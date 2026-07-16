# SriBookKeeping — Detailed Go-Live Runbook

Everything shares **one backend + one database** (the Next.js app in `web/`).
Stand that up once (**Part A**), and every surface plugs into the deployed URL:
the **web app ships with Part A**, **Android** is the same site installed as an
app, and **iOS** is a native client pointed at the URL.

Do the parts in order. Each step is a real command, a real edit (with the full
file contents to paste), or a dashboard clickpath, followed by a check.

Conventions: `web/` = run inside the `web` folder. Replace `<...>` placeholders.
Copy-paste blocks are complete file contents unless noted.

---

# Part A — Backend + database + web app (the shared core)

## A0. Prerequisites (one-time)

**Tools on your Mac:**
```sh
node -v        # need v20+  (you have v26 ✓)
git --version
npm i -g vercel@latest
```

**Accounts to create (free tiers are fine):**
- **GitHub** — https://github.com (host the repo; Vercel deploys from it)
- **Vercel** — https://vercel.com/signup (hosting + Blob storage + cron)
- **Neon** — https://neon.tech (Postgres) *or* add it via the Vercel Marketplace
- **Resend** — https://resend.com (transactional email)
- Later, only if you publish to stores: **Apple Developer** ($99/yr),
  **Google Play Developer** ($25 once).

## A1. Push the repo to GitHub

The repo is already committed locally. Create an empty GitHub repo (no README),
then:
```sh
cd /Users/yerra/Projects/SriBookKeeping
git remote add origin https://github.com/<you>/SriBookKeeping.git
git push -u origin main
```
**Check:** the code appears on github.com.

## A2. Create the Postgres database (Neon)

1. https://console.neon.tech → **New Project** → name it `sribookkeeping` →
   pick a region near you → **Create**.
2. On the project dashboard → **Connection string** → copy the
   **Pooled connection** URL. It looks like:
   `postgresql://<user>:<pass>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require`
3. Keep it handy — it's your `DATABASE_URL`.

**Check:** you have a `postgresql://...pooler...` URL.

## A3. Apply the schema to your Neon database

**Already done in code** — the app runs on **PostgreSQL**: `schema.prisma` uses
`provider = "postgresql"`, `lib/db.ts` uses the `@prisma/adapter-pg` driver, and
`prisma/migrations/` is Postgres dialect. So you only need to apply that schema
to your Neon database:

```sh
cd web
DATABASE_URL="<your-neon-pooled-url>" npx prisma migrate deploy
```
This creates all tables in Neon from the committed migrations.

**Check:**
```sh
DATABASE_URL="<your-neon-url>" npx prisma studio   # table browser on Neon
```
You should see all tables (Family, Member, Chore, …) empty. (In Vercel, set
`DATABASE_URL` in A7; the build's `vercel-build`/`postinstall` handles the rest,
or run `migrate deploy` from your machine once.)

## A4. Receipt & proof storage → Vercel Blob

Local disk is wiped on every deploy, so photos must go to Blob.

**A4a — install:**
```sh
cd web
npm i @vercel/blob
```

**A4b — replace the entire contents of `web/lib/storage.ts` with:**
```ts
import { put } from "@vercel/blob";
import crypto from "node:crypto";

// Receipt & proof photo storage on Vercel Blob. Files are uploaded with an
// unguessable random path; they're still served only through the app's
// auth-gated routes (/api/receipts/[id], /api/proofs/[id]), which verify
// family membership before streaming the bytes.

const MAX_BYTES = 10 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/webp": ".webp",
};

/** Uploads an image and returns its Blob URL (stored in receiptPath/proofImage). */
export async function saveReceipt(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Receipt must be an image");
  if (file.size === 0) throw new Error("Receipt image is empty");
  if (file.size > MAX_BYTES) throw new Error("Receipt image is too large (max 10 MB)");

  const ext = EXT_BY_TYPE[file.type] ?? ".jpg";
  const { url } = await put(`receipts/${crypto.randomUUID()}${ext}`, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });
  return url;
}

/** Fetches the stored image bytes for the auth-gated serving routes. */
export async function readReceipt(
  receiptPath: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!/^https:\/\//.test(receiptPath)) return null;
  try {
    const res = await fetch(receiptPath);
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return { data, contentType };
  } catch {
    return null;
  }
}
```
(No other file changes — every caller already uses `saveReceipt`/`readReceipt`.)

