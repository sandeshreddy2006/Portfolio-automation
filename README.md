# Portfolabs

Pick a design, add your details, and publish a portfolio at a link you can share.

- **Frontend:** Next.js (`frontend/`), deployed on Vercel.
- **Backend:** FastAPI (`backend/`), deployed on Railway with PostgreSQL.
- **Images:** Cloudflare R2. **Email:** Resend or SMTP. **Writing help:** Google Gemini (free tier).

## Run it locally

```bash
# 1. Backend (Windows paths shown; use .venv/bin/python on macOS/Linux)
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
copy .env.example .env          # then set AUTH_CODE_SECRET to 32+ random characters
.venv\Scripts\python.exe seed_dev.py
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. `seed_dev.py` creates a **local-only** test account
(`tester@portfolabs.dev` / `Portfolabs-Test-2026!`) and a demo portfolio at `/p/demo-alex`.
It refuses to run against PostgreSQL. With no email service configured, verification
codes are printed in the backend terminal.

## Tests

```bash
cd backend && .venv\Scripts\python.exe -m pytest tests -q
cd frontend && npm run lint && npm run build
```

The suite runs on SQLite by default. The live site uses PostgreSQL, so before a release also run it
against an empty PostgreSQL database (`TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/db`).
That turns on extra checks for simultaneous requests and for upgrading an older database.

There are also browser tests that click through the real screens (sign-up, publishing, images,
two tabs, renaming, the AI helper). See `frontend/e2e/README.md`.

## How the live site is connected

GitHub holds the code only. Passwords, API keys and hosting logins are never stored in it.
The live site is wired together inside each service's own dashboard:

- **Vercel** builds the `frontend/` folder from this GitHub repo every time `main` is pushed.
- **Railway** builds the `backend/` folder from the same repo and runs the database.
- Each service has its own **Variables** screen where the settings below are typed in.

Whoever created those projects owns the logins. To work on the deployment, ask them to invite you
(Vercel: project → Settings → Members; Railway: project → Settings → Members) or to share the
variable names they used. Share secret values privately, never in GitHub, chats or screenshots.

**Railway service settings:** Root Directory `backend`. Start command:

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Going live checklist

**Railway (backend)**

| Setting | Notes |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `FRONTEND_URL` | `https://www.portfolabs.com` |
| `AUTH_CODE_SECRET` | 32+ random characters |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | redirect URI `https://www.portfolabs.com/api/auth/google/callback` |
| `RESEND_API_KEY`, `MAIL_FROM` | or the `SMTP_*` settings |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | image uploads; without them uploads are disabled |
| `GEMINI_API_KEY` | optional; free key from https://aistudio.google.com/apikey. Without it the "Improve with AI" buttons are hidden |
| `REPORT_EMAIL`, `REVALIDATE_SECRET` | optional; report emails and the takedown tool |

**Vercel (frontend, Root Directory = `frontend`)**: `BACKEND_URL` (the Railway URL),
optionally `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, `REVALIDATE_SECRET`.

**Cloudflare R2**: create a bucket, connect a custom domain such as `assets.portfolabs.com`,
and create an API token with Object Read & Write on that bucket.

**Subdomains (optional)**: point wildcard DNS (`*.portfolabs.com`) at Vercel, add the wildcard
domain in Vercel, then set `ROOT_DOMAIN` and `NEXT_PUBLIC_ROOT_DOMAIN` to `portfolabs.com`.

## Moderation

Reports are stored in the database. From the backend's environment:

```bash
python moderate.py reports                # list recent reports
python moderate.py unpublish some-address # take a portfolio offline immediately
```

## Notes

- A deleted portfolio address is held for 30 days so nobody can take over old links.
- The template list lives in two places that must match: `frontend/components/templates/meta.ts`
  and `TEMPLATE_IDS` in `backend/app/portfolios.py`. A test fails if they drift apart.
- Schema changes only ever add tables and columns (`backend/app/migrate.py` never drops anything).
