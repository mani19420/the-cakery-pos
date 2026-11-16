/* ===================================================================
   The Cakery POS - Admin Panel Logic
   =================================================================== */

// ----------------------------------------------------------------
// STATE
// ----------------------------------------------------------------
const A = {
  // Caches
  menu: [],
  brand: {},
  sales: null,
  // Filters / search
  menuSearch: '',
  menuFilterCat: 'all',
  menuFilterAvail: 'all',
  ordersFilter: 'all',
  salesRange: 'today',
  // Edit state
  editingItemId: null,
  pendingImage: '',   // base64 data URL for item image (when editing)
  pendingLogo: '',    // base64 data URL for logo
  // Subscriptions
  unsubMenu: null,
  unsubBrand: null
};

// Categories (matches the customer menu's category slugs)
// Named ADMIN_CATS to avoid clashing with CATEGORIES in menu-data.js.
const ADMIN_CATS = [
  { slug: 'breads',        label: 'Breads',          emoji: '🥖' },
  { slug: 'viennoiserie',  label: 'Viennoiserie',    emoji: '🥐' },
  { slug: 'patisserie',    label: 'Patisserie',      emoji: '🥧' },
  { slug: 'cakes',         label: 'Signature Cakes', emoji: '🎂' },
  { slug: 'slices',        label: 'By The Slice',    emoji: '🍰' },
  { slug: 'chefswhisk',    label: "Chef's Whisk",    emoji: '🍫' },
  { slug: 'sandwiches',    label: 'Sandwiches',      emoji: '🥪' },
  { slug: 'coffees',       label: 'Coffees',         emoji: '☕' },
  { slug: 'matcha',        label: 'Matcha',          emoji: '🍵' },
  { slug: 'nocaffeine',    label: 'No Caffeine',     emoji: '🥤' },
  { slug: 'ontherocks',    label: 'On The Rocks',    emoji: '🍹' },
  { slug: 'tea',           label: 'Tea',             emoji: '🍵' },
  { slug: 'addons',        label: 'Add-Ons',         emoji: '➕' }
];

// ----------------------------------------------------------------
// INIT
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();

  // Session check
  if (!isLoggedIn()) {
    showLogin();
    return;
  }
  await bootAdmin();
});

function isLoggedIn() {
  try {
    const raw = localStorage.getItem(ADMIN_CONFIG.SESSION_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !s.ts) return false;
    return Date.now() - s.ts < ADMIN_CONFIG.SESSION_MS;
  } catch (e) { return false; }
}

function showLogin() {
  document.getElementById('loginScreen').hidden = false;
  document.getElementById('adminApp').hidden = true;
  document.getElementById('loginPassword').focus();
}

function loginSuccess() {
  localStorage.setItem(ADMIN_CONFIG.SESSION_KEY, JSON.stringify({ ts: Date.now() }));
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('adminApp').hidden = false;
  bootAdmin();
}

function logout() {
  localStorage.removeItem(ADMIN_CONFIG.SESSION_KEY);
  location.reload();
}

// Login form submit
document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const pwd = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  if (pwd === ADMIN_CONFIG.PASSWORD) {
    err.textContent = '';
    loginSuccess();
  } else {
    err.textContent = 'Wrong password. Try again.';
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
  }
});

document.getElementById('logoutBtn').addEventListener('click', logout);

