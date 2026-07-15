"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { audit, AuditAction } from "@/lib/audit";
import { approveRequest, rejectRequest } from "@/lib/approvals";

async function auditDecision(requestId: string, member: Awaited<ReturnType<typeof requireMember>>, decision: string) {
  const request = await db.approvalRequest.findUnique({ where: { id: requestId } });
  if (request) {
    await audit(member, AuditAction.APPROVAL_DECIDED, "ApprovalRequest", requestId, {
      type: request.type,
      decision,
      status: request.status,
    });
  }
}

export async function approve(requestId: string) {
  const member = await requireMember();
  await approveRequest(requestId, member);
  await auditDecision(requestId, member, "approve");
  revalidatePath("/", "layout");
}

export async function reject(requestId: string) {
  const member = await requireMember();
  await rejectRequest(requestId, member);
  await auditDecision(requestId, member, "reject");
  revalidatePath("/", "layout");
}
