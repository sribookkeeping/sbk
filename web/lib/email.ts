import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Email delivery. Local development has no mail server, so the dev transport
// writes each message to web/outbox/ as an .html file (and logs it) — open the
// file to see exactly what would have been sent.
//
// CLOUD SWAP: replace `sendEmail` with Resend (https://resend.com):
//   const resend = new Resend(process.env.RESEND_API_KEY);
//   await resend.emails.send({ from, to, subject, html });
// See README "Deploying to the cloud".

const OUTBOX_DIR = path.join(process.cwd(), "outbox");

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await mkdir(OUTBOX_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = to.replace(/[^a-z0-9@.-]/gi, "_");
  const file = path.join(OUTBOX_DIR, `${stamp}_${safeTo}.html`);
  await writeFile(
    file,
    `<!-- To: ${to} -->\n<!-- Subject: ${subject} -->\n${html}`,
  );
  console.log(`[email:dev] "${subject}" → ${to} (saved to ${file})`);
}
