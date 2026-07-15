"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { emailReport } from "@/lib/reports";
import { ReportFrequency, reportFrequencyDays } from "@/lib/types";

/** Change how often the current member gets balance-sheet emails. */
export async function setReportFrequency(formData: FormData) {
  const member = await requireMember();
  const frequency = String(formData.get("frequency") ?? ReportFrequency.MONTHLY);
  if (!Object.values(ReportFrequency).includes(frequency as ReportFrequency)) return;

  await db.member.update({
    where: { id: member.id },
    data: { reportFrequency: frequency },
  });
  revalidatePath("/reports");
  redirect("/reports?sent=pref");
}

/** "Send me a copy now" — emails the current member their report immediately. */
export async function sendReportNow() {
  const member = await requireMember();
  if (!member.email) redirect(`/reports?error=${encodeURIComponent("Add an email to your profile first.")}`);

  const now = new Date();
  const days = Math.max(reportFrequencyDays(member.reportFrequency), 30);
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  await emailReport(member.id, start, now);
  redirect("/reports?sent=now");
}
