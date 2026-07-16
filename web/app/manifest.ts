import type { MetadataRoute } from "next";

// Web App Manifest — makes SriBookKeeping installable on the Android home
// screen (and iPhone/tablet) as a standalone, full-screen app. Next serves
// this at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SriBookKeeping — family chores & allowance",
    short_name: "SriBookKeeping",
    description:
      "Family chores, earnings, and expenses with parent approvals — set up chores, pick them up and earn, log expenses with receipts, and see everyone's balance.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f4f5", // zinc-100, matches the app background
    theme_color: "#059669", // emerald-600, matches the header/buttons
    categories: ["productivity", "finance", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Chores", short_name: "Chores", url: "/chores" },
      { name: "Add expense", short_name: "Expense", url: "/expenses/new" },
      { name: "Approvals", short_name: "Approvals", url: "/approvals" },
    ],
  };
}
