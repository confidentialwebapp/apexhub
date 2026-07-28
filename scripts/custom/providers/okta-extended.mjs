/**
 * Okta — first-party checks extending the vendored upstream provider, which
 * covers only global session policy (5 checks).
 *
 * These use the upstream Okta SDK service base
 * (checks-source/providers/okta/lib/service/service.py), so only the new
 * services and check modules are emitted.
 */

const user_service = `from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.okta.lib.service.service import OktaService


class User(OktaService):
    """Retrieve Okta users with their status, factors and last login."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.users: dict[str, OktaUser] = {}
        self._list_users()
        self._list_factors()

    def _list_users(self):
        try:
            users, response, error = self._run(
                self.client.list_users({"limit": 200})
            )
            if error:
                logger.error(f"User - Error listing users: {error}")
                return

            while True:
                for raw in users or []:
                    user = OktaUser(
                        id=raw.id,
                        login=getattr(raw.profile, "login", ""),
                        email=getattr(raw.profile, "email", ""),
                        status=str(raw.status),
                        created=_as_datetime(raw.created),
                        last_login=_as_datetime(raw.last_login),
                        password_changed=_as_datetime(raw.password_changed),
                    )
                    self.users[user.id] = user

                if not response or not response.has_next():
                    break
                users, error = self._run(response.next())
                if error:
                    logger.error(f"User - Error paginating users: {error}")
                    break

            logger.info(f"User - Found {len(self.users)} user(s)")
        except Exception as error:
            logger.error(
                f"User - Error listing users: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _list_factors(self):
        """Attach the enrolled MFA factors for each active user."""
        for user in self.users.values():
            if user.status not in ("ACTIVE", "PASSWORD_EXPIRED", "RECOVERY"):
                continue
            try:
                factors, _, error = self._run(
                    self.client.list_factors(user.id)
                )
                if error:
                    logger.info(f"User - Factors not readable for {user.login}: {error}")
                    continue
                for factor in factors or []:
                    if str(factor.status) == "ACTIVE":
                        user.factors.append(str(factor.factor_type))
            except Exception as error:
                logger.error(
                    f"User - Error listing factors for {user.login}: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )


def _as_datetime(value) -> Optional[datetime]:
    if value is None or isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


class OktaUser(BaseModel):
    """Okta user representation."""

    id: str
    login: str = ""
    email: str = ""
    status: str = "ACTIVE"
    created: Optional[datetime] = None
    last_login: Optional[datetime] = None
    password_changed: Optional[datetime] = None
    factors: list[str] = Field(default_factory=list)
`;

const application_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.okta.lib.service.service import OktaService


