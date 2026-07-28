from typing import List

from apexhub.lib.check.models import Check, CheckReportOpenAI
from apexhub.providers.openai.services.organization.organization_client import organization_client


class openai_organization_sso_enforced(Check):
    """OpenAI organizations enforce SSO with a verified domain

    Without enforced SSO, members sign in with personal credentials outside your control, so leavers keep access until someone remembers to remove them manually, and there is no conditional access or central session revocation. An unverified domain also allows anyone with a company email address to self-register outside the governed organization entirely.
    """

    def execute(self) -> List[CheckReportOpenAI]:
        findings = []
        organization = organization_client.organization
        if organization is None:
            return findings

        report = CheckReportOpenAI(
            metadata=self.metadata(),
            resource=organization,
            resource_name=organization.name or organization.id,
            resource_id=organization.id,
        )

        if organization.sso_enforced and organization.domain_verified:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} enforces SSO with a "
                f"verified domain."
            )
        elif organization.sso_enforced:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} enforces SSO but has "
                f"no verified domain, so accounts can be created outside it."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} does not enforce SSO."
            )

        findings.append(report)
        return findings
