# Honeybun Kidswear

An e-commerce storefront + admin panel for a kids-clothing shop, built with
React, Vite, and Supabase.

- **Storefront**: browse/search products, product detail pages, cart, and a
  cash-on-delivery checkout with an order confirmation page.
- **Admin panel** (`/admin`, login-gated): add/edit/delete products with
  photo uploads, manage orders and their status, and view sales analytics.

## Getting started

```bash
npm install
```

Then set up the backend — see [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) for
step-by-step instructions to create a free Supabase project, run the schema,
and create your admin login.

```bash
npm run dev
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build locally
