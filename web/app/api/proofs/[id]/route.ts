import { getApiMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { choreHiddenFrom } from "@/lib/events";
import { readReceipt } from "@/lib/storage";

/** Streams the completion-proof photo for an assignment (family-gated). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getApiMember(request);
  if (!member) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const assignment = await db.assignment.findUnique({
    where: { id },
    include: { chore: { include: { event: true } } },
  });
  if (
    !assignment ||
    assignment.chore.familyId !== member.familyId ||
    choreHiddenFrom(assignment.chore, member.id) ||
    !assignment.proofImage
  ) {
    return new Response("Not found", { status: 404 });
  }

  const proof = await readReceipt(assignment.proofImage);
  if (!proof) return new Response("Proof missing", { status: 404 });

  return new Response(new Uint8Array(proof.data), {
    headers: {
      "Content-Type": proof.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
