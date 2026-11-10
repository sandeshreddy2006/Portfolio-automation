# Browser tests

These drive a real browser through the real screens. They need the backend and the frontend
running, and the local test account from `backend/seed_dev.py`.

```bash
cd frontend && npm install
```

They use the browser already installed on your machine: Microsoft Edge by default. If you
don't have Edge, set `E2E_BROWSER=chrome`. Screenshots of failures go to `e2e/output/`.
Run `python seed_dev.py` in `backend/` before a run to reset the demo data.

| Command | What it checks | Needs |
|---|---|---|
| `npm run e2e:core` | Sign in, create, edit, upload images, live preview, publish, republish, unpublish, delete | backend + frontend |
| `npm run e2e:sessions` | Two tabs can't overwrite each other; renaming an address keeps old links working | backend + frontend |
| `npm run e2e:accounts` | Real sign-up with an emailed code, refused addresses, sign-in and out, deleting an account | the backend log (below) and internet (DNS lookups) |
| `npm run e2e:features` | The AI assistant, search settings, share previews, sitemap, subdomains, reporting | the special set-up (below) |

The faster way to start the frontend is `npm run dev`. The tests also pass against
`npm run build && npm run start`, which is the better check before a release because that
is the same build, with the same security headers, as the live site.

## Accounts test

The backend prints sign-up codes to its log instead of emailing them when no email service is
set up. Start the backend with its log in a file and tell the test where it is:

```bash
cd backend && .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000 2> backend.log
# in another terminal
set E2E_BACKEND_LOG=..\backend\backend.log        # PowerShell: $env:E2E_BACKEND_LOG = "..\backend\backend.log"
npm run e2e:accounts
```

The test waits about 30 seconds in the middle on purpose: a new code can only be requested
every 30 seconds per address.

## Features test

It needs a fake Gemini server (so no real API key is used) and the subdomain settings:

```bash
python frontend/e2e/mock_gemini.py                       # leave running
# backend, started with these settings:
GEMINI_API_KEY=test-gemini-key GEMINI_BASE_URL=http://127.0.0.1:8999/v1beta REPORT_EMAIL=owner@portfolabs.dev
# frontend, started with these settings:
ROOT_DOMAIN=localhost NEXT_PUBLIC_ROOT_DOMAIN=localhost
npm run e2e:features
```
