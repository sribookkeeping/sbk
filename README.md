# SriBookKeeping 🏡

Family chores, earnings, and expenses — parents post chores with dollar
amounts, anyone in the family picks them up and earns, everyone logs expenses
with a photo of the bill, and the dashboard shows each member's
**earnings − expenses = balance**. Parent approvals are built into everything.

**One system, many interfaces.** The Next.js app owns the backend and the
database; the iPhone app is a native client of the same REST API
(`web/API.md`) with the same account; and the website is an installable PWA,
so **Android** phones (and iPhone/tablets) get a full-screen, home-screen app
too. Anything done on any surface appears on the others instantly.

| | Where | Stack |
|---|---|---|
| **Backend + website** | `web/` | Next.js 16 + Prisma + SQLite (→ Postgres in cloud) |
| **Android (+ any device)** | `web/` — installable PWA | manifest + service worker; install from the browser, runs standalone |
| **iPhone app** | `SriBookKeeping.xcodeproj` + `SriBookKeeping/` | SwiftUI, iOS 17+ — pure API client (no local database) |

## Feature map (all interfaces)

| # | Requirement | Implementation |
|---|-------------|-------|
| 1 | Head of family registers household (spouse, children) | web `/register`; iPhone signs in with the same account; add members later in **Family** |
| 2 | Parents set chores + dollar amounts; anyone picks & earns | Chore pool with **Pick Up** |
| 3 | Anyone creates one-time chores, assigns to member(s), sets reminders | *New Chore* → assign + due date + reminder hour |
| 4 | New chores optionally join the pool with parent approval | "Add to family chore pool" toggle |
| 5 | Kid-created pool chores → parent approval | any one parent approves |
| 6 | Parent-created pool chores → **other** parent approves | requester can never self-approve |
| 7 | Notify & remind assignee until done | iOS: local notifications (due + daily repeat); web: overdue highlighting today, push/email post-deploy |
| 8 | Schedules approved by **both** parents | creating parent counts as one approval |
| 9 | Complete a chore; optionally request extra pay + reason | base pays immediately, extra on approval |
| 10 | Expenses captured per member | kids their own; parents for anyone |
| 11 | Earnings vs expenses balance on dashboard | per-member balances, family view for parents |
| 12 | Every expense has a photo of the bill | camera/photo capture, stored with expense |
| 13 | Extras | member sign-ins, approvals inbox with badge, recurring schedules with pause/resume, activity feed, single-parent auto-approve |
| 14 | Guardian & grandparent roles | adults with family-wide visibility; approval authority stays with parents |
| 15 | Chore timing: exactly one of three modes | "When is it due?" radio on the New Chore form: **no due date** (open until completed), **one due date**, or **on a schedule** (recurring; both parents approve) |
| 19 | Payouts | parents record cash handed out; `balance = earned − spent − paid out`; shown everywhere incl. reports |
| 20 | Chore edit/delete | parents propose; BOTH parents approve; soft delete keeps ledger history; fully audited |
| 21 | Expense edit/delete | owner or parent; before/after captured in the audit log |
| 22 | Forgot password / find account | email reset link (1h, single-use) + account-details email; rate-limited |
| 23 | Edit / give up assignments | change due/reminder; give up returns the chore to "up for grabs" with family notification |
| 24 | Completion photo proof | required on web and iPhone; parents view proofs from the audit log |
| 25 | Surprise reveal | one click makes the whole event (chat, chores, history) visible to everyone — including members added later |
| 26 | Schedule end dates + skip/reschedule | schedules stop after the end date; assignees request skip/reschedule, a parent accepts |
| 27 | Family audit log + platform admin | every activity recorded for parents (`/audit`); platform admins impersonate any login, fully audited (`/admin`) |
| 28 | Test suite | 43 vitest tests over the rules engine + security (races, revocation, timezones) (`cd web && npm test`) |
| 16 | Open schedules: claim → auto-assign | occurrences with no assignee notify the whole family to claim ~24h before due; unclaimed after 12h → auto-assigned to the member with the fewest open chores, everyone notified, take-over allowed (web + API; in-app notification bell) |
| 17 | Periodic balance-sheet reports | emailed to each member's registered address on their chosen cadence (daily/weekly/monthly/quarterly/half-yearly/yearly, default monthly); on-demand view + "send now" on the Reports page; local dev writes emails to `web/outbox/` |
| 18 | Family brainstorming events | one group chat per event, chores linked to the event, and optional member exclusion — excluded members never see the event, chat, or its chores (surprise-proof, enforced server-side) |
| 29 | Member management | parents edit name/role/emoji, add a sign-in to a member, and remove/restore members; removal is a soft deactivation (history kept, sign-in revoked, excluded from new work and required approvals) with a last-active-parent guard; fully audited (web + API) |

