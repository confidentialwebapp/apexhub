/** Auth0 — tenant, application and connection security posture. */

const tenant_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.auth0.lib.service.service import Auth0Service


class Tenant(Auth0Service):
    """Retrieve Auth0 tenant settings, attack protection and log streams."""

    def __init__(self, provider):
        super().__init__("Tenant", provider)
        self.tenant: Optional[Auth0Tenant] = None
        self._get_tenant()

    def _get_tenant(self):
        try:
            settings = self._get("/api/v2/tenants/settings") or {}
            brute_force = self._get("/api/v2/attack-protection/brute-force-protection") or {}
            suspicious = (
                self._get("/api/v2/attack-protection/suspicious-ip-throttling") or {}
            )
            breached = (
                self._get("/api/v2/attack-protection/breached-password-detection") or {}
            )
            streams = self._get("/api/v2/log-streams") or []
            guardian = self._get("/api/v2/guardian/factors") or []

            self.tenant = Auth0Tenant(
                name=settings.get("friendly_name", "") or self._base_url,
                domain=self._base_url,
                idle_session_lifetime_hours=settings.get("idle_session_lifetime"),
                session_lifetime_hours=settings.get("session_lifetime"),
                brute_force_protection=bool(brute_force.get("enabled", False)),
                suspicious_ip_throttling=bool(suspicious.get("enabled", False)),
                breached_password_detection=bool(breached.get("enabled", False)),
                log_streams=[
                    Auth0LogStream(
                        id=raw.get("id", ""),
                        name=raw.get("name", ""),
                        type=raw.get("type", ""),
                        status=raw.get("status", "paused"),
                    )
                    for raw in streams
                    if isinstance(raw, dict)
                ],
                enabled_mfa_factors=[
                    raw.get("name", "")
                    for raw in guardian
                    if isinstance(raw, dict) and raw.get("enabled")
                ],
            )
            logger.info(f"Tenant - Read configuration for {self.tenant.name}")
        except Exception as error:
            logger.error(
                f"Tenant - Error reading tenant configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class Auth0LogStream(BaseModel):
    """An Auth0 log stream delivering tenant events to an external sink."""

    id: str
    name: str = ""
    type: str = ""
    status: str = "paused"


class Auth0Tenant(BaseModel):
    """Auth0 tenant representation."""

    name: str
    domain: str = ""
    idle_session_lifetime_hours: Optional[int] = None
    session_lifetime_hours: Optional[int] = None
    brute_force_protection: bool = False
    suspicious_ip_throttling: bool = False
    breached_password_detection: bool = False
    log_streams: list[Auth0LogStream] = Field(default_factory=list)
    enabled_mfa_factors: list[str] = Field(default_factory=list)
`;

const application_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.auth0.lib.service.service import Auth0Service


class Application(Auth0Service):
    """Retrieve Auth0 applications with their callback URLs and grant configuration."""

    def __init__(self, provider):
        super().__init__("Application", provider)
        self.applications: dict[str, Auth0Application] = {}
        self._list_applications()

    def _list_applications(self):
        try:
            for raw in self._paginate("/api/v2/clients", "clients", params={
                "fields": "client_id,name,app_type,callbacks,web_origins,"
                          "grant_types,token_endpoint_auth_method,oidc_conformant,"
                          "refresh_token,jwt_configuration,cross_origin_authentication",
                "include_fields": "true",
            }):
                refresh = raw.get("refresh_token") or {}
                jwt_config = raw.get("jwt_configuration") or {}
                app = Auth0Application(
                    client_id=raw.get("client_id", ""),
                    name=raw.get("name", ""),
                    app_type=raw.get("app_type", "non_interactive"),
                    callbacks=raw.get("callbacks") or [],
                    web_origins=raw.get("web_origins") or [],
                    grant_types=raw.get("grant_types") or [],
                    token_endpoint_auth_method=raw.get(
                        "token_endpoint_auth_method", "none"
                    ),
                    oidc_conformant=bool(raw.get("oidc_conformant", False)),
                    cross_origin_authentication=bool(
                        raw.get("cross_origin_authentication", False)
                    ),
                    refresh_token_rotation=(
                        refresh.get("rotation_type", "non-rotating") == "rotating"
                    ),
                    refresh_token_expiration=refresh.get(
                        "expiration_type", "non-expiring"
                    ),
                    signing_algorithm=jwt_config.get("alg", "HS256"),
                )
                self.applications[app.client_id] = app
            logger.info(
                f"Application - Found {len(self.applications)} application(s)"
            )
        except Exception as error:
            logger.error(
                f"Application - Error listing applications: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class Auth0Application(BaseModel):
    """Auth0 application (client) representation."""

    client_id: str
    name: str = ""
    app_type: str = "non_interactive"
    callbacks: list[str] = Field(default_factory=list)
    web_origins: list[str] = Field(default_factory=list)
    grant_types: list[str] = Field(default_factory=list)
    token_endpoint_auth_method: str = "none"
    oidc_conformant: bool = False
    cross_origin_authentication: bool = False
    refresh_token_rotation: bool = False
    refresh_token_expiration: str = "non-expiring"
    signing_algorithm: str = "HS256"
`;

const connection_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.auth0.lib.service.service import Auth0Service


class Connection(Auth0Service):
    """Retrieve Auth0 connections with their password and signup policies."""

    def __init__(self, provider):
        super().__init__("Connection", provider)
        self.connections: dict[str, Auth0Connection] = {}
        self._list_connections()

    def _list_connections(self):
        try:
            for raw in self._paginate("/api/v2/connections", "connections"):
                options = raw.get("options") or {}
                validation = options.get("passwordPolicy")
                complexity = (options.get("password_complexity_options") or {})
                connection = Auth0Connection(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    strategy=raw.get("strategy", ""),
                    enabled_clients=raw.get("enabled_clients") or [],
                    password_policy=validation or "none",
                    min_password_length=complexity.get("min_length"),
                    brute_force_protection=bool(
                        options.get("brute_force_protection", False)
                    ),
                    disable_signup=bool(options.get("disable_signup", False)),
                    requires_username=bool(options.get("requires_username", False)),
                    import_mode=bool(options.get("import_mode", False)),
                )
                self.connections[connection.id] = connection
            logger.info(f"Connection - Found {len(self.connections)} connection(s)")
        except Exception as error:
            logger.error(
                f"Connection - Error listing connections: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class Auth0Connection(BaseModel):
    """Auth0 connection representation."""

    id: str
    name: str = ""
    strategy: str = ""
    enabled_clients: list[str] = Field(default_factory=list)
    password_policy: str = "none"
    min_password_length: Optional[int] = None
    brute_force_protection: bool = False
    disable_signup: bool = False
    requires_username: bool = False
    import_mode: bool = False
`;

export default {
  id: "auth0",
  name: "Auth0",
  pyClass: "Auth0",
  baseUrl: "https://<tenant>.auth0.com",
  selfHosted: true,
  samplePath: "/api/v2/clients",
  errorCodeBase: 14900,
  pageParam: "page",
  pageSizeParam: "per_page",
  pageSize: 100,
  credentialsRemediation:
    "Set AUTH0_DOMAIN and AUTH0_TOKEN to a Management API token for a machine-to-machine application granted read:clients, read:connections, read:tenant_settings, read:log_streams and read:attack_protection.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Auth0 assesses an Auth0 tenant across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers callback URL strictness, refresh token rotation, token endpoint authentication, connection password policy, attack protection, log streaming and JWT signing algorithm — the controls that decide whether the identity provider itself can be turned against the applications it protects.",

  services: {
    tenant: { pyClass: "Tenant", source: tenant_service },
    application: { pyClass: "Application", source: application_service },
    connection: { pyClass: "Connection", source: connection_service },
  },

  checks: [
    {
      id: "auth0_application_no_wildcard_callback_urls",
      service: "application",
      pillar: "attacksurface",
      severity: "critical",
      title: "Auth0 applications use exact HTTPS callback URLs",
      resourceType: "Auth0::Application",
      resourceGroup: "network",
      categories: ["authentication", "trust-boundaries"],
      description:
        "This check reports applications whose **allowed callback URLs** or **web origins** contain wildcards, use plain HTTP for a non-localhost host, or are left empty for an interactive application.",
      risk:
        "The callback URL list is the only thing binding an authorization code to the application that requested it. A wildcard entry lets an attacker redirect the flow to a host they control — an unclaimed subdomain, or any path on a domain with an open redirect — and **receive the victim's authorization code**, exchanging it for tokens without ever touching the user's credentials. This is one of the most reliably exploited OAuth misconfigurations.",
      urls: [
        "https://auth0.com/docs/get-started/applications/confidential-and-public-applications",
        "https://auth0.com/docs/secure/attack-protection/state-parameters",
      ],
      relatedTo: ["auth0_application_refresh_token_rotation_enabled"],
      remediation: {
        cli: "curl -X PATCH \"https://$AUTH0_DOMAIN/api/v2/clients/<client-id>\" \\\n  -H \"Authorization: Bearer $AUTH0_TOKEN\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"callbacks\":[\"https://app.example.com/callback\"],\"web_origins\":[\"https://app.example.com\"]}'",
        other:
          "1. Open the application in the Auth0 Dashboard\n2. Go to **Settings > Application URIs**\n3. Replace every wildcard entry with the exact HTTPS callback URLs the application actually uses\n4. Do the same for **Allowed Web Origins** and **Allowed Logout URLs**\n5. Keep `http://localhost` entries only in development tenants\n6. Enable PKCE for public clients so an intercepted code cannot be exchanged\n7. Verify each application still completes login after tightening",
        terraform:
          'resource "auth0_client" "web_app" {\n  name         = "web-app"\n  app_type     = "regular_web"\n  callbacks    = ["https://app.example.com/callback"]\n  web_origins  = ["https://app.example.com"]\n  oidc_conformant = true\n}',
        text:
          "Replace wildcard callback and origin entries with exact HTTPS URLs, restrict localhost entries to development tenants, and enable PKCE for public clients.",
      },
      body: `INTERACTIVE_TYPES = {"spa", "regular_web", "native"}

findings = []
for app in application_client.applications.values():
    report = CheckReportAuth0(
        metadata=self.metadata(),
        resource=app,
        resource_name=app.name or app.client_id,
        resource_id=app.client_id,
    )

    # Machine-to-machine clients complete no redirect flow.
    if app.app_type not in INTERACTIVE_TYPES:
        continue

    issues = []
    urls = list(app.callbacks) + list(app.web_origins)

    wildcards = [url for url in urls if "*" in url]
    if wildcards:
        issues.append(f"wildcard URL(s): {', '.join(wildcards)}")

    insecure = [
        url
        for url in urls
        if url.startswith("http://")
        and "localhost" not in url
        and "127.0.0.1" not in url
    ]
    if insecure:
        issues.append(f"plaintext HTTP URL(s): {', '.join(insecure)}")

    if not app.callbacks:
        issues.append("no allowed callback URLs configured")

    if issues:
        report.status = "FAIL"
        report.status_extended = (
            f"Application {app.name or app.client_id} has {'; '.join(issues)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Application {app.name or app.client_id} uses "
            f"{len(app.callbacks)} exact HTTPS callback URL(s)."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "auth0_application_refresh_token_rotation_enabled",
      service: "application",
      pillar: "iam",
      severity: "high",
      title: "Auth0 public applications rotate and expire refresh tokens",
      resourceType: "Auth0::Application",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that single-page and native applications issuing refresh tokens have **rotation** enabled and an **expiring** refresh token policy, so a stolen token is single-use and time-bounded.",
      risk:
        "A non-rotating refresh token held by a browser or mobile application is a **long-lived credential stored on the client**, reachable through XSS, a malicious dependency or device compromise, and it grants indefinite re-authentication as the user. Rotation converts theft into a detectable event: reuse of a consumed token signals compromise and revokes the whole family.",
      urls: [
        "https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation",
        "https://auth0.com/docs/secure/tokens/refresh-tokens/configure-refresh-token-rotation",
      ],
      relatedTo: ["auth0_application_no_wildcard_callback_urls"],
      remediation: {
        cli: "curl -X PATCH \"https://$AUTH0_DOMAIN/api/v2/clients/<client-id>\" \\\n  -H \"Authorization: Bearer $AUTH0_TOKEN\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"refresh_token\":{\"rotation_type\":\"rotating\",\"expiration_type\":\"expiring\",\"token_lifetime\":2592000,\"leeway\":30}}'",
        other:
          "1. Open the application in the Auth0 Dashboard\n2. Go to **Settings > Refresh Token Rotation**\n3. Enable **Rotation** and set a short reuse interval (leeway)\n4. Enable **Absolute Expiration** and set a lifetime appropriate to the application\n5. Update the client SDK to store the newly issued refresh token on each exchange\n6. Monitor for automatic reuse detection events in the tenant logs — they indicate a stolen token",
        terraform:
          'resource "auth0_client" "spa" {\n  name     = "spa"\n  app_type = "spa"\n\n  refresh_token {\n    rotation_type   = "rotating"\n    expiration_type = "expiring"\n    token_lifetime  = 2592000\n    leeway          = 30\n  }\n}',
        text:
          "Enable refresh token rotation with absolute expiration for public clients, and alert on reuse-detection events, which indicate a token was stolen.",
      },
      body: `PUBLIC_TYPES = {"spa", "native"}

findings = []
for app in application_client.applications.values():
    if app.app_type not in PUBLIC_TYPES:
        continue
    if "refresh_token" not in app.grant_types:
        continue

    report = CheckReportAuth0(
        metadata=self.metadata(),
        resource=app,
        resource_name=app.name or app.client_id,
        resource_id=app.client_id,
    )

    issues = []
    if not app.refresh_token_rotation:
        issues.append("refresh token rotation is disabled")
    if app.refresh_token_expiration != "expiring":
        issues.append("refresh tokens do not expire")

    if issues:
        report.status = "FAIL"
        report.status_extended = (
            f"Application {app.name or app.client_id} ({app.app_type}): "
            f"{'; '.join(issues)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Application {app.name or app.client_id} rotates and expires refresh "
            f"tokens."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "auth0_application_signing_algorithm_asymmetric",
      service: "application",
      pillar: "encryption",
      severity: "medium",
      title: "Auth0 applications sign tokens with an asymmetric algorithm",
      resourceType: "Auth0::Application",
      resourceGroup: "iam",
      categories: ["encryption", "authentication"],
      description:
        "This check verifies that each application signs ID tokens with **RS256** or another asymmetric algorithm rather than the symmetric HS256, and that OIDC conformance is enabled.",
      risk:
        "HS256 signs and verifies with the **same shared secret**, so every party that validates a token also holds the key needed to forge one. A client secret leaked from a mobile binary, a repository or a misconfigured backend therefore allows an attacker to mint tokens for arbitrary users. RS256 removes this entirely: verifiers hold only the public key.",
      urls: [
        "https://auth0.com/docs/get-started/applications/change-application-signing-algorithm",
        "https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-token-structure",
      ],
      remediation: {
        cli: "curl -X PATCH \"https://$AUTH0_DOMAIN/api/v2/clients/<client-id>\" \\\n  -H \"Authorization: Bearer $AUTH0_TOKEN\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"jwt_configuration\":{\"alg\":\"RS256\"},\"oidc_conformant\":true}'",
        other:
          "1. Open the application in the Auth0 Dashboard\n2. Go to **Settings > Advanced Settings > OAuth**\n3. Set **JsonWebToken Signature Algorithm** to `RS256`\n4. Enable **OIDC Conformant**\n5. Update the application to fetch the tenant's JWKS and verify with the public key rather than the client secret\n6. Rotate the client secret afterwards, since it may previously have been distributed to token verifiers",
        terraform:
          'resource "auth0_client" "api_client" {\n  name            = "api-client"\n  oidc_conformant = true\n\n  jwt_configuration {\n    alg = "RS256"\n  }\n}',
        text:
          "Sign tokens with RS256 and verify against the tenant JWKS, enable OIDC conformance, and rotate any client secret that was previously shared with verifiers.",
      },
      body: `ASYMMETRIC = {"RS256", "RS384", "RS512", "PS256", "ES256", "ES384", "ES512"}

findings = []
for app in application_client.applications.values():
    report = CheckReportAuth0(
        metadata=self.metadata(),
        resource=app,
        resource_name=app.name or app.client_id,
        resource_id=app.client_id,
    )

    algorithm = (app.signing_algorithm or "HS256").upper()

    if algorithm in ASYMMETRIC:
        report.status = "PASS"
        report.status_extended = (
            f"Application {app.name or app.client_id} signs tokens with "
            f"{algorithm}."
        )
        if not app.oidc_conformant:
            report.status_extended += " OIDC conformant mode is not enabled."
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Application {app.name or app.client_id} signs tokens with the "
            f"symmetric algorithm {algorithm}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "auth0_connection_password_policy_strong",
      service: "connection",
      pillar: "iam",
      severity: "high",
      title: "Auth0 database connections enforce a strong password policy",
      resourceType: "Auth0::Connection",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that each database connection uses at least the **good** password policy, sets a minimum length of 12 or more, and enables per-connection brute force protection.",
      risk:
        "A database connection is where Auth0 stores the credentials it authenticates against, so a weak policy there directly determines how guessable your users' passwords are. Combined with the login endpoint being **publicly reachable by design**, a low minimum length makes credential stuffing and password spraying practical against the identity provider that fronts every application.",
      urls: [
        "https://auth0.com/docs/authenticate/database-connections/password-options",
        "https://auth0.com/docs/authenticate/database-connections/password-strength",
      ],
      relatedTo: ["auth0_tenant_attack_protection_enabled"],
      remediation: {
        cli: "curl -X PATCH \"https://$AUTH0_DOMAIN/api/v2/connections/<connection-id>\" \\\n  -H \"Authorization: Bearer $AUTH0_TOKEN\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"options\":{\"passwordPolicy\":\"excellent\",\"password_complexity_options\":{\"min_length\":12},\"brute_force_protection\":true}}'",
        other:
          "1. Open the connection in the Auth0 Dashboard under **Authentication > Database**\n2. Go to the **Password Policy** tab\n3. Set the policy to `Good` or `Excellent`\n4. Set the minimum length to 12 or more\n5. Enable **Breached password detection** at the tenant level\n6. Disable public signup on connections that should only receive users provisioned by an administrator\n7. Consider passwordless or federated authentication to remove the password entirely",
        terraform:
          'resource "auth0_connection" "users" {\n  name     = "Username-Password-Authentication"\n  strategy = "auth0"\n\n  options {\n    password_policy        = "excellent"\n    brute_force_protection = true\n\n    password_complexity_options {\n      min_length = 12\n    }\n  }\n}',
        text:
          "Set database connections to the good or excellent password policy with a 12-character minimum, enable brute force and breached password detection, and disable public signup where users are administratively provisioned.",
      },
      body: `STRONG_POLICIES = {"good", "excellent"}
DATABASE_STRATEGIES = {"auth0"}

min_length_required = self.audit_config.get("min_password_length", 12)

findings = []
for connection in connection_client.connections.values():
    if connection.strategy not in DATABASE_STRATEGIES:
        continue

    report = CheckReportAuth0(
        metadata=self.metadata(),
        resource=connection,
        resource_name=connection.name,
        resource_id=connection.id,
    )

    issues = []
    policy = (connection.password_policy or "none").lower()
    if policy not in STRONG_POLICIES:
        issues.append(f"password policy is '{policy}'")
    if (connection.min_password_length or 0) < min_length_required:
        issues.append(
            f"minimum length is {connection.min_password_length or 'unset'} "
            f"(expected {min_length_required})"
        )
    if not connection.brute_force_protection:
        issues.append("brute force protection is disabled")

    if issues:
        report.status = "FAIL"
        report.status_extended = (
            f"Connection {connection.name}: {'; '.join(issues)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Connection {connection.name} enforces the '{policy}' password policy "
            f"with a minimum length of {connection.min_password_length} and brute "
            f"force protection enabled."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "auth0_tenant_attack_protection_enabled",
      service: "tenant",
      pillar: "attacksurface",
      severity: "high",
      title: "Auth0 tenants enable all attack protection features",
      resourceType: "Auth0::Tenant",
      resourceGroup: "network",
      categories: ["authentication", "resilience"],
      description:
        "This check verifies that the tenant enables **brute force protection**, **suspicious IP throttling** and **breached password detection**, the three built-in defences against automated credential attacks.",
      risk:
        "Auth0 login endpoints are internet-facing and enumerable, so without throttling an attacker can run **credential stuffing at full speed** against your entire user base using passwords from unrelated breaches. Breached password detection is what catches the accounts that will fall first, and its absence means those compromises are only discovered after the account is used.",
      urls: [
        "https://auth0.com/docs/secure/attack-protection",
        "https://auth0.com/docs/secure/attack-protection/breached-password-detection",
      ],
      relatedTo: ["auth0_connection_password_policy_strong"],
      remediation: {
        cli: "curl -X PATCH \"https://$AUTH0_DOMAIN/api/v2/attack-protection/breached-password-detection\" \\\n  -H \"Authorization: Bearer $AUTH0_TOKEN\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"enabled\":true,\"shields\":[\"block\",\"admin_notification\"]}'",
        other:
          "1. In the Auth0 Dashboard, go to **Security > Attack Protection**\n2. Enable **Bot Detection**, **Suspicious IP Throttling**, **Brute-force Protection** and **Breached Password Detection**\n3. For each, configure the shields — blocking and administrator notification rather than notification alone\n4. Add your monitoring and load-testing egress ranges to the allowlist so legitimate automation is not throttled\n5. Route the resulting security events into your SIEM through a log stream",
        terraform:
          'resource "auth0_attack_protection" "this" {\n  breached_password_detection {\n    enabled = true\n    shields = ["block", "admin_notification"]\n  }\n\n  brute_force_protection {\n    enabled      = true\n    max_attempts = 10\n    shields      = ["block", "user_notification"]\n  }\n\n  suspicious_ip_throttling {\n    enabled = true\n    shields = ["block", "admin_notification"]\n  }\n}',
        text:
          "Enable brute force protection, suspicious IP throttling and breached password detection with blocking shields, allowlist your own automation, and stream the resulting events to your SIEM.",
      },
      body: `findings = []
tenant = tenant_client.tenant
if tenant is None:
    return findings

report = CheckReportAuth0(
    metadata=self.metadata(),
    resource=tenant,
    resource_name=tenant.name,
    resource_id=tenant.domain,
)

disabled = []
if not tenant.brute_force_protection:
    disabled.append("brute force protection")
if not tenant.suspicious_ip_throttling:
    disabled.append("suspicious IP throttling")
if not tenant.breached_password_detection:
    disabled.append("breached password detection")

if disabled:
    report.status = "FAIL"
    report.status_extended = (
        f"Tenant {tenant.name} has {', '.join(disabled)} disabled."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Tenant {tenant.name} enables brute force protection, suspicious IP "
        f"throttling and breached password detection."
    )

findings.append(report)
return findings`,
    },

    {
      id: "auth0_tenant_mfa_factor_enabled",
      service: "tenant",
      pillar: "iam",
      severity: "critical",
      title: "Auth0 tenants have at least one multi-factor authentication factor enabled",
      resourceType: "Auth0::Tenant::GuardianFactor",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the tenant has at least one **Guardian MFA factor** enabled, and reports tenants where SMS is the only available factor.",
      risk:
        "Auth0 fronts authentication for every application connected to it, so a tenant with no MFA factor means **none of those applications can require a second factor** regardless of their own configuration. Where SMS is the sole factor, SIM swap and SS7 interception defeat it, which is why phishing-resistant factors matter most at the identity provider layer.",
      urls: [
        "https://auth0.com/docs/secure/multi-factor-authentication",
        "https://auth0.com/docs/secure/multi-factor-authentication/configure-webauthn-security-keys-for-mfa",
      ],
      relatedTo: ["auth0_tenant_attack_protection_enabled"],
      remediation: {
        cli: "curl -X PUT \"https://$AUTH0_DOMAIN/api/v2/guardian/factors/webauthn-roaming\" \\\n  -H \"Authorization: Bearer $AUTH0_TOKEN\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"enabled\":true}'",
        other:
          "1. In the Auth0 Dashboard, go to **Security > Multi-factor Auth**\n2. Enable **WebAuthn with Security Keys** or **WebAuthn with Device Biometrics** as the primary factor\n3. Enable a push or OTP factor as a fallback\n4. Avoid making SMS the only available factor\n5. Define the MFA policy — always, or adaptive based on risk — under **Define policies**\n6. Verify enrolment coverage across your user base before requiring it",
        terraform:
          'resource "auth0_guardian" "this" {\n  policy = "all-applications"\n\n  webauthn_roaming {\n    enabled = true\n  }\n\n  otp = true\n}',
        text:
          "Enable a phishing-resistant WebAuthn factor as primary with OTP or push as fallback, avoid SMS-only configurations, and set an explicit MFA policy.",
      },
      body: `PHISHING_RESISTANT = {"webauthn-roaming", "webauthn-platform", "duo"}
WEAK_ONLY = {"sms"}

findings = []
tenant = tenant_client.tenant
if tenant is None:
    return findings

report = CheckReportAuth0(
    metadata=self.metadata(),
    resource=tenant,
    resource_name=tenant.name,
    resource_id=tenant.domain,
)

factors = {factor.strip().lower() for factor in tenant.enabled_mfa_factors if factor}

if not factors:
    report.status = "FAIL"
    report.status_extended = (
        f"Tenant {tenant.name} has no multi-factor authentication factor enabled."
    )
elif factors <= WEAK_ONLY:
    report.status = "FAIL"
    report.status_extended = (
        f"Tenant {tenant.name} has SMS as its only multi-factor authentication "
        f"factor."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Tenant {tenant.name} has {len(factors)} MFA factor(s) enabled: "
        f"{', '.join(sorted(factors))}."
    )
    if not factors & PHISHING_RESISTANT:
        report.status_extended += " No phishing-resistant factor is enabled."

findings.append(report)
return findings`,
    },

    {
      id: "auth0_tenant_log_streaming_configured",
      service: "tenant",
      pillar: "logging",
      severity: "high",
      title: "Auth0 tenants stream logs to an external system",
      resourceType: "Auth0::Tenant::LogStream",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "Auth0 retains tenant logs for a limited period that varies by plan. This check verifies that at least one **active log stream** delivers events to an external system such as a SIEM.",
      risk:
        "Auth0 log retention is measured in **days on most plans**, so by the time an account compromise is detected the authentication events that would explain it have often already aged out. Streamed logs are also the only source that shows failed login patterns, MFA enrolment changes and token exchanges — the primary indicators of an identity attack in progress.",
      urls: [
        "https://auth0.com/docs/customize/log-streams",
        "https://auth0.com/docs/deploy-monitor/logs/log-event-type-codes",
      ],
      remediation: {
        cli: "curl -X POST \"https://$AUTH0_DOMAIN/api/v2/log-streams\" \\\n  -H \"Authorization: Bearer $AUTH0_TOKEN\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"name\":\"siem\",\"type\":\"http\",\"sink\":{\"httpEndpoint\":\"https://siem.example.com/auth0\",\"httpContentType\":\"application/json\",\"httpAuthorization\":\"Bearer <token>\"}}'",
        other:
          "1. In the Auth0 Dashboard, go to **Monitoring > Streams**\n2. Create a stream to your SIEM (HTTP endpoint, Datadog, Splunk or an event bus)\n3. Verify the stream status is **Active** and that events are arriving\n4. Alert on `f` (failed login), `gd_*` (MFA), `sapi`/`fapi` (Management API) and `limit_*` (rate limiting) event codes\n5. Retain streamed events for at least your incident investigation window\n6. Monitor stream health — a paused or failing stream is a silent gap",
        terraform:
          'resource "auth0_log_stream" "siem" {\n  name   = "siem"\n  type   = "http"\n  status = "active"\n\n  sink {\n    http_endpoint     = "https://siem.example.com/auth0"\n    http_content_type = "application/json"\n  }\n}',
        text:
          "Stream tenant logs to a SIEM, confirm the stream stays active, alert on failed logins, MFA changes and Management API calls, and monitor stream health so a paused stream is noticed.",
      },
      body: `findings = []
tenant = tenant_client.tenant
if tenant is None:
    return findings

report = CheckReportAuth0(
    metadata=self.metadata(),
    resource=tenant,
    resource_name=tenant.name,
    resource_id=tenant.domain,
)

active = [
    stream for stream in tenant.log_streams if stream.status.lower() == "active"
]

if active:
    report.status = "PASS"
    report.status_extended = (
        f"Tenant {tenant.name} has {len(active)} active log stream(s): "
        f"{', '.join(stream.name or stream.type for stream in active)}."
    )
elif tenant.log_streams:
    report.status = "FAIL"
    report.status_extended = (
        f"Tenant {tenant.name} has {len(tenant.log_streams)} log stream(s) "
        f"configured but none are active."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Tenant {tenant.name} has no log stream configured."
    )

findings.append(report)
return findings`,
    },

    {
      id: "auth0_application_confidential_client_authentication",
      service: "application",
      pillar: "iam",
      severity: "medium",
      title: "Auth0 confidential applications authenticate at the token endpoint",
      resourceType: "Auth0::Application",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that regular web and machine-to-machine applications set a **token endpoint authentication method** other than `none`, and reports single-page applications that hold a client secret they cannot protect.",
      risk:
        "A confidential client with `token_endpoint_auth_method` set to `none` will exchange an authorization code **without proving its identity**, so any party holding a stolen code can complete the exchange. Conversely, a browser-based application configured as confidential ships a client secret that is trivially extractable from its bundle, giving that secret away to every visitor.",
      urls: [
        "https://auth0.com/docs/get-started/applications/confidential-and-public-applications",
        "https://auth0.com/docs/get-started/applications/set-up-client-authentication",
      ],
      relatedTo: ["auth0_application_no_wildcard_callback_urls"],
      remediation: {
        cli: "curl -X PATCH \"https://$AUTH0_DOMAIN/api/v2/clients/<client-id>\" \\\n  -H \"Authorization: Bearer $AUTH0_TOKEN\" \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"token_endpoint_auth_method\":\"client_secret_post\"}'",
        other:
          "1. Open the application in the Auth0 Dashboard\n2. Confirm the **Application Type** matches how the application actually runs\n3. For regular web and M2M applications, set **Token Endpoint Authentication Method** to `Post` or `Basic`, or use Private Key JWT for stronger assurance\n4. For single-page applications, set the type to `SPA` so no secret is issued, and use Authorization Code with PKCE\n5. Rotate any client secret that has been embedded in browser or mobile code — treat it as public",
        terraform:
          'resource "auth0_client" "backend" {\n  name                       = "backend"\n  app_type                   = "regular_web"\n  token_endpoint_auth_method = "client_secret_post"\n}',
        text:
          "Match the application type to how the app runs, require token endpoint authentication for confidential clients, use PKCE without a secret for SPAs, and rotate secrets that were shipped to browsers.",
      },
      body: `CONFIDENTIAL_TYPES = {"regular_web", "non_interactive"}

findings = []
for app in application_client.applications.values():
    report = CheckReportAuth0(
        metadata=self.metadata(),
        resource=app,
        resource_name=app.name or app.client_id,
        resource_id=app.client_id,
    )

    method = (app.token_endpoint_auth_method or "none").lower()

    if app.app_type in CONFIDENTIAL_TYPES:
        if method == "none":
            report.status = "FAIL"
            report.status_extended = (
                f"Application {app.name or app.client_id} is a confidential "
                f"{app.app_type} client but does not authenticate at the token "
                f"endpoint."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Application {app.name or app.client_id} authenticates at the "
                f"token endpoint using {method}."
            )
    elif app.app_type == "spa":
        if method != "none":
            report.status = "FAIL"
            report.status_extended = (
                f"Application {app.name or app.client_id} is a single-page "
                f"application but uses '{method}', which requires a client secret "
                f"it cannot protect."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Application {app.name or app.client_id} is a public client and "
                f"holds no token endpoint secret."
            )
    else:
        continue

    findings.append(report)

return findings`,
    },
  ],
};