class Application(OktaService):
    """Retrieve Okta applications with their sign-on mode and assignment scope."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.applications: dict[str, OktaApplication] = {}
        self._list_applications()

    def _list_applications(self):
        try:
            apps, response, error = self._run(
                self.client.list_applications({"limit": 200})
            )
            if error:
                logger.error(f"Application - Error listing applications: {error}")
                return

            while True:
                for raw in apps or []:
                    settings = getattr(raw, "settings", None)
                    sign_on = getattr(settings, "sign_on", None) if settings else None
                    application = OktaApplication(
                        id=raw.id,
                        label=getattr(raw, "label", ""),
                        name=getattr(raw, "name", ""),
                        status=str(getattr(raw, "status", "ACTIVE")),
                        sign_on_mode=str(getattr(raw, "sign_on_mode", "")),
                        visibility_hidden=bool(
                            getattr(
                                getattr(raw, "visibility", None), "hide", None
                            )
                        ),
                        destination_url=str(
                            getattr(sign_on, "destination_override_url", "") or ""
                        ),
                    )
                    self.applications[application.id] = application

                if not response or not response.has_next():
                    break
                apps, error = self._run(response.next())
                if error:
                    logger.error(f"Application - Error paginating: {error}")
                    break

            logger.info(
                f"Application - Found {len(self.applications)} application(s)"
            )
        except Exception as error:
            logger.error(
                f"Application - Error listing applications: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class OktaApplication(BaseModel):
    """Okta application representation."""

    id: str
    label: str = ""
    name: str = ""
    status: str = "ACTIVE"
    sign_on_mode: str = ""
    visibility_hidden: bool = False
    destination_url: str = ""
`;

const policy_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.okta.lib.service.service import OktaService

POLICY_TYPES = ("PASSWORD", "MFA_ENROLL", "ACCESS_POLICY")


class Policy(OktaService):
    """Retrieve Okta password, MFA enrolment and authentication policies."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.policies: dict[str, OktaPolicy] = {}
        self._list_policies()

    def _list_policies(self):
        for policy_type in POLICY_TYPES:
            try:
                policies, _, error = self._run(
                    self.client.list_policies({"type": policy_type})
                )
                if error:
                    logger.info(
                        f"Policy - {policy_type} policies not readable: {error}"
                    )
                    continue

                for raw in policies or []:
                    settings = getattr(raw, "settings", None)
                    password = getattr(settings, "password", None) if settings else None
                    complexity = (
                        getattr(password, "complexity", None) if password else None
                    )
                    lockout = getattr(password, "lockout", None) if password else None

                    policy = OktaPolicy(
                        id=raw.id,
                        name=getattr(raw, "name", ""),
                        type=policy_type,
                        status=str(getattr(raw, "status", "ACTIVE")),
                        priority=getattr(raw, "priority", None),
                        min_length=getattr(complexity, "min_length", None)
                        if complexity
                        else None,
                        exclude_username=bool(
                            getattr(complexity, "exclude_username", False)
                        )
                        if complexity
                        else False,
                        dictionary_check=bool(
                            getattr(
                                getattr(complexity, "dictionary", None),
                                "common",
                                None,
                            )
                        )
                        if complexity
                        else False,
                        max_attempts=getattr(lockout, "max_attempts", None)
                        if lockout
                        else None,
                    )
                    self.policies[policy.id] = policy
            except Exception as error:
                logger.error(
                    f"Policy - Error listing {policy_type} policies: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )

        logger.info(f"Policy - Found {len(self.policies)} policy(ies)")


class OktaPolicy(BaseModel):
    """Okta policy representation."""

    id: str
    name: str = ""
    type: str = ""
    status: str = "ACTIVE"
    priority: Optional[int] = None
    min_length: Optional[int] = None
    exclude_username: bool = False
    dictionary_check: bool = False
    max_attempts: Optional[int] = None
`;

export default {
  id: "okta",
  name: "Okta",
  pyClass: "Okta",
  extendsUpstream: true,
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Okta assesses an Okta org across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It extends the global session policy coverage with multi-factor enrolment, password policy strength, dormant account detection, application sign-on mode and phishing-resistant factor availability.",

  newServices: {
    user: { pyClass: "User", source: user_service },
    application: { pyClass: "Application", source: application_service },
    policy: { pyClass: "Policy", source: policy_service },
  },

  checks: [
    {
      id: "user_mfa_factor_enrolled",
      service: "user",
      pillar: "iam",
      severity: "critical",
      title: "Okta users have an active multi-factor authentication factor enrolled",
      resourceType: "Okta::User",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that every active Okta user has at least one **active MFA factor** enrolled, and flags users whose only factor is SMS or voice.",
      risk:
        "Okta is the **front door to every application it federates**, so a user without a second factor is a single password away from every downstream system at once. Where SMS is the only factor, SIM swap and interception defeat it — and because attackers target the identity provider specifically to reach everything behind it, weak factors here have the widest possible blast radius.",
      urls: [
        "https://help.okta.com/en-us/content/topics/security/mfa/mfa-home.htm",
        "https://developer.okta.com/docs/reference/api/factors/",
      ],
      relatedTo: ["policy_mfa_enrollment_required", "user_no_dormant_accounts"],
      remediation: {
        cli: "",
        other:
          "1. In the Okta Admin Console, go to **Security > Authenticators**\n2. Enable FIDO2 (WebAuthn) and Okta Verify with push\n3. Under **Enrollment**, set FIDO2 or Okta Verify to `Required`\n4. Set SMS and Voice to `Disabled` or `Optional` only as a recovery path\n5. Create an enrolment window and monitor progress in the MFA usage report\n6. For administrators, require a phishing-resistant factor with no fallback",
        terraform:
          'resource "okta_policy_mfa" "require_phishing_resistant" {\n  name        = "Require phishing-resistant MFA"\n  status      = "ACTIVE"\n  is_oie      = true\n\n  fido_webauthn = {\n    enroll = "REQUIRED"\n  }\n}',
        text:
          "Require a phishing-resistant factor (FIDO2/WebAuthn or Okta Verify with push) for every active user, and restrict SMS and voice to a recovery role at most.",
      },
      body: `PHISHING_RESISTANT = {"webauthn", "u2f", "token:hardware", "signed_nonce"}
WEAK_FACTORS = {"sms", "call"}
ACTIVE_STATUSES = {"ACTIVE", "PASSWORD_EXPIRED", "RECOVERY"}

findings = []
for user in user_client.users.values():
    if user.status not in ACTIVE_STATUSES:
        continue

    report = CheckReportOkta(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.login,
        resource_id=user.id,
    )

    factors = {factor.strip().lower() for factor in user.factors if factor}

    if not factors:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.login} has no active multi-factor authentication factor "
            f"enrolled."
        )
    elif factors <= WEAK_FACTORS:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.login} has only weak factor(s) enrolled: "
            f"{', '.join(sorted(factors))}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"User {user.login} has {len(factors)} active factor(s) enrolled: "
            f"{', '.join(sorted(factors))}."
        )
        if not factors & PHISHING_RESISTANT:
            report.status_extended += " No phishing-resistant factor is enrolled."

    findings.append(report)