## Run the website locally

```sh
cd web
npm install               # also runs `prisma generate`
npx prisma migrate dev    # creates prisma/dev.db (SQLite)
npm run seed              # optional demo family (see below)
npm run dev               # → http://localhost:3000
```

Demo sign-ins after `npm run seed` (password `demo1234` for all):
`ravi@demo.family` (head parent) · `sita@demo.family` (other parent) ·
`arjun@demo.family` (kid).

Receipts are stored in `web/uploads/` locally. Money is stored as integer
cents. The REST API for the iOS app is documented in [web/API.md](web/API.md).

## Run the iPhone app

1. Start the web app (`cd web && npm run dev`) — the phone app talks to it.
2. Install **Xcode 16+** from the Mac App Store, then:
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. Open `SriBookKeeping.xcodeproj`, pick your signing team, and run on a
   simulator (Server URL `http://localhost:3000` works out of the box) or your
   iPhone (set Server URL on the sign-in screen to your Mac's LAN IP, e.g.
   `http://192.168.1.20:3000`, or your deployed domain later).
4. Sign in with the same email/password as the website.

No Xcode yet? `Scripts/typecheck.sh` fully type-checks the app with just
Command Line Tools (the app is plain Swift/SwiftUI — no local database).

## Install on Android (and any phone) — PWA

The website is an installable **Progressive Web App**, so Android phones get a
real home-screen app with no Play Store step:

1. Open the site in **Chrome on Android** → menu (⋮) → **Install app** /
   **Add to Home screen** (or tap the **Install app** button on the sign-in
   screen). It launches full-screen with its own icon.
2. **iPhone/iPad** (bonus): Safari → **Share** → **Add to Home Screen**.
3. **Desktop** Chrome/Edge: the install icon in the address bar.

It runs standalone with the brand icon and theme color, and shows a friendly
offline page if the connection drops. The service worker
(`web/public/sw.js`) is deliberately conservative — it never caches page HTML
or API responses (per-user data stays fresh and is never shared between
accounts); only immutable static assets are cached. Manifest lives in
`web/app/manifest.ts`, icons in `web/public/icons/`.

> Camera capture (bill/proof photos) and web-push both require **HTTPS**, so
> they work once deployed (or via `localhost`), not over a plain-HTTP LAN IP.

## Tests

`cd web && npm test` — vitest suite (43 tests) covering the approval rules
(pool chores, both-parent schedules/edits/deletes, extra pay, skip), ledger
math incl. payouts, schedule recurrence/end-dates and the claim→auto-assign
sweep, surprise-event exclusion + reveal, reset tokens, session revocation,
impersonation-token expiry, claim/complete race-safety, timezone math, and
the audit log. Runs against a throwaway SQLite db (`prisma/test.db`).

## Security model

- **Sessions**: 30-day JWTs carrying a per-member `tokenVersion` — changing or
  resetting a password bumps the version and instantly signs out every other
  device. Change password (signed-in) lives on the **Family** page; forgot
  password / find account are email flows.
- **Impersonation tokens** (admin "view as") expire after **1 hour**.
- **Brute-force protection**: a per-IP + per-account in-memory throttle (first
  layer), plus a **durable account lockout** — 10 consecutive failures locks
  the account for 15 minutes, persisted in the database so it survives restarts
  and works across multiple instances. Any success resets it.
- **Race-safe money paths**: claiming, giving up, and completing a chore are
  atomic conditional updates (two simultaneous "Claim It" taps → exactly one
  winner, a double-submitted completion credits once); a parent's approval is
  appended inside a transaction so two parents approving at once can't lose an
  approval, and side-effects finalize exactly once.
- **Family timezone**: schedules, reminder hours, and day boundaries run in
  the family's IANA timezone (captured at registration, editable on the
  Family page) — correct even when the server runs in UTC on Vercel.

## Admin & audit

- **Audit log**: every activity (chore/expense/payout/approval/schedule/event/
  sign-in…) is recorded; parents review it at `/audit`, including completion
  proof photos.
