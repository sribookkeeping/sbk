import { db } from "@/lib/db";
import { audit, AuditAction } from "@/lib/audit";
import { submitExtraPay } from "@/lib/approvals";
import { saveReceipt } from "@/lib/storage";
import { AssignmentStatus } from "@/lib/types";
import { apiError, json, serializeAssignment, withAuth } from "@/lib/api";

/**
 * POST multipart/form-data: proof (image, REQUIRED), extraAmountCents?,
 * extraReason? — completes a chore with photo proof (requirement 9 + proof).
 */
export const POST = withAuth<{ params: Promise<{ id: string }> }>(
  async (member, request, { params }) => {
    const { id } = await params;
    const assignment = await db.assignment.findUnique({
      where: { id },
      include: { chore: true },
    });
    if (!assignment || assignment.chore.familyId !== member.familyId) {
      return apiError("Assignment not found", 404);
    }
    if (assignment.assigneeId === null) {
      return apiError("Claim this chore before completing it", 409);
    }
    if (assignment.assigneeId !== member.id && member.role !== "PARENT") {
      return apiError("Only the assignee or a parent can complete this", 403);
    }
    if (assignment.status !== AssignmentStatus.PENDING) {
      return apiError("Already completed", 409);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return apiError("Expected multipart/form-data with a proof image", 400);
    }

    const proof = form.get("proof");
    if (!(proof instanceof File) || proof.size === 0) {
      return apiError("proof image file is required", 400);
    }
    let proofImage: string;
    try {
      proofImage = await saveReceipt(proof);
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Bad proof image", 400);
    }

    const extraCents = Math.round(Number(form.get("extraAmountCents") ?? 0)) || 0;
    const extraReason = String(form.get("extraReason") ?? "").trim();
    if (extraCents < 0) return apiError("extraAmountCents must be >= 0", 400);
    if (extraCents > 0 && !extraReason) {
      return apiError("extraReason is required when requesting extra pay", 400);
    }

    await db.assignment.update({
      where: { id },
      data: {
        status: AssignmentStatus.COMPLETED,
        completedAt: new Date(),
        extraAmountCents: extraCents,
        extraReason: extraCents > 0 ? extraReason : "",
        proofImage,
      },
    });

    if (extraCents > 0) await submitExtraPay(id, extraReason, member);

    await audit(member, AuditAction.ASSIGNMENT_COMPLETED, "Assignment", id, {
      chore: assignment.chore.title,
      extraCents,
    });

    const updated = await db.assignment.findUniqueOrThrow({ where: { id } });
    return json({ assignment: serializeAssignment(updated) });
  },
);
