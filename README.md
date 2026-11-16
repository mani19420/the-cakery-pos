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
- Scan QR → menu auto-binds to their table number
- 100+ items across 13 categories (breads, viennoiserie, patisserie, signature cakes, slices, chef's whisk, sandwiches, coffees, matcha, no-caffeine, on-the-rocks, tea, add-ons) — all parsed from your actual menus
- Search, category filter, popular tags
- Cart with quantity controls + special instructions
- Live order tracking (Received → Preparing → Ready → Served)
- Toasts when status changes (real-time via Supabase)
- Cart persists per table in localStorage

### POS Dashboard (`pos.html`)
- 3-column Kanban: **New Orders / Preparing / Ready**
- **Pop-up alert** when a new order arrives (with sound 🔔)
- Buttons: Accept / Reject / Mark Ready / Serve / View Bill
- Print bill (clean print-friendly window)
- Today's stats sidebar: total orders, revenue, average, active tables
- Recently Served history (last 15)
- Search by order #, table, or item name
- Real-time via Supabase + 10-second polling fallback
- Mobile-responsive

### QR Generator (`qr.html`)
- Set number of tables → auto-generates a QR card per table
- Download each QR as PNG (high-res, print-ready)
- Persists table count in localStorage

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
2. **Double-click `index.html`** → a table picker appears → pick any table number (e.g. 5).
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
2. Enter the number of tables in your café.
3. Download each table's QR as a PNG and print it.
4. Place each printed QR on the matching physical table.

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
│   └── schema.sql          # Run this in Supabase SQL Editor
├── css/
│   ├── customer.css        # Customer page styles
│   └── pos.css             # POS dashboard styles
├── js/
│   ├── supabase-config.js  # ← PASTE YOUR SUPABASE CREDENTIALS HERE
│   ├── menu-data.js        # All menu items (parsed from your PDFs)
│   ├── utils.js            # Shared helpers (Supabase calls, formatters)
│   ├── customer.js         # Customer app logic
│   └── pos.js              # POS dashboard logic
└── assets/                 # (empty — uses emoji icons, no images needed)
```

---

## 💰 Pricing & Tax

- All prices are in **PKR** as in your menu PDFs.
- GST is set to **0%** (your menu says "Exclusive of GST"). To change it, edit `CAKERY.TAX_RATE` in `js/utils.js`.
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
- **🎨 Brand** — Edit brand name, tagline, logo emoji, accent color, and **upload a real logo image** (PNG/JPG, stored as base64). Changes appear instantly on customer menu and POS.

### First-time setup
1. **Run the updated SQL schema** in Supabase SQL Editor (the `sql/schema.sql` in this zip). This creates two new tables: `menu_items` and `brand_settings`. Safe to re-run.
2. **Seed the menu** — open Admin → Menu tab → click **📥 Seed from local**. This copies all 130 default items from `js/menu-data.js` into your database so you can start editing them.
3. **Upload your logo** — Admin → Brand tab → choose file → Upload → Save Brand.
4. **Customize items** — Edit prices, add real photos, mark popular items, toggle availability.

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

## 📝 License

Built for The Cakery. Free to modify and use.
Menu data © The Cakery (extracted from their public PDF menus).
