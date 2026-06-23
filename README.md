# JMUNZ FULL SITE — FINAL PACKAGE

This package contains the complete JMUNZ merch website and PayHere checkout backend.

## Included

- Immersive animated merch-factory experience
- Fixed blue water in the Color Lab
- Interactive shirt color selection
- Print and embroidery interactions
- Product carousel with real merch images and matching prices
- Full All Merch catalog with filters
- Cart drawer and subtotal
- Animated YouTube links to https://www.youtube.com/@jmunz13
- Large red YouTube banner removed
- Customer delivery-details checkout form
- PayHere Sandbox/Live backend integration
- Server-side price validation and payment hash generation
- Verified PayHere notification endpoint
- Responsive desktop and mobile design

## Folder structure

- `public/index.html` — production HTML
- `public/styles.css` — complete CSS
- `public/script.js` — complete JavaScript
- `public/assets/` — product images and favicon
- `public/standalone-preview.html` — single-file visual preview
- `server.js` — Node/Express backend
- `package.json` — dependencies and run scripts
- `.env.example` — PayHere configuration template
- `data/orders.json` — local demo order storage

## Run the full website

1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run:

```bash
npm install
```

4. Copy `.env.example` to `.env`.
5. Add your PayHere credentials:

```env
PAYHERE_SANDBOX=true
PAYHERE_MERCHANT_ID=YOUR_MERCHANT_ID
PAYHERE_MERCHANT_SECRET=YOUR_DOMAIN_SPECIFIC_MERCHANT_SECRET
BASE_URL=https://your-public-domain.com
PORT=3000
```

6. Start the website:

```bash
npm start
```

7. Open:

```text
http://localhost:3000
```

## Important payment notes

- Never place the PayHere Merchant Secret in HTML or browser JavaScript.
- The Merchant Secret must remain only in `.env` on the server.
- PayHere's `notify_url` must use a public HTTPS domain; localhost cannot receive final payment notifications.
- Keep `PAYHERE_SANDBOX=true` until testing is complete.
- Use a database instead of `orders.json` before a high-volume production launch.

## Preview only

Open `public/standalone-preview.html` to see the full design without starting Node.js. Live payment creation still requires the backend server.
