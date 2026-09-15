import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Nav } from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WC26 Host-City Mobility Optimizer",
  description:
    "Evidence-anchored mobility investment optimizer for the 11 U.S. FIFA World Cup 2026 host regions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col bg-bg text-fg">
        {/* Ambient glow sits behind everything; pages sit above it. */}
        <div
          aria-hidden="true"
          className="glow-bg pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        />
        <Providers>
          <Nav />
          <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
            {children}
          </main>
          <footer className="relative mt-16">
            <div className="divider" />
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="max-w-2xl leading-relaxed">
                Demonstration model. Every figure on this site is either
                sourced evidence (linked) or a labeled engineering assumption
                / model output. Nothing here is an official city, state, or
                federal commitment.
              </p>
              <p className="font-mono">WC26 · mobility optimizer</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