return findings`,
    },

    {
      id: "user_no_dormant_accounts",
      service: "user",
      pillar: "iam",
      severity: "medium",
      title: "Okta has no active users that are dormant or have never signed in",
      resourceType: "Okta::User",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check reports active Okta users who have never signed in, or whose last sign-in predates the configured dormancy threshold (90 days by default).",
      risk:
        "A dormant Okta account still **federates into every application assigned to it**, and because nobody uses it legitimately, nobody notices when someone else does. These accounts also tend to have older passwords and outdated factor enrolments, making them the easiest targets in the directory and the least likely compromise to be reported by the account's owner.",
      urls: [
        "https://help.okta.com/en-us/content/topics/users-groups-profiles/usgp-deactivate-user-account.htm",
        "https://developer.okta.com/docs/reference/api/users/",
      ],
      relatedTo: ["user_mfa_factor_enrolled"],
      remediation: {
        cli: "",
        other:
          "1. Run the **Okta user activity** report filtered on last sign-in\n2. Confirm with the owning manager whether each account is still needed\n3. Suspend rather than deactivate first, so any dependency surfaces safely\n4. Deactivate accounts that remain unclaimed after the grace period\n5. Connect Okta to your HR system so joiner-mover-leaver events deprovision automatically\n6. Check service accounts separately: they may legitimately never sign in interactively",
        terraform: "",
        text:
          "Suspend then deactivate dormant accounts, and drive lifecycle from your HR system so deprovisioning is automatic rather than dependent on periodic review.",
      },
      body: `from datetime import datetime, timedelta, timezone

max_idle_days = self.audit_config.get("max_user_idle_days", 90)
cutoff = datetime.now(timezone.utc) - timedelta(days=max_idle_days)
ACTIVE_STATUSES = {"ACTIVE", "PASSWORD_EXPIRED", "RECOVERY"}

