// Minimal admin auth for the hub-parity admin endpoints.
// NOTE: this deployment serves a static data snapshot, so admin "writes"
// (config/override/regenerate) are validated and echoed but not persisted.

const COOKIE = "apexhub_admin";

function token(): string {
  const pw = process.env.ADMIN_PASSWORD || "prowler";
  // Non-secret obfuscation; gate is the password check on /admin/auth.
  return Buffer.from(`apexhub:${pw}`).toString("base64url");
}

export function adminUser(): string {
  return process.env.ADMIN_USERNAME || "admin";
}

export function checkCredentials(username: string, password: string): boolean {
  return username === adminUser() && password === (process.env.ADMIN_PASSWORD || "prowler");
}

export function sessionCookie(): string {
  // httpOnly session cookie, 12h
  return `${COOKIE}=${token()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`;
}

export function isAdmin(request: Request): boolean {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return !!m && m[1] === token();
}
