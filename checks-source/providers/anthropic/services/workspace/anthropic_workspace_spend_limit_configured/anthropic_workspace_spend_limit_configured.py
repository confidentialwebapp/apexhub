from typing import List

from apexhub.lib.check.models import Check, CheckReportAnthropic
from apexhub.providers.anthropic.services.workspace.workspace_client import workspace_client


class anthropic_workspace_spend_limit_configured(Check):
    """Anthropic workspaces define a spend limit

    An uncapped workspace turns a leaked API key directly into unbounded financial loss, and heavy abuse traffic also consumes the rate capacity your production workloads depend on. A per-workspace limit converts both into a bounded, self-announcing failure: spend stops and the anomaly becomes visible.
    """

    def execute(self) -> List[CheckReportAnthropic]:
        findings = []
        for workspace in workspace_client.workspaces.values():
            if workspace.archived_at:
                continue

            report = CheckReportAnthropic(
                metadata=self.metadata(),
                resource=workspace,
                resource_name=workspace.name or workspace.id,
                resource_id=workspace.id,
            )

            limit = workspace.spend_limit_usd

            if limit is not None and limit > 0:
                report.status = "PASS"
                report.status_extended = (
                    f"Workspace {workspace.name or workspace.id} has a spend limit of "
                    f"{limit:.2f} USD."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Workspace {workspace.name or workspace.id} has no spend limit "
                    f"configured."
                )

            findings.append(report)

        return findings
