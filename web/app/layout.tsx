import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const appSans = Space_Grotesk({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SriBookKeeping — family chores, earnings & expenses",
  description:
    "Set up chores with dollar amounts, let the family pick them up and earn, track expenses with receipts, and see everyone's balance.",
  applicationName: "SriBookKeeping",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SriBookKeeping",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // Navy — colors the Android status bar and the installed app's title bar.
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${appSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
