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
    logoUrl: 'images/logo.png',
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
    logoUrl: 'images/logo.png',
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
    image_url: it.imageUrl || '',
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
// TAX SETTINGS — single-row (id=1). Read + write + cache.
// ----------------------------------------------------------------
const TAX_CACHE_KEY = 'cakery_tax_cache';
let _taxCache = null;

// Fallback used when Supabase not configured (demo mode).
// Slugs here MUST match the category slugs in menu-data.js (CATEGORIES).
// NOTE: PRA rate now depends on payment method (cash vs card).
const TAX_FALLBACK = {
  fbrEnabled: true,
  fbrRatePct: 18,
  fbrLabel: 'FBR Sales Tax',
  praEnabled: true,
  praRatePct: 16,          // legacy field, kept for backward compat (treated as the cash rate)
  praRateCashPct: 16,
  praRateCardPct: 8,
  praLabel: 'PRA Punjab Tax',
  beverageCategories: ['coffee', 'matcha', 'ncaffeine', 'onrocks', 'tea'],
  pricesInclusive: false
};

function _normalizeTaxRow(row) {
  let bevCats = row.beverage_categories;
  if (typeof bevCats === 'string') {
    try { bevCats = JSON.parse(bevCats); } catch (e) { bevCats = []; }
  }
  if (!Array.isArray(bevCats)) bevCats = [];
  return {
    fbrEnabled: row.fbr_enabled !== false,
    fbrRatePct: Number(row.fbr_rate_pct) || 0,
    fbrLabel: row.fbr_label || 'FBR Sales Tax',
    praEnabled: row.pra_enabled !== false,
    // PRA rate is now payment-method-aware: cash vs card.
    // Fall back to the legacy single rate if the new columns are absent.
    praRatePct: Number(row.pra_rate_pct) || 0,
    praRateCashPct: (row.pra_rate_cash_pct != null) ? Number(row.pra_rate_cash_pct) : (Number(row.pra_rate_pct) || 0),
    praRateCardPct: (row.pra_rate_card_pct != null) ? Number(row.pra_rate_card_pct) : (Number(row.pra_rate_pct) || 0),
    praLabel: row.pra_label || 'PRA Punjab Tax',
    beverageCategories: bevCats,
    pricesInclusive: !!row.prices_inclusive
  };
}

async function loadTaxSettings() {
  if (isSupabaseReady()) {
    try {
      const { data, error } = await supabaseClient
        .from('tax_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        _taxCache = _normalizeTaxRow(data);
        _writeCache(TAX_CACHE_KEY, _taxCache);
        return _taxCache;
      }
    } catch (e) {
      console.warn('menu-store: tax read failed, using fallback:', e.message);
    }
  }
  const cached = _readCache(TAX_CACHE_KEY);
  if (cached) { _taxCache = cached; return _taxCache; }
  _taxCache = { ...TAX_FALLBACK };
  return _taxCache;
}

function getTaxSettings() {
  if (_taxCache) return _taxCache;
  const cached = _readCache(TAX_CACHE_KEY);
  if (cached) { _taxCache = cached; return _taxCache; }
  _taxCache = { ...TAX_FALLBACK };
  return _taxCache;
}

