# 🧁 The Cakery POS

A QR-based restaurant ordering system for **The Cakery** (Patisserie · Boulangerie · Cafè).

Customers scan a QR code at their table → see the menu → place an order. The order **pops up instantly on the POS dashboard** at the counter. Staff can accept, prepare, mark ready, serve, and print a bill.

```
[Customer phone] --scan QR--> [index.html?table=5]
                                     |
                                     | place order
                                     v
                            [Supabase orders table]
                                     |
                            (realtime websocket)
                                     v
                              [pos.html popup]
                         "Table 5 just ordered!"
```

---

## ✨ Features

### Customer (`index.html`)
- Scan QR → menu **auto-opens** immediately for that table — no Start Order picker, the table number is read from the URL (`?table=N`).
- **Dine In only** — Take Away was removed in v7. Every table has its own QR code, so the customer's table is always known. If a customer opens `index.html` without a `?table=N`, a simple "What's your table number?" prompt appears (1–8).
- 100+ items across 13 categories (breads, viennoiserie, patisserie, signature cakes, slices, chef's whisk, sandwiches, coffees, matcha, no-caffeine, on-the-rocks, tea, add-ons) — all parsed from your actual menus
- Search, category filter, popular tags
- Cart with quantity controls + special instructions
- **Cart shows dual tax breakdown** — FBR Sales Tax (18% on food items, same for cash and card) + PRA Punjab Tax (16% on Cash / 8% on Card, on beverages only). The PRA rate and total **recompute live** when the customer switches between Cash and Card at checkout.
- **Payment Method selector** at checkout — 💵 Cash / 💳 Card (a payment method must be chosen before Place Order; order type is always Dine In).
- Live order tracking (Received → Preparing → Ready → Served)
- Toasts when status changes (real-time via Supabase)
- Cart + payment choice persists per table in localStorage

### POS Dashboard (`pos.html`)
- **Staff login required** — username + password. Accounts created from Admin → Users tab. Session lasts 8 hours.
- 3-column Kanban: **New Orders / Preparing / Ready**
- **Pop-up alert slides in from the top-center of the screen** when a new order arrives, with a 🔔 bell icon that rings and a **bell sound** (three rising beeps via the Web Audio API — no audio file needed). Auto-dismisses after 12 seconds. (Toggle the sound from the POS header.)
- Each order card shows the **payment method badge** (💵 Cash / 💳 Card) at a glance (order type is always 🍽️ Dine In)
- Buttons: Accept / Reject / Mark Ready / Serve / Edit / View Bill (role-gated: waiters see view-only; cashiers can't reject)
- **✏️ Edit Order** — open any active order to change items: increase/decrease quantity, remove an item, or add a new item from the searchable menu. Tax totals (FBR + PRA) recompute live. Save writes the changes back to Supabase. (Owner / Manager / Cashier can edit; Waiter cannot.)
- **Bill shows order type, table, payment method, dual tax split** (FBR and PRA on separate lines), and the staff name who served the order
- Print bill (clean print-friendly window)
- Today's stats sidebar: total orders, revenue, average, active tables
- Recently Served history (last 15)
- Search by order #, table, or item name
- Real-time via Supabase + 10-second polling fallback
- Mobile-responsive

### QR Generator (`qr.html`)
- Set number of tables (default **8**) → auto-generates a QR card per table
- Each QR opens `index.html?table=N` → the customer lands directly on the menu for their table (no Start Order picker)
- Download each QR as PNG (high-res, print-ready) — print one per table and stick it on the table
- Persists table count in localStorage
- A pre-built `qr-codes/` folder is included in the zip with all 8 table QR PNGs + an `all-tables.pdf` (one A4 page, print + cut) — **already generated with the live URL `https://the-cakery-pos.vercel.app`**, ready to print. If you move to a different domain, regenerate by opening `qr.html` on the new deployment and downloading fresh QRs.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript (ES6+) — no build step |
| Backend / DB | Supabase (PostgreSQL + Realtime WebSocket) |
| Hosting | Vercel (static hosting, free tier) |
| Icons | Lucide Icons |
| Fonts | Playfair Display + Poppins (Google Fonts) |
| QR generation | api.qrserver.com (free, no key) |

---

## 👀 Preview Without Setup (Demo Mode)

No Supabase account needed — try the whole flow in 30 seconds:

1. **Unzip the project** anywhere on your computer.
2. **Double-click `index.html`** → it asks for your table number (1–8). Or open `index.html?table=3` directly to skip the prompt and land on the menu for Table 3.
3. Add items to the cart → **Place Order** (order is stored in your browser only).
4. **Double-click `pos.html`** (keep it open in another tab) → the order appears in the **New Orders** column, with popup + sound.
5. Click **Accept → Ready → Serve** and watch the customer tab update live.

> ⚠️ Demo mode stores orders in your browser's localStorage and syncs between tabs
> of the **same browser** only. For real phones/POS, do the Supabase setup below.
> Internet is still needed for fonts, icons and QR images (CDN).

---

## 🚀 Setup — Step by Step

### Step 1: Create a Supabase project
1. Go to <https://supabase.com> and sign up (free).
2. Click **New Project**, give it a name (e.g. `the-cakery-pos`).
3. Choose a region close to you. Set a database password (save it somewhere safe).
4. Wait ~2 minutes for provisioning to finish.

### Step 2: Create the database tables
1. In your Supabase dashboard, open **SQL Editor** (left sidebar).
2. Click **New Query**.
3. Open the file `sql/schema.sql` from this project, copy its entire content, paste it into the editor.
4. Click **Run**. You should see "Success. No rows returned."
5. Your `orders` table now exists with Row Level Security enabled and realtime turned on.

### Step 3: Get your API credentials
1. In Supabase, go to **Project Settings** (gear icon, bottom-left) → **API**.
2. Copy these two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long JWT — starts with `eyJ...`)

### Step 4: Put credentials in the project
1. Open `js/supabase-config.js` in this project.
2. Replace the two placeholder strings:
   ```js
   const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
   ```
   with your real values.
3. Save the file.

### Step 5: Deploy to Vercel
1. Push this entire project folder to a GitHub repo (or use Vercel CLI).
2. Go to <https://vercel.com> and sign in with GitHub.
3. Click **Add New… → Project**, import your repo.
4. Framework Preset: **Other** (it's plain static HTML — no build needed).
5. Build Command: leave empty. Output Directory: leave empty (root).
6. Click **Deploy**. Done in ~30 seconds.

You'll get a URL like `https://the-cakery-pos.vercel.app`. Three pages:
- `/` → customer menu (with `?table=N` in URL)
- `/pos.html` → POS dashboard
- `/qr.html` → QR code generator

### Step 6: Set up your tables
1. Open `<your-vercel-url>/qr.html`.
2. The number of tables defaults to **8** — change it if your café has more or fewer.
3. Download each table's QR as a PNG (or print the pre-built `qr-codes/all-tables.pdf` — ships in the zip already pointed at `https://the-cakery-pos.vercel.app`).
4. Place each printed QR on the matching physical table.

> **Note:** the `qr-codes/` folder shipped in the zip is generated with the real deployment URL (`https://the-cakery-pos.vercel.app`) — safe to print as-is. If you redeploy under a **different** domain, open `qr.html` there and download fresh QRs; the generator always uses your current domain automatically.

### Step 7: Run the POS
1. On your POS computer/tablet, open `<your-vercel-url>/pos.html`.
2. Keep this tab open. New orders will pop up automatically.

### Step 8: Customer flow test
1. Open `<your-vercel-url>/index.html?table=1` (simulating a scan).
2. Add items to cart → Place Order.
3. Within ~1 second, you should see a popup appear on `pos.html` 🔔.

---

## 📂 Project Structure

```
the-cakery-pos/
├── index.html              # Customer menu (opens via QR scan)
├── pos.html                # POS dashboard (counter / kitchen staff)
├── qr.html                 # QR code generator (manager)
├── vercel.json             # Vercel hosting config
├── .gitignore
├── README.md               # this file
├── sql/
│   ├── schema.sql          # Full schema — run this first (fresh install)
│   ├── migration-v4.sql     # If you already ran v1–v3, run this (staff + tax)
│   ├── migration-v5.sql     # Then this (order_type + payment_method columns)
│   └── migration-v6.sql     # Then this (PRA cash/card rates + FBR bump to 18%)
├── css/
│   ├── customer.css        # Customer page styles
│   ├── admin.css            # Admin panel styles
│   └── pos.css             # POS dashboard styles
├── js/
│   ├── supabase-config.js  # ← PASTE YOUR SUPABASE CREDENTIALS HERE
│   ├── menu-data.js        # All menu items (parsed from your PDFs)
│   ├── utils.js            # Shared helpers (Supabase calls, formatters)
│   ├── customer.js         # Customer app logic
│   ├── menu-store.js       # Menu/brand/tax store + dual-tax calculation
│   ├── admin.js             # Admin panel logic
│   └── pos.js              # POS dashboard logic
├── qr-codes/               # Pre-built QR codes for tables 1–8 (live URL, print-ready)
│   ├── table-1.png … table-8.png   # One QR per table
│   └── all-tables.pdf      # All 8 on one A4 page (print + cut)
└── assets/                 # (empty — uses emoji icons, no images needed)
```

---

## 💰 Pricing & Tax

- All prices are in **PKR** as in your menu PDFs.
- **Dual Pakistan tax system** (configured in Admin → Tax):
  - **FBR Sales Tax (18%)** — Federal Board of Revenue, applied to **food & bakery items**. Same rate for cash and card payments.
  - **PRA Punjab Tax (16% cash / 8% card)** — Punjab Revenue Authority, applied to **beverages only** (coffee, matcha, no-caffeine, on-the-rocks, tea). The rate depends on the customer's payment method.
  - The customer cart total **recomputes automatically** when switching between Cash and Card — FBR stays at 18%, PRA switches between 16% and 8%.
  - Which categories count as "beverages" is configurable (tick the beverage categories in Admin → Tax).
- GST is set to **0%** (your menu says "Exclusive of GST"). The old single-rate tax fallback in `js/utils.js` (`CAKERY.TAX_RATE`) is only used when the menu-store module is not loaded.
- Currency symbol is `Rs`. To change it, edit `CAKERY.CURRENCY` in the same file.

---

## 🔄 Order Status Flow

```
received → accepted → ready → served
   ↓
rejected (with reason)
```

| Status | Meaning | Who triggers |
|---|---|---|
| `received` | Customer just placed the order | Customer (auto) |
| `accepted` | Kitchen started preparing | POS staff clicks "Accept" |
| `ready` | Food is ready to be served | POS staff clicks "Mark Ready" |
| `served` | Handed to customer, done | POS staff clicks "Serve" |
| `rejected` | Order cancelled | POS staff clicks "Reject" |

---

## 🎨 Branding

The Cakery's actual website (`thecakery.pk`) is a JavaScript shell, so static logos/colors weren't extractable. The design uses a patisserie-appropriate palette:
- **Cream** `#FBF7F0` backgrounds
- **Warm brown** `#3D2817` text
- **Gold** `#C9A24B` accents
- **Playfair Display** serif for headings, **Poppins** for body

To use the real logo, replace `assets/` placeholder and update `index.html`/`pos.html`/`qr.html` accordingly.

---

## ⚙️ Admin Panel (`admin.html`) — NEW

A built-in admin panel where you can manage **everything** without touching code: menu items (with images, prices, sale prices, descriptions, categories), view sales analytics, manage brand identity (logo, name, tagline, accent color), and browse all past orders.

### Login
- Open `<your-url>/admin.html`
- Default password: `cakery-admin-2026`
- ⚠️ **CHANGE IT** in `js/admin-config.js` before going live (search for `PASSWORD:`)

### Features
- **📊 Dashboard** — Total revenue, order count, average order, top item, 7-day revenue chart, top-selling items list, recent orders table. Filter by Today / 7 days / 30 days / All.
- **🍴 Menu** — Full CRUD for menu items. Each item supports: name, category, price, original price (for sales), description, emoji, **real image upload** (stored as base64 in DB), popular flag, availability toggle (hide items temporarily), search + category + availability filters.
- **🧾 Orders** — Browse all past orders with status filter, view items/total/timestamp, delete individual orders.
- **👥 Users** *(NEW)* — Create POS staff accounts (username + password + role). Four roles:
  - **Owner** — full access (admin + POS + delete orders)
  - **Manager** — POS, accept/reject/serve, void orders
  - **Cashier** — POS, take & serve orders, print bills
  - **Waiter** — POS view-only (cannot change order status)
- **🧮 Tax** — Dual Pakistan tax system with **payment-method-aware PRA**:
  - **FBR** (Federal Board of Revenue) — applies to **main menu items** (food, bakery, desserts, sandwiches). **Default 18%**, same rate for cash and card.
  - **PRA** (Punjab Revenue Authority) — applies to **beverages only** (coffees, matcha, no-caffeine, on-the-rocks, tea). **Rate depends on payment method: 16% on Cash, 8% on Card / online** (Punjab restaurant services).
  - The customer cart total **recomputes automatically** when the customer switches between Cash and Card at checkout — FBR stays the same, PRA switches between 16% and 8%.
  - Tick which categories count as "beverages" — PRA applies to those only.
  - Toggle each tax on/off, edit labels and rates (separate Cash / Card rates for PRA), switch between tax-inclusive and tax-exclusive pricing.
  - Live preview shows BOTH scenarios side-by-side — a Cash order and a Card/Online order — so you can see the difference before saving.
- **🎨 Brand** — Edit brand name, tagline, logo emoji, accent color, and **upload a real logo image** (PNG/JPG, stored as base64). Changes appear instantly on customer menu and POS.

### First-time setup
1. **Run the updated SQL schema** in Supabase SQL Editor (the `sql/schema.sql` in this zip). This creates five tables: `orders`, `menu_items`, `brand_settings`, `staff_users`, `tax_settings`. Safe to re-run.
   - **If you already ran an earlier schema (v1–v5)**, run the migrations in order: `sql/migration-v4.sql` (staff + tax tables, fbr/pra columns), then `sql/migration-v5.sql` (order_type + payment_method columns), then `sql/migration-v6.sql` (the new `pra_rate_cash_pct` + `pra_rate_card_pct` columns and FBR bump to 18%). Each one is safe to re-run and never touches your existing orders.
2. **Seed the menu** — open Admin → Menu tab → click **📥 Seed from local**. This copies all 130 default items from `js/menu-data.js` into your database so you can start editing them.
3. **Upload your logo** — Admin → Brand tab → choose file → Upload → Save Brand.
4. **Create POS users** — Admin → Users tab → **+ Add User**. Pick a role (cashier, manager, etc.) and set an initial password. After saving, that staff member can log in at `pos.html` with their username + password.
5. **Confirm tax rates** — Admin → Tax tab. Defaults are **FBR 18% on food** (cash or card) + **PRA 16% on beverages paid by Cash / 8% paid by Card**. Adjust to match your actual tax registration and Save.
6. **Customize items** — Edit prices, add real photos, mark popular items, toggle availability.

### How images work
- Item images and logo are stored as **base64 strings** directly in the Supabase `menu_items.image_url` and `brand_settings.logo_url` columns. No separate storage bucket needed.
- Max file size: ~1.2 MB per image (sufficient for square product photos).
- Customer menu shows the photo automatically when present; falls back to emoji otherwise.

### Real-time sync
All admin changes (new items, price edits, brand updates) appear instantly on every open customer menu and POS screen via Supabase realtime — no refresh needed.

---

## 🔒 Security Notes

- The Supabase **anon key** is designed to be public — it's safe in frontend code.
- Real security comes from **Row Level Security (RLS) policies** (already set up in `schema.sql`).
- For production, consider tightening the `UPDATE` policy so only authenticated staff can change order status (currently anyone can, which is fine for a small café on a private network).
- To add staff login later, use Supabase Auth and add a `pos.html` password gate.

---

## 🆘 Troubleshooting

**"Supabase not configured" toast appears**
→ You haven't filled in `js/supabase-config.js` yet. See Step 4.

**Customer places order but nothing pops up on POS**
→ Check the browser console on POS page (F12). Common causes:
- Supabase URL/key mismatch
- RLS policies not applied (re-run `sql/schema.sql`)
- Realtime not enabled (the schema enables it; check Supabase → Database → Replication)

**QR images don't load**
→ `api.qrserver.com` might be blocked. Replace with any QR API, or generate locally with a JS library.

**Sound doesn't play**
→ Browsers block audio until the user interacts with the page. Click anywhere on the POS page first.

---

## 🔖 What's new in v9 — Fixes + staff & admin power features

- **Premium login screens** — both POS and Admin logins now share a warm espresso gradient with an amber glow, the serif "The Cakery" wordmark, and left-aligned labelled fields. No more emoji logos.
- **QR scan bug fixed** — the menu **always opens**, no matter what. Robust URL parsing (`?table=N`, `?t=N`, `#table=N`, junky values like `table=3/` are tolerated), falls back to the last used table, and if no table is known the menu still renders with a small non-blocking table picker on top (the page is never blank).
- **Served orders no longer linger for the customer** — once an order is served (or rejected), the customer gets the final toast and the order disappears from their "Orders" list and badge. The full record stays in the database, POS history and admin panel.
- **New-order popup fights for attention** — when an order lands, the POS now: shows the top-center popup (amber glow), plays the 3-beep bell, flashes the browser tab title "🔔 NEW ORDER!", sends an OS-level desktop Notification (permission asked right after staff login), and if the tab was hidden the popup + sound replay the moment staff switches back. Nothing is ever missed.
- **Tax settings actually save** — fixed "new row violates row-level security policy" on save: writes now go UPDATE-first with INSERT fallback, plus `sql/migration-v9.sql` adds the missing INSERT policy for older databases. Tax tab (rates, labels, beverage categories, inclusive pricing, live preview) was already editable and now persists reliably.
- **Drag & drop menu ordering** — in Admin → Menu, grab the ⠿ handle on any row and drag it up/down. The new order is written to each item's `sort_order` and the customer menu follows it instantly (live via realtime). A hint under the table explains it.
- Demo mode (no Supabase): tax edits save to localStorage, and drag-reorder works for the session with a clear toast.

**Setup note:** this demo Supabase project has the `orders` and `tax_settings` tables but not `menu_items` / `brand_settings` — run `sql/schema.sql` (then `sql/migration-v9.sql`) in the Supabase SQL Editor to create them. Until then the menu runs from the built-in `menu-data.js` list.

---

## 🔖 What's new in v8 — Brand refresh (no more "AI template" look)

The whole app now reads as a **real, designed bakery brand** instead of a generic gray template. Same features, completely refreshed visual identity:

- **Warm patisserie palette** — cream paper (#FBF7F0), espresso brown text (#2B211A), butter-amber accent (#B8841F) carried through every page. No more pure gray/black.
- **Real typography** — Inter for body text, **Playfair Display** (serif) for headings ("Our Menu", "Your Order", panel titles, brand wordmark). Loaded from Google Fonts.
- **Branded wordmark** — "The **Cakery**" with the accent on "Cakery" replaces emoji logos everywhere (navbar, POS header, admin header, login).
- **Customer menu** — pill-shaped category tabs with a right-edge fade (no more cut-off "Sandwic…"), bigger 68px food thumbnails, high-contrast filled amber **Add** buttons, serif "Our Menu" title with "À LA CARTE" eyebrow.
- **Customer cart** — serif "Your Order" title, espresso "Place Order" button, amber-tinted active payment-method button.
- **POS dashboard** — **status-coloured kanban**: amber top-border on New, blue on Cooking, green on Ready. Order cards get a colored left stripe by status. Stat pills in the header are color-coded too. Clear button hierarchy: espresso Accept, green Mark Ready, outlined Serve, danger Reject.
- **Admin panel** — left-aligned login form with proper labels (no centered password, no "default password" hint), serif wordmark instead of 🧁 emoji, Lucide line icons in the nav tabs (no more emoji icons), espresso active tabs, serif "Dashboard" panel title.

All three pages (customer, POS, admin) now share one consistent bakery brand system.

---

## 🔖 What's new in v7

- **Take Away removed** — Dine In only now. Every table has its own QR code, so the customer's table is always known from the URL.
- **Menu auto-opens on QR scan** — no more "Start Order" picker. Scanning the table QR (`index.html?table=N`) lands the customer directly on the menu for that table. A simple "What's your table number?" prompt (1–8) only appears if they open the page with no `?table=N`.
- **8 table QR codes** — pre-built PNGs for tables 1–8 are in `qr-codes/`, plus an `all-tables.pdf` (one A4 page, print + cut), all generated with the live URL `https://the-cakery-pos.vercel.app` — print-ready as-is. If you change domains, open `qr.html` on the new deployment to regenerate.
- **New order popup moved to top-center** — slides down from the top of the POS screen (was top-right), with a 🔔 bell icon that rings and the bell sound (3 rising beeps). More visible from across the counter.

**v6** (previous) introduced the payment-method-aware PRA tax: FBR 18% on food (cash or card) + PRA 16% on Cash / 8% on Card for beverages. See `sql/migration-v6.sql`.

---

## 📝 License

Built for The Cakery. Free to modify and use.
Menu data © The Cakery (extracted from their public PDF menus).
