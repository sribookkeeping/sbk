import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-16">
      <div className="mb-8 text-center">
        <Link href="/" className="text-4xl">🏡</Link>
        <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
      </div>

      <Card>
        <ErrorBanner message={error} />
        <form action={login} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`}>Sign In</button>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/forgot-password" className="font-semibold text-emerald-600 dark:text-emerald-400">
            Forgot password?
          </Link>
          {" · "}
          <Link href="/find-account" className="font-semibold text-emerald-600 dark:text-emerald-400">
            Find my account
          </Link>
        </p>
      </Card>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        New here?{" "}
        <Link href="/register" className="font-semibold text-emerald-600 dark:text-emerald-400">
          Set up your family
        </Link>
      </p>
    </main>
  );
}
