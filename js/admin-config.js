/**
 * The Cakery POS - Admin Panel Configuration
 *
 * CHANGE THE PASSWORD BELOW before deploying to production.
 * The admin panel is a client-side password gate (NOT real server auth).
 * For a small café this is enough — anyone who has the password can edit
 * the menu and view sales. If you need real auth later, switch to
 * Supabase Auth (email + password) and replace this check.
 */

const ADMIN_CONFIG = {
  // ⚠️ CHANGE THIS. Choose something only you know.
  PASSWORD: 'cakery-admin-2026',

  // Session lifetime (ms). Default = 8 hours.
  SESSION_MS: 8 * 60 * 60 * 1000,

  // localStorage key for the session flag
  SESSION_KEY: 'cakery_admin_session'
};

// Expose
if (typeof window !== 'undefined') {
  window.ADMIN_CONFIG = ADMIN_CONFIG;
}
