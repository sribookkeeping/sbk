import { db } from "@/lib/db";
import { familyBalances } from "@/lib/ledger";
import { runScheduleSweep } from "@/lib/schedules";
import { AssignmentStatus } from "@/lib/types";
import { json, serializeAssignment, withAuth } from "@/lib/api";

/** GET → balances for every family member + my open assignments. */
export const GET = withAuth(async (member) => {
  await runScheduleSweep(member.familyId);

  const [balances, openAssignments] = await Promise.all([
    familyBalances(member.familyId),
    db.assignment.findMany({
      where: { assigneeId: member.id, status: AssignmentStatus.PENDING },
      include: { chore: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return json({
    balances: Object.fromEntries(balances),
    openAssignments: openAssignments.map((a) => ({
      ...serializeAssignment(a),
      choreTitle: a.chore.title,
    })),
  });
});
