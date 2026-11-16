/**
 * The Cakery POS - Menu Store
 *
 * Single source of truth for menu items and brand settings across
 * customer / POS / admin pages.
 *
 * Loading order:
 *   1. If Supabase is configured AND online → fetch from `menu_items` table
 *   2. If Supabase is NOT configured (demo mode) → use MENU_DATA from menu-data.js
 *   3. Cache the result in localStorage so the page loads instantly next time
 *
 * Writes (admin only):
 *   - saveMenuItem(item)      → upsert
 *   - deleteMenuItem(id)      → delete
 *   - seedMenuFromLocal()    → copy MENU_DATA into the database (one-time)
 *   - saveBrandSettings(b)   → upsert on id=1
 *
 * Realtime:
 *   - subscribeMenu(cb) / subscribeBrand(cb) → called when DB changes
 */

// ----------------------------------------------------------------
// MENU_DATA fallback (loaded by menu-data.js before this file)
// ----------------------------------------------------------------
// If menu-data.js failed to load (should never happen), keep a tiny
// fallback so the page does not crash.
const MENU_DATA_FALLBACK = [
  { id: 'br01', name: 'Baguette', category: 'breads', price: 350, desc: 'Classic French crusty baguette', emoji: '🥖' }
];

// ----------------------------------------------------------------
// Storage keys
// ----------------------------------------------------------------
const MENU_CACHE_KEY = 'cakery_menu_cache';
const BRAND_CACHE_KEY = 'cakery_brand_cache';

// In-memory cache (so all callers share one source)
let _menuCache = null;
let _brandCache = null;

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function _getMenuFallback() {
  return (typeof MENU_DATA !== 'undefined' && Array.isArray(MENU_DATA) && MENU_DATA.length)
    ? MENU_DATA
    : MENU_DATA_FALLBACK;
}

function _readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function _writeCache(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

// Normalize a DB row into the shape the customer/POS expect
function _normalizeRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price) || 0,
    originalPrice: row.original_price != null ? Number(row.original_price) : undefined,
    desc: row.description || '',
    emoji: row.emoji || '🍽️',
    imageUrl: row.image_url || '',
    popular: !!row.popular,
    available: row.available !== false,    // default true
    sortOrder: Number(row.sort_order) || 0
  };
}

// ----------------------------------------------------------------
// READ: menu items
// ----------------------------------------------------------------
async function loadMenu() {
  // 1. Supabase mode
  if (isSupabaseReady()) {
    try {
      const { data, error } = await supabaseClient
        .from('menu_items')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });
      if (error) throw error;
      if (data && data.length) {
        _menuCache = data.map(_normalizeRow);
        _writeCache(MENU_CACHE_KEY, _menuCache);
        return _menuCache;
      }
      // Empty DB → fall through to local fallback (admin has not seeded yet)
    } catch (e) {
      console.warn('menu-store: Supabase read failed, using cache/fallback:', e.message);
    }
  }

  // 2. Cached (last good Supabase fetch)
  const cached = _readCache(MENU_CACHE_KEY);
  if (cached && cached.length) {
    _menuCache = cached;
    return _menuCache;
  }

  // 3. Hard-coded MENU_DATA (demo mode, or first run before seeding)
  _menuCache = _getMenuFallback().slice();
  return _menuCache;
}

// Synchronous access (returns cached value, or the fallback immediately)
function getMenu() {
  if (_menuCache && _menuCache.length) return _menuCache;
  const cached = _readCache(MENU_CACHE_KEY);
  if (cached && cached.length) { _menuCache = cached; return _menuCache; }
  _menuCache = _getMenuFallback().slice();
  return _menuCache;
}

// ----------------------------------------------------------------
// READ: brand settings
// ----------------------------------------------------------------
async function loadBrand() {
  if (isSupabaseReady()) {
    try {
      const { data, error } = await supabaseClient
        .from('brand_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        _brandCache = {
          brandName: data.brand_name || 'The Cakery',
          tagline: data.tagline || 'Order From Your Table',
          logoUrl: data.logo_url || '',
          logoEmoji: data.logo_emoji || '🧁',
          accentColor: data.accent_color || '#1C1C1A'
        };
        _writeCache(BRAND_CACHE_KEY, _brandCache);
        return _brandCache;
      }
    } catch (e) {
      console.warn('menu-store: brand read failed, using fallback:', e.message);
    }
  }
  const cached = _readCache(BRAND_CACHE_KEY);
  if (cached) { _brandCache = cached; return _brandCache; }
  _brandCache = {
    brandName: 'The Cakery',
    tagline: 'Order From Your Table',
    logoUrl: '',
    logoEmoji: '🧁',
    accentColor: '#1C1C1A'
  };
  return _brandCache;
}

function getBrand() {
  if (_brandCache) return _brandCache;
  const cached = _readCache(BRAND_CACHE_KEY);
  if (cached) { _brandCache = cached; return _brandCache; }
  return {
    brandName: 'The Cakery',
    tagline: 'Order From Your Table',
    logoUrl: '',
    logoEmoji: '🧁',
    accentColor: '#1C1C1A'
  };
}

