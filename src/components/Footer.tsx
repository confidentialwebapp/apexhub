export function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-muted">
        <p>
          <span className="font-semibold text-foreground">APEX Hub</span> — cloud security checks &amp; compliance frameworks.
        </p>
        <p className="mt-1">
          Data sourced from the open-source{" "}
          <a href="https://github.com/prowler-cloud/prowler" className="text-accent hover:underline" target="_blank" rel="noreferrer">
            Prowler
          </a>{" "}
          project, licensed under Apache-2.0. This is an independent deployment and is not affiliated with or endorsed by Prowler / ProwlerPro.
        </p>
      </div>
    </footer>
  );
}
