/* ===================================================================
   The Cakery POS - Customer App Logic
   =================================================================== */

const STATE = {
  table: null,
  cart: [],
  orders: [],          // customer's own orders (local cache)
  selectedCategory: 'all',
  searchQuery: ''
};

const DOM = {
  tableBadge:   document.getElementById('tableBadge'),
  trackBtn:     document.getElementById('trackBtn'),
  activeBadge:  document.getElementById('activeBadge'),
  cartBtn:      document.getElementById('cartBtn'),
  cartCount:    document.getElementById('cartCount'),
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
  // 1. Detect table from URL (?table=5)
  const urlParams = new URLSearchParams(window.location.search);
  const tableFromURL = urlParams.get('table');

  if (!tableFromURL) {
    // No table in URL → show the table picker (demo-friendly:
    // lets you preview the customer app by just opening index.html)
    showTablePicker();
    return;
  }

  STATE.table = parseInt(tableFromURL);
  startApp();
}

// Show a modal asking which table the customer is sitting at
function showTablePicker() {
  const saved = localStorage.getItem('cakery_last_table');
  let picked = saved || '';
  const modal = document.createElement('div');
  modal.className = 'modal open';
  modal.id = 'tablePickerModal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-card">
      <div class="modal-eyebrow">Table</div>
      <h3 class="modal-title">Where are you sitting?</h3>
      <p class="modal-text" style="margin-bottom:16px;">Enter your table number to start ordering.</p>
      <input type="number" id="tablePickerInput" min="1" max="50" value="${picked}">
      <button class="modal-btn" id="tablePickerGo" style="width:100%;">Start Ordering</button>
    </div>
  `;
  document.body.appendChild(modal);
  const input = modal.querySelector('#tablePickerInput');
  const go = () => {
    const n = parseInt(input.value);
    if (!n || n < 1 || n > 50) { input.style.borderColor = '#dc2626'; input.focus(); return; }
    localStorage.setItem('cakery_last_table', String(n));
    window.location.href = 'index.html?table=' + n;
  };
  modal.querySelector('#tablePickerGo').addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  setTimeout(() => input.focus(), 100);
}

// Boot the app once we know the table number
async function startApp() {
  if (DOM.tableBadge) {
    DOM.tableBadge.style.display = 'inline-flex';
    DOM.tableBadge.innerHTML = 'Table ' + STATE.table;
  }

  // 2. Load saved cart & orders from localStorage
  const saved = loadTableState(STATE.table);
  if (saved) {
    STATE.cart = saved.cart || [];
    STATE.orders = saved.orders || [];
  }

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
      el.textContent = b.logoEmoji || '🧁';
    }
  });
  document.querySelectorAll('[data-brand-name]').forEach(el => {
    el.style.display = b.logoUrl ? 'none' : '';
    el.textContent = b.brandName || 'The Cakery';
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
      : '<div class="menu-card-image">' + escapeHTML(item.emoji || '🍽️') + '</div>';
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
  const totals = calcCartTotals(STATE.cart);
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
      DOM.praLabel.textContent = (info.praLabel || 'PRA Punjab Tax') + ' (' + info.praRatePct + '%)';
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
  if (!STATE.table) {
    showToast('No table selected. Please scan the QR code again.', 'error');
    return;
  }

  const orderNumber = generateOrderNumber();
  const totals = calcCartTotals(STATE.cart);
  const instructions = DOM.instructions ? DOM.instructions.value.trim() : '';

  // Build payload — match the schema in sql/schema.sql
  const payload = {
    order_number: orderNumber,
    table_number: STATE.table,
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
function handleOrderUpdate(payload) {
  const updated = payload.new;
  const order = STATE.orders.find(o => o.id === updated.id);
  if (!order) return;
  const oldStatus = order.status;
  order.status = updated.status;
  order.updated_at = updated.updated_at;
  saveState();

  // Show toast for meaningful changes
  if (oldStatus !== updated.status) {
    const msgs = {
      accepted: 'Order #' + order.order_number + ' is being prepared',
      ready:    'Order #' + order.order_number + ' is ready',
      served:   'Order #' + order.order_number + ' served',
      rejected:  'Order #' + order.order_number + ' was rejected'
    };
    if (msgs[updated.status]) showToast(msgs[updated.status], updated.status === 'rejected' ? 'error' : 'success', 4000);
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
              : `<span style="color:var(--text-muted);font-weight:600;font-size:0.9rem;">Table ${order.table_number}</span>`}
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
  DOM.closeCart.addEventListener('click', closeCart);
  DOM.cartOverlay.addEventListener('click', closeCart);

  // Place order
  DOM.placeOrderBtn.addEventListener('click', placeOrder);

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