// ----------------------------------------------------------------
// WRITE: menu items (admin only — requires Supabase)
// ----------------------------------------------------------------
async function saveMenuItem(item) {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured. Admin panel needs a live database.');
  }
  const row = {
    id: item.id,
    name: item.name,
    category: item.category,
    price: Number(item.price) || 0,
    original_price: item.originalPrice != null && item.originalPrice !== '' ? Number(item.originalPrice) : null,
    description: item.desc || '',
    emoji: item.emoji || '🍽️',
    image_url: item.imageUrl || '',
    popular: !!item.popular,
    available: item.available !== false,
    sort_order: Number(item.sortOrder) || 0
  };
  const { data, error } = await supabaseClient
    .from('menu_items')
    .upsert([row], { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  // Refresh cache
  await loadMenu();
  return _normalizeRow(data);
}

async function deleteMenuItem(id) {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured. Admin panel needs a live database.');
  }
  const { error } = await supabaseClient
    .from('menu_items')
    .delete()
    .eq('id', id);
  if (error) throw error;
  await loadMenu();
}

// One-time: copy MENU_DATA into the database so the customer/POS pages
// can start reading from Supabase instead of the hard-coded list.
async function seedMenuFromLocal() {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured. Cannot seed.');
  }
  const local = _getMenuFallback();
  const rows = local.map((it, idx) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    price: Number(it.price) || 0,
    original_price: it.originalPrice != null ? Number(it.originalPrice) : null,
    description: it.desc || '',
    emoji: it.emoji || '🍽️',
    image_url: '',
    popular: !!it.popular,
    available: true,
    sort_order: idx
  }));
  const { error } = await supabaseClient
    .from('menu_items')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  await loadMenu();
  return rows.length;
}

// ----------------------------------------------------------------
// WRITE: brand settings (admin only)
// ----------------------------------------------------------------
async function saveBrandSettings(b) {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured. Admin panel needs a live database.');
  }
  const row = {
    id: 1,
    brand_name: b.brandName || 'The Cakery',
    tagline: b.tagline || 'Order From Your Table',
    logo_url: b.logoUrl || '',
    logo_emoji: b.logoEmoji || '🧁',
    accent_color: b.accentColor || '#1C1C1A'
  };
  const { data, error } = await supabaseClient
    .from('brand_settings')
    .upsert([row], { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  _brandCache = {
    brandName: data.brand_name,
    tagline: data.tagline,
    logoUrl: data.logo_url,
    logoEmoji: data.logo_emoji,
    accentColor: data.accent_color
  };
  _writeCache(BRAND_CACHE_KEY, _brandCache);
  return _brandCache;
}

// ----------------------------------------------------------------
// READ: sales analytics (admin only)
// ----------------------------------------------------------------
// Returns aggregated sales stats from the orders table.
async function loadSalesStats(range) {
  if (!isSupabaseReady()) {
    return { totalOrders: 0, totalRevenue: 0, avgOrder: 0, topItems: [], recentOrders: [], byDay: [] };
  }
  const now = new Date();
  let since = new Date(0);
  if (range === 'today') {
    since = new Date(); since.setHours(0, 0, 0, 0);
  } else if (range === '7d') {
    since = new Date(); since.setDate(since.getDate() - 7);
  } else if (range === '30d') {
    since = new Date(); since.setDate(since.getDate() - 30);
  }

  try {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('id, order_number, table_number, items, subtotal, tax, total, status, created_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    const orders = data || [];

    // Aggregate
    const servedOrAll = orders.filter(o => o.status !== 'rejected');
    const totalRevenue = servedOrAll.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalOrders = servedOrAll.length;
    const avgOrder = totalOrders ? totalRevenue / totalOrders : 0;

    // Top items (by revenue)
    const itemAgg = {};
    servedOrAll.forEach(o => {
      (o.items || []).forEach(it => {
        const key = it.name || it.id || 'Unknown';
        if (!itemAgg[key]) itemAgg[key] = { name: key, qty: 0, revenue: 0, emoji: it.emoji || '🍽️' };
        itemAgg[key].qty += Number(it.qty || 1);
        itemAgg[key].revenue += (Number(it.price || 0) * Number(it.qty || 1));
      });
    });
    const topItems = Object.values(itemAgg)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // By-day breakdown (for chart)
    const byDay = {};
    servedOrAll.forEach(o => {
      const d = new Date(o.created_at);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!byDay[key]) byDay[key] = { date: key, orders: 0, revenue: 0 };
      byDay[key].orders += 1;
      byDay[key].revenue += Number(o.total || 0);
    });
    const byDayArr = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalOrders,
      totalRevenue,
      avgOrder,
      topItems,
      recentOrders: orders.slice(0, 50),
      byDay: byDayArr
    };
  } catch (e) {
    console.error('loadSalesStats error:', e.message);
    return { totalOrders: 0, totalRevenue: 0, avgOrder: 0, topItems: [], recentOrders: [], byDay: [], error: e.message };
  }
}

// ----------------------------------------------------------------
// REALTIME subscriptions
// ----------------------------------------------------------------
function subscribeMenu(callback) {
  if (!isSupabaseReady()) return () => {};
  const channel = supabaseClient
    .channel('menu-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'menu_items' },
      async () => {
        await loadMenu();
        if (typeof callback === 'function') callback(getMenu());
      })
    .subscribe();
  return () => { supabaseClient.removeChannel(channel); };
}

function subscribeBrand(callback) {
  if (!isSupabaseReady()) return () => {};
  const channel = supabaseClient
    .channel('brand-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'brand_settings' },
      async () => {
        await loadBrand();
        if (typeof callback === 'function') callback(getBrand());
      })
    .subscribe();
  return () => { supabaseClient.removeChannel(channel); };
}

// ----------------------------------------------------------------
// Expose
// ----------------------------------------------------------------
if (typeof window !== 'undefined') {
  Object.assign(window, {
    loadMenu, getMenu,
    loadBrand, getBrand,
    saveMenuItem, deleteMenuItem, seedMenuFromLocal,
    saveBrandSettings,
    loadSalesStats,
    subscribeMenu, subscribeBrand
  });
}