async function saveTaxSettings(t) {
  // v9: demo mode (no Supabase) — persist to localStorage so the admin
  // Tax tab still works for testing, and the customer cart / POS bills
  // pick the rates up instantly via getTaxSettings().
  if (!isSupabaseReady()) {
    _taxCache = {
      fbrEnabled: !!t.fbrEnabled,
      fbrRatePct: Number(t.fbrRatePct) || 0,
      fbrLabel: t.fbrLabel || 'FBR Sales Tax',
      praEnabled: !!t.praEnabled,
      praRatePct: Number(t.praRateCashPct != null ? t.praRateCashPct : t.praRatePct) || 0,
      praRateCashPct: Number(t.praRateCashPct != null ? t.praRateCashPct : t.praRatePct) || 0,
      praRateCardPct: Number(t.praRateCardPct != null ? t.praRateCardPct : t.praRatePct) || 0,
      praLabel: t.praLabel || 'PRA Punjab Tax',
      beverageCategories: Array.isArray(t.beverageCategories) ? t.beverageCategories : [],
      pricesInclusive: !!t.pricesInclusive
    };
    _writeCache(TAX_CACHE_KEY, _taxCache);
    return _taxCache;
  }
  const row = {
    id: 1,
    fbr_enabled: !!t.fbrEnabled,
    fbr_rate_pct: Number(t.fbrRatePct) || 0,
    fbr_label: t.fbrLabel || 'FBR Sales Tax',
    pra_enabled: !!t.praEnabled,
    // Keep the legacy single rate in sync with the cash rate for backward compat.
    pra_rate_pct: Number(t.praRateCashPct != null ? t.praRateCashPct : t.praRatePct) || 0,
    pra_rate_cash_pct: Number(t.praRateCashPct != null ? t.praRateCashPct : t.praRatePct) || 0,
    pra_rate_card_pct: Number(t.praRateCardPct != null ? t.praRateCardPct : t.praRatePct) || 0,
    pra_label: t.praLabel || 'PRA Punjab Tax',
    beverage_categories: JSON.stringify(t.beverageCategories || []),
    prices_inclusive: !!t.pricesInclusive
  };
  // v9: UPDATE-first strategy. The tax_settings RLS policy allows UPDATE
  // but not INSERT (fixed in sql/migration-v9.sql, but older deployments
  // may not have run it), so a plain upsert fails with
  // "violates row-level security policy". Try the update; only if no row
  // was affected, fall back to insert.
  const { data: updData, error: updError } = await supabaseClient
    .from('tax_settings')
    .update(row)
    .eq('id', 1)
    .select()
    .maybeSingle();
  if (!updError && updData) {
    _taxCache = _normalizeTaxRow(updData);
    _writeCache(TAX_CACHE_KEY, _taxCache);
    return _taxCache;
  }
  // No row yet (or update blocked) → insert it. If this fails too,
  // surface the original error.
  const { data, error } = await supabaseClient
    .from('tax_settings')
    .upsert([row], { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  _taxCache = _normalizeTaxRow(data);
  _writeCache(TAX_CACHE_KEY, _taxCache);
  return _taxCache;
}

// ----------------------------------------------------------------
// DUAL TAX CALCULATION
// Given a cart array [{id, name, price, qty, category, ...}], returns
//   { subtotal, fbrTax, praTax, totalTax, total, fbrBase, praBase, praRatePct }
// fbrBase = sum of food items (not beverages) — FBR applies
// praBase = sum of beverage items — PRA applies
// If pricesInclusive is true, taxes are extracted from the prices
// instead of added on top.
// `paymentMethod` ('cash' | 'card') selects the PRA rate: cash uses
// praRateCashPct, card uses praRateCardPct. If null/unknown, falls back
// to the legacy praRatePct (treated as the cash rate).
// ----------------------------------------------------------------
function calcCartTotalsWithTax(cart, tax, paymentMethod) {
  tax = tax || getTaxSettings();
  let fbrBase = 0;
  let praBase = 0;
  const bevSet = new Set(tax.beverageCategories || []);
  cart.forEach(i => {
    const line = Number(i.price || 0) * Number(i.qty || 1);
    if (bevSet.has(i.category)) praBase += line;
    else fbrBase += line;
  });
  const subtotal = fbrBase + praBase;

  // Pick the PRA rate based on payment method.
  // card → praRateCardPct (8%), cash → praRateCashPct (16%).
  // Default to cash rate if unknown.
  let praRatePct = 0;
  if (tax.praEnabled) {
    if (paymentMethod === 'card' && tax.praRateCardPct != null) {
      praRatePct = Number(tax.praRateCardPct) || 0;
    } else if (paymentMethod === 'cash' && tax.praRateCashPct != null) {
      praRatePct = Number(tax.praRateCashPct) || 0;
    } else {
      // Unknown / legacy: use the single rate field (kept in sync with cash rate).
      praRatePct = Number(tax.praRatePct != null ? tax.praRatePct : (tax.praRateCashPct || 0)) || 0;
    }
  }

  let fbrTax = 0, praTax = 0;
  if (tax.pricesInclusive) {
    // Taxes already inside the prices: extract them so the bill shows the split.
    if (tax.fbrEnabled && fbrBase > 0) {
      fbrTax = Math.round(fbrBase - (fbrBase / (1 + tax.fbrRatePct / 100)));
    }
    if (tax.praEnabled && praBase > 0 && praRatePct > 0) {
      praTax = Math.round(praBase - (praBase / (1 + praRatePct / 100)));
    }
    const total = subtotal;
    return { subtotal, fbrTax, praTax, totalTax: fbrTax + praTax, total, fbrBase, praBase, praRatePct };
  }
  if (tax.fbrEnabled && fbrBase > 0) {
    fbrTax = Math.round(fbrBase * (tax.fbrRatePct / 100));
  }
  if (tax.praEnabled && praBase > 0 && praRatePct > 0) {
    praTax = Math.round(praBase * (praRatePct / 100));
  }
  const total = subtotal + fbrTax + praTax;
  return { subtotal, fbrTax, praTax, totalTax: fbrTax + praTax, total, fbrBase, praBase, praRatePct };
}

// ----------------------------------------------------------------
// STAFF USERS — CRUD (admin only)
// ----------------------------------------------------------------
function _hashPassword(password, salt) {
  // SHA-256 via SubtleCrypto when available; otherwise a simple JS fallback.
  // Returns a hex string.
  return new Promise((resolve) => {
    if (window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder();
      window.crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + password))
        .then(buf => {
          const hex = Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(hex);
        })
        .catch(() => resolve(_fallbackHash(salt + ':' + password)));
    } else {
      resolve(_fallbackHash(salt + ':' + password));
    }
  });
}
function _fallbackHash(str) {
  // FNV-1a — not cryptographically strong, but works without SubtleCrypto.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}
function _genSalt() {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

async function loadStaffUsers() {
  if (!isSupabaseReady()) return [];
  const { data, error } = await supabaseClient
    .from('staff_users')
    .select('id, username, display_name, role, active, last_login_at, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    active: r.active !== false,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at
  }));
}

