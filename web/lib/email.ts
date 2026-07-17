import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

// Email delivery. Cloud (RESEND_API_KEY set): Resend. Local development:
// writes each message to web/outbox/ as an .html file (and logs it) — open
// the file to see exactly what would have been sent.

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
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) throw new Error(`Resend: ${error.message}`);
    return;
  }

  // Dev / no key configured → outbox file.
  const dir = path.join(process.cwd(), "outbox");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTo = to.replace(/[^a-z0-9@.-]/gi, "_");
  const file = path.join(dir, `${stamp}_${safeTo}.html`);
  await writeFile(
    file,
    `<!-- To: ${to} -->\n<!-- Subject: ${subject} -->\n${html}`,
  );
  console.log(`[email:dev] "${subject}" → ${to} (saved to ${file})`);
}