findings = []
for user in user_client.users.values():
    if user.status not in ACTIVE_STATUSES:
        continue

    report = CheckReportOkta(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.login,
        resource_id=user.id,
    )

    last_login = user.last_login
    if last_login is not None and last_login.tzinfo is None:
        last_login = last_login.replace(tzinfo=timezone.utc)

    if last_login is None:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.login} is active but has never signed in."
        )
    elif last_login < cutoff:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.login} has not signed in since {last_login.date()} "
            f"(threshold {max_idle_days} days)."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"User {user.login} last signed in on {last_login.date()}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "policy_password_strength_enforced",
      service: "policy",
      pillar: "iam",
      severity: "high",
      title: "Okta password policies enforce length, dictionary and lockout controls",
      resourceType: "Okta::Policy",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that each active password policy requires a minimum length of 12 or more, excludes the username, enables the common-password dictionary check, and locks accounts after a bounded number of failed attempts.",
      risk:
        "Okta's sign-in endpoint is internet-facing by design, so password policy directly determines how effective **password spraying** is against your whole directory at once. The common-password dictionary check matters most: spraying uses a small list of predictable passwords across many accounts precisely because lockout thresholds are per-account, and a dictionary check is what removes those passwords from the pool.",
      urls: [
        "https://help.okta.com/en-us/content/topics/security/policies/configure-password-policies.htm",
        "https://developer.okta.com/docs/reference/api/policy/",
      ],
      relatedTo: ["policy_mfa_enrollment_required"],
      remediation: {
        cli: "",
        other:
          "1. In the Okta Admin Console, go to **Security > Authentication policies > Password**\n2. Set the minimum length to 12 or more\n3. Enable **Common password check** and **Do not allow parts of the username**\n4. Set **Lock out user after** to 5 or fewer failed attempts\n5. Enable **Breached password detection** through ThreatInsight where licensed\n6. Configure ThreatInsight to block requests from known-malicious IPs, which stops spraying before it reaches the policy",
        terraform:
          'resource "okta_policy_password" "default" {\n  name                     = "Password Policy"\n  status                   = "ACTIVE"\n  password_min_length      = 12\n  password_exclude_username = true\n  password_dictionary_lookup = true\n  password_max_lockout_attempts = 5\n}',
        text:
          "Require 12+ characters with the common-password dictionary check and username exclusion, lock out after 5 failed attempts, and enable ThreatInsight to block spraying at the network layer.",
      },
      body: `min_length_required = self.audit_config.get("min_password_length", 12)
max_lockout_attempts = self.audit_config.get("max_invalid_login_attempts", 5)

findings = []
for policy in policy_client.policies.values():
    if policy.type != "PASSWORD" or policy.status != "ACTIVE":
        continue

    report = CheckReportOkta(
        metadata=self.metadata(),
        resource=policy,
        resource_name=policy.name,
        resource_id=policy.id,
    )

    issues = []
    if (policy.min_length or 0) < min_length_required:
        issues.append(
            f"minimum length is {policy.min_length or 'unset'} "
            f"(expected {min_length_required})"
        )
    if not policy.exclude_username:
        issues.append("the username is not excluded from passwords")
    if not policy.dictionary_check:
        issues.append("the common-password dictionary check is disabled")
    if policy.max_attempts is None or policy.max_attempts > max_lockout_attempts:
        issues.append(
            f"lockout after {policy.max_attempts or 'unlimited'} attempts "
            f"(expected {max_lockout_attempts} or fewer)"
        )

    if issues:
        report.status = "FAIL"
        report.status_extended = (
            f"Password policy {policy.name}: {'; '.join(issues)}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Password policy {policy.name} requires {policy.min_length} "
            f"characters with dictionary checking and lockout after "
            f"{policy.max_attempts} attempts."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "policy_mfa_enrollment_required",
      service: "policy",
      pillar: "iam",
      severity: "high",
      title: "Okta orgs have an active MFA enrollment policy",
      resourceType: "Okta::Policy",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check verifies that the org has at least one **active MFA enrollment policy**, which is what obliges users to register a factor rather than leaving enrolment optional.",
      risk:
        "Without an active enrolment policy, MFA is **available but not required**, so coverage depends entirely on individual users choosing to enrol. In practice that leaves a long tail of unprotected accounts — and attackers specifically enumerate for them, since one unenrolled user provides the same federated access as any other.",
      urls: [
        "https://help.okta.com/en-us/content/topics/security/mfa/mfa-enrollment-policy.htm",
        "https://developer.okta.com/docs/reference/api/policy/#multifactor-mfa-enrollment-policy",
      ],
      relatedTo: ["user_mfa_factor_enrolled", "policy_password_strength_enforced"],
      remediation: {
        cli: "",
        other:
          "1. In the Okta Admin Console, go to **Security > Authenticators > Enrollment**\n2. Create or edit an enrolment policy and set it to **Active**\n3. Set FIDO2 (WebAuthn) or Okta Verify to `Required`\n4. Assign the policy to all users, with a stricter policy for administrator groups\n5. Add a rule that prompts for enrolment at next sign-in rather than deferring indefinitely\n6. Track enrolment completion and follow up with the remaining users",
        terraform:
          'resource "okta_policy_mfa" "default" {\n  name   = "MFA Enrollment"\n  status = "ACTIVE"\n  is_oie = true\n\n  okta_verify = {\n    enroll = "REQUIRED"\n  }\n}',
        text:
          "Activate an MFA enrollment policy requiring a phishing-resistant factor, assign it to all users with a stricter variant for admins, and prompt for enrolment at next sign-in.",
      },
      body: `findings = []
active = [
    policy
    for policy in policy_client.policies.values()
    if policy.type == "MFA_ENROLL" and policy.status == "ACTIVE"
]

report = CheckReportOkta(
    metadata=self.metadata(),
    resource=active,
    resource_name="MFA enrollment policy",
    resource_id="mfa-enroll",
)

if active:
    report.status = "PASS"
    report.status_extended = (
        f"Okta org has {len(active)} active MFA enrollment policy(ies): "
        f"{', '.join(policy.name for policy in active)}."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        "Okta org has no active MFA enrollment policy; factor enrolment is "
        "optional."
    )

