# Supabase setup for Honeybun Kidswear

The storefront needs a free Supabase project for the product database, the
order database, admin login, and photo storage. Do these steps once.

## 1. Create the project

1. Go to https://supabase.com and sign up / log in.
2. Click **New project**. Pick any name (e.g. `honeybun-kidswear`), a strong
   database password (save it somewhere safe), and a region close to you.
3. Wait ~1-2 minutes for the project to finish provisioning.

## 2. Run the database schema

1. In the project sidebar, open **SQL Editor** → **New query**.
2. Open [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy its
   entire contents, paste into the SQL editor, and click **Run**.
3. This creates the `products` and `orders` tables, locks them down with
   row-level security, and creates the public `product-images` storage
   bucket with the right upload/read permissions.

## 3. Get your API keys

1. Open **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon public** key.
3. In this project folder, copy `.env.local.example` to `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

4. Paste the values in:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

5. Restart `npm run dev` if it's already running so it picks up the new env vars.

## 4. Create the admin account

There is no public sign-up page — the admin account is created directly in Supabase:

1. Open **Authentication** → **Users** → **Add user** → **Create new user**.
2. Enter the email and password you'll log in with at `/admin/login`.
3. Leave "Auto Confirm User" checked so it doesn't require an email confirmation step.

That's it — you can now log in at `/admin/login`, add products with photos,
and see orders/analytics as customers check out.
