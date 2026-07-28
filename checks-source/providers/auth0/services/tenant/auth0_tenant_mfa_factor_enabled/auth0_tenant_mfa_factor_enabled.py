from typing import List

from apexhub.lib.check.models import Check, CheckReportAuth0
from apexhub.providers.auth0.services.tenant.tenant_client import tenant_client


class auth0_tenant_mfa_factor_enabled(Check):
    """Auth0 tenants have at least one multi-factor authentication factor enabled

    Auth0 fronts authentication for every application connected to it, so a tenant with no MFA factor means none of those applications can require a second factor regardless of their own configuration. Where SMS is the sole factor, SIM swap and SS7 interception defeat it, which is why phishing-resistant factors matter most at the identity provider layer.
    """

    def execute(self) -> List[CheckReportAuth0]:
        PHISHING_RESISTANT = {"webauthn-roaming", "webauthn-platform", "duo"}
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
        return findings
