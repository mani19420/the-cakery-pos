/* ===================================================================
   The Cakery POS - Customer App Logic
   =================================================================== */

const STATE = {
  table: null,
  cart: [],
  orders: [],          // customer's own orders (local cache)
  selectedCategory: 'all',
  searchQuery: '',
  orderType: 'dine_in',     // 'dine_in' or 'takeaway'
  paymentMethod: 'cash'     // 'cash' or 'card'
};

const DOM = {
  tableBadge:   document.getElementById('tableBadge'),
  trackBtn:     document.getElementById('trackBtn'),
  activeBadge:  document.getElementById('activeBadge'),
  cartBtn:      document.getElementById('cartBtn'),
  cartCount:    document.getElementById('cartCount'),
  floatCartBtn: document.getElementById('floatCartBtn'),
  floatCartCount: document.getElementById('floatCartCount'),
  cartSidebar:  document.getElementById('cartSidebar'),
  cartOverlay:  document.getElementById('cartOverlay'),
  closeCart:    document.getElementById('closeCart'),
  cartItems:    document.getElementById('cartItems'),
  cartEmpty:    document.getElementById('cartEmpty'),
  cartSummary:  document.getElementById('cartSummary'),
  subtotal:     document.getElementById('subtotal'),
  tax:          document.getElementById('tax'),
  fbrRow:       document.getElementById('fbrRow'),
  praRow:       document.getElementById('praRow'),
  fbrLabel:     document.getElementById('fbrLabel'),
  praLabel:     document.getElementById('praLabel'),
  fbrTax:       document.getElementById('fbrTax'),
  praTax:       document.getElementById('praTax'),
  total:        document.getElementById('total'),
  instructions: document.getElementById('instructions'),
  placeOrderBtn:document.getElementById('placeOrderBtn'),
  categoryTabs: document.getElementById('categoryTabs'),
  searchInput:  document.getElementById('searchInput'),
  menuGrid:     document.getElementById('menuGrid'),
  noResults:    document.getElementById('noResults'),
  successModal: document.getElementById('successModal'),
  orderNumDisplay: document.getElementById('orderNumDisplay'),
  ordersModal:  document.getElementById('ordersModal'),
  ordersList:   document.getElementById('ordersList')
};

// ----------------------------------------------------------------
// INIT
// ----------------------------------------------------------------
function init() {
  // The customer reaches this page by scanning the table QR code,
  // which opens index.html?table=N. We go straight to the menu in
  // Dine In mode for that table — no "Start Order" picker needed.
  //
  // Robustness (v9): the menu ALWAYS opens, even if the QR/URL is
  // missing or mangled — we accept ?table=N / ?t=N / #table=N, we
  // extract digits from junky values ("3/", "table-3"), and if we
  // still can't find a table we fall back to the last used table or
  // show a small non-blocking picker ON TOP of the already-rendered
  // menu. A blank page behind a picker is the #1 "QR scan doesn't
  // open the menu" complaint.
  const urlParams = new URLSearchParams(window.location.search);
  let rawTable = urlParams.get('table') || urlParams.get('t');
  if (!rawTable && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    rawTable = hashParams.get('table') || hashParams.get('t');
  }

  let tableNum = null;
  if (rawTable) {
    const m = String(rawTable).match(/\d+/);   // tolerate junk around the number
    if (m) tableNum = parseInt(m[0]);
  }

  if (tableNum && tableNum >= 1 && tableNum <= 999) {
    STATE.table = tableNum;
    STATE.orderType = 'dine_in';
    startApp();
    return;
  }

  // No usable table in the URL — still open the menu immediately,
  // then ask for the table number on top (non-blocking).
  const savedTable = parseInt(localStorage.getItem('cakery_last_table'));
  if (savedTable && savedTable >= 1 && savedTable <= 999) {
    STATE.table = savedTable;
    STATE.orderType = 'dine_in';
    startApp();
    return;
  }
  startApp().then(() => showTablePicker());
}

