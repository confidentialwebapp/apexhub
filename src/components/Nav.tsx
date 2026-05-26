import Link from "next/link";
import Image from "next/image";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center" aria-label="APEX Hub home">
          <Image
            src="/apexhub-logo.png"
            alt="APEX Hub"
            width={384}
            height={105}
            priority
            className="h-8 w-auto"
          />
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
