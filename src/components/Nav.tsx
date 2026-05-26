import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "./ThemeToggle";

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center" aria-label="APEX Hub home">
          {/* dark-text logo for light theme */}
          <Image src="/apexhub-logo-light.png" alt="APEX Hub" width={377} height={99} priority className="block h-9 w-auto dark:hidden" />
          {/* white-text logo for dark theme */}
          <Image src="/apexhub-logo.png" alt="APEX Hub" width={377} height={99} priority className="hidden h-9 w-auto dark:block" />
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
          <span className="ml-1.5 border-l border-border pl-1.5">
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </header>
  );
}
