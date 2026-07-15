import { db } from "@/lib/db";
import { runScheduleSweep } from "@/lib/schedules";
import { sendDueReports } from "@/lib/reports";

/**
 * Cron entry point: schedule sweep (materialize, claim reminders, auto-assign)
 * + due report emails for EVERY family. Locally these also run on page loads;
 * in the cloud, point a Vercel Cron here (hourly) so timing is exact:
 *
 *   vercel.json / vercel.ts → crons: [{ path: "/api/cron", schedule: "0 * * * *" }]
 *
 * Secured with CRON_SECRET: Vercel Cron sends it automatically as
 * `Authorization: Bearer <CRON_SECRET>` when the env var is set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const families = await db.family.findMany({ select: { id: true } });
  for (const family of families) {
    await runScheduleSweep(family.id);
    await sendDueReports(family.id);
  }
  return Response.json({ ok: true, families: families.length });
}
