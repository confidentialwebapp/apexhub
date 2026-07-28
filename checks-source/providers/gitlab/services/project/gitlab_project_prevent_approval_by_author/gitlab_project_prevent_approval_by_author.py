from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.project.project_client import project_client


class gitlab_project_prevent_approval_by_author(Check):
    """GitLab projects prevent merge request authors from approving their own changes

    If authors may approve their own merge requests, a required-approvals rule becomes decorative: one account both writes and admits the change, and the audit trail shows a satisfied review that never happened. An attacker holding a single developer credential can push code to production unreviewed while appearing compliant.
    """

    def execute(self) -> List[CheckReportGitLab]:
        findings = []
        for project in project_client.projects.values():
            if project.archived:
                continue

            report = CheckReportGitLab(
                metadata=self.metadata(),
                resource=project,
                resource_name=project.path_with_namespace,
                resource_id=project.id,
            )

            approvals = project.approvals
            if approvals is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} approval settings could not be "
                    f"retrieved; self-approval cannot be confirmed as disabled."
                )
                findings.append(report)
                continue

            if not approvals.merge_requests_author_approval:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.path_with_namespace} prevents merge request authors "
                    f"from approving their own changes."
                )
                if not approvals.merge_requests_disable_committers_approval:
                    report.status_extended += (
                        " Users who add commits are still allowed to approve."
                    )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} allows merge request authors to "
                    f"approve their own changes."
                )

            findings.append(report)

        return findings