- **Platform admin**: members with `isPlatformAdmin` (set in the database or
  seed) get `/admin` — all families, cross-family activity, and one-click
  **impersonation** with a persistent banner; audit entries made while
  impersonating record the real admin.

## Deploying to the cloud — follow-up checklist

Work through these in order once you're ready to go live:

### 1. Database → Postgres
- [ ] Provision **Neon Postgres** via the Vercel Marketplace (or any Postgres).
- [ ] In `web/prisma/schema.prisma`: change `provider = "sqlite"` → `"postgresql"`.
- [ ] Swap the driver adapter in `web/lib/db.ts`: `@prisma/adapter-better-sqlite3`
      → `@prisma/adapter-pg` (`npm i @prisma/adapter-pg`).
- [ ] Delete `web/prisma/migrations/` (SQLite dialect) and run
      `npx prisma migrate dev --name init` against the new `DATABASE_URL`.

### 2. Receipt storage → Vercel Blob
- [ ] The local filesystem is ephemeral on Vercel. Replace the two functions in
      `web/lib/storage.ts` with `@vercel/blob` `put()`/`fetch` (store the blob
      URL in `Expense.receiptPath`). The rest of the app doesn't change.

### 3. Deploy the site
- [ ] `npm i -g vercel@latest`, then from `web/`: `vercel link` and `vercel`.
- [ ] Set env vars: `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`),
      `BLOB_READ_WRITE_TOKEN`.
- [ ] Add your registered domain in the Vercel dashboard → set DNS → HTTPS is
      automatic.
- [ ] Add a **Vercel Cron** (hourly) hitting a small route that calls
      `runScheduleSweep` for all families. Locally the sweep runs on page
      loads, so claim reminders / auto-assignment only fire when someone opens
      the app — the cron is what makes the 24h/12h timing exact.

### 4. Reminders & reports that reach people (cloud version)
- [ ] Sign up for **Resend** and swap the dev transport in `web/lib/email.ts`
      (one function) — report emails then go out for real.
- [ ] Vercel Cron (daily): a route that runs `runScheduleSweep` +
      `sendDueReports` for all families (locally they run on page loads).
- [ ] Email: an hourly cron that emails assignees with pending chores at their
      reminder hour (same Resend setup). The in-app
      `Notification` rows (claim reminders, auto-assignments) are already
      created — fan them out to email in the same cron.
- [ ] Web push notifications (service worker + VAPID) if you want browser pings.

### 5. Point the iPhone app at the API
- [ ] Replace the iOS SwiftData persistence with calls to `/api/v1/*`
      (documented in `web/API.md`; the endpoints mirror the app's screens 1:1).
- [ ] Store the JWT in the iOS Keychain; sign in with the same email/password.
- [ ] APNs push for chore reminders (server sends via a cron; needs an Apple
      Developer account + push key). Local notifications keep working meanwhile.

### 6. App Store
- [ ] Enroll in the Apple Developer Program ($99/yr), TestFlight the app.
- [ ] Publish a privacy policy page on your new website (App Store requires it).

### 5. iPhone app → production
- [ ] Change the app's default Server URL to your domain (or just type it on
      the sign-in screen).
- [ ] APNs push for chore reminders (server-side send from the cron; needs an
      Apple Developer account + push key). Until then the app schedules local
      notifications from synced data.

### 6. App Store
- [ ] Enroll in the Apple Developer Program ($99/yr), TestFlight the app.
- [ ] Publish a privacy policy page on your website (App Store requires it).

### 7. Hardening (before inviting other families)
- [x] Session revocation on password change/reset (`tokenVersion`).
- [x] Signed-in change-password flow; forgot-password / find-account emails.
- [x] Short-lived (1h) admin impersonation sessions.
- [x] Login/forgot/find throttled per IP + per account (in-memory) **and** a
      durable database-backed account lockout (10 fails → 15-min lock).
- [x] Atomic claim/complete/give-up; transactional approval accumulation +
      exactly-once finalization (no lost approvals under concurrency).
- [x] Family-timezone-aware scheduling (UTC servers handled).
- [x] Single git repo at the project root (nested `web/.git` removed).
- [ ] Swap the in-memory IP throttle for Upstash Ratelimit or the Vercel WAF
      when running more than one instance (the DB lockout already spans them).
- [ ] Set `APP_URL` (used in reset-link emails) and `CRON_SECRET` env vars.
- [ ] Database backups (Neon has point-in-time restore).
- [ ] Optional: Sign in with Apple on both surfaces.