// ----------------------------------------------------------------
// BOOT (after login)
// ----------------------------------------------------------------
async function bootAdmin() {
  // Wire up tabs
  document.querySelectorAll('.topbar .tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });

  // Wire up range pills
  document.querySelectorAll('.range-pill').forEach(p => {
    p.addEventListener('click', () => {
      document.querySelectorAll('.range-pill').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      A.salesRange = p.dataset.range;
      loadDashboard();
    });
  });

  // Wire up menu controls
  document.getElementById('menuSearch').addEventListener('input', (e) => {
    A.menuSearch = e.target.value.toLowerCase();
    renderMenuTable();
  });
  document.getElementById('menuFilterCat').addEventListener('change', (e) => {
    A.menuFilterCat = e.target.value;
    renderMenuTable();
  });
  document.getElementById('menuFilterAvail').addEventListener('change', (e) => {
    A.menuFilterAvail = e.target.value;
    renderMenuTable();
  });
  document.getElementById('addItemBtn').addEventListener('click', () => openItemModal(null));
  document.getElementById('seedMenuBtn').addEventListener('click', seedMenu);

  // Wire up orders filter
  document.getElementById('ordersStatusFilter').addEventListener('change', (e) => {
    A.ordersFilter = e.target.value;
    renderAllOrdersTable();
  });

  // Wire up brand form
  document.getElementById('saveBrandBtn').addEventListener('click', saveBrand);
  document.getElementById('uploadLogoBtn').addEventListener('click', () => {
    const f = document.getElementById('logoFile').files[0];
    if (!f) { showToast('Choose a file first', 'warning'); return; }
    readFileAsDataURL(f).then(dataUrl => {
      A.pendingLogo = dataUrl;
      renderLogoPreview(dataUrl);
    }).catch(err => showToast('Image read failed: ' + err.message, 'error'));
  });
  document.getElementById('clearLogoBtn').addEventListener('click', () => {
    A.pendingLogo = '';
    document.getElementById('logoFile').value = '';
    renderLogoPreview('');
  });

  // Wire up item modal
  document.querySelectorAll('#itemModal [data-close]').forEach(el => el.addEventListener('click', closeItemModal));
  document.getElementById('itemForm').addEventListener('submit', handleItemFormSubmit);
  document.getElementById('itemImage').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) { A.pendingImage = ''; renderItemImgPreview(''); return; }
    readFileAsDataURL(f).then(d => { A.pendingImage = d; renderItemImgPreview(d); })
                       .catch(err => showToast('Image read failed: ' + err.message, 'error'));
  });

  // Populate category dropdowns
  populateCategoryDropdowns();

  // Status + initial loads
  updateDBStatus();
  await Promise.all([loadBrandIntoForm(), refreshMenu()]);
  await loadDashboard();
  await loadAllOrders();

  // Realtime subscriptions
  A.unsubMenu = subscribeMenu(() => { refreshMenu(false); });
  A.unsubBrand = subscribeBrand(() => { loadBrandIntoForm(); });
}

function switchTab(name) {
  document.querySelectorAll('.topbar .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'dashboard') loadDashboard();
  if (name === 'orders') loadAllOrders();
}

function populateCategoryDropdowns() {
  const opts = ADMIN_CATS.map(c => `<option value="${c.slug}">${c.emoji} ${c.label}</option>`).join('');
  // Item modal category select
  const itemCat = document.getElementById('itemCategory');
  itemCat.innerHTML = opts;
  // Menu filter dropdown
  const filterCat = document.getElementById('menuFilterCat');
  filterCat.innerHTML = '<option value="all">All categories</option>' + opts;
}

// ----------------------------------------------------------------
// DB STATUS
// ----------------------------------------------------------------
function updateDBStatus() {
  const el = document.getElementById('dbStatus');
  if (isSupabaseReady()) {
    el.className = 'status-indicator live';
    el.innerHTML = '<span class="status-dot"></span>Live · connected to Supabase';
  } else {
    el.className = 'status-indicator offline';
    el.innerHTML = '<span class="status-dot"></span>Demo mode · Supabase not configured';
  }
}

// ----------------------------------------------------------------
// MENU LOAD + RENDER
// ----------------------------------------------------------------
async function refreshMenu(showLoader = true) {
  if (showLoader) {
    const tb = document.querySelector('#menuTable tbody');
    if (tb) tb.innerHTML = '<tr><td colspan="7" class="empty-row">Loading…</td></tr>';
  }
  try {
    A.menu = await loadMenu();
    document.getElementById('menuCount').textContent = A.menu.length + ' items';
    document.getElementById('lastSync').textContent = 'Synced ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    renderMenuTable();
  } catch (e) {
    showToast('Menu load failed: ' + e.message, 'error');
  }
}

function renderMenuTable() {
  const tbody = document.querySelector('#menuTable tbody');
  if (!A.menu.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">
      No menu items in the database. Click <b>📥 Seed from local</b> to import the default menu, or <b>+ Add item</b> to create one.
    </td></tr>`;
    return;
  }

  let items = A.menu.slice().sort((a, b) => {
    const c = (a.category || '').localeCompare(b.category || '');
    if (c !== 0) return c;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Apply filters
  if (A.menuFilterCat !== 'all') items = items.filter(i => i.category === A.menuFilterCat);
  if (A.menuFilterAvail === 'available') items = items.filter(i => i.available);
  else if (A.menuFilterAvail === 'unavailable') items = items.filter(i => !i.available);
  if (A.menuSearch) {
    items = items.filter(i =>
      (i.name || '').toLowerCase().includes(A.menuSearch) ||
      (i.id || '').toLowerCase().includes(A.menuSearch));
  }

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No items match your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(i => {
    const img = i.imageUrl
      ? `<div class="cell-image"><img src="${escapeHTML(i.imageUrl)}" alt=""></div>`
      : `<div class="cell-image">${escapeHTML(i.emoji || '🍽️')}</div>`;
    const priceCell = i.originalPrice
      ? `<span class="cell-sale"><span class="orig">Rs ${Number(i.originalPrice).toLocaleString('en-PK')}</span>Rs ${Number(i.price).toLocaleString('en-PK')}</span>`
      : `<span class="cell-price">Rs ${Number(i.price).toLocaleString('en-PK')}</span>`;
    const statusBadge = i.available
      ? '<span class="badge badge-available">Available</span>'
      : '<span class="badge badge-hidden">Hidden</span>';
    const popularBadge = i.popular ? ' <span class="badge badge-popular">★ Popular</span>' : '';
    return `<tr>
      <td>${img}</td>
      <td><b>${escapeHTML(i.name)}</b><br><span style="font-size:11px;color:var(--text-faint)">${escapeHTML(i.id)}</span></td>
      <td>${escapeHTML(catLabel(i.category))}</td>
      <td>${priceCell}</td>
      <td>${i.originalPrice ? 'On Sale' : '—'}</td>
      <td>${statusBadge}${popularBadge}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" data-edit="${escapeHTML(i.id)}">✏️ Edit</button>
          <button class="row-btn danger" data-del="${escapeHTML(i.id)}">🗑️ Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Wire row buttons
  tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const it = A.menu.find(x => x.id === b.dataset.edit);
    if (it) openItemModal(it);
  }));
  tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
    const it = A.menu.find(x => x.id === b.dataset.del);
    if (it) confirmDelete(it);
  }));
}

