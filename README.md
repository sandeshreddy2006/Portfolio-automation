# Portfolio-automation

## Portfolabs account setup

Run `./backend/run_sqlite.sh` from the repo root and `npm run dev` from
`frontend`. Open `http://localhost:3000/auth` for local sign-in. Next.js
forwards Google OAuth and account requests to FastAPI. The browser session
stays on the frontend domain.

1. Create a **Web application** OAuth client in Google Cloud and configure the
   Google Auth Platform consent screen for Portfolabs. Add
   `http://localhost:3000/api/auth/google/callback` to the local client's
   authorized redirect URIs and
   `https://www.portfolabs.com/api/auth/google/callback` to the production
   client's authorized redirect URIs. FastAPI builds the callback from the
   first origin in `FRONTEND_URL`.
2. For local testing, fill in `frontend/.env.local` and `backend/.env` using
   the matching examples. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   on FastAPI. Generate an `AUTH_CODE_SECRET` with `openssl rand -hex 32`.
   On Railway, keep
   `FRONTEND_URL=https://www.portfolabs.com` and
   `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
3. On Railway Pro, set `SMTP_USERNAME` to your Gmail address and
   `SMTP_PASSWORD` to a Google app password. Portfolabs defaults to
   `smtp.gmail.com` on port 587 with STARTTLS and sends as
   `Portfolabs <your Gmail address>`. Leave `RESEND_API_KEY` unset to use
   SMTP. For Resend instead, set its API key and an authorized `MAIL_FROM`.
4. On Vercel, keep `BACKEND_URL` set to the Railway API's public HTTPS origin.

Email registration requires a six-digit code. A new Google user sets a
Portfolabs password before receiving a session. Google users with an email
address that Google does not control verify it first. Signing in with Google
on an existing email/password account sends a code before linking the two
sign-in methods. The existing password continues to work.

## Startup schema migration

FastAPI startup runs the same schema reconciliation as
`cd backend && python -m app.migrate`. It creates missing modeled tables and
permanently deletes unmodeled tables and columns in the application's default
database schema. Use a dedicated Portfolabs database and back it up before
deploying a model removal. Column renames and additions to existing tables
require a separate migration. On SQLite, removing a constrained column may
rebuild its table with the modeled indexes and constraints.

The migration runs transactionally under a database lock. On Railway,
successful runs are recorded by deployment ID so other replicas and restarts
of that deployment skip the work. Locally, reconciliation runs on startup.
