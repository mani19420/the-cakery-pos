/**
 * The Cakery POS - Supabase Configuration
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://supabase.com → create free account
 * 2. Create a new project
 * 3. Run the SQL from sql/schema.sql in the Supabase SQL Editor
 * 4. Go to Project Settings → API
 * 5. Copy your "Project URL" and "anon public" key
 * 6. Paste them below (replace the placeholder strings)
 * 7. Save this file and redeploy to Vercel
 *
 * NOTE: The anon key is designed to be public. Security is enforced
 * via Supabase Row Level Security (RLS) policies in sql/schema.sql.
 */

// =================================================================
// 👇 REPLACE THESE TWO VALUES WITH YOUR OWN SUPABASE CREDENTIALS
// =================================================================
const SUPABASE_URL = https://cucnlraokynuesehjmav.supabase.co
const SUPABASE_ANON_KEY = sb_publishable_FqwYhiLyxpF62xBhEeqy-g_iMjGGQsV
// =================================================================

// Detect if Supabase is configured
const SUPABASE_CONFIGURED =
  typeof SUPABASE_URL !== 'undefined' &&
  SUPABASE_URL &&
  !SUPABASE_URL.includes('YOUR-PROJECT-REF') &&
  !SUPABASE_URL.includes('YOUR_') &&
  typeof SUPABASE_ANON_KEY !== 'undefined' &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_ANON_KEY.includes('YOUR_');

// Initialize client only if the lib is loaded and configured
let supabaseClient = null;
if (SUPABASE_CONFIGURED && typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: { eventsPerSecond: 20 },
      multiTab: true
    }
  });
}

// Helper to check readiness everywhere
function isSupabaseReady() {
  return SUPABASE_CONFIGURED && supabaseClient !== null;
}

// Expose
if (typeof window !== 'undefined') {
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
  window.SUPABASE_CONFIGURED = SUPABASE_CONFIGURED;
  window.supabaseClient = supabaseClient;
  window.isSupabaseReady = isSupabaseReady;
}