function catLabel(slug) {
  const c = ADMIN_CATS.find(x => x.slug === slug);
  return c ? `${c.emoji} ${c.label}` : slug;
}

// ----------------------------------------------------------------
// SEED
// ----------------------------------------------------------------
async function seedMenu() {
  if (!isSupabaseReady()) { showToast('Supabase not configured', 'error'); return; }
  if (!confirm('This will copy all ' + (window.MENU_DATA ? MENU_DATA.length : 0) + ' default menu items into your database. Items with the same ID will be updated. Continue?')) return;
  try {
    showToast('Seeding menu…', 'info');
    const n = await seedMenuFromLocal();
    showToast(`✓ ${n} items imported`, 'success');
    await refreshMenu();
  } catch (e) {
    showToast('Seed failed: ' + e.message, 'error');
  }
}

// ----------------------------------------------------------------
// ITEM MODAL (Add / Edit)
// ----------------------------------------------------------------
function openItemModal(item) {
  A.editingItemId = item ? item.id : null;
  A.pendingImage = item && item.imageUrl ? item.imageUrl : '';
  const f = document.getElementById('itemForm');
  f.reset();
  document.getElementById('itemModalEyebrow').textContent = item ? 'Edit Item' : 'New Item';
  document.getElementById('itemModalTitle').textContent = item ? 'Edit Menu Item' : 'Add Menu Item';
  document.getElementById('itemId').value = item ? item.id : '';
  document.getElementById('itemId').disabled = !!item; // can't change id on edit
  document.getElementById('itemName').value = item ? item.name : '';
  document.getElementById('itemCategory').value = item ? item.category : 'breads';
  document.getElementById('itemPrice').value = item ? item.price : '';
  document.getElementById('itemOriginalPrice').value = item && item.originalPrice ? item.originalPrice : '';
  document.getElementById('itemDesc').value = item ? (item.desc || '') : '';
  document.getElementById('itemEmoji').value = item ? (item.emoji || '🍽️') : '🍽️';
  document.getElementById('itemPopular').checked = item ? !!item.popular : false;
  document.getElementById('itemAvailable').checked = item ? item.available !== false : true;
  renderItemImgPreview(A.pendingImage);
  document.getElementById('itemModal').classList.add('open');
  setTimeout(() => document.getElementById(item ? 'itemName' : 'itemId').focus(), 50);
}

function closeItemModal() {
  document.getElementById('itemModal').classList.remove('open');
  A.editingItemId = null;
  A.pendingImage = '';
}

function renderItemImgPreview(dataUrl) {
  const el = document.getElementById('itemImgPreview');
  el.innerHTML = dataUrl ? `<img src="${escapeHTML(dataUrl)}" alt="preview">` : '';
}

