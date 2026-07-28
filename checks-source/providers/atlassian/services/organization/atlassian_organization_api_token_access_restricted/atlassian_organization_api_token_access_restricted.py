from typing import List

from apexhub.lib.check.models import Check, CheckReportAtlassian
from apexhub.providers.atlassian.services.organization.organization_client import organization_client


class atlassian_organization_api_token_access_restricted(Check):
    """Atlassian authentication policies restrict API token creation

    An Atlassian API token bypasses SSO and two-step verification entirely — it is a bearer credential that authenticates directly to the REST API with the user's full permissions. That makes unrestricted token creation a standing hole in whatever authentication policy you have configured, and tokens created by a user persist after their session is revoked.
    """

    def execute(self) -> List[CheckReportAtlassian]:
        RESTRICTED = {"blocked", "restricted", "disabled", "expiry_required"}

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

            access = (policy.api_token_access or "unrestricted").lower()

            if access in RESTRICTED:
                report.status = "PASS"
                report.status_extended = (
                    f"Authentication policy {policy.name or policy.id} sets API token "
                    f"access to '{access}'."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Authentication policy {policy.name or policy.id} allows unrestricted "
                    f"API token creation, which bypasses SSO and two-step verification."
                )

            findings.append(report)

        return findings
