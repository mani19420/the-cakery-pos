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
  tax: null,
  users: [],
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
  editingUserId: null,
  // Subscriptions
  unsubMenu: null,
  unsubBrand: null,
  unsubTax: null
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

  // Wire up user modal
  document.getElementById('addUserBtn').addEventListener('click', () => openUserModal(null));
  document.querySelectorAll('#userModal [data-close]').forEach(el => el.addEventListener('click', closeUserModal));
  document.getElementById('userForm').addEventListener('submit', handleUserFormSubmit);

  // Wire up tax form
  document.getElementById('saveTaxBtn').addEventListener('click', saveTax);
  ['fbrEnabled', 'fbrRate', 'fbrLabel', 'praEnabled', 'praRateCash', 'praRateCard', 'praLabel', 'pricesInclusive'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', renderTaxPreview);
      el.addEventListener('change', renderTaxPreview);
    }
  });

  // Populate category dropdowns
  populateCategoryDropdowns();

  // Status + initial loads
  updateDBStatus();
  await Promise.all([loadBrandIntoForm(), refreshMenu(), loadTaxIntoForm()]);
  await loadDashboard();
  await loadAllOrders();
  await loadUsers();

  // Realtime subscriptions
  A.unsubMenu = subscribeMenu(() => { refreshMenu(false); });
  A.unsubBrand = subscribeBrand(() => { loadBrandIntoForm(); });
  A.unsubTax = subscribeTax(() => { loadTaxIntoForm(); });
}

