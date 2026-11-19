/* ===================================================================
   The Cakery POS - Dashboard Logic
   Receives orders in real time, shows popup, accept/reject, bill print
   =================================================================== */

const POS_CONFIG = {
  SESSION_KEY: 'cakery_pos_session',
  SESSION_MS: 8 * 60 * 60 * 1000  // 8 hours
};

const POS_STATE = {
  orders: [],
  servedOrders: [],
  searchQuery: '',
  soundEnabled: true,
  activeTab: 'stats',
  user: null   // { id, username, displayName, role } when logged in
};

// v9: orders that arrived while the POS tab was hidden — their popup is
// re-shown when staff returns to the tab.
const _pendingPopupOrders = new Set();

// Role permissions: which actions each role can perform on the POS
const ROLE_PERMS = {
  owner:    { accept: true, reject: true, ready: true, serve: true, bill: true, delete: true, edit: true },
  manager:  { accept: true, reject: true, ready: true, serve: true, bill: true, delete: true, edit: true },
  cashier:  { accept: true, reject: false, ready: true, serve: true, bill: true, delete: false, edit: true },
  waiter:   { accept: false, reject: false, ready: false, serve: false, bill: true, delete: false, edit: false }
};
function can(action) {
  if (!POS_STATE.user) return false;
  const perms = ROLE_PERMS[POS_STATE.user.role] || ROLE_PERMS.cashier;
  return !!perms[action];
}

const POS_DOM = {
  searchInput: document.getElementById('searchInput'),
  lists: {
    received: document.getElementById('list-received'),
    accepted: document.getElementById('list-accepted'),
    ready:    document.getElementById('list-ready')
  },
  counts: {
    received: document.getElementById('cnt-received'),
    accepted: document.getElementById('cnt-accepted'),
    ready:    document.getElementById('cnt-ready')
  },
  stats: {
    new:    document.getElementById('statNew'),
    prep:   document.getElementById('statPrep'),
    ready:  document.getElementById('statReady'),
    today:  document.getElementById('statToday')
  },
  connStatus: document.getElementById('connStatus'),
  connText:   document.getElementById('connText'),
  popupContainer: document.getElementById('popupContainer'),
  billModal:   document.getElementById('billModal'),
  billContent: document.getElementById('billContent'),
  printBillBtn:document.getElementById('printBillBtn'),
  sumTotalOrders: document.getElementById('sumTotalOrders'),
  sumRevenue:      document.getElementById('sumRevenue'),
  sumAvg:          document.getElementById('sumAvg'),
  sumTables:       document.getElementById('sumTables'),
  historyList:     document.getElementById('historyList'),
  // Login
  loginScreen: document.getElementById('posLoginScreen'),
  posApp:      document.getElementById('posApp'),
  loginForm:   document.getElementById('posLoginForm'),
  loginError: document.getElementById('posLoginError'),
  // User badge
  userBadgeName: document.getElementById('userBadgeName'),
  userBadgeRole: document.getElementById('userBadgeRole'),
  logoutBtn: document.getElementById('posLogoutBtn'),
  // Edit modal
  editModal:        document.getElementById('editOrderModal'),
  editOrderTitle:   document.getElementById('editOrderTitle'),
  editOrderMeta:    document.getElementById('editOrderMeta'),
  editItemsList:    document.getElementById('editItemsList'),
  editMenuList:     document.getElementById('editMenuList'),
  editMenuSearch:   document.getElementById('editMenuSearch'),
  editInstructions: document.getElementById('editInstructions'),
  editTotals:       document.getElementById('editTotals'),
  editSaveBtn:      document.getElementById('editSaveBtn')
};

// Track which order IDs we've already shown a popup for (so we don't repeat)
const SHOWN_POPUPS = new Set();

// ----------------------------------------------------------------
// INIT
// ----------------------------------------------------------------
async function init() {
  // POS login gate
  if (!isPosLoggedIn()) {
    showPosLogin();
    return;
  }
  await bootPos();
}

function isPosLoggedIn() {
  try {
    const raw = localStorage.getItem(POS_CONFIG.SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !s.ts || !s.user) return false;
    if (Date.now() - s.ts > POS_CONFIG.SESSION_MS) return false;
    POS_STATE.user = s.user;
    return true;
  } catch (e) { return false; }
}

function showPosLogin() {
  POS_DOM.loginScreen.style.display = 'flex';
  POS_DOM.posApp.hidden = true;
  setTimeout(() => document.getElementById('posLoginUser').focus(), 50);
}

function showPosApp() {
  POS_DOM.loginScreen.style.display = 'none';
  POS_DOM.posApp.hidden = false;
  // Update user badge
  POS_DOM.userBadgeName.textContent = POS_STATE.user.displayName;
  POS_DOM.userBadgeRole.textContent = POS_STATE.user.role;
  POS_DOM.userBadgeRole.className = 'user-role role-' + POS_STATE.user.role;
}

function posLogout() {
  localStorage.removeItem(POS_CONFIG.SESSION_KEY);
  POS_STATE.user = null;
  POS_STATE.orders = [];
  POS_STATE.servedOrders = [];
  location.reload();
}