// Show a non-blocking modal asking which table the customer is sitting at.
// Dine In only — Take Away was removed in v7. The menu is already visible
// behind this modal; the customer can still browse while choosing.
function showTablePicker() {
  if (document.getElementById('tablePickerModal')) return; // already open
  const saved = localStorage.getItem('cakery_last_table');
  let picked = saved || '';
  const modal = document.createElement('div');
  modal.className = 'modal open';
  modal.id = 'tablePickerModal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="modal-eyebrow">Dine In</div>
      <h3 class="modal-title">What's your table number?</h3>
      <p class="modal-text" style="margin-bottom:16px;">Scan the QR code on your table, or enter your table number below to start ordering.</p>

      <label for="tablePickerInput" style="font-size:0.78rem;color:var(--text-muted);font-weight:600;display:block;margin-bottom:6px;">TABLE NUMBER</label>
      <input type="number" id="tablePickerInput" min="1" max="999" value="${picked}">

      <button class="modal-btn" id="tablePickerGo" style="width:100%;margin-top:14px;">Start Ordering</button>
    </div>
  `;
  document.body.appendChild(modal);

  const input = modal.querySelector('#tablePickerInput');
  const goBtn = modal.querySelector('#tablePickerGo');

  const go = () => {
    const n = parseInt(input.value);
    if (!n || n < 1 || n > 999) { input.style.borderColor = '#dc2626'; input.focus(); return; }
    localStorage.setItem('cakery_last_table', String(n));
    STATE.table = n;
    STATE.orderType = 'dine_in';
    // Reload cart/orders for the new table without a full page reload.
    const saved = loadTableState(n);
    STATE.cart = saved ? (saved.cart || []) : [];
    STATE.orders = saved ? (saved.orders || []) : [];
    updateCart();
    saveState();
    updateActiveBadge();
    if (DOM.tableBadge) {
      DOM.tableBadge.style.display = 'inline-flex';
      DOM.tableBadge.innerHTML = 'Table ' + n;
    }
    modal.remove();
    // Track this table's pending orders.
    STATE.orders.forEach(o => {
      if (o.status !== 'served' && o.status !== 'rejected') {
        subscribeToOrder(o.id, handleOrderUpdate);
      }
    });
    showToast('Table ' + n + ' selected — happy ordering!', 'success', 2500);
  };
  goBtn.addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  setTimeout(() => input.focus(), 100);
}

// Boot the app once we know the table number (Dine In only — Take Away removed in v7)
async function startApp() {
  // Show the table badge for Dine In.
  if (DOM.tableBadge && STATE.table) {
    DOM.tableBadge.style.display = 'inline-flex';
    DOM.tableBadge.innerHTML = 'Table ' + STATE.table;
  }

  // 2. Load saved cart & orders from localStorage (keyed by table number)
  const storageKey = STATE.table;
  if (storageKey) {
    const saved = loadTableState(storageKey);
    if (saved) {
      STATE.cart = saved.cart || [];
      STATE.orders = saved.orders || [];
    }
  }

  // v9: prune finished orders. Once an order is served (or rejected),
  // the customer has already got their "served" alert — the old order
  // details should NOT stay visible in "Orders" or in the badge. The
  // record itself lives on in the database / admin panel.
  const beforePrune = STATE.orders.length;
  STATE.orders = STATE.orders.filter(o =>
    o.status !== 'served' && o.status !== 'rejected'
  );
  if (STATE.orders.length !== beforePrune) saveState();

  // Sync the cart payment-method buttons with the current STATE
  document.querySelectorAll('[data-payment-method]').forEach(b => {
    b.classList.toggle('active', b.dataset.paymentMethod === STATE.paymentMethod);
  });

  // 2b. Load menu + brand + tax from Supabase (or cache/fallback)
  await Promise.all([loadMenu(), loadBrand(), loadTaxSettings()]);
  applyBrandToUI();

  // 3. Render UI
  renderCategories();
  renderMenu();
  updateCart();

  // 4. Setup listeners
  setupEventListeners();

  // 5. Subscribe to each order's realtime updates
  STATE.orders.forEach(o => {
    if (o.status !== 'served' && o.status !== 'rejected') {
      subscribeToOrder(o.id, handleOrderUpdate);
    }
  });

  // 5b. Polling safety net: realtime events can be missed (phone asleep,
  // tab reloaded, brief disconnect). Check active orders every few
  // seconds so the customer still gets their chime + popup.
  startStatusPolling();

  // 6. Update active badge
  updateActiveBadge();

  // 7. Icons
  if (window.lucide) lucide.createIcons();

  // 8. Inform about demo mode (Supabase not configured)
  if (!isSupabaseReady()) {
    setTimeout(() => {
      showToast('Demo mode — orders are saved in this browser only', 'info', 4000);
    }, 1500);
  }

  // 9. Live menu + brand + tax updates (admin changes appear instantly)
  subscribeMenu(() => renderMenu());
  subscribeBrand(() => { applyBrandToUI(); renderMenu(); });
  subscribeTax(() => updateCart());
}

// Monogram initials for items without a photo (e.g. "Iced Latte" -> "IL")
function initialsOf(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(w => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || 'TC';
}

// Apply brand settings to the UI (name, logo, tagline)
function applyBrandToUI() {
  const b = getBrand();
  document.title = (b.brandName || 'The Cakery') + ' — ' + (b.tagline || 'Order From Your Table');
  // Logo / emoji + brand name (if logo is a real image, it usually contains
  // the brand wordmark, so we hide the duplicate text label).
  document.querySelectorAll('[data-brand-logo]').forEach(el => {
    if (b.logoUrl) {
      el.innerHTML = '<img src="' + escapeHTML(b.logoUrl) + '" alt="logo">';
    } else {
      el.textContent = ''; // B&W redesign: wordmark only, no emoji mark
    }
  });
  document.querySelectorAll('[data-brand-name]').forEach(el => {
    el.style.display = b.logoUrl ? 'none' : '';
    // Preserve the accent on the last word ("Cakery") if the brand name is
    // the default; otherwise render the full stored name plainly.
    const name = b.brandName || 'The Cakery';
    if (name === 'The Cakery' && el.dataset.brandName === '') {
      el.innerHTML = 'The <span class="brand-accent">Cakery</span>';
    } else {
      el.textContent = name;
    }
  });
  // Tagline / subtitle
  document.querySelectorAll('[data-brand-tagline]').forEach(el => { el.textContent = b.tagline || ''; });
}

// ----------------------------------------------------------------
// RENDER: Categories
// ----------------------------------------------------------------
function renderCategories() {
  if (!DOM.categoryTabs) return;
  DOM.categoryTabs.innerHTML = CATEGORIES.map(c => `
    <button class="cat-tab ${c.id === STATE.selectedCategory ? 'active' : ''}"
            data-cat="${c.id}">${c.name}</button>
  `).join('');
}

// ----------------------------------------------------------------
// RENDER: Menu
// ----------------------------------------------------------------
function renderMenu() {
  let items = getMenu().filter(i => i.available !== false);

  // v9: respect the admin's drag & drop order (sort_order). getMenu()
  // already sorts by sort_order when reading from Supabase, but the
  // cache/fallback paths may not — sort defensively here too.
  items = items.slice().sort((a, b) => {
    const sa = Number(a.sortOrder != null ? a.sortOrder : 9999);
    const sb = Number(b.sortOrder != null ? b.sortOrder : 9999);
    if (sa !== sb) return sa - sb;
    return 0; // keep the underlying (name) order for equal sort values
  });

  if (STATE.selectedCategory !== 'all') {
    items = items.filter(i => i.category === STATE.selectedCategory);
  }
  if (STATE.searchQuery) {
    const q = STATE.searchQuery.toLowerCase();
    items = items.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.desc.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  }

  if (items.length === 0) {
    DOM.menuGrid.innerHTML = '';
    DOM.noResults.classList.remove('hidden');
    return;
  }
  DOM.noResults.classList.add('hidden');

  DOM.menuGrid.innerHTML = items.map(item => {
    const imgBlock = item.imageUrl
      ? '<div class="menu-card-image"><img src="' + escapeHTML(item.imageUrl) + '" alt="' + escapeHTML(item.name) + '"></div>'
      : '<div class="menu-card-image menu-card-image--text">' + escapeHTML(initialsOf(item.name)) + '</div>';
    const priceBlock = item.originalPrice
      ? '<span class="menu-card-price"><span class="orig">' + formatPrice(item.originalPrice) + '</span> ' + formatPrice(item.price) + '</span>'
      : '<span class="menu-card-price">' + formatPrice(item.price) + '</span>';
    return `
    <div class="menu-card" data-id="${item.id}">
      ${imgBlock}
      <div class="menu-card-name">${escapeHTML(item.name)}${item.popular ? '<span class="menu-card-popular">Popular</span>' : ''}</div>
      <div class="menu-card-desc">${escapeHTML(item.desc)}</div>
      <div class="menu-card-footer">
        ${priceBlock}
        <button class="btn-add" data-add="${item.id}">Add</button>
      </div>
    </div>`;
  }).join('');

  if (window.lucide) lucide.createIcons();
  refreshAddButtons();
}

// ----------------------------------------------------------------
// ADD BUTTONS — show what's already in the cart ("Add · 2")
// ----------------------------------------------------------------
// The customer should see at a glance how many of each item they've
// taken without opening the cart. Updates buttons in place (no full
// menu re-render, so scroll position is preserved).
function refreshAddButtons() {
  document.querySelectorAll('.btn-add[data-add]').forEach(btn => {
    const item = STATE.cart.find(i => i.id === btn.dataset.add);
    const qty = item ? item.qty : 0;
    btn.classList.toggle('added', qty > 0);
    btn.textContent = qty > 0 ? 'Add · ' + qty : 'Add';
  });
}

// ----------------------------------------------------------------
// CART
// ----------------------------------------------------------------
function addToCart(itemId) {
  const item = getMenu().find(i => i.id === itemId);
  if (!item) return;
  const existing = STATE.cart.find(i => i.id === itemId);
  if (existing) existing.qty++;
  else STATE.cart.push({ ...item, qty: 1 });
  updateCart();
  saveState();
  showToast(item.name + ' added to cart', 'success', 1500);
  animateCartIcon();
}

function updateQty(itemId, change) {
  const item = STATE.cart.find(i => i.id === itemId);
  if (!item) return;
  item.qty += change;
  if (item.qty <= 0) {
    STATE.cart = STATE.cart.filter(i => i.id !== itemId);
  }
  updateCart();
  saveState();
}

function updateCart() {
  const totalItems = STATE.cart.reduce((s, i) => s + i.qty, 0);
  if (DOM.cartCount) {
    DOM.cartCount.textContent = totalItems;
    DOM.cartCount.classList.toggle('hidden', totalItems === 0);
  }
  // Floating cart button (v12): keep its badge in sync too, so the
  // count updates immediately from anywhere on the page.
  if (DOM.floatCartCount) {
    DOM.floatCartCount.textContent = totalItems;
    DOM.floatCartCount.classList.toggle('hidden', totalItems === 0);
  }
  // Keep the per-card ADD buttons in sync ("Add · 2") with the cart.
  refreshAddButtons();
  // Pass the chosen payment method so PRA uses the right rate (cash 16% / card 8%).
  const totals = calcCartTotals(STATE.cart, STATE.paymentMethod);
  const info = totals.taxInfo || (typeof getTaxSettings === 'function' ? getTaxSettings() : null);

  if (DOM.subtotal) DOM.subtotal.textContent = formatPrice(totals.subtotal);
  if (DOM.total)    DOM.total.textContent    = formatPrice(totals.total);

  // Dual tax rows (FBR + PRA)
  if (DOM.fbrRow && DOM.fbrTax && DOM.fbrLabel) {
    const showFbr = info && info.fbrEnabled && totals.fbrTax > 0;
    DOM.fbrRow.style.display = showFbr ? 'flex' : 'none';
    if (showFbr) {
      DOM.fbrLabel.textContent = (info.fbrLabel || 'FBR Sales Tax') + ' (' + info.fbrRatePct + '%)';
      DOM.fbrTax.textContent = formatPrice(totals.fbrTax);
    }
  }
  if (DOM.praRow && DOM.praTax && DOM.praLabel) {
    const showPra = info && info.praEnabled && totals.praTax > 0;
    DOM.praRow.style.display = showPra ? 'flex' : 'none';
    if (showPra) {
      // Show the rate that actually applies to the selected payment method.
      const pmLabel = STATE.paymentMethod === 'card' ? 'Card' : 'Cash';
      const ratePct = totals.praRatePct != null ? totals.praRatePct : info.praRatePct;
      DOM.praLabel.textContent = (info.praLabel || 'PRA Punjab Tax') + ' (' + ratePct + '% · ' + pmLabel + ')';
      DOM.praTax.textContent = formatPrice(totals.praTax);
    }
  }

  const isEmpty = STATE.cart.length === 0;
  if (DOM.cartEmpty)  DOM.cartEmpty.style.display  = isEmpty ? 'flex' : 'none';
  if (DOM.cartSummary) DOM.cartSummary.style.display = isEmpty ? 'none' : 'block';
  if (DOM.cartItems)  DOM.cartItems.innerHTML = isEmpty ? '' : STATE.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHTML(item.name)}</div>
        <div class="cart-item-price">${formatPrice(item.price)} each</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" data-qty="${item.id}" data-change="-1">−</button>
        <span class="qty-val">${item.qty}</span>
        <button class="qty-btn" data-qty="${item.id}" data-change="1">+</button>
      </div>
    </div>
  `).join('');
}

