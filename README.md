# API & security tests for a finance web app

[![API & security tests](https://github.com/BRLorena/api-security-tests/actions/workflows/security-tests.yml/badge.svg)](https://github.com/BRLorena/api-security-tests/actions/workflows/security-tests.yml)

API contract, access-control and security testing for the [Finance App](https://github.com/BRLorena/finance_app) (Next.js, NextAuth, Prisma/Postgres). The suite checks every REST endpoint for the things a UI test never reaches: can one user touch another's data, does bad input get rejected or crash the server, and is the app configured safely.

Tests that write data or send request floods run against a **local copy of the app** backed by a throwaway Docker Postgres, so production is never used as a test database. Only read-only checks (security headers, CORS) run against the deployed site.

## What it covers

| Layer | Project | Target | Decides |
|---|---|---|---|
| **API contract** | `api` | local | CRUD for expenses, incomes and invoices, plus summary, each response checked against a strict Zod schema |
| **Access control** | `authz` | local | A second real account tries to read, change, delete and list the first account's records (OWASP API1), and to set `userId` from the body (mass assignment) |
| **Input validation** | `input` | local | Fixed bad inputs **and** property-based fuzzing (fast-check): bad input must be `400`, never `500` and never a saved record |
| **Authentication** | `auth` | local | Registration rules, login, brute-force resistance, user enumeration, session handling |
| **Configuration** | `config` | **production** | Security headers, CORS. Read-only: ordinary GETs only, nothing written |

The strict Zod schemas also guard against **over-exposure**: an unexpected field in a response (a password hash, another user's id) fails the parse.

## Findings

16 issues were confirmed against the app. Each is a `test.fail()` test: the suite stays green while the bug exists and turns **red when it is fixed**, so the marker is removed together with the fix.

| ID | Endpoint | What happens | Risk | OWASP API |
|---|---|---|---|---|
| BUG-1 | `POST /api/expenses` | A non-numeric `amount` (`"abc"`) reaches `parseFloat` and the route answers **500** | Unhandled error, no validation | API8 |
| BUG-2 | `POST /api/expenses` | `amount: "1e400"` becomes `Infinity` and the DB write fails with a **500** | Unhandled error | API8 |
| BUG-3 | `POST /api/expenses` | A **negative amount is saved** (`-500`). The schema says amounts are positive, but the route uses the string form schema, which doesn't check it. A single `-500` expense flips a no-income account's net income to **+474** | Data integrity, corrupted reports | API8 |
| BUG-4 | `POST /api/expenses` | An unparseable `date` answers **500**, not 400 | Unhandled error | API8 |
| BUG-5 | `POST /api/expenses` | **No length limit** on `description`: a 100,000-character string is stored in full | Resource consumption, storage abuse | API4 |
| BUG-6 | `GET /api/expenses` | `page=0` answers **500**; `limit=abc` answers **500**; `limit=100000` is accepted with no cap | Unhandled error, resource consumption | API4 |
| BUG-7 | `POST /api/invoices` | `invoiceNumber` is globally unique, so reusing a number another user already has answers **500**. That doubles as an oracle: it confirms the number exists and lets an attacker claim numbers before their owner | Enumeration, denial of a resource | API3 |
| BUG-8 | `GET /api/summary` | A bad `year` throws inside Prisma and the route returns `error.message` in a `details` field, **leaking the ORM query and column names** to the client | Internal disclosure | API8 |
| BUG-9 | `POST /api/auth/callback/credentials` | **No rate limit on login.** Register and the data APIs are throttled; the credentials callback is not, so passwords can be brute-forced | Brute force | API2 |
| BUG-10 | `POST /api/auth/signout` | **Signing out does not invalidate the session token.** JWT sessions are stateless, so a captured token still works for up to 30 days after logout | Session lifetime | API2 |
| BUG-11 | `POST /api/register` | The error names the condition — *"User with this email already exists"* — and login timing differs (≈5 ms for an unknown email vs ≈370 ms for a known one, because bcrypt only runs when the user exists). Both reveal whether an email has an account | Account enumeration | API2 |
| BUG-12 | `POST /api/register` | A trivially weak password (`"123456"`) is accepted; the only rule is 6 characters | Weak credentials | API2 |
| BUG-13 | app pages | No `Content-Security-Policy` header | Missing hardening | API8 |
| BUG-14 | app pages | No `X-Frame-Options` (clickjacking) | Missing hardening | API8 |
| BUG-15 | app pages | No `X-Content-Type-Options: nosniff` | Missing hardening | API8 |
| BUG-16 | app pages | No `Referrer-Policy` | Missing hardening | API8 |

## Controls that passed (regression guards)

These behaviours were tested and found **correct**; the tests stay as guards so a future change can't silently break them:

- **Object-level authorization.** Every by-id lookup filters on `userId`; a second account gets `404` reading, updating or deleting another user's expense, income or invoice, and the record is left untouched.
- **Mass assignment.** A `userId` sent in the request body is ignored — the server takes it from the session.
- **Authentication required.** Every data route answers `401` without a session.
- **CORS.** A cross-origin request receives no `Access-Control-Allow-Origin`.
- **Session cookies.** `__Host-`/`__Secure-` prefixes, `HttpOnly`, `Secure`, `SameSite=Lax`.
- **HSTS** is set on production with a two-year `max-age`.
- **Missing/invalid fields and bad enums** are correctly rejected with `400`.

## How it runs against a local app

The suite needs the app running, not just the repo, so it starts a real instance:

```bash
npm ci
npm run db:up      # Postgres 16 in Docker on port 54329 (data in tmpfs, wiped on stop)
npm run app        # clones finance_app into .app, builds it, serves on :3100 against that DB
npm test           # api + authz + input + auth, in parallel
```

`npm run app` uses [`scripts/start-app.sh`](scripts/start-app.sh) and [`scripts/app.env`](scripts/app.env): throwaway secret, Groq disabled (the AI features are covered separately in [ai-feature-tests](https://github.com/BRLorena/ai-feature-tests)), and the app's in-memory rate limiter turned off so many parallel workers can register accounts without being throttled.

Read-only checks against production:

```bash
npm run test:prod  # security headers and CORS only — nothing written
```

| Variable | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:3100` | App under test for the local projects |
| `DATABASE_URL` | the Docker DB | Database the app under test uses |
| `AUTH_SECRET` | a local throwaway | NextAuth secret for the app under test |

## Design notes

- **Fuzzing finds classes, not cases.** The fixed input tests pin one bug each; the fast-check properties (`tests/input/fuzz.spec.ts`) assert *"no generated value of this field ever causes a 500"* and shrink to the smallest failing input, showing the bugs aren't cherry-picked.
- **No retries.** `retries: 0`, so a flaky result is a real defect, not something hidden by a re-run.
- **Two accounts per worker.** A worker-scoped `owner`/`intruder` pair ([`src/fixtures.ts`](src/fixtures.ts)) makes the access-control tests cheap and parallel-safe, and the accounts are fixed so runs don't fill the database.
- **No browser.** These are HTTP-level tests via Playwright's `APIRequestContext`, so CI skips the browser download.

## CI

[`.github/workflows/security-tests.yml`](.github/workflows/security-tests.yml):
- **local** (every push and PR): a Postgres service, build and start the app, then the four local projects.
- **prod-config** (every push and PR): the read-only header and CORS checks against production.
- **zap-passive** (weekly and manual): an [OWASP ZAP](https://www.zaproxy.org/) baseline scan of production. Passive — it spiders and inspects responses, it sends no attacks.