// Handle login form submit
POS_DOM.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('posLoginUser').value;
  const password = document.getElementById('posLoginPass').value;
  POS_DOM.loginError.textContent = '';
  if (!isSupabaseReady()) {
    POS_DOM.loginError.textContent = 'Supabase not configured. Set it up first, then create users in the Admin Panel.';
    return;
  }
  try {
    const result = await verifyStaffLogin(username, password);
    if (!result.success) {
      // Friendly message when the staff_users table hasn't been created yet
      if (result.error && (result.error.includes('staff_users') || result.error.includes('PGRST205') || result.error.includes('schema cache'))) {
        POS_DOM.loginError.innerHTML = 'Staff login is not set up yet. Run <code>sql/migration-v4.sql</code> in your Supabase SQL Editor, then create a user in <a href="admin.html">Admin → Users</a>.';
      } else {
        POS_DOM.loginError.textContent = result.error || 'Login failed';
      }
      document.getElementById('posLoginPass').value = '';
      document.getElementById('posLoginPass').focus();
      return;
    }
    POS_STATE.user = result.user;
    localStorage.setItem(POS_CONFIG.SESSION_KEY, JSON.stringify({
      ts: Date.now(),
      user: result.user
    }));
    // v9: ask for desktop Notification permission right after login —
    // this is a user-gesture context, so the browser prompt is allowed.
    // Grants fire OS-level popups for new orders even when this POS tab
    // is in the background.
    _requestNotifyPermission();
    showPosApp();
    await bootPos();
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (msg.includes('staff_users') || msg.includes('PGRST205') || msg.includes('schema cache')) {
      POS_DOM.loginError.innerHTML = 'Staff login is not set up yet. Run <code>sql/migration-v4.sql</code> in your Supabase SQL Editor, then create a user in <a href="admin.html">Admin → Users</a>.';
    } else {
      POS_DOM.loginError.textContent = 'Login error: ' + msg;
    }
  }
});

POS_DOM.logoutBtn.addEventListener('click', posLogout);

// ----------------------------------------------------------------
// BOOT (after login)
// ----------------------------------------------------------------
async function bootPos() {
  setupEventListeners();
  setupEditModalListeners();

  // Load tax settings (for bill + edit totals rendering)
  if (typeof loadTaxSettings === 'function') {
    try { await loadTaxSettings(); } catch (e) {}
  }
  // Load menu (needed by the Edit Order modal to add items)
  if (typeof loadMenu === 'function') {
    try { await loadMenu(); } catch (e) {}
  }

  if (!isSupabaseReady()) {
    // DEMO MODE — no Supabase credentials: run on localStorage orders
    // (synced across open tabs via BroadcastChannel) so the whole
    // customer → POS flow can be previewed offline.
    setConnectionStatus(true, 'Demo mode');
    await loadAllOrders();
    subscribeToOrders(handleRealtimeEvent);
    setInterval(loadAllOrders, 10000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadAllOrders();
        replayPendingPopups();
      }
    });
    showToast('Demo mode — orders placed in another tab will appear here', 'info', 6000);
    if (window.lucide) lucide.createIcons();
    return;
  }

  setConnectionStatus(false, 'Loading orders…');

  // Initial fetch
  await loadAllOrders();

  // Realtime subscription
  subscribeToOrders(handleRealtimeEvent);

  // Background poll every 10s as a safety net (in case realtime drops)
  setInterval(loadAllOrders, 10000);

  setConnectionStatus(true, 'Live');

  // Visibility change → re-fetch on tab focus + re-show queued popups
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadAllOrders();
      replayPendingPopups();
    }
  });

  if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------------------
// LOAD ORDERS
// ----------------------------------------------------------------
async function loadAllOrders() {
  const [active, served] = await Promise.all([fetchActiveOrders(), fetchServedOrders(15)]);
  POS_STATE.orders = active;
  POS_STATE.servedOrders = served;
  renderDashboard();
}

// ----------------------------------------------------------------
// REALTIME HANDLER
// ----------------------------------------------------------------
function handleRealtimeEvent(payload) {
  const { eventType, new: newRec, old: oldRec } = payload;

  if (eventType === 'INSERT') {
    // Brand new order arrived!
    if (!POS_STATE.orders.find(o => o.id === newRec.id)) {
      POS_STATE.orders.unshift(newRec);
      showNewOrderPopup(newRec);
      playNotificationSound();
    }
  } else if (eventType === 'UPDATE') {
    // Status changed
    const idx = POS_STATE.orders.findIndex(o => o.id === newRec.id);
    // v9: if a NEW order arrives while this tab is hidden, the in-page
    // popup is easy to miss — queue it so it re-shows (plus title flash
    // + sound) the moment the staff comes back to the POS.
    if (document.visibilityState !== 'visible') {
      _pendingPopupOrders.add(newRec.id);
    }
    if (newRec.status === 'served' || newRec.status === 'rejected') {
      // Remove from active, add to history if served
      if (idx !== -1) POS_STATE.orders.splice(idx, 1);
      if (newRec.status === 'served') {
        POS_STATE.servedOrders.unshift(newRec);
        if (POS_STATE.servedOrders.length > 15) POS_STATE.servedOrders.pop();
      }
    } else {
      if (idx !== -1) POS_STATE.orders[idx] = newRec;
      else POS_STATE.orders.unshift(newRec);
    }
  } else if (eventType === 'DELETE') {
    POS_STATE.orders = POS_STATE.orders.filter(o => o.id !== oldRec.id);
  }
  renderDashboard();
}

