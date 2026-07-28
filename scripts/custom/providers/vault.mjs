/** HashiCorp Vault — seal, audit, authentication and secret engine posture. */

const system_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.vault.lib.service.service import VaultService


class System(VaultService):
    """Retrieve Vault seal status, health and replication configuration."""

    def __init__(self, provider):
        super().__init__("System", provider)
        self.system: Optional[VaultSystem] = None
        self._get_system()

    def _get_system(self):
        try:
            seal = self._get("/v1/sys/seal-status") or {}
            health = self._get("/v1/sys/health") or {}
            # The config endpoint requires a root-equivalent token; absence is
            # handled by leaving the listener fields unknown.
            config = (self._get("/v1/sys/config/state/sanitized") or {}).get("data", {})
            listeners = config.get("listeners") or []

            self.system = VaultSystem(
                address=self._base_url,
                version=seal.get("version", health.get("version", "unknown")),
                sealed=bool(seal.get("sealed", True)),
                seal_type=seal.get("type", "shamir"),
                recovery_seal=bool(seal.get("recovery_seal", False)),
                key_shares=seal.get("n"),
                key_threshold=seal.get("t"),
                cluster_name=seal.get("cluster_name", ""),
                ha_enabled=bool(health.get("ha_enabled", False)),
                storage_type=seal.get("storage_type", config.get("storage_type", "")),
                listeners=[
                    VaultListener(
                        type=str(listener.get("type", "tcp")),
                        address=str(
                            (listener.get("config") or {}).get("address", "")
                        ),
                        tls_disable=_as_bool(
                            (listener.get("config") or {}).get("tls_disable", False)
                        ),
                    )
                    for listener in listeners
                    if isinstance(listener, dict)
                ],
            )
            logger.info(f"System - Read seal status for {self._base_url}")
        except Exception as error:
            logger.error(
                f"System - Error reading system configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("true", "1", "yes", "on")


class VaultListener(BaseModel):
    """A Vault listener configuration."""

    type: str = "tcp"
    address: str = ""
    tls_disable: bool = False


class VaultSystem(BaseModel):
    """Vault cluster system representation."""

    address: str
    version: str = "unknown"
    sealed: bool = True
    seal_type: str = "shamir"
    recovery_seal: bool = False
    key_shares: Optional[int] = None
    key_threshold: Optional[int] = None
    cluster_name: str = ""
    ha_enabled: bool = False
    storage_type: str = ""
    listeners: list[VaultListener] = Field(default_factory=list)
`;

const audit_service = `from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.vault.lib.service.service import VaultService


class Audit(VaultService):
    """Retrieve enabled Vault audit devices."""

    def __init__(self, provider):
        super().__init__("Audit", provider)
        self.devices: dict[str, VaultAuditDevice] = {}
        self._list_devices()

    def _list_devices(self):
        try:
            data = self._get("/v1/sys/audit") or {}
            entries = data.get("data", data)
            for path, raw in entries.items():
                if not isinstance(raw, dict) or "type" not in raw:
                    continue
                options = raw.get("options") or {}
                device = VaultAuditDevice(
                    path=path.rstrip("/"),
                    type=raw.get("type", ""),
                    description=raw.get("description", ""),
                    file_path=options.get("file_path", ""),
                    log_raw=str(options.get("log_raw", "false")).lower() == "true",
                    hmac_accessor=str(
                        options.get("hmac_accessor", "true")
                    ).lower()
                    == "true",
                )
                self.devices[device.path] = device
            logger.info(f"Audit - Found {len(self.devices)} audit device(s)")
        except Exception as error:
            logger.error(
                f"Audit - Error listing audit devices: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class VaultAuditDevice(BaseModel):
    """Vault audit device representation."""

    path: str
    type: str = ""
    description: str = ""
    file_path: str = ""
    log_raw: bool = False
    hmac_accessor: bool = True
`;

const auth_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.vault.lib.service.service import VaultService


class Auth(VaultService):
    """Retrieve Vault auth methods, their tuning and outstanding root tokens."""

    def __init__(self, provider):
        super().__init__("Auth", provider)
        self.methods: dict[str, VaultAuthMethod] = {}
        self.root_token_accessors: list[str] = []
        self._list_methods()
        self._find_root_tokens()

    def _list_methods(self):
        try:
            data = self._get("/v1/sys/auth") or {}
            entries = data.get("data", data)
            for path, raw in entries.items():
                if not isinstance(raw, dict) or "type" not in raw:
                    continue
                config = raw.get("config") or {}
                method = VaultAuthMethod(
                    path=path.rstrip("/"),
                    type=raw.get("type", ""),
                    description=raw.get("description", ""),
                    default_lease_ttl=config.get("default_lease_ttl"),
                    max_lease_ttl=config.get("max_lease_ttl"),
                    local=raw.get("local", False),
                )
                self.methods[method.path] = method
            logger.info(f"Auth - Found {len(self.methods)} auth method(s)")
        except Exception as error:
            logger.error(
                f"Auth - Error listing auth methods: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _find_root_tokens(self):
        """List token accessors and record those carrying the root policy."""
        try:
            listing = self._list("/v1/auth/token/accessors") or {}
            accessors = (listing.get("data") or {}).get("keys", [])

            for accessor in accessors:
                info = self._post(
                    "/v1/auth/token/lookup-accessor", {"accessor": accessor}
                )
                data = (info or {}).get("data") or {}
                if "root" in (data.get("policies") or []):
                    self.root_token_accessors.append(accessor)

            if self.root_token_accessors:
                logger.info(
                    f"Auth - Found {len(self.root_token_accessors)} root token(s)"
                )
        except Exception as error:
            logger.error(
                f"Auth - Error enumerating token accessors: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class VaultAuthMethod(BaseModel):
    """Vault auth method representation."""

    path: str
    type: str = ""
    description: str = ""
    default_lease_ttl: Optional[int] = None
    max_lease_ttl: Optional[int] = None
    local: bool = False
`;

const secret_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.vault.lib.service.service import VaultService


class Secret(VaultService):
    """Retrieve Vault secret engine mounts and their lease tuning."""

    def __init__(self, provider):
        super().__init__("Secret", provider)
        self.mounts: dict[str, VaultSecretMount] = {}
        self._list_mounts()

    def _list_mounts(self):
        try:
            data = self._get("/v1/sys/mounts") or {}
            entries = data.get("data", data)
            for path, raw in entries.items():
                if not isinstance(raw, dict) or "type" not in raw:
                    continue
                config = raw.get("config") or {}
                options = raw.get("options") or {}
                mount = VaultSecretMount(
                    path=path.rstrip("/"),
                    type=raw.get("type", ""),
                    description=raw.get("description", ""),
                    default_lease_ttl=config.get("default_lease_ttl"),
                    max_lease_ttl=config.get("max_lease_ttl"),
                    kv_version=str(options.get("version", "")),
                    seal_wrap=raw.get("seal_wrap", False),
                    local=raw.get("local", False),
                )
                self.mounts[mount.path] = mount
            logger.info(f"Secret - Found {len(self.mounts)} secret engine mount(s)")
        except Exception as error:
            logger.error(
                f"Secret - Error listing secret engines: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class VaultSecretMount(BaseModel):
    """Vault secret engine mount representation."""

    path: str
    type: str = ""
    description: str = ""
    default_lease_ttl: Optional[int] = None
    max_lease_ttl: Optional[int] = None
    kv_version: str = ""
    seal_wrap: bool = False
    local: bool = False
`;

// Vault's API needs LIST and POST verbs that the shared HTTP base does not expose.
const service_base_extra = `
    def _list(self, path: str) -> dict:
        """Issue a Vault LIST request (GET with ?list=true)."""
        return self._get(path, params={"list": "true"})

    def _post(self, path: str, payload: dict) -> dict:
        """Issue a POST request, returning None when the token lacks capability."""
        try:
            response = self._http_session.post(
                f"{self._base_url}{path}", json=payload, timeout=30
            )
            if response.status_code in (403, 404):
                return None
            response.raise_for_status()
            return response.json()
        except Exception as error:
            logger.error(
                f"{self.service} - POST {path} failed: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )
            return None
`;

export default {
  id: "vault",
  name: "HashiCorp Vault",
  pyClass: "Vault",
  baseUrl: "https://vault.example.com:8200",
  selfHosted: true,
  samplePath: "/v1/sys/seal-status",
  errorCodeBase: 15100,
  auth: { header: "X-Vault-Token", scheme: null },
  serviceBaseExtra: service_base_extra,
  credentialsRemediation:
    "Set VAULT_ADDR and VAULT_TOKEN to a token whose policy grants read on sys/seal-status, sys/audit, sys/auth, sys/mounts and list on auth/token/accessors.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for HashiCorp Vault assesses a Vault cluster across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers audit device coverage, outstanding root tokens, lease and token TTL bounds, identity-backed authentication, listener TLS and seal configuration — the controls that determine whether the secrets store itself can be quietly drained.",

  services: {
    system: { pyClass: "System", source: system_service },
    audit: { pyClass: "Audit", source: audit_service },
    auth: { pyClass: "Auth", source: auth_service },
    secret: { pyClass: "Secret", source: secret_service },
  },

  checks: [
    {
      id: "vault_audit_device_enabled",
      service: "audit",
      pillar: "logging",
      severity: "critical",
      title: "Vault clusters have at least one audit device enabled",
      resourceType: "Vault::AuditDevice",
      resourceGroup: "logging",
      categories: ["logging"],
      description:
        "Vault **audit devices** record every request and response, including the requesting token's accessor. This check verifies that at least one audit device is enabled on the cluster.",
      risk:
        "With no audit device, Vault keeps **no record of which secrets were read or by whom**, so a compromised token can drain the entire store leaving nothing to investigate. This is the single most consequential logging gap in a secrets platform: without it, an incident response cannot determine which credentials need rotating, forcing a rotation of everything.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/audit",
        "https://developer.hashicorp.com/vault/tutorials/monitoring/blocked-audit-devices",
      ],
      relatedTo: ["vault_audit_device_redundant"],
      remediation: {
        cli: "vault audit enable file file_path=/var/log/vault/audit.log\nvault audit enable -path=syslog syslog tag=\"vault\" facility=\"AUTH\"\nvault audit list -detailed",
        other:
          "1. Enable a file audit device writing to a path with restrictive permissions\n2. Ship the file to your SIEM with a log agent, or enable a syslog device in addition\n3. Leave `hmac_accessor` at its default and `log_raw` disabled so secret values are not written in cleartext\n4. Configure log rotation, and confirm Vault reopens the file afterwards with `vault audit`\n5. Alert on the absence of audit events — a blocked audit device stops Vault from serving requests, which is by design",
        terraform:
          'resource "vault_audit" "file" {\n  type = "file"\n\n  options = {\n    file_path = "/var/log/vault/audit.log"\n  }\n}',
        text:
          "Enable at least one audit device with log_raw disabled, ship the events to a SIEM outside the Vault administrators' control, and alert when audit events stop arriving.",
      },
      body: `findings = []

if audit_client.devices:
    for device in audit_client.devices.values():
        report = CheckReportVault(
            metadata=self.metadata(),
            resource=device,
            resource_name=device.path,
            resource_id=device.path,
        )

        if device.log_raw:
            report.status = "FAIL"
            report.status_extended = (
                f"Audit device {device.path} ({device.type}) is enabled but logs "
                f"raw request and response data, writing secret values in cleartext."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Audit device {device.path} ({device.type}) is enabled with "
                f"sensitive values hashed."
            )

        findings.append(report)
else:
    report = CheckReportVault(
        metadata=self.metadata(),
        resource={},
        resource_name=self._base_url,
        resource_id=self._base_url,
    )
    report.status = "FAIL"
    report.status_extended = (
        f"Vault cluster {self._base_url} has no audit device enabled."
    )
    findings.append(report)

return findings`,
    },

    {
      id: "vault_audit_device_redundant",
      service: "audit",
      pillar: "logging",
      severity: "medium",
      title: "Vault clusters have more than one audit device enabled",
      resourceType: "Vault::AuditDevice",
      resourceGroup: "logging",
      categories: ["logging", "resilience"],
      description:
        "Vault refuses to serve requests when an enabled audit device cannot write. This check verifies that at least two audit devices are enabled so a single failing sink does not take the cluster offline.",
      risk:
        "A single audit device is both a logging and an **availability** dependency: if its disk fills or the syslog target becomes unreachable, Vault stops answering requests and every application depending on it for credentials fails. Operators under that pressure frequently disable auditing to restore service, which removes the record precisely when it matters most.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/audit",
        "https://developer.hashicorp.com/vault/tutorials/monitoring/blocked-audit-devices",
      ],
      relatedTo: ["vault_audit_device_enabled"],
      remediation: {
        cli: "vault audit enable file file_path=/var/log/vault/audit.log\nvault audit enable -path=syslog syslog tag=\"vault\" facility=\"AUTH\"\nvault audit enable -path=socket socket address=\"siem.example.com:9090\" socket_type=\"tcp\"",
        other:
          "1. Enable a second audit device with a different failure mode — a local file plus syslog, for example\n2. Monitor free space on the audit log volume and alert well before it fills\n3. Configure log rotation with an agent that does not hold the file handle open\n4. Test the failure path in a non-production cluster so the operational response is known\n5. Never leave a socket device as the only sink; a network partition then blocks Vault entirely",
        terraform:
          'resource "vault_audit" "file" {\n  type    = "file"\n  options = { file_path = "/var/log/vault/audit.log" }\n}\n\nresource "vault_audit" "syslog" {\n  path    = "syslog"\n  type    = "syslog"\n  options = { tag = "vault", facility = "AUTH" }\n}',
        text:
          "Enable two audit devices with independent failure modes, monitor the audit volume's free space, and rehearse the blocked-audit-device response so nobody disables auditing under pressure.",
      },
      body: `findings = []
report = CheckReportVault(
    metadata=self.metadata(),
    resource=list(audit_client.devices.values()),
    resource_name=self._base_url,
    resource_id=self._base_url,
)

count = len(audit_client.devices)
socket_only = count > 0 and all(
    device.type == "socket" for device in audit_client.devices.values()
)

if count >= 2 and not socket_only:
    report.status = "PASS"
    report.status_extended = (
        f"Vault cluster {self._base_url} has {count} audit devices enabled: "
        f"{', '.join(sorted(audit_client.devices))}."
    )
elif socket_only:
    report.status = "FAIL"
    report.status_extended = (
        f"Vault cluster {self._base_url} uses only socket audit device(s); a "
        f"network partition would block all requests."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Vault cluster {self._base_url} has {count} audit device(s); a single "
        f"failing sink would block all requests."
    )

findings.append(report)
return findings`,
    },

    {
      id: "vault_auth_no_active_root_tokens",
      service: "auth",
      pillar: "iam",
      severity: "critical",
      title: "Vault clusters have no outstanding root tokens",
      resourceType: "Vault::Token",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "A Vault **root token** bypasses all policy enforcement. This check enumerates token accessors and reports any token carrying the `root` policy, which should exist only briefly during break-glass operations.",
      risk:
        "A root token is **unrestricted and, unless explicitly created with a TTL, never expires**. Anyone holding one can read every secret, disable the audit devices that would record them doing so, and create further tokens for persistence. Root tokens generated during initial setup and never revoked are among the most common serious findings in a Vault deployment.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/concepts/tokens#root-tokens",
        "https://developer.hashicorp.com/vault/tutorials/operations/generate-root",
      ],
      relatedTo: ["vault_auth_identity_backed_methods_enabled"],
      remediation: {
        cli: "vault list auth/token/accessors\nvault token lookup-accessor <accessor>\nvault token revoke -accessor <accessor>",
        other:
          "1. List token accessors and look up each one to identify those holding the root policy\n2. Confirm no automation depends on them — automation should use an auth method, not a root token\n3. Revoke each root token by accessor\n4. When root access is genuinely needed, generate a temporary one with `vault operator generate-root` using the unseal key holders, and revoke it immediately afterwards\n5. Ensure administrators authenticate through an identity-backed auth method with scoped policies for day-to-day work",
        terraform: "",
        text:
          "Revoke all outstanding root tokens, generate one on demand through the quorum-based generate-root process when break-glass access is needed, and revoke it as soon as the operation completes.",
      },
      body: `findings = []
report = CheckReportVault(
    metadata=self.metadata(),
    resource=auth_client.root_token_accessors,
    resource_name=self._base_url,
    resource_id=self._base_url,
)

count = len(auth_client.root_token_accessors)

if count == 0:
    report.status = "PASS"
    report.status_extended = (
        f"Vault cluster {self._base_url} has no outstanding root tokens."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Vault cluster {self._base_url} has {count} outstanding root token(s), "
        f"which bypass all policy enforcement."
    )

findings.append(report)
return findings`,
    },

    {
      id: "vault_auth_token_ttl_bounded",
      service: "auth",
      pillar: "iam",
      severity: "high",
      title: "Vault auth methods bound token lifetime",
      resourceType: "Vault::AuthMethod",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that each auth method sets a **maximum lease TTL** within the configured bound (32 days by default), so tokens issued through it cannot be renewed indefinitely.",
      risk:
        "A token with an unbounded maximum TTL can be **renewed forever**, so a credential stolen from a log, a container environment or a developer machine stays valid until someone notices and revokes it explicitly. Bounded lifetimes convert theft from a permanent compromise into a time-limited one, and force the legitimate consumer to re-authenticate through the identity source you actually control.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/concepts/tokens#token-time-to-live-periodic-tokens-and-explicit-max-ttls",
        "https://developer.hashicorp.com/vault/api-docs/system/auth",
      ],
      relatedTo: ["vault_secret_engine_lease_ttl_bounded"],
      remediation: {
        cli: "vault auth tune -default-lease-ttl=1h -max-lease-ttl=24h kubernetes/\nvault read sys/auth/kubernetes/tune",
        other:
          "1. Review each auth method's tuning with `vault read sys/auth/<path>/tune`\n2. Set `default_lease_ttl` to the shortest interval the consuming workload tolerates\n3. Set `max_lease_ttl` so renewal cannot extend a token indefinitely\n4. Prefer short-lived tokens obtained per workload run over long-lived ones held in configuration\n5. Verify applications handle token renewal and re-authentication correctly before tightening",
        terraform:
          'resource "vault_auth_backend" "kubernetes" {\n  type              = "kubernetes"\n  default_lease_ttl_seconds = 3600\n  max_lease_ttl_seconds     = 86400\n}',
        text:
          "Tune each auth method with short default and bounded maximum lease TTLs, and confirm consuming applications re-authenticate cleanly before tightening the values.",
      },
      body: `max_allowed_seconds = self.audit_config.get("max_token_ttl_seconds", 2764800)

findings = []
for method in auth_client.methods.values():
    report = CheckReportVault(
        metadata=self.metadata(),
        resource=method,
        resource_name=method.path,
        resource_id=method.path,
    )

    max_ttl = method.max_lease_ttl

    # 0 means "inherit the system max", which is itself unbounded by default.
    if max_ttl is None or max_ttl == 0:
        report.status = "FAIL"
        report.status_extended = (
            f"Auth method {method.path} ({method.type}) does not set a maximum "
            f"lease TTL, so tokens can be renewed indefinitely."
        )
    elif max_ttl > max_allowed_seconds:
        report.status = "FAIL"
        report.status_extended = (
            f"Auth method {method.path} ({method.type}) sets a maximum lease TTL "
            f"of {max_ttl} seconds, above the {max_allowed_seconds} second bound."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Auth method {method.path} ({method.type}) bounds token lifetime at "
            f"{max_ttl} seconds."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "vault_auth_identity_backed_methods_enabled",
      service: "auth",
      pillar: "iam",
      severity: "medium",
      title: "Vault clusters authenticate through identity-backed methods",
      resourceType: "Vault::AuthMethod",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the cluster enables at least one **identity-backed auth method** — OIDC, JWT, Kubernetes, AWS/Azure/GCP IAM, LDAP or cert — rather than relying solely on the built-in token method.",
      risk:
        "With only the token auth method available, every consumer holds a **static secret that was issued once and copied wherever it was needed**. There is no upstream identity to revoke, no attestation of what the caller actually is, and offboarding a person or decommissioning a workload leaves working tokens behind. Identity-backed methods let Vault verify the caller against a source of truth on every login.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/auth",
        "https://developer.hashicorp.com/vault/docs/auth/jwt",
      ],
      relatedTo: ["vault_auth_no_active_root_tokens"],
      remediation: {
        cli: "vault auth enable oidc\nvault auth enable kubernetes\nvault auth list",
        other:
          "1. Enable an auth method backed by your workload identity: Kubernetes for pods, JWT/OIDC for CI, cloud IAM for VMs\n2. Enable OIDC against your corporate identity provider for human operators\n3. Bind roles to specific service accounts, repositories or instance profiles rather than broad wildcards\n4. Migrate applications off static tokens one at a time, confirming each works before removing the old token\n5. Revoke the static tokens once migration completes",
        terraform:
          'resource "vault_jwt_auth_backend" "ci" {\n  path               = "jwt"\n  oidc_discovery_url = "https://token.actions.githubusercontent.com"\n  bound_issuer       = "https://token.actions.githubusercontent.com"\n}',
        text:
          "Enable identity-backed auth methods for both workloads and operators, bind roles narrowly to specific identities, and revoke static tokens once each consumer has migrated.",
      },
      body: `IDENTITY_BACKED = {
    "oidc",
    "jwt",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "ldap",
    "cert",
    "okta",
    "github",
}

findings = []
report = CheckReportVault(
    metadata=self.metadata(),
    resource=list(auth_client.methods.values()),
    resource_name=self._base_url,
    resource_id=self._base_url,
)

enabled = {
    method.type for method in auth_client.methods.values() if method.type
}
identity_methods = enabled & IDENTITY_BACKED

if identity_methods:
    report.status = "PASS"
    report.status_extended = (
        f"Vault cluster {self._base_url} enables identity-backed auth method(s): "
        f"{', '.join(sorted(identity_methods))}."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Vault cluster {self._base_url} enables no identity-backed auth method; "
        f"only static tokens are available."
    )

findings.append(report)
return findings`,
    },

    {
      id: "vault_secret_engine_lease_ttl_bounded",
      service: "secret",
      pillar: "iam",
      severity: "medium",
      title: "Vault dynamic secret engines bound credential lease lifetime",
      resourceType: "Vault::SecretEngine",
      resourceGroup: "secrets",
      categories: ["secrets"],
      description:
        "This check verifies that dynamic secret engines — database, AWS, Azure, GCP, PKI, SSH and Consul — set a **maximum lease TTL**, so the credentials they issue expire rather than persisting indefinitely.",
      risk:
        "The value of a dynamic secret engine is that credentials are **short-lived and revoked automatically**; without a bounded maximum lease TTL that property is lost and the engine simply becomes a generator of long-lived credentials scattered across your estate. Worse, each is a real database user or cloud principal, so an unbounded lease leaves durable access that no rotation of the Vault token will revoke.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/concepts/lease",
        "https://developer.hashicorp.com/vault/api-docs/system/mounts",
      ],
      relatedTo: ["vault_auth_token_ttl_bounded"],
      remediation: {
        cli: "vault secrets tune -default-lease-ttl=1h -max-lease-ttl=24h database/\nvault read sys/mounts/database/tune",
        other:
          "1. Review each dynamic engine's tuning with `vault read sys/mounts/<path>/tune`\n2. Set `max_lease_ttl` to the shortest period the consuming workload can operate within\n3. Set role-level TTLs where they should be shorter than the mount default\n4. Verify that revocation actually works — test that a revoked database credential is dropped at the target\n5. Monitor the lease count; a growing backlog usually means consumers are not releasing leases",
        terraform:
          'resource "vault_mount" "database" {\n  path                      = "database"\n  type                      = "database"\n  default_lease_ttl_seconds = 3600\n  max_lease_ttl_seconds     = 86400\n}',
        text:
          "Bound the maximum lease TTL on every dynamic secret engine, set shorter role-level TTLs where appropriate, and verify revocation actually removes the credential at the target system.",
      },
      body: `DYNAMIC_ENGINES = {
    "database",
    "aws",
    "azure",
    "gcp",
    "pki",
    "ssh",
    "consul",
    "nomad",
    "rabbitmq",
}

max_allowed_seconds = self.audit_config.get("max_lease_ttl_seconds", 604800)

findings = []
for mount in secret_client.mounts.values():
    if mount.type not in DYNAMIC_ENGINES:
        continue

    report = CheckReportVault(
        metadata=self.metadata(),
        resource=mount,
        resource_name=mount.path,
        resource_id=mount.path,
    )

    max_ttl = mount.max_lease_ttl

    if max_ttl is None or max_ttl == 0:
        report.status = "FAIL"
        report.status_extended = (
            f"Secret engine {mount.path} ({mount.type}) does not set a maximum "
            f"lease TTL for the credentials it issues."
        )
    elif max_ttl > max_allowed_seconds:
        report.status = "FAIL"
        report.status_extended = (
            f"Secret engine {mount.path} ({mount.type}) issues credentials with a "
            f"maximum lease of {max_ttl} seconds, above the "
            f"{max_allowed_seconds} second bound."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Secret engine {mount.path} ({mount.type}) bounds credential leases "
            f"at {max_ttl} seconds."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "vault_system_listener_tls_enabled",
      service: "system",
      pillar: "encryption",
      severity: "critical",
      title: "Vault listeners require TLS",
      resourceType: "Vault::Listener",
      resourceGroup: "network",
      categories: ["encryption"],
      description:
        "This check reports Vault listeners configured with `tls_disable`, and confirms the cluster address itself uses HTTPS.",
      risk:
        "Vault tokens and secret values travel in the **request and response bodies**, so a listener without TLS publishes every credential the cluster serves to anyone on the network path. Because a captured token is immediately replayable, one intercepted request is enough to reach every secret that token's policy allows — the entire purpose of the system defeated at the transport layer.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/configuration/listener/tcp",
        "https://developer.hashicorp.com/vault/tutorials/operations/production-hardening",
      ],
      relatedTo: ["vault_system_auto_unseal_configured"],
      remediation: {
        cli: "# In the Vault server configuration:\n#   listener \"tcp\" {\n#     address       = \"0.0.0.0:8200\"\n#     tls_cert_file = \"/etc/vault/tls/vault.crt\"\n#     tls_key_file  = \"/etc/vault/tls/vault.key\"\n#     tls_min_version = \"tls12\"\n#   }\nsudo systemctl restart vault",
        other:
          "1. Provision a certificate for the Vault cluster's DNS name\n2. Set `tls_cert_file` and `tls_key_file` on every listener and remove `tls_disable`\n3. Set `tls_min_version = \"tls12\"` or higher\n4. Restart Vault and confirm `VAULT_ADDR` uses `https://`\n5. Enable `tls_require_and_verify_client_cert` where mutual TLS is practical\n6. Rotate every token and secret that was served over a plaintext listener — treat them as intercepted",
        terraform:
          '# Vault Helm chart values\nserver:\n  standalone:\n    config: |\n      listener "tcp" {\n        address       = "0.0.0.0:8200"\n        tls_cert_file = "/vault/userconfig/tls/tls.crt"\n        tls_key_file  = "/vault/userconfig/tls/tls.key"\n        tls_min_version = "tls12"\n      }',
        text:
          "Enable TLS on every listener with a minimum version of 1.2, remove tls_disable, and rotate all tokens and secrets that were previously served over plaintext.",
      },
      body: `findings = []
system = system_client.system
if system is None:
    return findings

if system.listeners:
    for listener in system.listeners:
        report = CheckReportVault(
            metadata=self.metadata(),
            resource=listener,
            resource_name=listener.address or listener.type,
            resource_id=f"{listener.type}:{listener.address}",
        )

        if listener.tls_disable:
            report.status = "FAIL"
            report.status_extended = (
                f"Vault listener {listener.type} on {listener.address} has TLS "
                f"disabled."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Vault listener {listener.type} on {listener.address} requires TLS."
            )

        findings.append(report)
else:
    # The sanitized config endpoint was not readable; fall back to the address.
    report = CheckReportVault(
        metadata=self.metadata(),
        resource=system,
        resource_name=system.address,
        resource_id=system.address,
    )
    if system.address.startswith("https://"):
        report.status = "PASS"
        report.status_extended = (
            f"Vault cluster is reached over HTTPS at {system.address}."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Vault cluster is reached over plaintext HTTP at {system.address}."
        )
    findings.append(report)

return findings`,
    },

    {
      id: "vault_system_auto_unseal_configured",
      service: "system",
      pillar: "encryption",
      severity: "medium",
      title: "Vault clusters use auto-unseal or a quorum Shamir threshold",
      resourceType: "Vault::Seal",
      resourceGroup: "storage",
      categories: ["encryption", "resilience"],
      description:
        "This check verifies that the cluster uses an **auto-unseal seal** backed by a cloud KMS or HSM, or — where Shamir key sharing is used — that the unseal threshold is at least three of five shares.",
      risk:
        "With Shamir unsealing and a low threshold, **one or two key holders can unseal Vault alone**, removing the quorum control that protects the master key; and every restart requires humans to assemble, which pressures operators into storing shares together and defeating the split entirely. Auto-unseal moves the trust to a KMS key you can audit and revoke, and removes the temptation to hoard shares.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/concepts/seal",
        "https://developer.hashicorp.com/vault/tutorials/auto-unseal",
      ],
      relatedTo: ["vault_system_listener_tls_enabled"],
      remediation: {
        cli: "# In the Vault server configuration:\n#   seal \"awskms\" {\n#     region     = \"us-east-1\"\n#     kms_key_id = \"alias/vault-unseal\"\n#   }\nvault operator migrate -config=migrate.hcl",
        other:
          "1. Create a KMS key (AWS KMS, Azure Key Vault, GCP KMS) or provision an HSM\n2. Add the corresponding `seal` stanza to the Vault configuration\n3. Migrate the existing seal with `vault operator unseal -migrate`\n4. Distribute the resulting recovery keys to separate holders using a threshold of at least 3 of 5\n5. Store recovery key shares in physically separate locations — never together\n6. Restrict and monitor the KMS key policy: whoever can use that key can unseal Vault",
        terraform:
          '# Vault server configuration\nseal "awskms" {\n  region     = "us-east-1"\n  kms_key_id = "alias/vault-unseal"\n}',
        text:
          "Use KMS or HSM auto-unseal with recovery keys split 3-of-5 across separate holders, and tightly restrict and monitor the unseal key's policy since it is equivalent to the seal itself.",
      },
      body: `min_threshold = self.audit_config.get("min_unseal_threshold", 3)
min_shares = self.audit_config.get("min_unseal_shares", 5)

findings = []
system = system_client.system
if system is None:
    return findings

report = CheckReportVault(
    metadata=self.metadata(),
    resource=system,
    resource_name=system.address,
    resource_id=system.cluster_name or system.address,
)

seal_type = (system.seal_type or "shamir").lower()
shares = system.key_shares or 0
threshold = system.key_threshold or 0

if seal_type != "shamir":
    report.status = "PASS"
    report.status_extended = (
        f"Vault cluster {system.address} uses the {seal_type} auto-unseal seal "
        f"with a recovery threshold of {threshold} of {shares}."
    )
elif threshold >= min_threshold and shares >= min_shares:
    report.status = "PASS"
    report.status_extended = (
        f"Vault cluster {system.address} uses Shamir unsealing with a threshold of "
        f"{threshold} of {shares} shares."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Vault cluster {system.address} uses Shamir unsealing with a threshold of "
        f"{threshold} of {shares} shares (expected at least {min_threshold} of "
        f"{min_shares}, or an auto-unseal seal)."
    )

findings.append(report)
return findings`,
    },

    {
      id: "vault_system_not_sealed",
      service: "system",
      pillar: "attacksurface",
      severity: "high",
      title: "Vault clusters are unsealed and serving requests",
      resourceType: "Vault::Seal",
      resourceGroup: "compute",
      categories: ["resilience"],
      description:
        "A sealed Vault cannot decrypt its storage and refuses all requests. This check reports clusters found in a sealed state, and confirms high availability is enabled.",
      risk:
        "A sealed Vault is a **total outage for every application that depends on it** for database credentials, certificates and API keys, and the recovery path requires assembling unseal key holders under time pressure. Teams routinely respond by caching secrets locally or falling back to static credentials, which quietly undoes the controls Vault was deployed to provide.",
      urls: [
        "https://developer.hashicorp.com/vault/docs/concepts/seal",
        "https://developer.hashicorp.com/vault/docs/internals/high-availability",
      ],
      relatedTo: ["vault_system_auto_unseal_configured"],
      remediation: {
        cli: "vault status\nvault operator unseal\n# Prefer auto-unseal so restarts recover without human intervention.",
        other:
          "1. Determine why the cluster is sealed — a restart, a crash, or a manual seal\n2. Unseal it with the required key shares, or confirm the auto-unseal KMS key is reachable\n3. Configure auto-unseal so restarts recover automatically\n4. Run Vault in HA with at least three nodes, so a single node restart does not interrupt service\n5. Alert on seal status changes and on nodes leaving the cluster\n6. Verify applications retry gracefully rather than caching secrets when Vault is unavailable",
        terraform: "",
        text:
          "Restore the cluster to unsealed, configure auto-unseal so restarts recover unattended, run at least three nodes in HA, and alert on seal status transitions.",
      },
      body: `findings = []
system = system_client.system
if system is None:
    return findings

report = CheckReportVault(
    metadata=self.metadata(),
    resource=system,
    resource_name=system.address,
    resource_id=system.cluster_name or system.address,
)

if system.sealed:
    report.status = "FAIL"
    report.status_extended = (
        f"Vault cluster {system.address} is sealed and is not serving requests."
    )
elif not system.ha_enabled:
    report.status = "FAIL"
    report.status_extended = (
        f"Vault cluster {system.address} is unsealed but high availability is not "
        f"enabled, so a single node restart interrupts every consumer."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Vault cluster {system.address} is unsealed and running in high "
        f"availability mode."
    )

findings.append(report)
return findings`,
    },
  ],
};
