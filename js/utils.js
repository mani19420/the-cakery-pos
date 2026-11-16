/**
 * The Cakery POS - Shared Utilities
 * Used by both customer (index.html) and POS (pos.html) pages.
 */

const CAKERY = {
  CURRENCY: 'Rs',
  TAX_RATE: 0.00, // GST exclusive per menu — adjust if needed
  ORDER_PREFIX: 'TC', // Order number prefix
  STORAGE_KEY: 'cakery_table_', // + table number
  POS_STATUS_KEY: 'cakery_pos_orders', // local fallback for POS
  DEMO_ORDERS_KEY: 'cakery_demo_orders', // demo-mode order store
  DEMO_CHANNEL: 'cakery-demo-channel' // BroadcastChannel name
};

// ----------------------------------------------------------------
// Formatting
// ----------------------------------------------------------------
function formatPrice(n) {
  if (n == null || isNaN(n)) n = 0;
  return CAKERY.CURRENCY + ' ' + Number(n).toLocaleString('en-PK');
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
}

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return days + 'd ago';
  if (hours > 0) return hours + 'h ago';
  if (mins < 1) return 'Just now';
  return mins + 'm ago';
}

// ----------------------------------------------------------------
// Order Number Generator (5-digit)
// ----------------------------------------------------------------
function generateOrderNumber() {
  const n = Math.floor(10000 + Math.random() * 90000);
  return CAKERY.ORDER_PREFIX + '-' + n;
}

// ----------------------------------------------------------------
// Cart Math
// ----------------------------------------------------------------
function calcCartTotals(cart) {
  const subtotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
  const tax = Math.round(subtotal * CAKERY.TAX_RATE);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

// ----------------------------------------------------------------
// Supabase Order API
// (with automatic DEMO MODE fallback when Supabase is not configured:
//  orders are stored in localStorage and synced across open tabs via
//  BroadcastChannel — enough to preview the full flow offline)
// ----------------------------------------------------------------

// ---- Demo store helpers ----
function _demoRead() {
  try {
    const raw = localStorage.getItem(CAKERY.DEMO_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function _demoWrite(orders) {
  try { localStorage.setItem(CAKERY.DEMO_ORDERS_KEY, JSON.stringify(orders)); } catch (e) {}
}
function _demoBroadcast(eventType, record) {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CAKERY.DEMO_CHANNEL);
      ch.postMessage({ eventType, new: record, old: null });
      ch.close();
    }
  } catch (e) {}
}
function _isDemoMode() { return !isSupabaseReady(); }

// Insert a new order. Returns { success, order, error }
async function insertOrder(orderPayload) {
  if (_isDemoMode()) {
    const record = {
      id: 'demo-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      ...orderPayload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const all = _demoRead();
    all.push(record);
    _demoWrite(all);
    _demoBroadcast('INSERT', record);
    return { success: true, order: record, error: null };
  }
  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .insert([orderPayload])
      .select()
      .single();
    if (error) throw error;
    return { success: true, order: data, error: null };
  } catch (err) {
    return { success: false, error: err.message, order: null };
  }
}

// Fetch all active orders for POS (received/accepted/ready)
async function fetchActiveOrders() {
  if (_isDemoMode()) {
    return _demoRead()
      .filter(o => ['received', 'accepted', 'ready'].includes(o.status))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .in('status', ['received', 'accepted', 'ready'])
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('fetchActiveOrders error:', err.message);
    return [];
  }
}

// Fetch recent served orders (for POS history)
async function fetchServedOrders(limit = 10) {
  if (_isDemoMode()) {
    return _demoRead()
      .filter(o => o.status === 'served')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  }
  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('status', 'served')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('fetchServedOrders error:', err.message);
    return [];
  }
}

// Update order status
async function updateOrderStatus(orderId, newStatus) {
  if (_isDemoMode()) {
    const all = _demoRead();
    const idx = all.findIndex(o => o.id === orderId);
    if (idx === -1) return { success: false, error: 'Order not found' };
    all[idx].status = newStatus;
    all[idx].updated_at = new Date().toISOString();
    _demoWrite(all);
    _demoBroadcast('UPDATE', all[idx]);
    return { success: true, error: null };
  }
  try {
    const { error } = await supabaseClient
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Reject order (sets status to 'rejected', can also delete)
async function rejectOrder(orderId, reason = '') {
  if (_isDemoMode()) {
    const all = _demoRead();
    const idx = all.findIndex(o => o.id === orderId);
    if (idx === -1) return { success: false, error: 'Order not found' };
    all[idx].status = 'rejected';
    all[idx].reject_reason = reason;
    all[idx].updated_at = new Date().toISOString();
    _demoWrite(all);
    _demoBroadcast('UPDATE', all[idx]);
    return { success: true, error: null };
  }
  try {
    const { error } = await supabaseClient
      .from('orders')
      .update({ status: 'rejected', reject_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Subscribe to ALL orders table changes (for POS)
function subscribeToOrders(onChange) {
  if (_isDemoMode()) {
    if (typeof BroadcastChannel === 'undefined') return null;
    const ch = new BroadcastChannel(CAKERY.DEMO_CHANNEL);
    ch.onmessage = (e) => onChange(e.data);
    return ch;
  }
  return supabaseClient
    .channel('pos-orders')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      (payload) => onChange(payload))
    .subscribe();
}

// Subscribe to ONE order (for customer tracking)
function subscribeToOrder(orderId, onChange) {
  if (_isDemoMode()) {
    if (typeof BroadcastChannel === 'undefined') return null;
    const ch = new BroadcastChannel(CAKERY.DEMO_CHANNEL);
    ch.onmessage = (e) => {
      // Only forward updates for this order
      if (e.data && e.data.new && e.data.new.id === orderId) onChange(e.data);
    };
    return ch;
  }
  return supabaseClient
    .channel('cust-order-' + orderId)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'id=eq.' + orderId },
      (payload) => onChange(payload))
    .subscribe();
}

// ----------------------------------------------------------------
// Local storage helpers (customer cart persistence per table)
// ----------------------------------------------------------------
function saveTableState(tableNumber, data) {
  if (!tableNumber) return;
  try {
    localStorage.setItem(CAKERY.STORAGE_KEY + tableNumber, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage save failed', e);
  }
}

function loadTableState(tableNumber) {
  if (!tableNumber) return null;
  try {
    const raw = localStorage.getItem(CAKERY.STORAGE_KEY + tableNumber);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearTableState(tableNumber) {
  try { localStorage.removeItem(CAKERY.STORAGE_KEY + tableNumber); } catch (e) {}
}

// ----------------------------------------------------------------
// Misc
// ----------------------------------------------------------------
function escapeHTML(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function showToast(message, type = 'success', duration = 3000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const colors = {
    success: '#16a34a',
    error: '#dc2626',
    warning: '#d97706',
    info: '#2563eb'
  };
  const toast = document.createElement('div');
  toast.style.cssText = `
    background:${colors[type] || colors.success};
    color:white;padding:12px 20px;border-radius:8px;
    box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;font-weight:500;
    max-width:320px;animation:toastIn 0.3s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Expose
if (typeof window !== 'undefined') {
  Object.assign(window, {
    CAKERY, formatPrice, formatTime, formatDateTime, timeAgo,
    generateOrderNumber, calcCartTotals,
    insertOrder, fetchActiveOrders, fetchServedOrders,
    updateOrderStatus, rejectOrder,
    subscribeToOrders, subscribeToOrder,
    saveTableState, loadTableState, clearTableState,
    escapeHTML, showToast
  });
}