async function handleItemFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('itemId').value.trim().toLowerCase();
  const name = document.getElementById('itemName').value.trim();
  const category = document.getElementById('itemCategory').value;
  const price = parseFloat(document.getElementById('itemPrice').value);
  const originalPrice = document.getElementById('itemOriginalPrice').value.trim();
  const desc = document.getElementById('itemDesc').value.trim();
  const emoji = document.getElementById('itemEmoji').value.trim() || '🍽️';
  const popular = document.getElementById('itemPopular').checked;
  const available = document.getElementById('itemAvailable').checked;

  if (!id || !name || isNaN(price) || !category) {
    showToast('Please fill ID, name, category and price', 'warning');
    return;
  }
  if (!A.editingItemId && A.menu.some(m => m.id === id)) {
    showToast('An item with this ID already exists', 'error');
    return;
  }

  const payload = {
    id, name, category, price,
    originalPrice: originalPrice !== '' ? Number(originalPrice) : undefined,
    desc, emoji,
    imageUrl: A.pendingImage || '',
    popular, available,
    sortOrder: 0
  };

  try {
    await saveMenuItem(payload);
    showToast(A.editingItemId ? '✓ Item updated' : '✓ Item added', 'success');
    closeItemModal();
    await refreshMenu();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

function confirmDelete(item) {
  if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
  deleteMenuItem(item.id).then(() => {
    showToast('✓ Item deleted', 'success');
    refreshMenu();
  }).catch(err => showToast('Delete failed: ' + err.message, 'error'));
}

// ----------------------------------------------------------------
// BRAND
// ----------------------------------------------------------------
async function loadBrandIntoForm() {
  try {
    A.brand = await loadBrand();
  } catch (e) { A.brand = getBrand(); }
  document.getElementById('brandName').textContent = A.brand.brandName || 'The Cakery';
  document.getElementById('brandEmoji').textContent = A.brand.logoEmoji || '🧁';
  document.getElementById('brandNameInput').value = A.brand.brandName || '';
  document.getElementById('brandTagline').value = A.brand.tagline || '';
  document.getElementById('brandEmojiInput').value = A.brand.logoEmoji || '🧁';
  document.getElementById('brandAccentColor').value = A.brand.accentColor || '#1C1C1A';
  renderLogoPreview(A.brand.logoUrl || '');
}

function renderLogoPreview(dataUrl) {
  const el = document.getElementById('logoPreview');
  el.innerHTML = dataUrl
    ? `<img src="${escapeHTML(dataUrl)}" alt="logo">`
    : `<span class="logo-placeholder">No logo uploaded</span>`;
}

async function saveBrand() {
  const payload = {
    brandName: document.getElementById('brandNameInput').value.trim() || 'The Cakery',
    tagline: document.getElementById('brandTagline').value.trim() || 'Order From Your Table',
    logoEmoji: document.getElementById('brandEmojiInput').value.trim() || '🧁',
    accentColor: document.getElementById('brandAccentColor').value || '#1C1C1A',
    logoUrl: A.pendingLogo || A.brand.logoUrl || ''
  };
  try {
    await saveBrandSettings(payload);
    showToast('✓ Brand saved', 'success');
    await loadBrandIntoForm();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

// ----------------------------------------------------------------
// DASHBOARD / SALES
// ----------------------------------------------------------------
async function loadDashboard() {
  try {
    A.sales = await loadSalesStats(A.salesRange);
    renderDashboard();
  } catch (e) {
    showToast('Sales load failed: ' + e.message, 'error');
  }
}

function renderDashboard() {
  const s = A.sales || {};
  document.getElementById('kpiRevenue').textContent = formatPrice(s.totalRevenue || 0);
  document.getElementById('kpiRevenueSub').innerHTML = `from <b>${s.totalOrders || 0}</b> orders`;
  document.getElementById('kpiOrders').textContent = s.totalOrders || 0;
  document.getElementById('kpiAvg').textContent = formatPrice(s.avgOrder || 0);

  const top = (s.topItems || [])[0];
  if (top) {
    document.getElementById('kpiTopItem').textContent = (top.emoji || '🍽️') + ' ' + top.name;
    document.getElementById('kpiTopItemSub').textContent = `${top.qty} sold · ${formatPrice(top.revenue)}`;
  } else {
    document.getElementById('kpiTopItem').textContent = '—';
    document.getElementById('kpiTopItemSub').textContent = 'no sales yet';
  }

  // Top items list
  const list = document.getElementById('topItemsList');
  if (s.topItems && s.topItems.length) {
    list.innerHTML = s.topItems.slice(0, 8).map(t => `
      <div class="top-item">
        <div class="top-item-emoji">${escapeHTML(t.emoji || '🍽️')}</div>
        <div class="top-item-info">
          <div class="top-item-name">${escapeHTML(t.name)}</div>
          <div class="top-item-meta">${t.qty} sold</div>
        </div>
        <div class="top-item-revenue">${formatPrice(t.revenue)}</div>
      </div>`).join('');
  } else {
    list.innerHTML = '<div class="chart-empty">No item sales yet.</div>';
  }

  // Chart
  renderRevenueChart(s.byDay || []);

  // Recent orders table
  renderRecentOrders(s.recentOrders || []);
}

function renderRevenueChart(byDay) {
  const wrap = document.getElementById('revenueChart');
  const meta = document.getElementById('chartMeta');
  if (!byDay.length) {
    wrap.innerHTML = '<div class="chart-empty">No sales recorded yet. Place a test order to see the chart.</div>';
    meta.textContent = 'No data';
    return;
  }
  meta.textContent = `${byDay.length} day(s) · ${formatPrice(byDay.reduce((s, d) => s + d.revenue, 0))}`;
  const max = Math.max(...byDay.map(d => d.revenue), 1);
  wrap.innerHTML = '<div class="bar-chart">' + byDay.map(d => {
    const h = Math.max(2, (d.revenue / max) * 160);
    const label = d.date.slice(5); // MM-DD
    const val = formatPrice(d.revenue).replace('Rs ', 'Rs');
    return `<div class="bar-col">
      <div class="bar-value">${val}</div>
      <div class="bar" style="height:${h}px" title="${d.date}: ${val} (${d.orders} orders)"></div>
      <div class="bar-label">${label}</div>
    </div>`;
  }).join('') + '</div>';
}

function renderRecentOrders(orders) {
  const tb = document.querySelector('#recentOrdersTable tbody');
  document.getElementById('recentCount').textContent = (orders.length || 0) + ' orders';
  if (!orders.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-row">No orders yet.</td></tr>';
    return;
  }
  tb.innerHTML = orders.slice(0, 20).map(o => {
    const items = (o.items || []).map(i => (i.qty || 1) + '× ' + (i.name || i.id)).join(', ');
    return `<tr>
      <td><b>${escapeHTML(o.order_number || '')}</b></td>
      <td>${o.table_number}</td>
      <td class="cell-items">${escapeHTML(items)}</td>
      <td>${formatPrice(o.total)}</td>
      <td><span class="badge badge-${escapeHTML(o.status)}">${escapeHTML(o.status)}</span></td>
      <td>${formatDateTime(o.created_at)}</td>
    </tr>`;
  }).join('');
}

// ----------------------------------------------------------------
// ALL ORDERS TAB
// ----------------------------------------------------------------
async function loadAllOrders() {
  if (!isSupabaseReady()) {
    document.querySelector('#allOrdersTable tbody').innerHTML =
      '<tr><td colspan="9" class="empty-row">Supabase not configured. No order history.</td></tr>';
    return;
  }
  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    A.allOrders = data || [];
    renderAllOrdersTable();
  } catch (e) {
    showToast('Orders load failed: ' + e.message, 'error');
  }
}

function renderAllOrdersTable() {
  const tb = document.querySelector('#allOrdersTable tbody');
  let orders = A.allOrders || [];
  if (A.ordersFilter !== 'all') orders = orders.filter(o => o.status === A.ordersFilter);
  if (!orders.length) {
    tb.innerHTML = '<tr><td colspan="9" class="empty-row">No orders found.</td></tr>';
    return;
  }
  tb.innerHTML = orders.map(o => {
    const items = (o.items || []).map(i => (i.qty || 1) + '× ' + (i.name || i.id)).join(', ');
    return `<tr>
      <td><b>${escapeHTML(o.order_number || '')}</b></td>
      <td>${o.table_number}</td>
      <td class="cell-items">${escapeHTML(items)}</td>
      <td>${formatPrice(o.subtotal)}</td>
      <td>${formatPrice(o.tax)}</td>
      <td>${formatPrice(o.total)}</td>
      <td><span class="badge badge-${escapeHTML(o.status)}">${escapeHTML(o.status)}</span></td>
      <td>${formatDateTime(o.created_at)}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn danger" data-del-order="${o.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tb.querySelectorAll('[data-del-order]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this order? This cannot be undone.')) return;
    try {
      const { error } = await supabaseClient.from('orders').delete().eq('id', b.dataset.delOrder);
      if (error) throw error;
      showToast('✓ Order deleted', 'success');
      await loadAllOrders();
      await loadDashboard();
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  }));
}

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (file.size > 1.2 * 1024 * 1024) return reject(new Error('File too large (max 1.2 MB)'));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

// (showToast, escapeHTML, formatPrice, formatDateTime are provided by utils.js)
