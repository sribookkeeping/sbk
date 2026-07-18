import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { buttonPrimary, buttonSecondary, Card, Tile } from "@/components/ui";
import { BrandMark } from "@/components/brand";
import {
  IconArrowUpRight,
  IconChart,
  IconCheckCircle,
  IconGrid,
  IconListChecks,
  IconReceipt,
} from "@/components/icons";
import { InstallButton } from "@/components/install-button";

const FEATURES = [
  {
    tone: "indigo",
    icon: <IconListChecks className="h-5 w-5" />,
    title: "Chores with dollar amounts",
    text: "Parents fill a family chore pool; anyone picks one up and earns.",
  },
  {
    tone: "emerald",
    icon: <IconCheckCircle className="h-5 w-5" />,
    title: "Built-in approvals",
    text: "Kids' chores need a parent; a parent's chores need the other parent; schedules need both.",
  },
  {
    tone: "amber",
    icon: <IconArrowUpRight className="h-5 w-5" />,
    title: "Extra-pay requests",
    text: "Harder than usual today? Ask for more with a reason when completing.",
  },
  {
    tone: "red",
    icon: <IconReceipt className="h-5 w-5" />,
    title: "Expenses with receipts",
    text: "Every expense is logged in a member's name with a photo of the bill.",
  },
  {
    tone: "indigo",
    icon: <IconChart className="h-5 w-5" />,
    title: "Live balances",
    text: "Earnings minus expenses, per member, right on the dashboard.",
  },
  {
    tone: "slate",
    icon: <IconGrid className="h-5 w-5" />,
    title: "iPhone + web",
    text: "A native iOS app and this website, one family ledger.",
  },
];

export default async function LandingPage() {
  const member = await getCurrentMember();
  if (member) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="text-center">
        <div className="flex justify-center">
          <BrandMark size={64} />
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight">SriBookKeeping</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600 dark:text-slate-300">
          Family chores, earnings, and expenses — with parent approvals baked in.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className={buttonPrimary}>
            Set up your family
          </Link>
          <Link href="/login" className={buttonSecondary}>
            Sign in
          </Link>
        </div>
        <div className="mt-4 flex justify-center">
          <InstallButton />
        </div>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <Tile tone={feature.tone}>{feature.icon}</Tile>
            <h3 className="mt-3 font-semibold">{feature.title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{feature.text}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
