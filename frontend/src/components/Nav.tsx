"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/compare", label: "Compare" },
  { href: "/cities/nynj", label: "Evidence" },
  { href: "/optimize", label: "Optimizer" },
  { href: "/map", label: "Map" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/cities")) return pathname.startsWith("/cities");
  return pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/70 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-accent to-model text-[10px] font-bold text-white shadow-[0_0_0_1px_rgb(255_255_255/0.12)_inset,0_4px_12px_-4px_rgb(94_106_210/0.8)] transition-transform duration-300 ease-[var(--ease-spring)] group-hover:scale-105"
          >
            26
          </span>
          <span className="text-sm font-semibold tracking-tight text-fg">
            Mobility Optimizer
          </span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 sm:flex">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${
                  active
                    ? "text-fg"
                    : "text-fg-muted hover:bg-white/[0.05] hover:text-fg"
                }`}
              >
                {link.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -bottom-[13px] h-px bg-gradient-to-r from-transparent via-fg to-transparent"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/optimize" className="btn btn-primary btn-sm">
            Run optimizer
          </Link>
        </div>
      </div>

      {/* Compact nav for phones. */}
      <nav
        aria-label="Primary (compact)"
        className="flex gap-1 overflow-x-auto px-3 pb-2 sm:hidden"
      >
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-surface-3 text-fg"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
