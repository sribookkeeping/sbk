export const metadata = { title: "Offline — SriBookKeeping" };

// Shown by the service worker when a navigation happens with no connection.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col items-center justify-center px-6 text-center">
      <div className="text-6xl">🏡</div>
      <h1 className="mt-4 text-2xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        SriBookKeeping needs a connection to show your family&apos;s chores, balances, and
        expenses. Reconnect and try again.
      </p>
      <a
        href="/dashboard"
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Retry
      </a>
    </main>
  );
}
