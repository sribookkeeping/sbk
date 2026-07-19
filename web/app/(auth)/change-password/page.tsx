import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { setFirstPassword } from "@/lib/actions/auth";
import { BrandMark } from "@/components/brand";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

/**
 * Forced first-login step for accounts created with an emailed temporary
 * password. The (app) layout redirects here until the flag clears.
 */
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await requireMember();
  if (!member.mustChangePassword) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-16">
      <div className="mb-8 text-center">
        <span className="inline-flex"><BrandMark size={48} /></span>
        <h1 className="mt-2 text-2xl font-bold">Choose your password</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Hi {member.name} — replace the temporary password from your email with one
          only you know.
        </p>
      </div>

      <Card>
        <ErrorBanner message={error} />
        <form action={setFirstPassword} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="next">
              New password (8+ characters)
            </label>
            <input
              id="next"
              name="next"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="confirm">
              Confirm new password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`}>
            Save and continue
          </button>
        </form>
      </Card>
    </main>
  );
}
