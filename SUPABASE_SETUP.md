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

The admin account is created directly in Supabase:

1. Open **Authentication** -> **Users** -> **Add user** -> **Create new user**.
2. Enter the email and password you'll log in with at `/admin/login`.
3. Leave "Auto Confirm User" checked so it doesn't require an email confirmation step.

Do this **before** you run `schema.sql` (step 2). When the schema first runs, it
makes whoever already has an account the admin. If shoppers could sign up
before that, they would be made admins too, so check **Authentication -> Users**
lists only your account before running it.

## 5. Shopper accounts

Shoppers can create accounts at `/account` to track their orders and keep their
bag on every device. Guests can still check out without one.

- Only accounts on the `admins` table can open `/admin`. To add another admin:
  `insert into admins (user_id) select id from auth.users where email = 'her@email.com';`
- **Authentication -> URL Configuration:** set the Site URL to your domain and
  add `https://yourdomain.com/**` under Redirect URLs (password-reset links use it).
- **Authentication -> Providers -> Email:** "Confirm email" decides whether new
  shoppers must click a link before signing in. Supabase's built-in mailer is
  limited to a few emails an hour, so for real use set up your own sender under
  **Authentication -> SMTP Settings** (e.g. Resend).

## 6. Emails from your own domain (Resend)

Verify your domain in Resend first (Resend -> Domains -> add it, paste the DNS
records at your domain registrar, wait for "Verified"). Then create an API key
(Resend -> API Keys -> Create, "Sending access").

### Sign-up and password-reset emails

**Authentication -> Emails -> SMTP Settings** (or Project Settings -> Auth):
turn on **Enable custom SMTP** and enter:

| Field | Value |
|---|---|
| Sender email | `hello@honeybun.online` (any address on your verified domain) |
| Sender name | `Honeybun Kidswear` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key |

Afterwards you can turn **Confirm email** back on (Authentication -> Providers -> Email).

### Order confirmation emails

The function in `supabase/functions/send-order-email` emails the customer a
receipt (and optionally you) whenever an order is placed.

1. **Edge Functions -> Deploy a new function -> Via Editor.** Name it
   `send-order-email`, paste the contents of `supabase/functions/send-order-email/index.ts`,
   and deploy. In the function's settings turn **Verify JWT** off (the webhook
   authenticates with its own secret instead).
2. **Edge Functions -> Secrets**, add:
   - `RESEND_API_KEY` - your Resend API key
   - `WEBHOOK_SECRET` - any long random string
   - `FROM_EMAIL` - e.g. `orders@honeybun.online`
   - `REPLY_TO` - where customer replies should go (your Gmail or a forwarded address)
   - `OWNER_EMAIL` - optional: your email, to be alerted about each new order
3. **Database -> Webhooks -> Create a new hook:** table `orders`, event
   **Insert**, type **HTTP Request**, method `POST`, URL
   `https://<your-project-ref>.supabase.co/functions/v1/send-order-email`, and
   add an HTTP header `x-webhook-secret` with the same value as `WEBHOOK_SECRET`.
4. Place a test order. If no email arrives, open **Edge Functions -> send-order-email -> Logs**.
