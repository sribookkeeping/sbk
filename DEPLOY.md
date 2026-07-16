# SriBookKeeping — Go-Live Runbook

Everything shares **one backend + one database** (the Next.js app in `web/`).
So the order is: get the shared backend live first (**Common**), then each
surface plugs into it. The **Web app is deployed as part of Common** — it *is*
the backend. iOS and Android each just point at the deployed URL.

Legend: ☁️ = needs an account/credential you create · 💻 = a command/edit ·
⏱️ = rough effort.

---

## 0. Common — the shared backend + database (do this first)

Nothing else works until this is live. ⏱️ ~half a day the first time.

### 0.1 Provision Postgres ☁️
- Create a **Neon Postgres** database (via the Vercel Marketplace, or Neon
  directly). Copy its connection string.
- SQLite was dev-only; production needs Postgres.

### 0.2 Point Prisma at Postgres 💻
In `web/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
}
```
Swap the driver adapter in `web/lib/db.ts`:
```sh
cd web
npm i @prisma/adapter-pg
npm rm @prisma/adapter-better-sqlite3
```
Then in `web/lib/db.ts` replace `PrismaBetterSqlite3` with `PrismaPg`
(`{ connectionString: process.env.DATABASE_URL }`).
Regenerate migrations against the new DB (the existing `web/prisma/migrations`
are SQLite dialect — delete them and recreate):
```sh
rm -rf prisma/migrations
DATABASE_URL="<neon-url>" npx prisma migrate dev --name init
```

### 0.3 Receipt & proof storage → Vercel Blob ☁️💻
The local filesystem is ephemeral in the cloud. In `web/lib/storage.ts`,
replace the two functions (`saveReceipt` / `readReceipt`) with **Vercel Blob**
(`@vercel/blob` `put()` / fetch the returned URL). Store the blob URL in
`Expense.receiptPath` / `Assignment.proofImage`. Nothing else changes.
```sh
npm i @vercel/blob
```

### 0.4 Email → Resend ☁️💻
Report emails, password-reset links, and "find my account" currently write to
`web/outbox/`. In `web/lib/email.ts`, replace `sendEmail` with Resend:
```sh
npm i resend
```
```ts
const resend = new Resend(process.env.RESEND_API_KEY);
await resend.emails.send({ from, to, subject, html });
```

### 0.5 Deploy to Vercel ☁️💻
```sh
npm i -g vercel@latest
cd web
vercel link
vercel            # preview
vercel --prod     # production
```

### 0.6 Environment variables ☁️ (Vercel → Project → Settings → Env)
| Var | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `AUTH_SECRET` | session/JWT signing — `openssl rand -base64 32` (**required in prod**) |
| `APP_URL` | your https domain — used in reset/find-account email links |
| `CRON_SECRET` | protects `/api/cron` — `openssl rand -base64 32` |
| `BLOB_READ_WRITE_TOKEN` | auto-added when you enable Vercel Blob |
| `RESEND_API_KEY` | from Resend |
| `NEXT_PUBLIC_CURRENCY` | optional, e.g. `USD` (default) |

### 0.7 Custom domain + HTTPS ☁️
Add your registered domain in the Vercel dashboard → set DNS → HTTPS is
automatic. **HTTPS is required** for PWA install, camera capture, and push.

### 0.8 Scheduled jobs (reminders + reports) 💻
The sweep (claim reminders, auto-assign) and due report emails currently run
on page loads. For exact timing, add a **Vercel Cron** hitting the existing
route `web/app/api/cron/route.ts` (it runs `runScheduleSweep` + `sendDueReports`
for every family, guarded by `CRON_SECRET`). In `web/vercel.json` (or
`vercel.ts`):
```json
{ "crons": [{ "path": "/api/cron", "schedule": "0 * * * *" }] }
```
(Hourly is enough for the 24h/12h claim windows; use `0 * * * *`.)

### 0.9 First family + admin ☁️
- Register your family at `https://<domain>/register`.
- To grant yourself the platform-admin console (`/admin` + impersonation), set
  `isPlatformAdmin = true` on your member row once (Neon SQL editor or
  `npx prisma studio` against the prod DB).

