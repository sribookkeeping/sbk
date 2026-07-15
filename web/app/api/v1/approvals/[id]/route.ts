import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { approveRequest, rejectRequest } from "@/lib/approvals";
import { apiError, json, withAuth } from "@/lib/api";

/** POST { decision: "approve" | "reject" } */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, request, { params }) => {
    const { id } = await params;

    let body: { decision?: string };
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", 400);
    }

    if (body.decision === "approve") {
      await approveRequest(id, member);
    } else if (body.decision === "reject") {
      await rejectRequest(id, member);
    } else {
      return apiError('decision must be "approve" or "reject"', 400);
    }

    const updated = await db.approvalRequest.findUnique({ where: { id } });
    if (!updated || updated.familyId !== member.familyId) {
      return apiError("Request not found", 404);
    }
    await audit(member, AuditAction.APPROVAL_DECIDED, "ApprovalRequest", id, {
      type: updated.type,
      decision: body.decision,
      status: updated.status,
    });
    return json({ id: updated.id, status: updated.status });
  },
);
