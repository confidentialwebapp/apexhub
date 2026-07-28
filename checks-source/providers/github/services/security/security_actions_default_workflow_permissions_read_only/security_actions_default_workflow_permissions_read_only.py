from typing import List

from apexhub.lib.check.models import Check, CheckReportGithub
from apexhub.providers.github.services.security.security_client import security_client


class security_actions_default_workflow_permissions_read_only(Check):
    """GitHub Actions workflows default to read-only token permissions

    A write-scoped default token lets any workflow push commits, publish packages and modify releases, so a compromised action from the marketplace — or a malicious pull request in a repository that runs workflows on `pull_request_target` — inherits repository write access automatically. Allowing workflows to approve pull requests additionally lets automation satisfy the review requirement that branch
    """

    def execute(self) -> List[CheckReportGithub]:
        findings = []
        for org in security_client.organizations.values():
            report = CheckReportGithub(
                metadata=self.metadata(),
                resource=org,
                resource_name=org.name,
                resource_id=str(org.id),
            )

            issues = []
            if (org.default_workflow_permissions or "write").lower() != "read":
                issues.append(
                    f"default workflow permissions are "
                    f"'{org.default_workflow_permissions}'"
                )
            if org.can_approve_pull_request_reviews:
                issues.append("workflows are allowed to approve pull requests")

            if issues:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {org.name}: {'; '.join(issues)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Organization {org.name} defaults Actions workflows to read-only "
                    f"token permissions and disallows workflow approvals."
                )

            findings.append(report)

        return findings