function animateCartIcon() {
  if (DOM.cartCount) {
    DOM.cartCount.style.transform = 'scale(1.4)';
    setTimeout(() => { DOM.cartCount.style.transform = ''; }, 200);
  }
  // Floating cart button (v12): replay the pop/nudge animations for
  // immediate visual feedback on every add-to-cart.
  if (DOM.floatCartCount && !DOM.floatCartCount.classList.contains('hidden')) {
    DOM.floatCartCount.classList.remove('pop');
    void DOM.floatCartCount.offsetWidth;   // force reflow so the animation restarts
    DOM.floatCartCount.classList.add('pop');
  }
  if (DOM.floatCartBtn) {
    DOM.floatCartBtn.classList.remove('nudge');
    void DOM.floatCartBtn.offsetWidth;
    DOM.floatCartBtn.classList.add('nudge');
  }
}

function openCart() {
  DOM.cartSidebar.classList.add('open');
  DOM.cartOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  DOM.cartSidebar.classList.remove('open');
  DOM.cartOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ----------------------------------------------------------------
// PLACE ORDER
// ----------------------------------------------------------------
async function placeOrder() {
  if (STATE.cart.length === 0) {
    showToast('Your cart is empty!', 'warning');
    return;
  }
  // Dine In requires a table number; Take Away does not.
  if (STATE.orderType === 'dine_in' && !STATE.table) {
    showToast('No table selected. Please scan the QR code again or switch to Take Away.', 'error');
    return;
  }
  // Defensive: ensure a payment method is selected (order type is always Dine In).
  if (!STATE.paymentMethod) {
    showToast('Please choose your payment method.', 'warning');
    return;
  }

  const orderNumber = generateOrderNumber();
  const totals = calcCartTotals(STATE.cart, STATE.paymentMethod);
  const instructions = DOM.instructions ? DOM.instructions.value.trim() : '';

  // Build payload — match the schema in sql/schema.sql
  // (Order type is always Dine In now — Take Away removed in v7)
  const payload = {
    order_number: orderNumber,
    table_number: STATE.table || 0,
    order_type: 'dine_in',
    payment_method: STATE.paymentMethod,
    items: STATE.cart.map(i => ({
      id: i.id, name: i.name, price: i.price, qty: i.qty, emoji: i.emoji,
      category: i.category || ''
    })),
    subtotal: totals.subtotal,
    tax: totals.tax,
    fbr_tax: totals.fbrTax || 0,
    pra_tax: totals.praTax || 0,
    total: totals.total,
    instructions: instructions,
    status: 'received',
    customer_note: ''
  };

  // Disable button to prevent double-submit
  DOM.placeOrderBtn.disabled = true;
  DOM.placeOrderBtn.textContent = 'Sending...';

  const result = await insertOrder(payload);

  if (result.success) {
    // Use the DB id as the local id for tracking
    const savedOrder = {
      id: result.order.id,
      order_number: result.order.order_number,
      table_number: result.order.table_number,
      order_type: result.order.order_type || STATE.orderType,
      payment_method: result.order.payment_method || STATE.paymentMethod,
      items: result.order.items,
      subtotal: result.order.subtotal,
      tax: result.order.tax,
      fbr_tax: result.order.fbr_tax || 0,
      pra_tax: result.order.pra_tax || 0,
      total: result.order.total,
      instructions: result.order.instructions,
      status: result.order.status,
      created_at: result.order.created_at
    };
    STATE.orders.unshift(savedOrder);
    saveState();

    // Clear cart
    STATE.cart = [];
    if (DOM.instructions) DOM.instructions.value = '';
    updateCart();
    closeCart();

    // Subscribe to live updates
    subscribeToOrder(savedOrder.id, handleOrderUpdate);

    // Show success
    DOM.orderNumDisplay.textContent = savedOrder.order_number;
    DOM.successModal.classList.add('open');

    updateActiveBadge();
  } else {
    showToast('Order failed: ' + result.error, 'error', 5000);
    // Local fallback so customer still sees their order
    const localOrder = {
      id: 'local-' + Date.now(),
      order_number: orderNumber,
      table_number: STATE.table,
      items: payload.items,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      instructions: instructions,
      status: 'received',
      created_at: new Date().toISOString(),
      _local: true
    };
    STATE.orders.unshift(localOrder);
    saveState();
    DOM.orderNumDisplay.textContent = orderNumber;
    DOM.successModal.classList.add('open');
    updateActiveBadge();
  }

  DOM.placeOrderBtn.disabled = false;
  DOM.placeOrderBtn.textContent = 'Place Order';
}

// ----------------------------------------------------------------
// REALTIME ORDER UPDATES
// ----------------------------------------------------------------

// ---- Notification tone (Web Audio — no audio files needed) ----
let _audioCtx = null;
function _ensureAudio() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  } catch (e) { return null; }
}
// Browsers block sound until the user interacts once — unlock on the
// first tap so the chime works later when the kitchen accepts.
document.addEventListener('pointerdown', () => { _ensureAudio(); }, { once: true, capture: true });