### 0.10 Hardening (before inviting others) 💻
- Swap the in-memory IP throttle (`web/lib/rate-limit.ts`) for **Upstash
  Ratelimit** or the Vercel WAF (the DB account-lockout already spans
  instances).
- Enable Neon backups / point-in-time restore.
- Publish a **privacy policy** page (App Store + Play Store both require one).

---

## 1. Web app

The web app **ships with Common** (it's the same deployment). After 0.5:

- 💻 Smoke-test the core flows on the live URL: register → add members → create
  chore → pick up → complete with proof → approve → record expense → payout →
  report → event + reveal → audit.
- 💻 Confirm the **PWA installs** (Chrome address-bar install icon) and camera
  capture works — both need the HTTPS domain from 0.7.
- 💻 Optional polish: real Open Graph / social preview image, a favicon set,
  analytics.

Nothing else is separate for web — it's done once Common is live.

---

## 2. iOS app (native, SwiftUI)

The app is a pure client of the deployed API. ⏱️ ~1–2 hrs to run; longer for
the App Store.

### 2.1 Build & run 💻
1. Install **Xcode 16+**, then
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
2. Open `SriBookKeeping.xcodeproj`; select the target → **Signing &
   Capabilities** → pick your Apple ID / team; set a unique bundle id.
3. Run on a simulator or your iPhone. Expect to fix a small SwiftData-free
   compile nit or two — this is the app's **first real Xcode build** (only
   type-checked so far via `Scripts/typecheck.sh`).

### 2.2 Point at production 💻
- On the sign-in screen, set **Server URL** to `https://<your-domain>`, or
  change the default in `SriBookKeeping/Core/API.swift` (`serverURLString`).
- Sign in with the same email/password as the website — same account, same
  data.

### 2.3 Optional: fill remaining native screens 💻
Endpoints already exist (see `web/API.md`); the iOS UI doesn't yet cover:
create schedule, link chore→event, propose chore edit/delete, audit log, admin
console, member management. Add screens as desired.

### 2.4 Push notifications (optional for v1) ☁️💻
Local notifications already remind the assignee. For server-driven push you
need an **Apple Developer account**, an APNs auth key, and a send step in the
cron. Until then, local notifications keep working.

### 2.5 App Store ☁️
- Enroll in the **Apple Developer Program** ($99/yr).
- Camera/notification usage strings are already set in the project.
- TestFlight → submit for review with screenshots + the privacy-policy URL.

---

## 3. Android (installable PWA — already built)

Android is served by the **same PWA** — no separate build or codebase. ⏱️
minutes once the web app is on HTTPS.

### 3.1 Install on a phone 💻
- Open `https://<your-domain>` in **Chrome on Android** → ⋮ menu → **Install
  app** (or tap the **Install app** button on the sign-in screen). It launches
  full-screen with its own icon.
- Verify camera capture (bill/proof photos) works — needs HTTPS (0.7).

### 3.2 Optional: publish to the Play Store via a TWA ☁️💻
If you want a Play Store *listing* (not required — the PWA installs directly):
- Wrap the deployed PWA in a **Trusted Web Activity** with **Bubblewrap**
  (`npm i -g @bubblewrap/cli`, `bubblewrap init --manifest
  https://<domain>/manifest.webmanifest`).
- Host the generated `/.well-known/assetlinks.json` on your domain to verify
  ownership.
- Create a **Google Play Developer** account ($25 one-time), upload the AAB.

### 3.3 Optional: web push 💻
The manifest + service worker are in place; browser push needs VAPID keys + a
push-subscription flow (and a send step in the cron). Not required for install.

---

## Suggested order

1. **Common 0.1–0.9** → backend + web live (Android installs immediately after,
   step 3.1).
2. **0.10 hardening** before inviting other families.
3. **iOS 2.1–2.2** to get the native app on your phone; App Store later.
4. Optional: iOS parity screens, push, Play Store TWA, product enhancements.
