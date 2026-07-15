# SriBookKeeping REST API (v1)

Consumed by the iOS app once it's pointed at the deployed website. All money
values are **integer cents**; all dates are **ISO 8601** strings.

## Authentication

```
POST /api/v1/auth/login
Body: { "email": "...", "password": "..." }
→ 200 { "token": "<jwt>", "member": {...}, "family": {...} }
```

Send the token on every other request:

```
Authorization: Bearer <jwt>
```

Tokens expire after 30 days. (The web session cookie also authenticates these
endpoints, which makes testing in a browser easy.)

## Endpoints

| Method & path | Purpose |
|---|---|
| `GET /api/v1/me` | Current member + family roster |
| `GET /api/v1/dashboard` | Balances per member + my open assignments (also materializes due schedules) |
| `GET /api/v1/chores` | All family chores + pending assignments |
| `POST /api/v1/chores` | Create a chore: `{ title, details?, amountCents, addToPool?, assigneeIds?, dueDate?, reminderHour?, openToAnyone?, eventId? }` |
| `POST /api/v1/chores/:id/pickup` | Pick up a pool chore: `{ assigneeIds?, dueDate?, reminderHour? }` (defaults to self) |
| `POST /api/v1/assignments/:id/complete` | Complete — multipart/form-data: `proof` (image, **required**), `extraAmountCents?`, `extraReason?` |
| `PATCH /api/v1/assignments/:id` | Edit due date / reminder: `{ dueDate?, reminderHour? }` (assignee or parent) |
| `POST /api/v1/assignments/:id/giveup` | Give up a held chore — returns to "up for grabs", family notified |
| `POST /api/v1/assignments/:id/skip` | Ask to skip/reschedule: `{ reason, newDueDate? }` — a parent accepts |
| `GET /api/v1/approvals` | All requests, each with a `canDecide` flag for the caller |
| `POST /api/v1/approvals/:id` | Decide: `{ "decision": "approve" \| "reject" }` |
| `POST /api/v1/assignments/:id/claim` | Claim an unclaimed scheduled chore, or take over an auto-assigned one |
| `GET /api/v1/schedules` | All schedules |
| `POST /api/v1/schedules` | Create: `{ choreId, recurrence, weekdays?, dayOfMonth?, reminderHour?, assigneeIds?, openToAnyone? }` |
| `POST /api/v1/chores/:id/change` | Propose edit/delete: `{ title?, details?, amountCents?, delete? }` — parents only, BOTH parents approve |
| `GET /api/v1/payouts` | Payouts (kids: own; adults: family) |
| `POST /api/v1/payouts` | Record a payout: `{ memberId, amountCents, note? }` — parents only |
| `GET /api/v1/audit` | Family audit log — parents only |
| `GET /api/v1/notifications` | My notifications + unread count |
| `POST /api/v1/notifications` | Mark all my notifications read |
| `GET /api/v1/events` | Events visible to the caller (surprise exclusions applied) |
| `POST /api/v1/events` | Create: `{ title, details?, eventDate?, excludedMemberIds? }` |
| `GET /api/v1/events/:id/messages` | The event's group chat |
| `POST /api/v1/events/:id/messages` | Post to the chat: `{ body }` |
| `POST /api/v1/events/:id/reveal` | Reveal a surprise event (creator or parent) — visible to everyone after |
| `GET /api/v1/reports?days=30` | Balance sheet for the period (kids: personal; adults: family) |
| `POST /api/v1/reports` | Set email cadence: `{ frequency: NONE\|DAILY\|WEEKLY\|MONTHLY\|QUARTERLY\|HALF_YEARLY\|YEARLY }` |
| `PATCH /api/v1/members/:id` | Edit a member: `{ name?, role?, emoji?, email?, password? }` — parents only; keeps ≥1 active parent |
| `POST /api/v1/members/:id/deactivate` | Remove a member — parents only; history kept, sign-in dies, can't strand the last parent |
| `POST /api/v1/members/:id/reactivate` | Restore a former member — parents only |
| `GET /api/v1/expenses` | Expenses (kids: own; parents: family) |
| `POST /api/v1/expenses` | multipart/form-data: `title, amountCents, date?, category?, notes?, memberId?, receipt` (image, required) |
| `PATCH /api/v1/expenses/:id` | Edit an expense (owner or parent; audited) |
| `DELETE /api/v1/expenses/:id` | Delete an expense (owner or parent; audited) |
| `GET /api/proofs/:assignmentId` | Completion proof photo (auth required) |
| `GET /api/receipts/:expenseId` | Receipt image (auth required) |

