import Link from "next/link";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-sm font-bold text-background">
            AX
          </span>
          <span className="text-lg tracking-tight">
            APEX<span className="text-accent">Hub</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/check" className="rounded-md px-3 py-1.5 text-muted transition hover:bg-surface hover:text-foreground">
            Checks
          </Link>
          <Link href="/compliance" className="rounded-md px-3 py-1.5 text-muted transition hover:bg-surface hover:text-foreground">
            Compliance
          </Link>
          <Link href="/api/docs" className="rounded-md px-3 py-1.5 text-muted transition hover:bg-surface hover:text-foreground">
            API Docs
          </Link>
        </nav>
      </div>
    </header>
  );
}
