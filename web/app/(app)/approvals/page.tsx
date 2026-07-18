import { requireMember } from "@/lib/auth";
import {
  canDecide,
  familyRequests,
  parseIds,
  requestAmountCents,
  requestHeadline,
  requestPayload,
  type ChoreEditPayload,
  type FamilyRequest,
  type SkipPayload,
} from "@/lib/approvals";
import { fmtMoney } from "@/lib/format";
import { approve, reject } from "@/lib/actions/approvals";
import { fmtDateTime } from "@/lib/format";
import { ApprovalStatus, ApprovalType } from "@/lib/types";
import { Badge, Card, EmptyState, Money, PageHeader, SectionTitle, Tile } from "@/components/ui";
import {
  IconArrowUpRight,
  IconCalendar,
  IconCheckCircle,
  IconListChecks,
  IconPencil,
  IconSkip,
  IconTrash,
} from "@/components/icons";

const TYPE_TILE: Record<string, { tone: string; icon: React.ReactNode }> = {
  [ApprovalType.POOL_CHORE]: { tone: "indigo", icon: <IconListChecks className="h-5 w-5" /> },
  [ApprovalType.SCHEDULE]: { tone: "indigo", icon: <IconCalendar className="h-5 w-5" /> },
  [ApprovalType.EXTRA_PAY]: { tone: "emerald", icon: <IconArrowUpRight className="h-5 w-5" /> },
  [ApprovalType.CHORE_EDIT]: { tone: "slate", icon: <IconPencil className="h-5 w-5" /> },
  [ApprovalType.CHORE_DELETE]: { tone: "red", icon: <IconTrash className="h-5 w-5" /> },
  [ApprovalType.ASSIGNMENT_SKIP]: { tone: "amber", icon: <IconSkip className="h-5 w-5" /> },
};

/** Human-readable summary of what a proposal would change. */
function proposalDetail(request: FamilyRequest): string | null {
  if (request.type === ApprovalType.CHORE_EDIT) {
    const changes = requestPayload<ChoreEditPayload>(request);
    if (!changes) return null;
    const parts: string[] = [];
    if (changes.title !== undefined) parts.push(`title → "${changes.title}"`);
    if (changes.amountCents !== undefined) parts.push(`amount → ${fmtMoney(changes.amountCents)}`);
    if (changes.details !== undefined) parts.push("details updated");
    return parts.join(", ") || null;
  }
  if (request.type === ApprovalType.ASSIGNMENT_SKIP) {
    const payload = requestPayload<SkipPayload>(request);
    if (payload?.newDueDate) {
      return `new due date: ${new Date(payload.newDueDate).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
    }
    return "skip this occurrence";
  }
  if (request.type === ApprovalType.CHORE_DELETE) {
    return "cancels open assignments and pauses schedules; history is kept";
  }
  return null;
}

function RequestRow({ request, actions }: { request: FamilyRequest; actions: boolean }) {
  const amount = requestAmountCents(request);
  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Tile tone={TYPE_TILE[request.type]?.tone ?? "slate"}>
            {TYPE_TILE[request.type]?.icon ?? <IconCheckCircle className="h-5 w-5" />}
          </Tile>
          <div>
            <p className="font-medium">{requestHeadline(request)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {request.requestedBy?.name ?? "Someone"} · {fmtDateTime(request.createdAt)}
            </p>
            {proposalDetail(request) && (
              <p className="mt-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                {proposalDetail(request)}
              </p>
            )}
            {request.note && (
              <p className="mt-1 text-xs text-slate-500 italic dark:text-slate-400">
                Reason: {request.note}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {amount !== null && amount > 0 && <Money cents={amount} tone="positive" />}
          {request.status === ApprovalStatus.PENDING && <Badge color="orange">Pending</Badge>}
          {request.status === ApprovalStatus.APPROVED && <Badge color="green">Approved</Badge>}
          {request.status === ApprovalStatus.REJECTED && <Badge color="red">Rejected</Badge>}
        </div>
      </div>
      {actions && (
        <div className="mt-3 flex gap-2">
          <form action={approve.bind(null, request.id)} className="flex-1">
            <button className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Approve
            </button>
          </form>
          <form action={reject.bind(null, request.id)} className="flex-1">
            <button className="w-full rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">
              Reject
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

export default async function ApprovalsPage() {
  const member = await requireMember();
  const requests = await familyRequests(member.familyId);

  const needsMe = requests.filter((r) => canDecide(r, member));
  const waiting = requests.filter(
    (r) =>
      r.status === ApprovalStatus.PENDING &&
      !canDecide(r, member) &&
      (r.requestedById === member.id || parseIds(r.approvedByIds).includes(member.id)),
  );
  const decided = requests.filter((r) => r.status !== ApprovalStatus.PENDING).slice(0, 10);

  return (
    <>
      <PageHeader title="Approvals" />

      {needsMe.length === 0 && waiting.length === 0 && decided.length === 0 && (
        <Card className="mt-6">
          <EmptyState>
            Nothing to approve. New chores, schedules, and extra-pay requests will show up here.
          </EmptyState>
        </Card>
      )}

      {needsMe.length > 0 && (
        <>
          <SectionTitle>Needs your approval ({needsMe.length})</SectionTitle>
          <Card>
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {needsMe.map((request) => (
                <RequestRow key={request.id} request={request} actions />
              ))}
            </ul>
          </Card>
        </>
      )}

      {waiting.length > 0 && (
        <>
          <SectionTitle>Waiting on others</SectionTitle>
          <Card>
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {waiting.map((request) => (
                <RequestRow key={request.id} request={request} actions={false} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {decided.length > 0 && (
        <>
          <SectionTitle>Recent decisions</SectionTitle>
          <Card>
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {decided.map((request) => (
                <RequestRow key={request.id} request={request} actions={false} />
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