// Short chime when the kitchen moves the order to the next stage.
// Each stage gets its own melody so regulars recognise it by ear.
function playOrderTone(status) {
  const ctx = _ensureAudio();
  const patterns = {
    accepted: [[660, 0, 130], [880, 160, 200]],                     // rising two-tone
    ready:    [[523, 0, 130], [659, 150, 130], [784, 300, 260]],    // C-E-G chime
    served:   [[784, 0, 150], [988, 180, 320]],                     // happy finish
    rejected: [[330, 0, 220], [247, 240, 340]]                      // falling low
  };
  const notes = patterns[status];
  if (ctx && notes) {
    try {
      notes.forEach(([freq, delay, dur]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const t0 = ctx.currentTime + delay / 1000;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / 1000);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur / 1000 + 0.05);
      });
    } catch (e) {}
  }
  // Phone vibration (best effort — ignored where unsupported)
  try {
    const vibes = {
      accepted: [120, 80, 120],
      ready:    [150, 70, 150, 70, 220],
      served:   [220, 100, 320],
      rejected: [320]
    };
    if (navigator.vibrate && vibes[status]) navigator.vibrate(vibes[status]);
  } catch (e) {}
}

// ---- Status popup — tells the customer which stage the order is at ----
const STATUS_META = {
  accepted: { eyebrow: 'Good news', title: 'Order is being prepared', sub: 'The kitchen has accepted your order' },
  ready:    { eyebrow: 'Ready',     title: 'Your order is ready!',     sub: 'Please collect it from the counter' },
  served:   { eyebrow: 'Served',    title: 'Order served — enjoy!',    sub: 'Your order has been brought to your table' },
  rejected: { eyebrow: 'Sorry',     title: 'Order was rejected',       sub: 'Please speak to our staff for details' }
};