// ----------------------------------------------------------------
// NEW ORDER POPUP (the highlight feature!)
// ----------------------------------------------------------------
// v9: the popup now fights for attention even if the POS is in a
// background tab / different window:
//   1. A desktop Notification pops on the OS level (if permission granted).
//   2. document.title flashes "NEW ORDER!" until staff returns.
//   3. On return (visibilitychange), the popup is guaranteed re-shown
//      for any order placed while the tab was hidden.
//   4. Sound plays regardless (browsers may throttle, but on focus it retries).
const _titleFlash = {
  timer: null,
  base: null,
  start() {
    if (this.timer) return;                 // already flashing
    this.base = this.base || document.title;
    let flip = false;
    this.timer = setInterval(() => {
      document.title = flip ? 'NEW ORDER! — ' + this.base : this.base;
      flip = !flip;
    }, 900);
  },
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.base) { document.title = this.base; }
  }
};

function _requestNotifyPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  } catch (e) {}
}

function _showDesktopNotification(order, itemCount) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const body = '#' + order.order_number + ' · Table ' + order.table_number +
                 ' · ' + itemCount + ' item' + (itemCount !== 1 ? 's' : '') +
                 ' · ' + formatPrice(order.total);
    const n = new Notification('New order — The Cakery', { body: body, tag: order.id, requireInteraction: false });
    n.onclick = () => { window.focus(); n.close(); };
  } catch (e) {}
}

function showNewOrderPopup(order) {
  // Avoid duplicates
  if (SHOWN_POPUPS.has(order.id)) return;
  SHOWN_POPUPS.add(order.id);

  const itemCount = Array.isArray(order.items) ? order.items.reduce((s, i) => s + i.qty, 0) : 0;

  // v9 attention stack — works even from a background tab:
  _showDesktopNotification(order, itemCount);
  _titleFlash.start();
  // Try to steal focus if the browser allows it (works when POS is in
  // another window/tab on the same machine; harmless otherwise).
  try { window.focus(); } catch (e) {}

  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.innerHTML = `
    <div class="popup-head">
      <div class="popup-title">New order</div>
      <button class="popup-close">&times;</button>
    </div>
    <div class="popup-body">
      <strong>#${escapeHTML(order.order_number)}</strong> · Table ${order.table_number}<br>
      <span style="color:var(--text-muted);">${itemCount} item${itemCount !== 1 ? 's' : ''} · ${formatPrice(order.total)}</span>
    </div>
    <div class="popup-actions">
      <button class="popup-btn view">View Order</button>
    </div>
  `;
  POS_DOM.popupContainer.appendChild(popup);

  // Stop flashing the title when staff actually looks at the POS.
  const stopFlash = () => _titleFlash.stop();
  document.addEventListener('visibilitychange', function onVis() {
    if (document.visibilityState === 'visible') {
      stopFlash();
      document.removeEventListener('visibilitychange', onVis);
      playNotificationSound();   // retry the bell once staff is back
    }
  });
  popup.addEventListener('click', stopFlash, { once: true });

  // Auto-dismiss after 12 seconds
  const dismissTimer = setTimeout(() => dismissPopup(popup), 12000);

  popup.querySelector('.popup-close').addEventListener('click', () => {
    clearTimeout(dismissTimer);
    stopFlash();
    dismissPopup(popup);
  });
  popup.querySelector('.popup-btn.view').addEventListener('click', () => {
    clearTimeout(dismissTimer);
    stopFlash();
    dismissPopup(popup);
    showBill(order);
  });
}

function dismissPopup(popup) {
  popup.classList.add('closing');
  setTimeout(() => popup.remove(), 300);
}

// Re-show popups for orders that arrived while the tab was hidden.
// Staff gets the full "New order!" popup + sound the moment they switch
// back to the POS, so nothing is ever missed.
function replayPendingPopups() {
  if (_pendingPopupOrders.size === 0) return;
  const ids = Array.from(_pendingPopupOrders);
  _pendingPopupOrders.clear();
  ids.forEach(id => {
    const order = POS_STATE.orders.find(o => o.id === id);
    if (order && order.status === 'received') {
      // Temporarily allow re-showing (SHOWN_POPUPS blocked the first one)
      SHOWN_POPUPS.delete(id);
      showNewOrderPopup(order);
    }
  });
  if (ids.length) playNotificationSound();
}

