# Enquiry backend & dashboard

Every enquiry sent from the website is saved in a database. You see them in a simple dashboard at:

**https://chefsfinefood-api.onrender.com/admin/**

From the dashboard you can call or WhatsApp a customer with one tap, mark each enquiry **New → Contacted → Booked → Closed**, keep notes, search, and download everything for Excel.

---

## One-time setup (about 10 minutes)

### 1. Create the free database (Neon)
1. Go to **https://neon.tech** and sign up (Google login is fine).
2. Create a project. Pick the region **AWS Asia Pacific (Singapore)**, which is closest to India.
3. On the project dashboard, click **Connect** and copy the **connection string**. It looks like:
   `postgresql://user:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

You don't need to create any tables. The server creates them by itself.

### 2. Create the server on Render — easiest: one-click Blueprint
1. In Render click **New → Blueprint**, pick the repo **xdvae/chefsfinefood.com**, click **Apply**.
2. Render reads `render.yaml` and fills in every setting for you. It asks for two values:
   - `DATABASE_URL`: paste the Neon connection string
   - `ADMIN_PASSWORD`: your dashboard password
3. Wait until the service shows **Live**, then open the dashboard link.

### 2b. Or create it by hand
1. In Render, click **New → Web Service**, and pick the GitHub repo **xdvae/chefsfinefood.com**.
2. Fill in:
   | Setting | Value |
   |---|---|
   | Name | `chefsfinefood-api` *(keep this exact name — the website already points to it)* |
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | Free |
3. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `ADMIN_PASSWORD` | the password you will use to open the dashboard |
   | `SESSION_SECRET` | any long random text (e.g. mash the keyboard for 40 characters) |
4. Click **Create Web Service** and wait until it says **Live**.
5. Open **https://chefsfinefood-api.onrender.com/admin/** and log in with your password.

> If Render gives the service a different address, open `assets/js/main.js` and change the `ENQUIRY_API` line near the top to that address.

### 3. Keep it awake (recommended)
Free Render servers go to sleep after 15 minutes without visitors, and take about a minute to wake up. The website already wakes the server when someone opens a page with a form. To keep it always ready:
1. Go to **https://cron-job.org** and make a free account.
2. Create a cron job with the URL **https://chefsfinefood-api.onrender.com/api/health**, set to run **every 10 minutes**.

---

## How the website form behaves
- **Send Enquiry**: the enquiry is saved to the database and the customer sees a thank-you message.
- **Send on WhatsApp**: opens WhatsApp with the details filled in, *and* saves the enquiry.
- If the server can't be reached, the customer is asked to send it on WhatsApp instead, so no lead is lost.
- Enquiries from the **Shree Shyam** page are tagged **Shree Shyam · Pure Veg** in the dashboard.

## Settings (environment variables)
| Variable | Needed | What it does |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string (Neon, Supabase, Render Postgres…) |
| `ADMIN_PASSWORD` | yes | Dashboard password |
| `SESSION_SECRET` | recommended | Keeps logins secure (you stay logged in for 30 days) |
| `ALLOWED_ORIGINS` | no | Extra websites allowed to send enquiries (comma separated). chefsfinefood.com, www and `chefsfinefood….onrender.com` are always allowed. |

## Security built in
- Password-protected dashboard (secure, HTTP-only login cookie; 10 tries per 15 minutes)
- Only your website can send enquiries; spam trap and rate limit on the form
- All database queries are parameterised; everything in the dashboard is shown as plain text
- The dashboard is hidden from Google (`noindex`)

---

## Troubleshooting
Open **https://chefsfinefood-api.onrender.com/api/health**. It tells you what is wrong:

| You see | Fix |
|---|---|
| Render "Not Found" page | The web service doesn't exist under that name. Create it (step 2). If Render gave it a different address (e.g. `chefsfinefood-api-ab12.onrender.com`), send that address so the website can be pointed to it. |
| `"database": "DATABASE_URL is not set…"` | Add `DATABASE_URL` in Render → your service → **Environment**, then save. |
| `"database": "Database error: …"` | The Neon connection string is wrong. Copy it again from Neon (it must start with `postgresql://`). |
| `"adminPassword": "NOT SET"` | Add `ADMIN_PASSWORD` in Render → **Environment**. |
| `"ok": true, "database": "connected"` | All good. The dashboard is at `/admin/`. |
| Build failed in Render logs | Check that **Root Directory** is `server` and the service type is **Web Service**, not Static Site. |

Enquiries are accepted from `chefsfinefood.com`, `www.chefsfinefood.com` and any `chefsfinefood….onrender.com` preview. To allow another address, add it to `ALLOWED_ORIGINS`.
