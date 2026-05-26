"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/check", label: "Checks" },
  { href: "/compliance", label: "Compliance" },
  { href: "/api/docs", label: "API Docs" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link href="/" className="flex shrink-0 items-center" aria-label="APEX Hub home" onClick={() => setOpen(false)}>
          <Image src="/apexhub-logo-light.png" alt="APEX Hub" width={377} height={99} priority className="block h-7 w-auto sm:h-9 dark:hidden" />
          <Image src="/apexhub-logo.png" alt="APEX Hub" width={377} height={99} priority className="hidden h-7 w-auto sm:h-9 dark:block" />
        </Link>

        {/* desktop links */}
        <nav className="hidden items-center gap-1 text-sm sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 transition hover:bg-surface hover:text-foreground ${
                pathname === l.href ? "text-foreground" : "text-muted"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <span className="ml-1.5 border-l border-border pl-1.5">
            <ThemeToggle />
          </span>
        </nav>

        {/* mobile controls */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted transition hover:text-foreground"
          >
            {open ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg>
            )}
          </button>
        </div>
      </div>

      {/* mobile dropdown */}
      {open && (
        <nav className="border-t border-border bg-background px-4 pb-3 pt-2 sm:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2.5 text-sm transition hover:bg-surface ${
                pathname === l.href ? "text-foreground" : "text-muted"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
