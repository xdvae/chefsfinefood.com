# Website server, enquiries & dashboard

This one Node server runs the whole site (chefsfinefood.com), saves form enquiries in PostgreSQL, and serves the dashboard at /admin/. Point the chefsfinefood.com custom domain at this web service.

Every enquiry sent from the website is saved in a database. You see them in a simple dashboard at:

**https://chefsfinefood.com/admin/**

From the dashboard you can call or WhatsApp a customer with one tap, mark each enquiry **New → Contacted → Booked → Closed**, keep notes, search, and download everything for Excel.

---

## Setup (one click, about 5 minutes)
1. In Render click **New → Blueprint**.
2. Pick the repo **xdvae/chefsfinefood.com** and click **Apply**.
3. When it asks for `ADMIN_PASSWORD`, type your dashboard password.
4. Render creates two things: the database **chefsfinefood-db** and the server **chefsfinefood**. Wait until both show **Live/Available**.
5. Open **https://chefsfinefood.com/admin/** and log in.

That's it. The database tables are created automatically.

> **Important — free database lasts 30 days.** Render deletes free databases 30 days after creation (it emails you first).
> Before then, either open **chefsfinefood-db → Upgrade** in Render (≈ $6–7/month, keeps everything), or create a free
> database at neon.tech and replace `DATABASE_URL` on chefsfinefood with the Neon connection string.
> Download your enquiries first with the **Excel** button in the dashboard.

### Keep it awake (optional)
Free servers sleep after 15 minutes. Make a free job at **cron-job.org** that opens
**https://chefsfinefood.com/api/health** every 10 minutes.

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
Open **https://chefsfinefood.com/api/health**. It tells you what is wrong:

| You see | Fix |
|---|---|
| Render "Not Found" page | The web service doesn't exist under that name. Create it (step 2). If Render gave it a different address (e.g. `chefsfinefood-ab12.onrender.com`), send that address so the website can be pointed to it. |
| `"database": "DATABASE_URL is not set…"` | The server was created by hand instead of by the Blueprint. Delete it and use **New → Blueprint**, or add `DATABASE_URL` under **Environment**. |
| `"database": "Database error: …"` | The database isn't ready yet or has expired. Check **chefsfinefood-db** in Render is *Available*. If you use Neon, copy its connection string again. |
| `"adminPassword": "NOT SET"` | Add `ADMIN_PASSWORD` in Render → **Environment**. |
| `"ok": true, "database": "connected"` | All good. The dashboard is at `/admin/`. |
| Build failed in Render logs | Check that **Root Directory** is `server` and the service type is **Web Service**, not Static Site. |

Enquiries are accepted from `chefsfinefood.com`, `www.chefsfinefood.com` and any `chefsfinefood….onrender.com` preview. To allow another address, add it to `ALLOWED_ORIGINS`.
