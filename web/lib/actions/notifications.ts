"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { markAllRead } from "@/lib/notifications";

export async function markNotificationsRead() {
  const member = await requireMember();
  await markAllRead(member.id);
  revalidatePath("/", "layout");
}
