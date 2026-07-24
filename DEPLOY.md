# AutoVet — Deploying the backend to Render (free) + TiDB (free MySQL)

This replaces the retired Railway backend. The frontend stays on Vercel; we just
repoint it at the new Render URL. Nothing in the app has to be rewritten — the
database stays MySQL and file uploads stay on Supabase storage.

**Architecture after migration**
```
Frontend (React)      → Vercel        (unchanged)
Backend (Laravel+AI)  → Render        (Docker image: PHP 8.2 + Python bundled)
Database (MySQL)      → TiDB Serverless
File uploads          → Supabase S3   (unchanged)
Uptime pinger         → UptimeRobot   (keeps Render awake)
```

Both TiDB and Render are **free and require no credit card**.

---

## 1. Create the database — TiDB Serverless

1. Sign up at https://tidbcloud.com → create a **Serverless** cluster (free tier).
2. Open **Connect** → note the **Host**, **Port** (`4000`), **User** (looks like
   `xxxxxxxx.root`), and set/copy the **Password**.
3. In the SQL editor (or any MySQL client), create the database:
   ```sql
   CREATE DATABASE autovet;
   ```
   (The app's `config/database.php` uses the database name `autovet`.)

## 2. Create the backend — Render

1. Sign up at https://render.com → **New → Web Service** → connect the GitHub
   repo `andreidcnyy/AutoVet`.
2. Settings:
   - **Root Directory:** `backend`
   - **Runtime/Environment:** `Docker` (it auto-detects `backend/Dockerfile`)
   - **Instance Type:** Free
3. **Environment variables:** open `backend/.env.render.example`, and add each
   variable in Render's **Environment** tab. Fill the `<FROM local .env ...>`
   placeholders from your existing `backend/.env`, and the `DB_*` values from
   TiDB (step 1). Set `APP_URL` to your Render URL once you know it (you can add
   it after the first deploy).
4. Click **Create Web Service**. The first build takes a few minutes (installs
   PHP + Python + builds assets). On boot it runs `php artisan migrate --force`
   automatically, creating all tables in TiDB.

## 3. Seed the fresh database

You have no Railway backup, so seed a clean dataset. In Render → your service →
**Shell**, run:
```bash
php artisan db:seed --force
```
(If the seeder is chunked via the setup-wizard, follow that flow instead.)

Verify: open `https://<your-render-url>/up` — it should return **200 OK**.

## 4. Repoint the frontend — Vercel

Edit `frontend/admin/vercel.json` and replace the old Railway host in all three
rewrites with your Render URL:

```jsonc
// before
"destination": "https://vibrant-abundance-production-4543.up.railway.app/api/:path*"
// after
"destination": "https://<your-render-url>/api/:path*"
```
(Do the same for the `/sanctum/` and `/storage/` rewrites.)

Commit + push → Vercel redeploys → **`autovet-admin.vercel.app` is back online.**

> Tell me your Render URL and I'll make this one-line edit for you.

## 5. Keep it awake — free uptime pinger

Render's free service sleeps after 15 min idle. To prevent the ~50s cold start:

1. Sign up at https://uptimerobot.com (free).
2. **Add New Monitor** → **HTTP(s)** → URL `https://<your-render-url>/up` →
   check interval **5–10 minutes**.

That keeps it awake 24/7, within Render's free 750 hours/month.

---

## Notes / known trade-offs on the free tier

- **Live updates (Reverb):** off for now (`BROADCAST_CONNECTION=log`). The app
  works fully on refresh. To restore real-time later, switch to **Pusher** (the
  `pusher/pusher-php-server` package is already installed) and set the frontend
  `VITE_REVERB_*` / broadcaster to Pusher.
- **AI forecast timing:** runs inline (`QUEUE_CONNECTION=sync`) instead of a
  background worker, so an invoice save that triggers a forecast is slightly
  slower. No feature is lost.
- **Uploads:** already on Supabase S3, so Render's ephemeral disk is a non-issue.
