import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted">
        <Image src="/apexhub-logo.png" alt="APEX Hub" width={384} height={105} className="h-7 w-auto opacity-90" />
        <p className="mt-3">Cloud security checks &amp; compliance frameworks.</p>
        <p className="mt-1">
          Check &amp; compliance data licensed under Apache-2.0. © {new Date().getFullYear()} APEX Hub.
        </p>
      </div>
    </footer>
  );
}