**A4c — enable Blob in Vercel** (after A6 links the project): Vercel dashboard →
your project → **Storage** → **Create** → **Blob** → connect. This auto-adds the
`BLOB_READ_WRITE_TOKEN` env var.

## A5. Email → Resend

**A5a — install:**
```sh
cd web
npm i resend
```

**A5b — replace the entire contents of `web/lib/email.ts` with** (this keeps the
local `web/outbox/` fallback when no API key is set, so dev still works):
```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

// Cloud: Resend. Dev fallback: write the message to web/outbox/ as .html.
const FROM = process.env.EMAIL_FROM ?? "SriBookKeeping <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to, subject, html });
    return;
  }
  // Dev / no key configured → outbox file.
  const dir = path.join(process.cwd(), "outbox");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = to.replace(/[^a-z0-9@.-]/gi, "_");
  await writeFile(
    path.join(dir, `${stamp}_${safeTo}.html`),
    `<!-- To: ${to} -->\n<!-- Subject: ${subject} -->\n${html}`,
  );
  console.log(`[email:dev] "${subject}" → ${to}`);
}
```

**A5c — Resend setup:** https://resend.com → **API Keys** → **Create** → copy
(that's `RESEND_API_KEY`). To send from your own domain (recommended), Resend →
**Domains** → **Add Domain** → add the DNS records it shows → verify, then set
`EMAIL_FROM="SriBookKeeping <noreply@yourdomain.com>"`. Until then the default
`onboarding@resend.dev` works for testing to your own address.

**A5d — commit the swaps:**
```sh
cd /Users/yerra/Projects/SriBookKeeping
git add -A && git commit -m "Cloud swaps: Postgres, Vercel Blob, Resend"
git push
```

## A6. Create the Vercel project & first deploy

```sh
cd web
vercel link          # → create a new project; scope = your account
```
Then either **CLI deploy** (`vercel` for preview, `vercel --prod` for prod) or
connect the GitHub repo in the dashboard (**Add New → Project → import your
repo**). **Important:** set the **Root Directory** to `web` (the Next app is in a
subfolder), Framework = Next.js.

Don't worry if this first deploy fails for missing env vars — set them next.

## A7. Environment variables

Vercel dashboard → project → **Settings → Environment Variables**. Add each for
**Production** (and Preview if you want):

| Name | Value | How to get it |
|---|---|---|
| `DATABASE_URL` | Neon pooled URL | A2 |
| `AUTH_SECRET` | random 32+ bytes | `openssl rand -base64 32` |
| `CRON_SECRET` | random 32+ bytes | `openssl rand -base64 32` |
| `APP_URL` | `https://<your-domain>` | A9 (use the `*.vercel.app` URL until the domain is set) |
| `RESEND_API_KEY` | Resend key | A5c |
| `EMAIL_FROM` | `SriBookKeeping <noreply@yourdomain.com>` | A5c (optional) |
| `BLOB_READ_WRITE_TOKEN` | auto-added | A4c (enable Blob storage) |
| `NEXT_PUBLIC_CURRENCY` | `USD` | optional (default USD) |

Generate the two secrets:
```sh
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # CRON_SECRET
```
Then redeploy: `vercel --prod` (or dashboard → Deployments → Redeploy).

**Check:** open the deployment URL — the landing page loads over HTTPS.

## A8. Run the migration against production

Your local `migrate dev` (A3d) already created the schema in Neon, so nothing
more is needed. For future schema changes, deploy them with:
```sh
cd web
DATABASE_URL="<neon-url>" npx prisma migrate deploy
```
(Optionally add `"postinstall": "prisma generate"` is already present; you can
also add a `vercel-build` that runs `prisma migrate deploy && next build`.)

## A9. Custom domain + HTTPS

Vercel → project → **Settings → Domains** → add `yourdomain.com` → follow the
DNS instructions at your registrar (A/CNAME). HTTPS is automatic once DNS
propagates. Update `APP_URL` to the final `https://yourdomain.com` and redeploy.

**Why it matters:** PWA install, camera capture, and push all require HTTPS.

## A10. Scheduled jobs (reminders + report emails)

The claim-reminder / auto-assign sweep and due report emails run on page loads
in dev; in prod a cron makes the timing exact. The route already exists at
`web/app/api/cron/route.ts` and checks `CRON_SECRET`.

Create `web/vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron", "schedule": "0 * * * *" }
  ]
}
```
Commit + push + redeploy. Vercel Cron automatically sends
`Authorization: Bearer $CRON_SECRET`. Hourly covers the 24h reminder / 12h
auto-assign windows.

**Check:** Vercel → project → **Cron Jobs** shows `/api/cron` scheduled; trigger
it once and confirm a 200.

## A11. Create your family & grant admin

1. Go to `https://yourdomain.com/register` and set up your family.
2. To unlock the platform-admin console (`/admin` + impersonation), flip your
   member row once:
```sh
cd web
DATABASE_URL="<neon-url>" npx prisma studio
# Member table → your row → isPlatformAdmin = true → Save
```
   (Or run one SQL update in the Neon console.)

## A12. Production smoke test (do all of these on the live URL)

- [ ] Register → add a spouse + kid in **Family**
- [ ] Create a pool chore; second parent **approves** it
- [ ] Pick up → **Complete** with a **photo** → proof shows in **Audit**
- [ ] Record an **expense** with a bill photo → opens in detail
- [ ] Record a **payout** → balance drops
- [ ] Create an **event**, exclude the kid, chat, then **reveal**
- [ ] **Reports** → "Send me a copy now" → arrives in your inbox (Resend)
- [ ] **Forgot password** → reset email arrives → reset works, old sessions die
- [ ] Install the **PWA** (address-bar install icon) and reopen standalone

## A13. Hardening before inviting other families

- [ ] Replace the in-memory IP throttle (`web/lib/rate-limit.ts`) with
      **Upstash Ratelimit** (`npm i @upstash/ratelimit @upstash/redis`) — the
      DB account-lockout already spans instances, this covers the IP layer.
- [ ] Neon → enable backups / confirm point-in-time restore.
- [ ] Publish a **Privacy Policy** page (both app stores require a URL).
- [ ] Optional: Vercel WAF / BotID on `/api/v1/auth/*` and `/register`.

---

# Part B — Web app

The web app is **already live** after Part A (same deployment). Nothing separate
to build. Just confirm on the production URL:

- [ ] All flows in A12 pass.
- [ ] Camera capture works when adding an expense/proof (needs HTTPS from A9).
- [ ] Dark mode + mobile layout look right (resize the browser).
- [ ] Optional: add a social/OG preview image and a full favicon set.

---

# Part C — iOS app (native SwiftUI)

The app is a pure REST client of your deployed API. ⏱️ ~1–2 hrs to run on a
device; the App Store is a separate, longer track.

## C1. Open & configure in Xcode
1. Install **Xcode 16+** (Mac App Store). Then:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
2. Open `SriBookKeeping.xcodeproj`.
3. Select the **SriBookKeeping** target → **Signing & Capabilities**:
   - **Team**: pick your Apple ID (free account works for running on your own
     device; the paid program is only needed for TestFlight/App Store).
   - **Bundle Identifier**: change to something unique, e.g.
     `com.<you>.SriBookKeeping`.
   - Leave **Automatically manage signing** on.

## C2. Point the app at production
- Easiest: run it, and on the **sign-in screen** set **Server URL** to
  `https://yourdomain.com`.
- Or make it the default: in `SriBookKeeping/Core/API.swift`, change the
  fallback in `serverURLString` from `http://localhost:3000` to your domain.

## C3. Build & run
1. Pick a **simulator** (e.g. iPhone 16) or your plugged-in iPhone in the scheme
   selector.
2. **⌘R**. This is the app's **first real Xcode compile** (previously only
   type-checked headlessly), so budget time for one or two small fixes:
   - If a SwiftUI/SDK API mismatch appears, Xcode will point at the exact line.
   - On a physical device: **Settings → General → VPN & Device Management** →
     trust your developer certificate the first time.
