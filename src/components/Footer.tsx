export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted">
        <p>
          <span className="font-semibold text-foreground">APEX Hub</span> — cloud security checks &amp; compliance frameworks.
        </p>
        <p className="mt-1">
          Check &amp; compliance data licensed under Apache-2.0. © {new Date().getFullYear()} APEX Hub.
        </p>
      </div>
    </footer>
  );
}