function showStatusPopup(order) {
  const meta = STATUS_META[order.status];
  if (!meta) return;
  const old = document.getElementById('statusPopupModal');
  if (old) old.remove();

  const stepIdx = { received: 0, accepted: 1, ready: 2, served: 3 }[order.status] ?? 0;
  const labels = ['Received', 'Preparing', 'Ready', 'Served'];
  const isRejected = order.status === 'rejected';

  const modal = document.createElement('div');
  modal.className = 'modal open';
  modal.id = 'statusPopupModal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card status-popup-card">
      <div class="modal-eyebrow">${meta.eyebrow}</div>
      <div class="modal-order-num" style="margin-bottom:4px;">#${escapeHTML(order.order_number)}</div>
      <h3 class="status-popup-title">${meta.title}</h3>
      <p class="modal-text">${meta.sub}</p>
      ${!isRejected ? `
      <div class="status-steps" style="margin:18px 0 6px;">
        <div class="status-line"><div class="status-line-fill" style="width:${(stepIdx / 3) * 100}%"></div></div>
        ${labels.map((label, idx) => `
          <div class="status-step ${idx < stepIdx ? 'done' : (idx === stepIdx ? 'active' : '')}">
            <div class="status-circle">${idx < stepIdx ? '✓' : idx + 1}</div>
            <span class="status-label">${label}</span>
          </div>`).join('')}
      </div>` : ''}
      <button class="modal-btn" onclick="this.closest('.modal').remove()">Okay</button>
    </div>
  `;
  modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
  document.body.appendChild(modal);
  // Auto-dismiss after 8s — the customer can also tap Okay / backdrop.
  setTimeout(() => {
    const m = document.getElementById('statusPopupModal');
    if (m) m.remove();
  }, 8000);
}

function handleOrderUpdate(payload) {
  const updated = payload.new;
  const order = STATE.orders.find(o => o.id === updated.id);
  if (!order) return;
  const oldStatus = order.status;
  order.status = updated.status;
  order.updated_at = updated.updated_at;

  // v9: once the order reaches the customer (served / rejected) and the
  // alert toast has fired, the order is removed from the customer's view
  // entirely. The full record stays in the database / POS history /
  // admin panel — the customer just doesn't need it anymore.
  if (updated.status === 'served' || updated.status === 'rejected') {
    // Fire the final alert first…
    const msgs = {
      served:  'Order #' + order.order_number + ' served — enjoy!',
      rejected: 'Order #' + order.order_number + ' was rejected'
    };
    if (msgs[updated.status] && oldStatus !== updated.status) {
      showToast(msgs[updated.status], updated.status === 'rejected' ? 'error' : 'success', 4000);
      playOrderTone(updated.status);
      showStatusPopup(order);
    }
    // …then drop it from the local list and persist.
    STATE.orders = STATE.orders.filter(o => o.id !== updated.id);
    saveState();
    updateActiveBadge();
    if (DOM.ordersModal.classList.contains('open')) renderOrdersList();
    return;
  }

  saveState();

  // Show toast for meaningful changes
  if (oldStatus !== updated.status) {
    const msgs = {
      accepted: 'Order #' + order.order_number + ' is being prepared',
      ready:    'Order #' + order.order_number + ' is ready'
    };
    if (msgs[updated.status]) showToast(msgs[updated.status], 'success', 4000);
    // Chime + popup: the customer hears AND sees that the order moved
    // to the next stage.
    playOrderTone(updated.status);
    showStatusPopup(order);
  }

  updateActiveBadge();
  // If orders modal is open, refresh
  if (DOM.ordersModal.classList.contains('open')) renderOrdersList();
}

function updateActiveBadge() {
  const count = STATE.orders.filter(o => o.status !== 'served' && o.status !== 'rejected').length;
  if (DOM.activeBadge) {
    DOM.activeBadge.textContent = count;
    DOM.activeBadge.classList.toggle('hidden', count === 0);
  }
}

// ----------------------------------------------------------------
// STATUS POLLING (safety net for missed realtime events)
// ----------------------------------------------------------------
let _pollTimer = null;
function startStatusPolling() {
  if (_pollTimer) return;   // already running
  _pollTimer = setInterval(async () => {
    const active = STATE.orders.filter(o => o.status !== 'served' && o.status !== 'rejected');
    for (const o of active) {
      try {
        const rec = await fetchOrderById(o.id);
        if (rec && rec.status && rec.status !== o.status) {
          handleOrderUpdate({ eventType: 'UPDATE', new: rec });
        }
      } catch (e) {}   // network hiccup — next tick will retry
    }
  }, 4000);
}

// ----------------------------------------------------------------
// ORDERS LIST MODAL
// ----------------------------------------------------------------
function renderOrdersList() {
  if (STATE.orders.length === 0) {
    DOM.ordersList.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <p>No orders yet.</p>
      </div>`;
    return;
  }
  DOM.ordersList.innerHTML = STATE.orders.map(order => {
    const stepIdx = { received: 0, accepted: 1, ready: 2, served: 3 }[order.status] ?? 0;
    const labels = ['Received', 'Preparing', 'Ready', 'Served'];
    const isRejected = order.status === 'rejected';
    const otLabel = order.order_type === 'takeaway' ? 'Take Away' : 'Dine In';
    const pmLabel = order.payment_method === 'card' ? 'Card' : 'Cash';
    const tableLabel = (order.order_type === 'takeaway' || !order.table_number || order.table_number === 0)
      ? otLabel
      : 'Table ' + order.table_number;
    return `
      <div class="track-card">
        <div class="track-header">
          <div>
            <div class="track-order-id">#${escapeHTML(order.order_number)}</div>
            <div class="track-time">${formatDateTime(order.created_at)}</div>
          </div>
          <div style="text-align:right;">
            ${isRejected
              ? '<span style="color:var(--danger);font-weight:600;font-size:0.9rem;">Rejected</span>'
              : `<div style="font-weight:600;font-size:0.9rem;">${tableLabel}</div>
                 <div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;">${pmLabel}</div>`}
          </div>
        </div>
        ${!isRejected ? `
          <div class="status-steps">
            <div class="status-line"><div class="status-line-fill" style="width:${(stepIdx/3)*100}%"></div></div>
            ${labels.map((label, idx) => `
              <div class="status-step ${idx < stepIdx ? 'done' : (idx === stepIdx ? 'active' : '')}">
                <div class="status-circle">${idx < stepIdx ? '✓' : idx + 1}</div>
                <span class="status-label">${label}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="track-items">
          ${order.items.map(item => `
            <div class="track-item-row">
              <span>${escapeHTML(item.name)} × ${item.qty}</span>
              <span>${formatPrice(item.price * item.qty)}</span>
            </div>
          `).join('')}
          ${order.instructions ? `<div style="margin-top:8px;font-size:0.82rem;color:var(--text-muted);font-style:italic;">Note: "${escapeHTML(order.instructions)}"</div>` : ''}
          <div class="track-total">
            <span>Total</span>
            <span>${formatPrice(order.total)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------------------
// SAVE / LOAD
// ----------------------------------------------------------------
function saveState() {
  saveTableState(STATE.table, { cart: STATE.cart, orders: STATE.orders });
}

// ----------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------
function setupEventListeners() {
  // Cart open/close
  DOM.cartBtn.addEventListener('click', openCart);
  if (DOM.floatCartBtn) DOM.floatCartBtn.addEventListener('click', openCart);
  DOM.closeCart.addEventListener('click', closeCart);
  DOM.cartOverlay.addEventListener('click', closeCart);

  // Place order
  DOM.placeOrderBtn.addEventListener('click', placeOrder);

  // Payment method choice buttons (event delegation) — Order Type is always
  // Dine In now (Take Away removed in v7), so no order-type buttons exist.
  document.addEventListener('click', (e) => {
    const pmBtn = e.target.closest('[data-payment-method]');
    if (pmBtn) {
      STATE.paymentMethod = pmBtn.dataset.paymentMethod;
      document.querySelectorAll('[data-payment-method]').forEach(b => b.classList.toggle('active', b === pmBtn));
      // PRA rate depends on payment method → recompute totals + label.
      updateCart();
      return;
    }
  });

  // Track / My Orders button
  DOM.trackBtn.addEventListener('click', () => {
    renderOrdersList();
    DOM.ordersModal.classList.add('open');
  });

  // Search input — typing resets to "All" category so results aren't filtered away
  DOM.searchInput.addEventListener('input', (e) => {
    STATE.searchQuery = e.target.value;
    if (STATE.searchQuery && STATE.selectedCategory !== 'all') {
      STATE.selectedCategory = 'all';
      renderCategories();
    }
    renderMenu();
  });

  // Event delegation for dynamic content
  document.addEventListener('click', (e) => {
    // Category tab click
    const catTab = e.target.closest('.cat-tab');
    if (catTab) {
      STATE.selectedCategory = catTab.dataset.cat;
      renderCategories();
      renderMenu();
      return;
    }
    // Add to cart from menu
    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      addToCart(addBtn.dataset.add);
      return;
    }
    // Quantity buttons in cart
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      updateQty(qtyBtn.dataset.qty, parseInt(qtyBtn.dataset.change));
      return;
    }
    // Modal backdrop click closes
    if (e.target.classList.contains('modal-backdrop')) {
      e.target.closest('.modal').classList.remove('open');
    }
  });

  // Close cart on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    }
  });
}

// ----------------------------------------------------------------
// GO
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', init);