3. Sign in with the same email/password as the website — same family, same data.

**Check:** the dashboard shows your family's live balances (proving it's hitting
the deployed API, not local data).

## C4. (Optional) Fill the remaining native screens
Endpoints already exist (`web/API.md`); the iOS UI doesn't yet include: create
schedule, link chore→event, propose chore edit/delete, audit log, admin console,
member management. Add SwiftUI screens calling those endpoints as needed.

## C5. (Optional) Push notifications
Local notifications already remind the assignee. For server push you need the
paid Apple Developer account, an **APNs key** (Keys → +), the Push
Notifications capability, and a send step in the cron. Until then local
notifications keep working.

## C6. App Store submission
1. Enroll in the **Apple Developer Program** ($99/yr).
2. In **App Store Connect** create the app record (matching bundle id).
3. Xcode → **Product → Archive** → **Distribute App → App Store Connect**.
4. Add screenshots, description, and the **privacy-policy URL** (from A13).
5. Submit for review (TestFlight first is recommended). Camera + notification
   usage strings are already set in the project.

---

# Part D — Android (installable PWA — already built)

Android is served by the **same PWA** from Part A. No separate codebase or
build. ⏱️ minutes.

## D1. Install on an Android phone
1. Open `https://yourdomain.com` in **Chrome on Android**.
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**), or tap the
   **Install app** button on the sign-in screen.
