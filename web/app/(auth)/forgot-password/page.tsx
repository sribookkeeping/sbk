import Link from "next/link";
import { forgotPassword } from "@/lib/actions/auth";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-16">
      <div className="mb-8 text-center">
        <Link href="/" className="text-4xl">🏡</Link>
        <h1 className="mt-2 text-2xl font-bold">Forgot password</h1>
      </div>

      <Card>
        <ErrorBanner message={error} />
        {sent ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            If that email is registered, a reset link is on its way. (Locally, check{" "}
            <code>web/outbox/</code>.) The link is valid for 1 hour.
          </p>
        ) : (
          <form action={forgotPassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
            </div>
            <button type="submit" className={`${buttonPrimary} w-full`}>Send reset link</button>
          </form>
        )}
      </Card>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/login" className="font-semibold text-emerald-600 dark:text-emerald-400">
          Back to sign in
        </Link>
        {" · "}
        <Link href="/find-account" className="font-semibold text-emerald-600 dark:text-emerald-400">
          Find my account
        </Link>
      </p>
    </main>
  );
}
