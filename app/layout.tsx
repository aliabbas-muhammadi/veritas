import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gateway.alimuhammadi.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Veritas — an LLM gateway whose cache is proven correct",
  description:
    "A provider-agnostic LLM gateway with a two-tier semantic cache whose false-positive rate is measured, not assumed — precision, recall, and a CI gate the commercial tier doesn't ship.",
  openGraph: {
    title: "Veritas LLM Gateway",
    description:
      "A semantic cache that proves — with precision and a measured false-positive rate — that it never serves a wrong answer at its chosen threshold.",
    url: siteUrl,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
