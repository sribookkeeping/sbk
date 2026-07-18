import { BrandMark } from "@/components/brand";
export const metadata = { title: "Offline — SriBookKeeping" };

// Shown by the service worker when a navigation happens with no connection.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col items-center justify-center px-6 text-center">
      <div className="flex justify-center"><BrandMark size={64} /></div>
      <h1 className="mt-4 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        SriBookKeeping needs a connection to show your family&apos;s chores, balances, and
        expenses. Reconnect and try again.
      </p>
      <a
        href="/dashboard"
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Retry
      </a>
    </main>
  );
}
