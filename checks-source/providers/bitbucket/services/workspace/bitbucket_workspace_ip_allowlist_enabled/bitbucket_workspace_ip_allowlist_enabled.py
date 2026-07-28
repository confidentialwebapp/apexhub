from typing import List

from apexhub.lib.check.models import Check, CheckReportBitbucket
from apexhub.providers.bitbucket.services.workspace.workspace_client import workspace_client


class bitbucket_workspace_ip_allowlist_enabled(Check):
    """Bitbucket workspaces restrict access with an IP allowlist

    App passwords and access tokens are bearer credentials that work from any network, and their theft produces no failed-login signal to alert on. An IP allowlist forces a stolen token to be replayed from inside an approved range, which both blocks opportunistic use and narrows the set of hosts an investigation must consider.
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

            if workspace.ip_allowlist_enabled:
                report.status = "PASS"
                report.status_extended = (
                    f"Workspace {workspace.slug} restricts access with an IP allowlist."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Workspace {workspace.slug} does not restrict access with an IP allowlist."
                )

            findings.append(report)

        return findings