findings.append(report)
return findings`,
    },

    {
      id: "application_sign_on_mode_federated",
      service: "application",
      pillar: "attacksurface",
      severity: "medium",
      title: "Okta applications use federated sign-on rather than stored passwords",
      resourceType: "Okta::Application",
      resourceGroup: "iam",
      categories: ["authentication", "secrets"],
      description:
        "This check reports active applications using `SECURE_PASSWORD_STORE`, `BASIC_AUTH` or `BOOKMARK` sign-on modes, where Okta stores and replays a password rather than issuing a federated assertion.",
      risk:
        "Password-replay sign-on modes mean Okta **holds a reusable credential for the downstream application**, so compromising the Okta org yields working passwords for those systems directly rather than only session assertions. Those credentials also bypass the downstream application's own MFA, and they survive an Okta session revocation because the password itself is unchanged.",
      urls: [
        "https://help.okta.com/en-us/content/topics/apps/apps-about-sign-on-options.htm",
        "https://developer.okta.com/docs/reference/api/apps/",
      ],
      remediation: {
        cli: "",
        other:
          "1. In the Okta Admin Console, list applications and review the **Sign-On Method** of each\n2. For applications that support SAML 2.0 or OpenID Connect, migrate them to federated sign-on\n3. Where an application only supports password replay, restrict its assignment to the smallest possible group\n4. Ensure those applications enforce their own MFA independently\n5. Remove BOOKMARK apps that point at systems now reachable through federation\n6. Rotate the stored passwords for any application that remains on password replay",
        terraform: "",
        text:
          "Migrate applications to SAML or OIDC federation, restrict assignment for those that only support password replay, and rotate the passwords Okta stores for them.",
      },
      body: `PASSWORD_REPLAY_MODES = {
    "SECURE_PASSWORD_STORE",
    "BASIC_AUTH",
    "BOOKMARK",
    "AUTO_LOGIN",
}

findings = []
for application in application_client.applications.values():
    if application.status != "ACTIVE":
        continue

    report = CheckReportOkta(
        metadata=self.metadata(),
        resource=application,
        resource_name=application.label or application.name,
        resource_id=application.id,
    )

    mode = (application.sign_on_mode or "").upper()

    if mode in PASSWORD_REPLAY_MODES:
        report.status = "FAIL"
        report.status_extended = (
            f"Application {application.label or application.name} uses the "
            f"password-replay sign-on mode {mode}."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Application {application.label or application.name} uses the "
            f"federated sign-on mode {mode or 'unknown'}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "user_password_rotated",
      service: "user",
      pillar: "encryption",
      severity: "low",
      title: "Okta user passwords have been changed within the rotation window",
      resourceType: "Okta::User",
      resourceGroup: "iam",
      categories: ["authentication"],
      description:
        "This check reports active users whose password has not changed within the configured window (365 days by default), or for whom no password change is recorded at all.",
      risk:
        "A password unchanged for years is one that has had the **maximum possible exposure to credential breaches elsewhere**, since reuse is common and breach corpora accumulate over time. While forced frequent rotation is no longer recommended practice, an unchanged credential of this age combined with weak or absent MFA is a meaningful indicator of an account worth attention.",
      urls: [
        "https://help.okta.com/en-us/content/topics/security/policies/configure-password-policies.htm",
        "https://developer.okta.com/docs/reference/api/users/",
      ],
      relatedTo: ["policy_password_strength_enforced"],
      remediation: {
        cli: "",
        other:
          "1. Prefer breach-driven rotation over calendar-driven: enable **breached password detection** so a credential is reset when it is known to be exposed\n2. Where a maximum password age is required by policy, configure it under **Security > Authentication policies > Password**\n3. For the accounts flagged here, confirm a strong MFA factor is enrolled — that matters more than the password age\n4. Consider moving the account to passwordless authentication with FIDO2\n5. Reset passwords for any account appearing in a breach corpus regardless of age",
        terraform: "",
        text:
          "Drive password resets from breach detection rather than a calendar, ensure flagged accounts have a strong factor enrolled, and move suitable accounts to passwordless FIDO2 authentication.",
      },
      body: `from datetime import datetime, timedelta, timezone

max_age_days = self.audit_config.get("max_password_age_days", 365)
cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
ACTIVE_STATUSES = {"ACTIVE", "PASSWORD_EXPIRED", "RECOVERY"}

findings = []
for user in user_client.users.values():
    if user.status not in ACTIVE_STATUSES:
        continue

    report = CheckReportOkta(
        metadata=self.metadata(),
        resource=user,
        resource_name=user.login,
        resource_id=user.id,
    )

    changed = user.password_changed
    if changed is not None and changed.tzinfo is None:
        changed = changed.replace(tzinfo=timezone.utc)

    if changed is None:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.login} has no recorded password change."
        )
    elif changed < cutoff:
        report.status = "FAIL"
        report.status_extended = (
            f"User {user.login} last changed their password on {changed.date()} "
            f"(threshold {max_age_days} days)."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"User {user.login} changed their password on {changed.date()}."
        )

    findings.append(report)

return findings`,
    },
  ],
};
