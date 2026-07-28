from typing import List

from apexhub.lib.check.models import Check, CheckReportOpenAI
from apexhub.providers.openai.services.organization.organization_client import organization_client


class openai_organization_mfa_required(Check):
    """OpenAI organizations require multi-factor authentication

    Console access is what mints and reads API keys, so a password-only account is the shortest path to a durable credential for your models and, through those keys, to any data your prompts carry. Because usage is billed, a compromised organization also produces immediate financial loss through model abuse before the intrusion is even noticed.
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

        if organization.mfa_required:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} requires "
                f"multi-factor authentication."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} does not require "
                f"multi-factor authentication."
            )

        findings.append(report)
        return findings