3. It launches full-screen with the app icon and emerald status bar.
4. Sign in with the same account. Test camera capture on an expense (needs
   HTTPS — works on your domain).

**Check:** the app appears in the app drawer and opens without browser chrome.

## D2. (Optional) Publish to the Google Play Store via a TWA
Only needed if you want a Play Store *listing* — the PWA installs directly
without it. A **Trusted Web Activity** wraps your live PWA:

1. Install Bubblewrap:
   ```sh
   npm i -g @bubblewrap/cli
   ```
2. Generate the Android project from your manifest:
   ```sh
   bubblewrap init --manifest https://yourdomain.com/manifest.webmanifest
   bubblewrap build
   ```
   This produces a signed **`.aab`** and prints a **SHA-256 fingerprint**.
3. Prove domain ownership: host
   `https://yourdomain.com/.well-known/assetlinks.json` containing that
   fingerprint (Bubblewrap prints the exact JSON; drop it in
   `web/public/.well-known/assetlinks.json` and redeploy).
4. Create a **Google Play Developer** account ($25 one-time), create the app,
   upload the `.aab`, fill the listing + privacy policy, and roll out.

## D3. (Optional) Web push on Android
The manifest + service worker are already in place. To add push: generate VAPID
keys, add a push-subscription flow in the client, store subscriptions, and send
from the cron. Not required for install or normal use.

---

# Troubleshooting

- **`AUTH_SECRET must be set in production`** → you deployed without
  `AUTH_SECRET`. Set it (A7) and redeploy.
- **Prisma "provider mismatch" / migration errors** → you didn't recreate
  migrations after switching to `postgresql` (redo A3d: `rm -rf
  prisma/migrations` then `migrate dev`).
- **Blob upload 500** → `BLOB_READ_WRITE_TOKEN` missing; enable Blob storage
  (A4c) and redeploy.
- **Reset/report emails don't arrive** → `RESEND_API_KEY` missing (falls back to
  `web/outbox/`, which doesn't exist in prod), or `EMAIL_FROM` domain not
  verified in Resend. Test to your own inbox with the default sender first.
- **Cron never runs** → confirm `web/vercel.json` was deployed and `CRON_SECRET`
  is set; check Vercel → Cron Jobs.
- **iOS "Could not connect to server"** → Server URL must be `https://` your
  domain (App Transport Security blocks plain-http except localhost).
- **PWA won't install / camera blocked** → must be HTTPS (A9); a plain-http LAN
  IP won't offer install or camera.

## Fastest path to "it works"
A0 → A1 → A2 → A3 → A4(a,b) → A5(a,b) → commit → A6 → A7 → A9 → A10 → A11 →
A12. Android (D1) works the moment A9 is done. iOS (C1–C3) whenever you're at a
Mac with Xcode.
