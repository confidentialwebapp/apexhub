from typing import List

from apexhub.lib.check.models import Check, CheckReportBitbucket
from apexhub.providers.bitbucket.services.workspace.workspace_client import workspace_client


class bitbucket_workspace_no_inactive_admins(Check):
    """Bitbucket workspaces have no inactive administrator accounts

    An inactive account retaining owner permission is an orphaned administrative path: nobody monitors it, its password may never be rotated, and reactivating it — through account recovery or an IdP mistake — silently restores full workspace control. Offboarding processes that only disable the identity provider entry frequently leave this Bitbucket-side grant in place.
    """

    def execute(self) -> List[CheckReportBitbucket]:
        findings = []
        for workspace in workspace_client.workspaces.values():
            admins = [
                member
                for member in workspace.members
                if member.permission in ("owner", "admin")
            ]

            for member in admins:
                report = CheckReportBitbucket(
                    metadata=self.metadata(),
                    resource=member,
                    resource_name=f"{workspace.slug}/{member.display_name or member.uuid}",
                    resource_id=member.uuid,
                )

                if member.account_status == "active":
                    report.status = "PASS"
                    report.status_extended = (
                        f"Workspace {workspace.slug} administrator "
                        f"{member.display_name or member.uuid} has an active account."
                    )
                else:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Workspace {workspace.slug} administrator "
                        f"{member.display_name or member.uuid} has account status "
                        f"'{member.account_status}' but still holds "
                        f"{member.permission} permission."
                    )

                findings.append(report)

        return findings