// ----------------------------------------------------------------
// NOTIFICATION SOUND (Web Audio API beep — no asset file needed)
// ----------------------------------------------------------------
function playNotificationSound() {
  if (!POS_STATE.soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    // Three rising beeps
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch (e) {
    // Silent fail
  }
}

// ----------------------------------------------------------------
// RENDER DASHBOARD
// ----------------------------------------------------------------
function renderDashboard() {
  let orders = POS_STATE.orders;

  // Search filter
  if (POS_STATE.searchQuery) {
    const q = POS_STATE.searchQuery.toLowerCase();
    orders = orders.filter(o => {
      const tableMatch = String(o.table_number).includes(q) ||
                         ('table ' + o.table_number).toLowerCase().includes(q);
      const orderMatch = String(o.order_number).toLowerCase().includes(q);
      let itemMatch = false;
      try {
        const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
        itemMatch = items.some(i => (i.name || '').toLowerCase().includes(q));
      } catch (e) {}
      return tableMatch || orderMatch || itemMatch;
    });
  }

  const groups = {
    received: orders.filter(o => o.status === 'received').sort(byCreatedAsc),
    accepted: orders.filter(o => o.status === 'accepted').sort(byCreatedAsc),
    ready:    orders.filter(o => o.status === 'ready').sort(byCreatedAsc)
  };

  Object.keys(groups).forEach(status => {
    const list = POS_DOM.lists[status];
    POS_DOM.counts[status].textContent = groups[status].length;
    if (groups[status].length === 0) {
      const empties = { received: 'No new orders', accepted: 'Nothing in progress', ready: 'Nothing ready' };
      list.innerHTML = `<div class="column-empty">${empties[status]}</div>`;
    } else {
      list.innerHTML = groups[status].map(o => createOrderCardHTML(o)).join('');
    }
  });

  // Top stat pills
  POS_DOM.stats.new.textContent   = groups.received.length;
  POS_DOM.stats.prep.textContent  = groups.accepted.length;
  POS_DOM.stats.ready.textContent = groups.ready.length;
  POS_DOM.stats.today.textContent = POS_STATE.orders.length + POS_STATE.servedOrders.length;

  // Sidebar stats
  renderSidebarStats();
  renderHistory();

  if (window.lucide) lucide.createIcons();
}

function byCreatedAsc(a, b) {
  return new Date(a.created_at) - new Date(b.created_at);
}

// ----------------------------------------------------------------
// ORDER CARD
// ----------------------------------------------------------------
function createOrderCardHTML(order) {
  const items = Array.isArray(order.items) ? order.items : (() => {
    try { return JSON.parse(order.items || '[]'); } catch (e) { return []; }
  })();
  const time = timeAgo(order.created_at);
  const minsAgo = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const timeClass = minsAgo >= 15 ? 'danger' : (minsAgo >= 10 ? 'warn' : '');

  let actions = '';
  // Role gating: waiters can only view/print bills. Cashier+ can accept/serve/edit.
  // Manager+ can reject. Owner+manager+cashier can mark ready.
  // Edit button is available for any active (non-served) order if role allows.
  const editBtn = (can('edit') && order.status !== 'served' && order.status !== 'rejected')
    ? `<button class="btn-action btn-edit" data-edit="${order.id}">Edit</button>`
    : '';
  if (order.status === 'received') {
    const acc = can('accept') ? `<button class="btn-action btn-accept" data-accept="${order.id}">Accept</button>` : '';
    const rej = can('reject') ? `<button class="btn-action btn-reject" data-reject="${order.id}">Reject</button>` : '';
    actions = `
      ${rej}
      ${acc}
      ${editBtn}
      <button class="btn-action btn-print" data-bill="${order.id}">Bill</button>
    `;
  } else if (order.status === 'accepted') {
    const rdy = can('ready') ? `<button class="btn-action btn-ready" data-ready="${order.id}">Mark Ready</button>` : '';
    actions = `
      ${editBtn}
      <button class="btn-action btn-print" data-bill="${order.id}">Bill</button>
      ${rdy}
    `;
  } else if (order.status === 'ready') {
    const srv = can('serve') ? `<button class="btn-action btn-serve" data-serve="${order.id}">Serve</button>` : '';
    actions = `
      ${editBtn}
      <button class="btn-action btn-print" data-bill="${order.id}">Bill</button>
      ${srv}
    `;
  } else if (order.status === 'served') {
    actions = `<span class="served-badge">Served</span>`;
  }

  return `
    <article class="order-card ${order.status === 'received' ? 'new' : ''}" data-id="${order.id}">
      <div class="order-card-head">
        <span class="order-num">#${escapeHTML(order.order_number)}</span>
        <span class="table-tag">${order.order_type === 'takeaway' ? 'Take Away' : (order.table_number && order.table_number !== 0 ? 'Table ' + order.table_number : 'Dine In')}</span>
      </div>
      <div class="order-time ${timeClass}">
        <i data-lucide="clock" style="width:12px;height:12px;"></i> ${time}
        <span class="pay-tag">${order.payment_method === 'card' ? 'Card' : 'Cash'}</span>
      </div>
      <div class="order-items">
        ${items.map(i => `
          <div class="order-item-row">
            <span class="order-item-name">${escapeHTML(i.name)}</span>
            <span class="order-item-qty">× ${i.qty}</span>
          </div>
        `).join('')}
      </div>
      ${order.instructions ? `<div class="order-instructions">"${escapeHTML(order.instructions)}"</div>` : ''}
      <div class="order-footer">
        <span class="order-total">${formatPrice(order.total)}</span>
        <div style="display:flex;gap:6px;">${actions}</div>
      </div>
    </article>
  `;
}

// ----------------------------------------------------------------
// SIDEBAR
// ----------------------------------------------------------------
function renderSidebarStats() {
  const allToday = [...POS_STATE.orders, ...POS_STATE.servedOrders];
  const totalOrders = allToday.length;
  const revenue = allToday.reduce((s, o) => s + (o.total || 0), 0);
  const avg = totalOrders > 0 ? Math.round(revenue / totalOrders) : 0;
  const tables = new Set(POS_STATE.orders.map(o => o.table_number)).size;

  POS_DOM.sumTotalOrders.textContent = totalOrders;
  POS_DOM.sumRevenue.textContent = formatPrice(revenue);
  POS_DOM.sumAvg.textContent = formatPrice(avg);
  POS_DOM.sumTables.textContent = tables;
}

function renderHistory() {
  if (POS_STATE.servedOrders.length === 0) {
    POS_DOM.historyList.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px 10px;font-size:0.82rem;">No served orders yet.</div>';
    return;
  }
  POS_DOM.historyList.innerHTML = POS_STATE.servedOrders.map(o => `
    <div class="history-card">
      <div class="h-head">
        <span class="h-num">#${escapeHTML(o.order_number)} · Table ${o.table_number}</span>
        <span class="h-time">${timeAgo(o.created_at)}</span>
      </div>
      <div class="h-total">${formatPrice(o.total)}</div>
    </div>
  `).join('');
}

// ----------------------------------------------------------------
// BILL MODAL
// ----------------------------------------------------------------
function showBill(order) {
  const items = Array.isArray(order.items) ? order.items : (() => {
    try { return JSON.parse(order.items || '[]'); } catch (e) { return []; }
  })();

  // Tax settings (cached) — used for the bill labels and fallback split
  let taxInfo = null;
  try { taxInfo = (typeof getTaxSettings === 'function') ? getTaxSettings() : null; } catch (e) {}

  // Determine the order's payment method (default to cash for legacy orders).
  const orderPaymentMethod = order.payment_method === 'card' ? 'card' : 'cash';
  const pmLabel = orderPaymentMethod === 'card' ? 'Card' : 'Cash';

  // Use stored per-order tax values if present (saved at order time).
  // Otherwise recompute from items + the order's payment method for backward compat.
  let fbrTax = Number(order.fbr_tax || 0);
  let praTax = Number(order.pra_tax || 0);
  let praRate = 0;
  if (taxInfo && taxInfo.praEnabled) {
    // Resolve the PRA rate that applies to THIS order's payment method.
    if (orderPaymentMethod === 'card') {
      praRate = Number(taxInfo.praRateCardPct != null ? taxInfo.praRateCardPct : taxInfo.praRatePct) || 0;
    } else {
      praRate = Number(taxInfo.praRateCashPct != null ? taxInfo.praRateCashPct : taxInfo.praRatePct) || 0;
    }
  }
  if ((!fbrTax && !praTax) && taxInfo && typeof calcCartTotalsWithTax === 'function') {
    const t = calcCartTotalsWithTax(items, taxInfo, orderPaymentMethod);
    fbrTax = t.fbrTax;
    praTax = t.praTax;
    if (t.praRatePct != null) praRate = t.praRatePct;
  }

  const fbrLabel = (taxInfo && taxInfo.fbrLabel) || 'FBR Sales Tax';
  const praLabel = (taxInfo && taxInfo.praLabel) || 'PRA Punjab Tax';
  const fbrRate = (taxInfo && taxInfo.fbrEnabled) ? taxInfo.fbrRatePct : 0;

  POS_DOM.billContent.innerHTML = `
    <div class="bill-header">
      <div class="bill-brand">The Cakery</div>
      <div class="bill-tag">Patisserie · Boulangerie · Cafè</div>
      <div class="bill-meta">
        <div><span>Order:</span><strong>#${escapeHTML(order.order_number)}</strong></div>
        <div><span>Type:</span><strong>${order.order_type === 'takeaway' ? 'Take Away' : 'Dine In'}</strong></div>
        <div><span>Table:</span><strong>${(order.order_type === 'takeaway' || !order.table_number || order.table_number === 0) ? '—' : order.table_number}</strong></div>
        <div><span>Payment:</span><strong style="text-transform:capitalize;">${order.payment_method === 'card' ? 'Card' : 'Cash'}</strong></div>
        <div><span>Date:</span><strong>${formatDateTime(order.created_at)}</strong></div>
        <div><span>Status:</span><strong style="text-transform:capitalize;">${order.status}</strong></div>
        <div><span>Served by:</span><strong>${escapeHTML(POS_STATE.user ? POS_STATE.user.displayName : '—')}</strong></div>
      </div>
    </div>
    <table class="bill-items">
      <thead>
        <tr>
          <th>Item</th>
          <th class="center">Qty</th>
          <th class="right">Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td>${escapeHTML(i.name)}</td>
            <td class="center">${i.qty}</td>
            <td class="right">${formatPrice(i.price)}</td>
            <td class="right">${formatPrice(i.price * i.qty)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${order.instructions ? `<div style="font-size:0.78rem;color:var(--text-muted);margin:8px 0;font-style:italic;">Note: ${escapeHTML(order.instructions)}</div>` : ''}
    <div class="bill-totals">
      <div class="row"><span>Subtotal</span><span>${formatPrice(order.subtotal)}</span></div>
      ${fbrTax > 0 ? `<div class="row"><span>${escapeHTML(fbrLabel)} (${fbrRate}%)</span><span>${formatPrice(fbrTax)}</span></div>` : ''}
      ${praTax > 0 ? `<div class="row"><span>${escapeHTML(praLabel)} (${praRate}% · ${pmLabel})</span><span>${formatPrice(praTax)}</span></div>` : ''}
      <div class="row grand"><span>Grand Total</span><span>${formatPrice(order.total)}</span></div>
    </div>
    <div class="bill-footer">
      <p>Thank you for dining with us</p>
      <p style="margin-top:3px;">Cash · Card accepted</p>
    </div>
  `;
  POS_DOM.billModal.classList.add('open');

  // Hook up print button to this specific order
  POS_DOM.printBillBtn.onclick = () => printBill(order);
}

function printBill(order) {
  // Open a print-friendly window
  const billHTML = POS_DOM.billContent.innerHTML;
  const w = window.open('', '_blank', 'width=420,height=600');
  if (!w) { showToast('Pop-up blocked. Allow pop-ups to print.', 'warning'); return; }
  w.document.write(`
    <!DOCTYPE html><html><head><title>Bill #${order.order_number}</title>
    <style>
      body { font-family: 'Courier New', monospace; padding: 16px; color: #1C1C1A; }
      h1 { font-size: 1.4rem; text-align: center; margin: 0; }
      .tag { text-align: center; font-size: 0.7rem; letter-spacing: 1px; text-transform: uppercase; }
      .meta { font-size: 0.78rem; margin: 12px 0; }
      .meta div { display: flex; justify-content: space-between; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.85rem; }
      th, td { padding: 4px 0; text-align: left; }
      th { border-bottom: 1px solid #333; font-size: 0.7rem; text-transform: uppercase; }
      .right { text-align: right; }
      .center { text-align: center; }
      .totals { border-top: 2px solid #333; padding-top: 8px; }
      .totals div { display: flex; justify-content: space-between; padding: 2px 0; font-size: 0.9rem; }
      .grand { font-weight: bold; font-size: 1.1rem; border-top: 1px dashed #999; padding-top: 6px; margin-top: 6px; }
      .footer { text-align: center; margin-top: 16px; font-size: 0.78rem; color: #666; }
      @media print { body { padding: 0; } }
    </style></head>
    <body>${billHTML}</body></html>
  `);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ----------------------------------------------------------------
// EDIT ORDER  (POS staff can edit an active order's items)
// ----------------------------------------------------------------
// Working copy of the order being edited: { id, items, instructions, order_type, payment_method, table_number }
let EDIT_STATE = null;
let EDIT_MENU_SEARCH = '';

function openEditModal(order) {
  // Defensive copy of items so we don't mutate the live order until Save.
  const items = Array.isArray(order.items) ? order.items : (() => {
    try { return JSON.parse(order.items || '[]'); } catch (e) { return []; }
  })();
  EDIT_STATE = {
    id: order.id,
    order_number: order.order_number,
    table_number: order.table_number,
    order_type: order.order_type || 'dine_in',
    payment_method: order.payment_method || 'cash',
    instructions: order.instructions || '',
    items: items.map(i => ({
      id: i.id || '',
      name: i.name || '',
      price: Number(i.price) || 0,
      qty: Number(i.qty) || 1,
      emoji: '',
      category: i.category || ''
    }))
  };
  EDIT_MENU_SEARCH = '';

  POS_DOM.editOrderTitle.textContent = '#' + order.order_number;

  // Meta line: order type + payment method + table
  const otLabel = EDIT_STATE.order_type === 'takeaway' ? 'Take Away' : 'Dine In' + (EDIT_STATE.table_number && EDIT_STATE.table_number !== 0 ? ' · Table ' + EDIT_STATE.table_number : '');
  const pmLabel = EDIT_STATE.payment_method === 'card' ? 'Card' : 'Cash';
  POS_DOM.editOrderMeta.innerHTML = `
    <span class="edit-meta-pill">${otLabel}</span>
    <span class="edit-meta-pill">${pmLabel}</span>
    <span class="edit-meta-pill">Status: <b>${order.status}</b></span>
  `;

  POS_DOM.editInstructions.value = EDIT_STATE.instructions;
  if (POS_DOM.editMenuSearch) POS_DOM.editMenuSearch.value = '';

  renderEditItems();
  renderEditMenu();
  renderEditTotals();

  POS_DOM.editModal.classList.add('open');
}

function closeEditModal() {
  POS_DOM.editModal.classList.remove('open');
  EDIT_STATE = null;
}

function renderEditItems() {
  if (!EDIT_STATE) return;
  if (EDIT_STATE.items.length === 0) {
    POS_DOM.editItemsList.innerHTML = '<div class="edit-empty">No items. Add one from the menu below.</div>';
    return;
  }
  POS_DOM.editItemsList.innerHTML = EDIT_STATE.items.map((it, idx) => `
    <div class="edit-item-row">
      <div class="edit-item-info">
        
        <div>
          <div class="edit-item-name">${escapeHTML(it.name)}</div>
          <div class="edit-item-price">${formatPrice(it.price)} each</div>
        </div>
      </div>
      <div class="edit-item-controls">
        <button class="edit-qty-btn" data-edit-qty-minus="${idx}">−</button>
        <span class="edit-qty-val">${it.qty}</span>
        <button class="edit-qty-btn" data-edit-qty-plus="${idx}">+</button>
        <button class="edit-remove-btn" data-edit-remove="${idx}" title="Remove">Remove</button>
      </div>
    </div>
  `).join('');
}

function renderEditMenu() {
  if (!EDIT_STATE) return;
  let menu = (typeof getMenu === 'function') ? getMenu() : [];
  // Exclude items already in the cart? No — allow adding duplicates (e.g. extra coffees).
  // But filter by search if present.
  const q = EDIT_MENU_SEARCH.trim().toLowerCase();
  let filtered = menu;
  if (q) {
    filtered = menu.filter(i => (i.name || '').toLowerCase().includes(q) || (i.desc || '').toLowerCase().includes(q));
  }
  // Only show available items, and limit to first 30 to keep DOM light.
  filtered = filtered.filter(i => i.available !== false).slice(0, 30);

  if (filtered.length === 0) {
    POS_DOM.editMenuList.innerHTML = '<div class="edit-empty">No matching items.</div>';
    return;
  }
  POS_DOM.editMenuList.innerHTML = filtered.map(it => `
    <button class="edit-menu-item" data-edit-add="${it.id}">
      
      <span class="edit-menu-name">${escapeHTML(it.name)}</span>
      <span class="edit-menu-price">${formatPrice(it.price)}</span>
    </button>
  `).join('');
}

function renderEditTotals() {
  if (!EDIT_STATE) return;
  // Pass the order's payment method so PRA uses the right rate (cash 16% / card 8%).
  const totals = calcCartTotals(EDIT_STATE.items, EDIT_STATE.payment_method);
  const info = totals.taxInfo || (typeof getTaxSettings === 'function' ? getTaxSettings() : null);
  const fbrLabel = (info && info.fbrLabel) || 'FBR Sales Tax';
  const praLabel = (info && info.praLabel) || 'PRA Punjab Tax';
  const fbrRate = (info && info.fbrEnabled) ? info.fbrRatePct : 0;
  const pmLabel = EDIT_STATE.payment_method === 'card' ? 'Card' : 'Cash';
  const praRate = totals.praRatePct != null ? totals.praRatePct : ((info && info.praEnabled) ? info.praRatePct : 0);
  POS_DOM.editTotals.innerHTML = `
    <div class="edit-totals-row"><span>Subtotal</span><span>${formatPrice(totals.subtotal)}</span></div>
    ${totals.fbrTax > 0 ? `<div class="edit-totals-row"><span>${escapeHTML(fbrLabel)} (${fbrRate}%)</span><span>${formatPrice(totals.fbrTax)}</span></div>` : ''}
    ${totals.praTax > 0 ? `<div class="edit-totals-row"><span>${escapeHTML(praLabel)} (${praRate}% · ${pmLabel})</span><span>${formatPrice(totals.praTax)}</span></div>` : ''}
    <div class="edit-totals-row grand"><span>Grand Total</span><span>${formatPrice(totals.total)}</span></div>
  `;
}

async function saveEditOrder() {
  if (!EDIT_STATE) return;
  if (EDIT_STATE.items.length === 0) {
    showToast('Cannot save an empty order. Add at least one item or cancel.', 'warning');
    return;
  }
  // Recompute totals with the order's payment method so PRA uses the right rate.
  const totals = calcCartTotals(EDIT_STATE.items, EDIT_STATE.payment_method);
  const patch = {
    items: EDIT_STATE.items.map(i => ({
      id: i.id, name: i.name, price: i.price, qty: i.qty, emoji: i.emoji,
      category: i.category || ''
    })),
    subtotal: totals.subtotal,
    tax: totals.tax,
    fbr_tax: totals.fbrTax || 0,
    pra_tax: totals.praTax || 0,
    total: totals.total,
    instructions: (POS_DOM.editInstructions.value || '').trim(),
    updated_at: new Date().toISOString()
  };

  POS_DOM.editSaveBtn.disabled = true;
  POS_DOM.editSaveBtn.textContent = 'Saving...';
  try {
    if (!isSupabaseReady()) {
      throw new Error('Supabase not configured — cannot save edits in demo mode.');
    }
    const { data, error } = await supabaseClient
      .from('orders')
      .update(patch)
      .eq('id', EDIT_STATE.id)
      .select()
      .single();
    if (error) throw error;
    showToast('Order updated', 'success');
    closeEditModal();
    await loadAllOrders();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    POS_DOM.editSaveBtn.disabled = false;
    POS_DOM.editSaveBtn.textContent = 'Save Changes';
  }
}

// Edit-modal event delegation (wired once in bootPos)
function setupEditModalListeners() {
  // Close on backdrop / cancel / X
  POS_DOM.editModal.querySelectorAll('[data-edit-close]').forEach(el => {
    el.addEventListener('click', closeEditModal);
  });
  // Save button
  POS_DOM.editSaveBtn.addEventListener('click', saveEditOrder);
  // Search input
  POS_DOM.editMenuSearch.addEventListener('input', (e) => {
    EDIT_MENU_SEARCH = e.target.value;
    renderEditMenu();
  });
  // Delegated clicks inside the edit modal
  POS_DOM.editModal.addEventListener('click', (e) => {
    if (!EDIT_STATE) return;
    const plus = e.target.closest('[data-edit-qty-plus]');
    if (plus) {
      const idx = Number(plus.dataset.editQtyPlus);
      if (EDIT_STATE.items[idx]) EDIT_STATE.items[idx].qty += 1;
      renderEditItems();
      renderEditTotals();
      return;
    }
    const minus = e.target.closest('[data-edit-qty-minus]');
    if (minus) {
      const idx = Number(minus.dataset.editQtyMinus);
      if (EDIT_STATE.items[idx]) {
        EDIT_STATE.items[idx].qty -= 1;
        if (EDIT_STATE.items[idx].qty <= 0) EDIT_STATE.items.splice(idx, 1);
      }
      renderEditItems();
      renderEditTotals();
      return;
    }
    const rm = e.target.closest('[data-edit-remove]');
    if (rm) {
      const idx = Number(rm.dataset.editRemove);
      if (EDIT_STATE.items[idx]) EDIT_STATE.items.splice(idx, 1);
      renderEditItems();
      renderEditTotals();
      return;
    }
    const add = e.target.closest('[data-edit-add]');
    if (add) {
      const itemId = add.dataset.editAdd;
      const menu = (typeof getMenu === 'function') ? getMenu() : [];
      const item = menu.find(m => m.id === itemId);
      if (!item) return;
      const existing = EDIT_STATE.items.find(i => i.id === itemId);
      if (existing) {
        existing.qty += 1;
      } else {
        EDIT_STATE.items.push({
          id: item.id, name: item.name, price: Number(item.price) || 0,
          qty: 1, emoji: '', category: item.category || ''
        });
      }
      renderEditItems();
      renderEditTotals();
      return;
    }
  });
}

// ----------------------------------------------------------------
// CONNECTION STATUS
// ----------------------------------------------------------------
function setConnectionStatus(online, text) {
  if (online) {
    POS_DOM.connStatus.classList.remove('offline');
  } else {
    POS_DOM.connStatus.classList.add('offline');
  }
  POS_DOM.connText.textContent = text;
}

// ----------------------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------------------
function setupEventListeners() {
  // Search
  POS_DOM.searchInput.addEventListener('input', (e) => {
    POS_STATE.searchQuery = e.target.value;
    renderDashboard();
  });

  // Delegation for action buttons
  document.addEventListener('click', async (e) => {
    const acceptBtn = e.target.closest('[data-accept]');
    if (acceptBtn) {
      await updateOrderStatus(acceptBtn.dataset.accept, 'accepted');
      return;
    }
    const rejectBtn = e.target.closest('[data-reject]');
    if (rejectBtn) {
      if (confirm('Reject this order? Customer will be notified.')) {
        await rejectOrder(rejectBtn.dataset.reject, 'Rejected by staff');
      }
      return;
    }
    const readyBtn = e.target.closest('[data-ready]');
    if (readyBtn) {
      await updateOrderStatus(readyBtn.dataset.ready, 'ready');
      return;
    }
    const serveBtn = e.target.closest('[data-serve]');
    if (serveBtn) {
      await updateOrderStatus(serveBtn.dataset.serve, 'served');
      return;
    }
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      const order = POS_STATE.orders.find(o => o.id == editBtn.dataset.edit);
      if (order) openEditModal(order);
      return;
    }
    const billBtn = e.target.closest('[data-bill]');
    if (billBtn) {
      const order = POS_STATE.orders.find(o => o.id == billBtn.dataset.bill)
                || POS_STATE.servedOrders.find(o => o.id == billBtn.dataset.bill);
      if (order) showBill(order);
      return;
    }
    // Sidebar tab switching
    const tabBtn = e.target.closest('.sidebar-tab');
    if (tabBtn) {
      POS_STATE.activeTab = tabBtn.dataset.tab;
      document.querySelectorAll('.sidebar-tab').forEach(t =>
        t.classList.toggle('active', t === tabBtn));
      document.getElementById('tab-stats').style.display =
        POS_STATE.activeTab === 'stats' ? 'block' : 'none';
      document.getElementById('tab-history').style.display =
        POS_STATE.activeTab === 'history' ? 'block' : 'none';
      return;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
