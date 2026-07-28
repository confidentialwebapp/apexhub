from typing import List

from apexhub.lib.check.models import Check, CheckReportBitbucket
from apexhub.providers.bitbucket.services.workspace.workspace_client import workspace_client


class bitbucket_workspace_two_factor_enforced(Check):
    """Bitbucket workspaces enforce two-step verification

    Bitbucket credentials unlock source code and the pipelines that deploy it, making them a high-value target for credential stuffing against reused passwords. Without enforced two-step verification a single leaked password grants an attacker repository write access, and from there the ability to alter build definitions that run with production credentials.
    """

    def execute(self) -> List[CheckReportBitbucket]:
        findings = []
        for workspace in workspace_client.workspaces.values():
            report = CheckReportBitbucket(
                metadata=self.metadata(),
                resource=workspace,
                resource_name=workspace.slug,
                resource_id=workspace.uuid,
            )

            if workspace.enforced_two_factor:
                report.status = "PASS"
                report.status_extended = (
                    f"Workspace {workspace.slug} enforces two-step verification."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Workspace {workspace.slug} does not enforce two-step verification."
                )

            findings.append(report)

        return findings