## Business rules enforced server-side

- Kid's pool chore → any one parent approves.
- Parent's pool chore → the **other** parent approves (requester can never
  self-approve).
- Schedule → **both** parents must approve; the creating parent counts as one.
- Extra pay → a parent other than the requester.
- Single-parent family → own submissions auto-approve.
- Guardians and grandparents are **adults**: family-wide visibility (balances,
  expenses, receipts, chores in progress) and can log expenses for anyone —
  but approval authority stays with parents.
- Kids can only record/see their own expenses.
- Members carry an `active` flag. A **deactivated** member can't sign in, be
  assigned new work, or count as a required approver — but their ledger history
  stays in reports/balances/audit. A family always keeps ≥1 active parent.
- Every expense requires a receipt image; every completion requires a proof photo.
- Chore edits/deletes need BOTH parents (proposer counts; deletes are soft —
  ledger history survives). Skip/reschedule needs any one parent.
- `balance = earned − spent − paid out` (payouts settle balances).
- Every mutating action lands in the audit log (`GET /api/v1/audit`), including
  actions performed by a platform admin impersonating a member.

### Open schedules (claim & auto-assign)

A schedule with `openToAnyone: true` has no fixed assignees. Each occurrence is
materialized ahead of time as an assignment with `assigneeId: null`:

1. ~24h before the due date, every member gets a `CLAIM_REMINDER` notification.
2. Anyone can `POST /assignments/:id/claim` to take it (first come, first serve).
3. If still unclaimed 12h after the reminder (or within 12h of the due date),
   it's auto-assigned to the member with the fewest open chores
   (`autoAssigned: true`) and everyone gets an `AUTO_ASSIGNED` notification.
4. Auto-assigned chores can still be claimed by someone else (take-over).

### Surprise events

An event may exclude members (`excludedMemberIds`). Excluded members never see
the event, its chat, or chores linked to it (`eventId`) — enforced across every
endpoint, notification, and auto-assignment. Event chores can't join the shared
pool or repeat on a schedule.

### Reports

Every member with an email gets a balance-sheet report (chores earned, expenses,
per-member and family totals) on their chosen cadence; kids receive a personal
sheet, adults the family sheet. Locally, emails are written to `web/outbox/`.

## Enums

- `role`: `PARENT | GUARDIAN | GRANDPARENT | CHILD`
- `chore.kind`: `POOL | ONE_TIME`
- `chore.poolStatus`: `PENDING_APPROVAL | ACTIVE | REJECTED | RETIRED`
- `assignment.status`: `PENDING | COMPLETED | CANCELLED`
- `assignment.extraStatus`: `NONE | PENDING | APPROVED | DENIED`
- `approval.type`: `POOL_CHORE | SCHEDULE | EXTRA_PAY | CHORE_EDIT | CHORE_DELETE | ASSIGNMENT_SKIP`
- `approval.status`: `PENDING | APPROVED | REJECTED`
- `schedule.status`: `PENDING_APPROVAL | ACTIVE | REJECTED | PAUSED`
- `schedule.recurrence`: `DAILY | WEEKLY | MONTHLY` (`weekdays`: 1 = Sunday … 7 = Saturday)
- `expense.category`: `FOOD | CLOTHING | SCHOOL | ENTERTAINMENT | TOYS | OTHER`
