import { requireMember, isParent } from "@/lib/auth";
import { familyBalances, EMPTY_BALANCE } from "@/lib/ledger";
import {
  addMember,
  setFamilyTimezone,
  updateMember,
  deactivateMember,
  reactivateMember,
  resetMemberPassword,
} from "@/lib/actions/family";
import { changePassword } from "@/lib/actions/auth";
import { buttonSecondary, buttonDanger } from "@/components/ui";
import { recordPayout } from "@/lib/actions/payouts";
import { db } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Role, ROLE_OPTIONS, roleLabel } from "@/lib/types";
import {
  Avatar,
  buttonPrimary,
  Card,
  ErrorBanner,
  inputClass,
  Money,
  SectionTitle,
} from "@/components/ui";

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    paid?: string;
    pwd?: string;
    tz?: string;
    updated?: string;
    removed?: string;
    restored?: string;
    reset?: string;
  }>;
}) {
  const member = await requireMember();
  const { error, paid, pwd, tz, updated, removed, restored, reset } = await searchParams;
  const timezones = Intl.supportedValuesOf("timeZone");
  const recentPayouts = await db.payout.findMany({
    where: { familyId: member.familyId },
    include: { member: true, paidBy: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const parent = isParent(member);
  const balances = await familyBalances(member.familyId);

  const sorted = [...member.family.members].sort((a, b) => {
    if (a.isHead !== b.isHead) return a.isHead ? -1 : 1;
    if (a.role !== b.role) return a.role === Role.PARENT ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  const active = sorted.filter((m) => !m.deactivatedAt);
  const former = sorted.filter((m) => m.deactivatedAt);

  return (
    <>
      <h1 className="text-2xl font-bold">{member.family.name}</h1>
      <div className="mt-4 space-y-2">
        <ErrorBanner message={error} />
        {updated && (
          <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Member updated.
          </p>
        )}
        {removed && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Member removed — their history is kept, and they can no longer sign in.
          </p>
        )}
        {restored && (
          <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Member restored.
          </p>
        )}
        {reset && (
          <p className="rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Password reset — they&apos;ve been emailed a temporary password and will choose a
            new one at sign-in.
          </p>
        )}
      </div>

      <SectionTitle>Members</SectionTitle>
      <Card>
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {active.map((m) => {
            const balance = balances.get(m.id) ?? EMPTY_BALANCE;
            return (
              <li key={m.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar emoji={m.emoji} isParent={m.role === Role.PARENT} size={40} />
                    <div>
                      <p className="font-medium">
                        {m.name}{m.isHead && " · head"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {roleLabel(m.role)}
                        {m.email && ` · ${m.email}`}
                        {!m.passwordHash && " · no sign-in yet"}
                      </p>
                    </div>
                  </div>
                  <Money cents={balance.balanceCents} />
                </div>

                {parent && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      Edit
                    </summary>
                    <form
                      action={updateMember.bind(null, m.id)}
                      className="mt-3 grid gap-3 sm:grid-cols-2"
                    >
                      <div>
                        <label className="mb-1 block text-xs font-medium">Name</label>
                        <input name="name" defaultValue={m.name} required className={inputClass} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Emoji</label>
                        <input name="emoji" defaultValue={m.emoji} maxLength={4} className={inputClass} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">Role</label>
                        <select name="role" defaultValue={m.role} className={inputClass}>
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium">
                          {m.email ? "Email" : "Add email (optional)"}
                        </label>
                        <input
                          name="email"
                          type="email"
                          defaultValue={m.email ?? ""}
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-medium">
                          {m.email ? "New password (optional)" : "Password (with email, gives a sign-in)"}
                        </label>
                        <input
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                        <button type="submit" className={buttonSecondary}>
                          Save changes
                        </button>
                        {m.role !== Role.PARENT && !!m.email && !m.deactivatedAt && (
                          <button
                            formAction={resetMemberPassword.bind(null, m.id)}
                            title="Emails them a temporary password; they choose a new one at sign-in"
                            className={buttonSecondary}
                          >
                            Reset password
                          </button>
                        )}
                        {m.id !== member.id && (
                          <button
                            formAction={deactivateMember.bind(null, m.id)}
                            className={buttonDanger}
                          >
                            Remove from family
                          </button>
                        )}
                      </div>
                      {m.role === Role.PARENT && (
                        <p className="text-xs text-slate-500 sm:col-span-2 dark:text-slate-400">
                          Parents reset their own password with &ldquo;Forgot password&rdquo; on
                          the sign-in page.
                        </p>
                      )}
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {former.length > 0 && (
        <>
          <SectionTitle>Former members</SectionTitle>
          <Card>
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {former.map((m) => {
                const balance = balances.get(m.id) ?? EMPTY_BALANCE;
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-3 opacity-70">
                    <div className="flex items-center gap-3">
                      <Avatar emoji={m.emoji} isParent={m.role === Role.PARENT} size={36} />
                      <div>
                        <p className="font-medium line-through">{m.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {roleLabel(m.role)} · removed
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Money cents={balance.balanceCents} />
                      {parent && (
                        <form action={reactivateMember.bind(null, m.id)}>
                          <button className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                            Restore
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}

      <SectionTitle>My account</SectionTitle>
      <Card>
        {pwd && (
          <p className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Password changed — every other device has been signed out.
          </p>
        )}
        {member.passwordHash ? (
          <form action={changePassword} className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="current">Current password</label>
              <input id="current" name="current" type="password" required autoComplete="current-password" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="next">New password (8+)</label>
              <input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="confirm">Confirm new</label>
              <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className={buttonSecondary}>Change password</button>
              <span className="ml-3 text-xs text-slate-500 dark:text-slate-400">
                Changing it signs out all other devices.
              </span>
            </div>
          </form>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This profile has no sign-in yet — a parent can add an email + password below.
          </p>
        )}
      </Card>

      {parent && (
        <>
          <SectionTitle>💵 Record a payout</SectionTitle>
          <Card>
            {paid && (
              <p className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Payout recorded — balances updated.
              </p>
            )}
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Handed someone cash (or transferred their earnings)? Record it here — their balance
              goes down by the amount. balance = earned − spent − paid out.
            </p>
            <form action={recordPayout} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="payoutMember">To</label>
                <select id="payoutMember" name="memberId" className={inputClass}>
                  {sorted.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.emoji} {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="mb-1 block text-sm font-medium" htmlFor="payoutAmount">Amount ($)</label>
                <input id="payoutAmount" name="amount" required inputMode="decimal" placeholder="20.00" className={inputClass} />
              </div>
              <div className="min-w-40 flex-1">
                <label className="mb-1 block text-sm font-medium" htmlFor="payoutNote">Note (optional)</label>
                <input id="payoutNote" name="note" placeholder="Cash, allowance…" className={inputClass} />
              </div>
              <button type="submit" className={buttonPrimary}>Record</button>
            </form>
            {recentPayouts.length > 0 && (
              <ul className="mt-4 divide-y divide-black/5 border-t border-black/5 pt-2 text-sm dark:divide-white/10 dark:border-white/10">
                {recentPayouts.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <span>
                      {p.member.emoji} {p.member.name}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {" "}· {fmtDate(p.createdAt)} · by {p.paidBy?.name ?? "?"}
                        {p.note ? ` · ${p.note}` : ""}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{fmtMoney(p.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <SectionTitle>Family settings</SectionTitle>
          <Card>
            {tz && (
              <p className="mb-3 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Timezone updated — schedules and reminders now run on it.
              </p>
            )}
            <form action={setFamilyTimezone} className="flex flex-wrap items-end gap-3">
              <div className="min-w-64">
                <label className="mb-1 block text-sm font-medium" htmlFor="timezone">
                  Family timezone
                </label>
                <select id="timezone" name="timezone" defaultValue={member.family.timezone} className={inputClass}>
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className={buttonSecondary}>Save</button>
              <p className="w-full text-xs text-slate-500 dark:text-slate-400">
                Schedule reminder hours and day boundaries run in this timezone — important once
                the app is hosted in the cloud (servers run in UTC).
              </p>
            </form>
          </Card>

          <SectionTitle>Add family member</SectionTitle>
          <Card>
            <form action={addMember} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="name">Name</label>
                  <input id="name" name="name" required className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" htmlFor="role">Role</label>
                  <select id="role" name="role" defaultValue={Role.CHILD} className={inputClass}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="emoji">Emoji avatar</label>
                <input id="emoji" name="emoji" placeholder="🧒" maxLength={4} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="email">
                  Email (required)
                </label>
                <input id="email" name="email" type="email" required className={inputClass} />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  They&apos;ll get a temporary password by email and choose their own at first
                  sign-in.
                </p>
              </div>
              <button type="submit" className={buttonPrimary}>Add Member</button>
            </form>
          </Card>
        </>
      )}
    </>
  );
}
