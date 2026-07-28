from typing import List

from apexhub.lib.check.models import Check, CheckReportAnthropic
from apexhub.providers.anthropic.services.organization.organization_client import organization_client


class anthropic_organization_mfa_required(Check):
    """Anthropic organizations require multi-factor authentication

    A password-only console account gives an attacker the ability to mint API keys and add workspace members, establishing persistence that survives a password reset. Because usage is metered, a compromised organization also produces immediate financial loss and exposes whatever data the organization's prompts carry.
    """

    def execute(self) -> List[CheckReportAnthropic]:
        findings = []
        organization = organization_client.organization
        if organization is None:
            return findings

        report = CheckReportAnthropic(
            metadata=self.metadata(),
            resource=organization,
            resource_name=organization.name or organization.id,
            resource_id=organization.id,
        )

        # SSO delegates the factor policy to the identity provider.
        if organization.mfa_required or organization.sso_enforced:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} requires "
                f"multi-factor authentication"
                f"{' through the federated identity provider' if not organization.mfa_required else ''}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} does not require "
                f"multi-factor authentication."
            )

        findings.append(report)
        return findings
