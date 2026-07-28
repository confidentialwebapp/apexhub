from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.project.project_client import project_client


class gitlab_project_merge_request_approvals_required(Check):
    """GitLab projects require merge request approvals

    Without a required approval, a single compromised or malicious account can author and merge a change on its own, introducing a backdoor or an exfiltrating build step into the pipeline with no second party ever seeing the diff. This removes the primary detective control over source code changes.
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

            required = max(
                project.approval_rule_minimum,
                project.approvals.approvals_required if project.approvals else 0,
            )

            if required >= 1:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.path_with_namespace} requires {required} merge "
                    f"request approval(s)."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} does not require any merge "
                    f"request approvals."
                )

            findings.append(report)

        return findings
