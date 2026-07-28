from typing import List

from apexhub.lib.check.models import Check, CheckReportAnthropic
from apexhub.providers.anthropic.services.apikey.apikey_client import apikey_client
from apexhub.providers.anthropic.services.workspace.workspace_client import workspace_client


class anthropic_apikey_scoped_to_workspace(Check):
    """Anthropic API keys are scoped to a workspace

    A key that is not workspace-scoped draws against the organization's shared limits, so its compromise degrades every other workload rather than only its own. It also loses the isolation that makes revocation safe: without a workspace boundary, there is no way to disable one workload's access without assessing the impact on all of them.
    """

    def execute(self) -> List[CheckReportAnthropic]:
        findings = []
        for key in apikey_client.keys.values():
            if key.status != "active":
                continue

            report = CheckReportAnthropic(
                metadata=self.metadata(),
                resource=key,
                resource_name=key.name or key.id,
                resource_id=key.id,
            )

            workspace = (
                workspace_client.workspaces.get(key.workspace_id)
                if key.workspace_id
                else None
            )

            if key.workspace_id and workspace is not None:
                report.status = "PASS"
                report.status_extended = (
                    f"API key {key.name or key.id} is scoped to workspace "
                    f"{workspace.name or key.workspace_id}."
                )
            elif key.workspace_id:
                report.status = "PASS"
                report.status_extended = (
                    f"API key {key.name or key.id} is scoped to workspace "
                    f"{key.workspace_id}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"API key {key.name or key.id} is not scoped to a workspace and draws "
                    f"against organization-wide limits."
                )

            findings.append(report)

        return findings
