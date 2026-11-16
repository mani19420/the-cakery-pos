/* ===================================================================
   The Cakery POS - Dashboard Logic
   Receives orders in real time, shows popup, accept/reject, bill print
   =================================================================== */

const POS_STATE = {
  orders: [],
  servedOrders: [],
  searchQuery: '',
  soundEnabled: true,
  activeTab: 'stats'
};

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
  historyList:     document.getElementById('historyList')
};

// Track which order IDs we've already shown a popup for (so we don't repeat)
const SHOWN_POPUPS = new Set();

// ----------------------------------------------------------------
// INIT
// ----------------------------------------------------------------
async function init() {
  setupEventListeners();

  if (!isSupabaseReady()) {
    // DEMO MODE — no Supabase credentials: run on localStorage orders
    // (synced across open tabs via BroadcastChannel) so the whole
    // customer → POS flow can be previewed offline.
    setConnectionStatus(true, 'Demo mode');
    await loadAllOrders();
    subscribeToOrders(handleRealtimeEvent);
    setInterval(loadAllOrders, 10000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') loadAllOrders();
    });
    showToast('🧪 Demo mode — orders placed in another tab will appear here', 'info', 6000);
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

  // Visibility change → re-fetch on tab focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadAllOrders();
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
function showNewOrderPopup(order) {
  // Avoid duplicates
  if (SHOWN_POPUPS.has(order.id)) return;
  SHOWN_POPUPS.add(order.id);

  const itemCount = Array.isArray(order.items) ? order.items.reduce((s, i) => s + i.qty, 0) : 0;

  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.innerHTML = `
    <div class="popup-head">
      <div class="popup-title">
        <span style="font-size:1.2rem;">🔔</span> New Order!
      </div>
      <button class="popup-close">&times;</button>
    </div>
    <div class="popup-body">
      <strong style="color:var(--brown);font-size:1rem;">#${escapeHTML(order.order_number)}</strong>
      &nbsp;·&nbsp;
      <strong>Table ${order.table_number}</strong>
      <br>
      <span style="color:var(--text-muted);">${itemCount} item${itemCount !== 1 ? 's' : ''} · ${formatPrice(order.total)}</span>
    </div>
    <div class="popup-actions">
      <button class="popup-btn view">👁 View</button>
    </div>
  `;
  POS_DOM.popupContainer.appendChild(popup);

  // Auto-dismiss after 12 seconds
  const dismissTimer = setTimeout(() => dismissPopup(popup), 12000);

  popup.querySelector('.popup-close').addEventListener('click', () => {
    clearTimeout(dismissTimer);
    dismissPopup(popup);
  });
  popup.querySelector('.popup-btn.view').addEventListener('click', () => {
    clearTimeout(dismissTimer);
    dismissPopup(popup);
    showBill(order);
  });
}

function dismissPopup(popup) {
  popup.classList.add('closing');
  setTimeout(() => popup.remove(), 300);
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
      const empties = { received: ['📝','No new orders'], accepted: ['👨‍🍳','Nothing cooking'], ready: ['🍽️','Nothing ready'] };
      list.innerHTML = `<div class="column-empty"><span class="emo">${empties[status][0]}</span>${empties[status][1]}</div>`;
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
  if (order.status === 'received') {
    actions = `
      <button class="btn-action btn-reject" data-reject="${order.id}">Reject</button>
      <button class="btn-action btn-accept" data-accept="${order.id}">Accept</button>
      <button class="btn-action btn-print" data-bill="${order.id}">Bill</button>
    `;
  } else if (order.status === 'accepted') {
    actions = `
      <button class="btn-action btn-print" data-bill="${order.id}">Bill</button>
      <button class="btn-action btn-ready" data-ready="${order.id}">Mark Ready</button>
    `;
  } else if (order.status === 'ready') {
    actions = `
      <button class="btn-action btn-print" data-bill="${order.id}">Bill</button>
      <button class="btn-action btn-serve" data-serve="${order.id}">Serve</button>
    `;
  } else if (order.status === 'served') {
    actions = `<span class="served-badge">✓ Served</span>`;
  }

  return `
    <article class="order-card ${order.status === 'received' ? 'new' : ''}" data-id="${order.id}">
      <div class="order-card-head">
        <span class="order-num">#${escapeHTML(order.order_number)}</span>
        <span class="table-tag">Table ${order.table_number}</span>
      </div>
      <div class="order-time ${timeClass}">
        <i data-lucide="clock" style="width:12px;height:12px;"></i> ${time}
      </div>
      <div class="order-items">
        ${items.map(i => `
          <div class="order-item-row">
            <span class="order-item-name">${escapeHTML(i.name)}</span>
            <span class="order-item-qty">× ${i.qty}</span>
          </div>
        `).join('')}
      </div>
      ${order.instructions ? `<div class="order-instructions">📝 "${escapeHTML(order.instructions)}"</div>` : ''}
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
    POS_DOM.historyList.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:30px 10px;font-size:0.85rem;">No served orders yet.</div>';
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

  POS_DOM.billContent.innerHTML = `
    <div class="bill-header">
      <div class="bill-brand">The Cakery</div>
      <div class="bill-tag">Patisserie · Boulangerie · Cafè</div>
      <div class="bill-meta">
        <div><span>Order:</span><strong>#${escapeHTML(order.order_number)}</strong></div>
        <div><span>Table:</span><strong>${order.table_number}</strong></div>
        <div><span>Date:</span><strong>${formatDateTime(order.created_at)}</strong></div>
        <div><span>Status:</span><strong style="text-transform:capitalize;">${order.status}</strong></div>
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
    ${order.instructions ? `<div style="font-size:0.8rem;color:var(--warning);margin:8px 0;font-style:italic;">📝 ${escapeHTML(order.instructions)}</div>` : ''}
    <div class="bill-totals">
      <div class="row"><span>Subtotal</span><span>${formatPrice(order.subtotal)}</span></div>
      <div class="row"><span>GST</span><span>${formatPrice(order.tax)}</span></div>
      <div class="row grand"><span>Grand Total</span><span>${formatPrice(order.total)}</span></div>
    </div>
    <div class="bill-footer">
      <p>Thank you for dining with us!</p>
      <p style="margin-top:4px;">Cash · Visa · Mastercard accepted</p>
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
      body { font-family: 'Courier New', monospace; padding: 16px; color: #2A2017; }
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
