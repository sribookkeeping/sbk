import { canDecide, familyRequests, requestAmountCents, requestHeadline } from "@/lib/approvals";
import { json, withAuth } from "@/lib/api";

/** GET → all approval requests in the family, with a canDecide flag for the caller. */
export const GET = withAuth(async (member) => {
  const requests = await familyRequests(member.familyId);
  return json({
    requests: requests.map((request) => ({
      id: request.id,
      type: request.type,
      status: request.status,
      headline: requestHeadline(request),
      note: request.note,
      amountCents: requestAmountCents(request),
      requestedBy: request.requestedBy
        ? { id: request.requestedBy.id, name: request.requestedBy.name }
        : null,
      requiresBothParents: request.requiresBothParents,
      canDecide: canDecide(request, member),
      createdAt: request.createdAt.toISOString(),
      decidedAt: request.decidedAt?.toISOString() ?? null,
    })),
  });
});