function switchTab(name) {
  document.querySelectorAll('.topbar .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'dashboard') loadDashboard();
  if (name === 'orders') loadAllOrders();
  if (name === 'users') loadUsers();
  if (name === 'tax') loadTaxIntoForm();
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
// USERS TAB
// ----------------------------------------------------------------
async function loadUsers() {
  const tb = document.querySelector('#usersTable tbody');
  if (!tb) return;
  if (!isSupabaseReady()) {
    tb.innerHTML = '<tr><td colspan="6" class="empty-row">Supabase not configured. Configure it in <code>js/supabase-config.js</code> to manage users.</td></tr>';
    return;
  }
  tb.innerHTML = '<tr><td colspan="6" class="empty-row">Loading…</td></tr>';
  try {
    A.users = await loadStaffUsers();
    renderUsersTable();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (msg.includes('staff_users') || msg.includes('PGRST205') || msg.includes('schema cache')) {
      tb.innerHTML = `<tr><td colspan="6" class="empty-row">
        <b>The <code>staff_users</code> table is missing from your database.</b><br>
        Run the latest <code>sql/schema.sql</code> in your Supabase SQL Editor to create it
        (plus the <code>tax_settings</code> table and the <code>fbr_tax</code>/<code>pra_tax</code> columns on orders).
      </td></tr>`;
    } else {
      showToast('Users load failed: ' + msg, 'error');
    }
  }
}

function renderUsersTable() {
  const tb = document.querySelector('#usersTable tbody');
  if (!A.users.length) {
    tb.innerHTML = `<tr><td colspan="6" class="empty-row">
      No staff users yet. Click <b>+ Add User</b> to create the first account.
      <br><br>Tip: after creating a user, they can log in at <code>pos.html</code>.
    </td></tr>`;
    return;
  }
  tb.innerHTML = A.users.map(u => {
    const roleClass = (u.role || 'cashier').toLowerCase();
    return `<tr>
      <td><b>${escapeHTML(u.username)}</b></td>
      <td>${escapeHTML(u.displayName)}</td>
      <td><span class="badge-role ${roleClass}">${escapeHTML(u.role)}</span></td>
      <td>${u.active
        ? '<span class="badge badge-user-active">Active</span>'
        : '<span class="badge badge-user-disabled">Disabled</span>'}</td>
      <td>${u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" data-edit-user="${u.id}">✏️ Edit</button>
          <button class="row-btn danger" data-del-user="${u.id}">🗑️ Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  tb.querySelectorAll('[data-edit-user]').forEach(b => b.addEventListener('click', () => {
    const u = A.users.find(x => x.id === Number(b.dataset.editUser));
    if (u) openUserModal(u);
  }));
  tb.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', () => {
    const u = A.users.find(x => x.id === Number(b.dataset.delUser));
    if (u) confirmDeleteUser(u);
  }));
}

function openUserModal(user) {
  A.editingUserId = user ? user.id : null;
  const f = document.getElementById('userForm');
  f.reset();
  document.getElementById('userModalEyebrow').textContent = user ? 'Edit User' : 'New User';
  document.getElementById('userModalTitle').textContent = user ? 'Edit POS User' : 'Add POS User';
  document.getElementById('userUsername').value = user ? user.username : '';
  document.getElementById('userUsername').disabled = !!user;
  document.getElementById('userDisplayName').value = user ? user.displayName : '';
  document.getElementById('userRole').value = user ? user.role : 'cashier';
  document.getElementById('userActive').value = user ? (user.active ? '1' : '0') : '1';
  // Password is optional on edit; required on new.
  const pwdField = document.getElementById('userPassword');
  pwdField.value = '';
  pwdField.required = !user;
  const hint = document.getElementById('userPasswordHint');
  if (user) {
    hint.textContent = 'Leave blank to keep the existing password.';
  } else {
    hint.textContent = 'Set an initial password. You can change it later by editing the user.';
  }
  document.getElementById('userModal').classList.add('open');
  setTimeout(() => document.getElementById(user ? 'userDisplayName' : 'userUsername').focus(), 50);
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('open');
  A.editingUserId = null;
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('userUsername').value.trim().toLowerCase();
  const displayName = document.getElementById('userDisplayName').value.trim();
  const role = document.getElementById('userRole').value;
  const active = document.getElementById('userActive').value === '1';
  const password = document.getElementById('userPassword').value;

  if (!username || !displayName) {
    showToast('Username and display name are required', 'warning');
    return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    showToast('Username must be 3-20 lowercase letters, digits or _', 'warning');
    return;
  }
  if (!A.editingUserId && password.length < 4) {
    showToast('Password must be at least 4 characters', 'warning');
    return;
  }
  // Uniqueness check (client-side; DB also enforces unique)
  const dup = A.users.find(u => u.username === username && u.id !== A.editingUserId);
  if (dup) {
    showToast('A user with this username already exists', 'error');
    return;
  }

  try {
    await saveStaffUser({
      id: A.editingUserId || null,
      username, displayName, role, active,
      password: password || undefined
    });
    showToast(A.editingUserId ? '✓ User updated' : '✓ User created', 'success');
    closeUserModal();
    await loadUsers();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

function confirmDeleteUser(user) {
  if (!confirm(`Delete user "${user.username}"? They will no longer be able to log in to POS.`)) return;
  deleteStaffUser(user.id).then(() => {
    showToast('✓ User deleted', 'success');
    loadUsers();
  }).catch(err => showToast('Delete failed: ' + err.message, 'error'));
}

// ----------------------------------------------------------------
// TAX TAB
// ----------------------------------------------------------------
async function loadTaxIntoForm() {
  try {
    A.tax = await loadTaxSettings();
  } catch (e) { A.tax = getTaxSettings(); }
  if (!document.getElementById('fbrRate')) return; // tab not in DOM
  document.getElementById('fbrEnabled').checked = A.tax.fbrEnabled;
  document.getElementById('fbrRate').value = A.tax.fbrRatePct;
  document.getElementById('fbrLabel').value = A.tax.fbrLabel;
  document.getElementById('praEnabled').checked = A.tax.praEnabled;
  document.getElementById('praRateCash').value = (A.tax.praRateCashPct != null ? A.tax.praRateCashPct : A.tax.praRatePct);
  document.getElementById('praRateCard').value = (A.tax.praRateCardPct != null ? A.tax.praRateCardPct : A.tax.praRatePct);
  document.getElementById('praLabel').value = A.tax.praLabel;
  document.getElementById('pricesInclusive').checked = A.tax.pricesInclusive;
  renderBeverageCategoryCheckboxes(A.tax.beverageCategories || []);
  renderTaxPreview();
}

function renderBeverageCategoryCheckboxes(selected) {
  const sel = new Set(selected || []);
  const grid = document.getElementById('bevCatGrid');
  // Use the real CATEGORIES from menu-data.js — their slugs match what
  // items actually have. ADMIN_CATS uses different slugs ('coffees' vs
  // 'coffee'), so it must NOT be used here.
  const cats = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).filter(c => c.id !== 'all');
  grid.innerHTML = cats.map(c => `
    <label>
      <input type="checkbox" data-bev-cat="${c.id}" ${sel.has(c.id) ? 'checked' : ''}>
      ${c.icon || '🍽️'} ${escapeHTML(c.name)}
    </label>
  `).join('');
  grid.querySelectorAll('[data-bev-cat]').forEach(cb => cb.addEventListener('change', renderTaxPreview));
}

function getSelectedBeverageCategories() {
  return Array.from(document.querySelectorAll('[data-bev-cat]:checked')).map(cb => cb.dataset.bevCat);
}

function renderTaxPreview() {
  const el = document.getElementById('taxPreview');
  if (!el) return;
  // Gather current form values
  const fbrEnabled = document.getElementById('fbrEnabled').checked;
  const fbrRate = parseFloat(document.getElementById('fbrRate').value) || 0;
  const fbrLabel = document.getElementById('fbrLabel').value || 'FBR';
  const praEnabled = document.getElementById('praEnabled').checked;
  const praRateCash = parseFloat(document.getElementById('praRateCash').value) || 0;
  const praRateCard = parseFloat(document.getElementById('praRateCard').value) || 0;
  const praLabel = document.getElementById('praLabel').value || 'PRA';
  const inclusive = document.getElementById('pricesInclusive').checked;
  const bevCats = getSelectedBeverageCategories();

  // Demo cart: 1 food item Rs 500 + 1 beverage Rs 690
  const demoCart = [
    { price: 500, qty: 1, category: 'breads', name: 'Sample Bread' },
    { price: 690, qty: 1, category: 'coffee', name: 'Sample Coffee' }
  ];
  const tax = {
    fbrEnabled, fbrRatePct: fbrRate, fbrLabel,
    praEnabled, praRateCashPct: praRateCash, praRateCardPct: praRateCard, praLabel,
    beverageCategories: bevCats,
    pricesInclusive: inclusive
  };
  // Compute totals for both payment methods so the owner sees the difference.
  const tCash = calcCartTotalsWithTax(demoCart, tax, 'cash');
  const tCard = calcCartTotalsWithTax(demoCart, tax, 'card');

  el.innerHTML = `
    <div class="tp-row"><span>Food item (Rs 500)</span><span>→ ${fbrEnabled ? fbrRate + '% ' + escapeHTML(fbrLabel) : 'no FBR'}</span></div>
    <div class="tp-row"><span>Beverage (Rs 690)</span><span>→ ${praEnabled ? praRateCash + '% / ' + praRateCard + '% ' + escapeHTML(praLabel) : 'no PRA'}</span></div>
    <div class="tp-row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px;font-weight:600;"><span>CASH ORDER</span><span></span></div>
    <div class="tp-row"><span>Subtotal</span><span>Rs ${tCash.subtotal.toLocaleString('en-PK')}</span></div>
    ${fbrEnabled ? `<div class="tp-row"><span>${escapeHTML(fbrLabel)} (${fbrRate}%)</span><span>Rs ${tCash.fbrTax.toLocaleString('en-PK')}</span></div>` : ''}
    ${praEnabled ? `<div class="tp-row"><span>${escapeHTML(praLabel)} (${praRateCash}% · Cash)</span><span>Rs ${tCash.praTax.toLocaleString('en-PK')}</span></div>` : ''}
    <div class="tp-row grand"><span>Grand Total (Cash)</span><span>Rs ${tCash.total.toLocaleString('en-PK')}</span></div>
    <div class="tp-row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:6px;font-weight:600;"><span>CARD / ONLINE ORDER</span><span></span></div>
    <div class="tp-row"><span>Subtotal</span><span>Rs ${tCard.subtotal.toLocaleString('en-PK')}</span></div>
    ${fbrEnabled ? `<div class="tp-row"><span>${escapeHTML(fbrLabel)} (${fbrRate}%)</span><span>Rs ${tCard.fbrTax.toLocaleString('en-PK')}</span></div>` : ''}
    ${praEnabled ? `<div class="tp-row"><span>${escapeHTML(praLabel)} (${praRateCard}% · Card)</span><span>Rs ${tCard.praTax.toLocaleString('en-PK')}</span></div>` : ''}
    <div class="tp-row grand"><span>Grand Total (Card)</span><span>Rs ${tCard.total.toLocaleString('en-PK')}</span></div>
  `;
}

async function saveTax() {
  const praRateCash = parseFloat(document.getElementById('praRateCash').value) || 0;
  const praRateCard = parseFloat(document.getElementById('praRateCard').value) || 0;
  const payload = {
    fbrEnabled: document.getElementById('fbrEnabled').checked,
    fbrRatePct: parseFloat(document.getElementById('fbrRate').value) || 0,
    fbrLabel: document.getElementById('fbrLabel').value.trim() || 'FBR Sales Tax',
    praEnabled: document.getElementById('praEnabled').checked,
    // Keep legacy field in sync with the cash rate for backward compatibility.
    praRatePct: praRateCash,
    praRateCashPct: praRateCash,
    praRateCardPct: praRateCard,
    praLabel: document.getElementById('praLabel').value.trim() || 'PRA Punjab Tax',
    beverageCategories: getSelectedBeverageCategories(),
    pricesInclusive: document.getElementById('pricesInclusive').checked
  };
  try {
    await saveTaxSettings(payload);
    showToast('✓ Tax settings saved', 'success');
    await loadTaxIntoForm();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  }
}

// ----------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------
// Read a file as a (compressed) data URL.
// Large images are auto-resized to max 600x600 and JPEG-compressed so the
// base64 string fits comfortably inside Supabase's REST payload limit.
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('File too large (max 8 MB)'));

    const r = new FileReader();
    r.onerror = () => reject(new Error('Read failed'));

    // For non-image files or tiny images, just return the raw data URL.
    if (!file.type || !file.type.startsWith('image/')) {
      r.onload = () => resolve(r.result);
      r.readAsDataURL(file);
      return;
    }

    r.onload = () => {
      const raw = r.result;
      // If already small enough (<300KB), return as-is.
      if (raw.length < 300 * 1024) { resolve(raw); return; }

      // Otherwise load into an image and re-draw on a canvas at reduced size.
      const img = new Image();
      img.onload = () => {
        const MAX = 600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        try {
          // JPEG at 0.82 quality is ~5-10x smaller than the original photo.
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        } catch (e) {
          // CORS-tainted canvas (shouldn't happen for uploaded files) — fall back.
          resolve(raw);
        }
      };
      img.onerror = () => resolve(raw);  // If image fails to load, fall back to raw.
      img.src = raw;
    };

    r.readAsDataURL(file);
  });
}

// (showToast, escapeHTML, formatPrice, formatDateTime are provided by utils.js)
