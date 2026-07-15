import { getApiMember, isAdult as isParent } from "@/lib/auth"; // adults can view family receipts
import { db } from "@/lib/db";
import { readReceipt } from "@/lib/storage";

/** Streams the receipt photo for an expense, gated by family membership. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getApiMember(request);
  if (!member) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const expense = await db.expense.findUnique({ where: { id } });
  if (!expense || expense.familyId !== member.familyId) {
    return new Response("Not found", { status: 404 });
  }
  if (!isParent(member) && expense.memberId !== member.id) {
    return new Response("Not found", { status: 404 });
  }

  const receipt = await readReceipt(expense.receiptPath);
  if (!receipt) return new Response("Receipt missing", { status: 404 });

  return new Response(new Uint8Array(receipt.data), {
    headers: {
      "Content-Type": receipt.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
