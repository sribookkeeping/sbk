import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { register } from "@/lib/actions/auth";
import { TimezoneField } from "@/components/timezone-field";
import { buttonPrimary, Card, ErrorBanner, inputClass } from "@/components/ui";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm px-6 py-16">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex"><BrandMark size={48} /></Link>
        <h1 className="mt-2 text-2xl font-bold">Set up your family</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          You&apos;ll be the head of the family — add your spouse and kids next.
        </p>
      </div>

      <Card>
        <ErrorBanner message={error} />
        <form action={register} className="space-y-4">
          <TimezoneField />
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="familyName">Family name</label>
            <input id="familyName" name="familyName" required placeholder="The Yerras" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="name">Your name</label>
            <input id="name" name="name" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="password">Password (8+ characters)</label>
            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
          </div>
          <button type="submit" className={`${buttonPrimary} w-full`}>Create Family</button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-indigo-600 dark:text-indigo-400">
          Sign in
        </Link>
      </p>
    </main>
  );
}
