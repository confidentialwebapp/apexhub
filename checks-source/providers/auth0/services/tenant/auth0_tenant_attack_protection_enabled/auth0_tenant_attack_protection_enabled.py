from typing import List

from apexhub.lib.check.models import Check, CheckReportAuth0
from apexhub.providers.auth0.services.tenant.tenant_client import tenant_client


class auth0_tenant_attack_protection_enabled(Check):
    """Auth0 tenants enable all attack protection features

    Auth0 login endpoints are internet-facing and enumerable, so without throttling an attacker can run credential stuffing at full speed against your entire user base using passwords from unrelated breaches. Breached password detection is what catches the accounts that will fall first, and its absence means those compromises are only discovered after the account is used.
    """

    def execute(self) -> List[CheckReportAuth0]:
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
        return findings
