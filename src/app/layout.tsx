import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kedbyte Payroll — Bureau Command Center",
  description:
    "Multi-tenant UK payroll bureau platform with HMRC RTI compliance. Bureau Command Center + Employee Self-Service Portal.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  applicationName: "Kedbyte Payroll",
  authors: [{ name: "Kedbyte Payroll" }],
  keywords: ["UK payroll", "HMRC RTI", "bureau payroll", "payroll software", "Kedbyte"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <link
          rel="icon"
          href="/logo.svg"
          type="image/svg+xml"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300,0,0&display=block"
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrains.variable} antialiased bg-void text-tprimary`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