async function saveStaffUser(user) {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured. Admin panel needs a live database.');
  }
  if (!user.username || !user.displayName) throw new Error('Username and display name required');
  const username = String(user.username).toLowerCase().trim();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new Error('Username must be 3-20 lowercase letters, digits or _');
  }

  if (user.id) {
    // UPDATE
    const patch = {
      username,
      display_name: user.displayName,
      role: user.role || 'cashier',
      active: user.active !== false,
      updated_at: new Date().toISOString()
    };
    if (user.password) {
      const salt = _genSalt();
      patch.password_hash = await _hashPassword(user.password, salt);
      patch.password_salt = salt;
    }
    const { data, error } = await supabaseClient
      .from('staff_users')
      .update(patch)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  // INSERT
  const salt = _genSalt();
  const hash = await _hashPassword(user.password || 'changeme', salt);
  const row = {
    username,
    display_name: user.displayName,
    role: user.role || 'cashier',
    active: user.active !== false,
    password_hash: hash,
    password_salt: salt
  };
  const { data, error } = await supabaseClient
    .from('staff_users')
    .insert([row])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteStaffUser(id) {
  if (!isSupabaseReady()) {
    throw new Error('Supabase is not configured.');
  }
  const { error } = await supabaseClient
    .from('staff_users')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// POS login: verify username + password against the staff_users table.
// Returns { success, user, error } where user has only safe fields.
async function verifyStaffLogin(username, password) {
  if (!isSupabaseReady()) {
    return { success: false, error: 'Supabase not configured', user: null };
  }
  try {
    const uname = String(username || '').toLowerCase().trim();
    const { data, error } = await supabaseClient
      .from('staff_users')
      .select('id, username, display_name, role, active, password_hash, password_salt')
      .eq('username', uname)
      .maybeSingle();
    if (error) {
      // Detect "table missing" error and return a clearer message.
      const msg = error.message || '';
      if (msg.includes('staff_users') || msg.includes('PGRST205') || msg.includes('schema cache')) {
        return { success: false, error: 'Staff login is not set up yet. Run sql/migration-v4.sql in your Supabase SQL Editor.', user: null };
      }
      throw error;
    }
    if (!data) return { success: false, error: 'Unknown user', user: null };
    if (data.active === false) return { success: false, error: 'Account disabled', user: null };
    const expected = await _hashPassword(password, data.password_salt);
    if (expected !== data.password_hash) {
      return { success: false, error: 'Wrong password', user: null };
    }
    // Update last_login_at (best effort, ignore errors)
    supabaseClient.from('staff_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.id)
      .then(() => {}, () => {});
    return {
      success: true,
      error: null,
      user: {
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        role: data.role
      }
    };
  } catch (e) {
    return { success: false, error: e.message, user: null };
  }
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

function subscribeTax(callback) {
  if (!isSupabaseReady()) return () => {};
  const channel = supabaseClient
    .channel('tax-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'tax_settings' },
      async () => {
        await loadTaxSettings();
        if (typeof callback === 'function') callback(getTaxSettings());
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
    loadTaxSettings, getTaxSettings, saveTaxSettings,
    calcCartTotalsWithTax,
    loadStaffUsers, saveStaffUser, deleteStaffUser, verifyStaffLogin,
    loadSalesStats,
    subscribeMenu, subscribeBrand, subscribeTax
  });
}
