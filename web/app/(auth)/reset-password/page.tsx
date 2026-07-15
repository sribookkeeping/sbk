import Link from "next/link";
import { resetPassword } from "@/lib/actions/auth";
import { peekResetToken } from "@/lib/auth";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; token?: string }>;
}) {
  const { error, token = "" } = await searchParams;
  const valid = token ? (await peekResetToken(token)) !== null : false;

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-16">
      <div className="mb-8 text-center">
        <Link href="/" className="text-4xl">🏡</Link>
        <h1 className="mt-2 text-2xl font-bold">Set a new password</h1>
      </div>

      <Card>
        <ErrorBanner message={error} />
        {!valid ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            This reset link is invalid or has expired.{" "}
            <Link href="/forgot-password" className="font-semibold text-emerald-600 dark:text-emerald-400">
              Request a new one →
            </Link>
          </p>
        ) : (
          <form action={resetPassword} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="password">
                New password (8+ characters)
              </label>
              <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="confirm">Confirm password</label>
              <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
            </div>
            <button type="submit" className={`${buttonPrimary} w-full`}>Reset & Sign In</button>
          </form>
        )}
      </Card>
    </main>
  );
}
