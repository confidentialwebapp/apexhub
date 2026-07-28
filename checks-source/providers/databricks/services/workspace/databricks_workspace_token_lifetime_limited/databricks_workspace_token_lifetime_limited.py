from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.workspace.workspace_client import workspace_client


class databricks_workspace_token_lifetime_limited(Check):
    """Databricks personal access tokens have a bounded lifetime

    A personal access token with no expiry is a permanent credential carrying its owner's full workspace privileges, and it keeps working after that person changes role or leaves the company. These tokens accumulate in notebooks, CI configuration and local files, so an old leak stays exploitable indefinitely and its use is attributed to the original user rather than the attacker.
    """

    def execute(self) -> List[CheckReportDatabricks]:
        findings = []
        workspace = workspace_client.workspace
        if workspace is None:
            return findings

        max_lifetime = workspace.max_token_lifetime_days
        configured_cap = self.audit_config.get("max_token_lifetime_days", 90)

        report = CheckReportDatabricks(
            metadata=self.metadata(),
            resource=workspace,
            resource_name=workspace.host,
            resource_id=workspace.workspace_id or workspace.host,
        )

        never_expiring = [token for token in workspace.tokens if not token.expiry_time]

        if max_lifetime is not None and max_lifetime <= configured_cap and not never_expiring:
            report.status = "PASS"
            report.status_extended = (
                f"Workspace {workspace.host} caps token lifetime at {max_lifetime} day(s) "
                f"and has no non-expiring tokens."
            )
        elif max_lifetime is None:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.host} does not cap personal access token lifetime "
                f"({len(never_expiring)} token(s) never expire)."
            )
        elif never_expiring:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.host} caps token lifetime at {max_lifetime} day(s) "
                f"but {len(never_expiring)} existing token(s) never expire."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Workspace {workspace.host} caps token lifetime at {max_lifetime} day(s), "
                f"above the {configured_cap} day threshold."
            )

        findings.append(report)
        return findings
