from typing import List

from apexhub.lib.check.models import Check, CheckReportAtlassian
from apexhub.providers.atlassian.services.organization.organization_client import organization_client


class atlassian_organization_two_step_verification_required(Check):
    """Atlassian authentication policies require two-step verification

    Where SSO is not enforced for a policy, the accounts it covers are protected by a password alone against an internet-facing login endpoint. Atlassian credentials are heavily targeted precisely because Jira and Confluence describe the organisation's systems, unpatched vulnerabilities and operational procedures in detail — valuable reconnaissance for a follow-on intrusion.
    """

    def execute(self) -> List[CheckReportAtlassian]:
        findings = []
        organization = organization_client.organization
        if organization is None:
            return findings

        for policy in organization.authentication_policies:
            if policy.status.lower() != "enabled":
                continue

            report = CheckReportAtlassian(
                metadata=self.metadata(),
                resource=policy,
                resource_name=policy.name or policy.id,
                resource_id=policy.id,
            )

            # SSO delegates the factor policy to the identity provider.
            if policy.two_step_required or policy.sso_enforced:
                report.status = "PASS"
                report.status_extended = (
                    f"Authentication policy {policy.name or policy.id} requires two-step "
                    f"verification"
                    f"{' through the federated identity provider' if not policy.two_step_required else ''}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Authentication policy {policy.name or policy.id} does not require "
                    f"two-step verification."
                )

            findings.append(report)

        return findings
