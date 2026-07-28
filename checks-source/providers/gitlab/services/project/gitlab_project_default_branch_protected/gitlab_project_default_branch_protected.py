from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.project.project_client import project_client


class gitlab_project_default_branch_protected(Check):
    """GitLab project default branches are protected

    An unprotected default branch lets any project member push directly to the branch that triggers production pipelines, bypassing merge request review entirely. It also permits force pushes that rewrite history, which can quietly remove a malicious commit from the log after it has already been built and deployed.
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

            default_branch = project.default_branch
            if not default_branch:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.path_with_namespace} has no default branch to protect."
                )
                findings.append(report)
                continue

            protection = next(
                (
                    branch
                    for branch in project.protected_branches
                    if branch.name == default_branch or branch.name == "*"
                ),
                None,
            )

            if protection and not protection.allow_force_push:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.path_with_namespace} protects its default branch "
                    f"{default_branch} and force push is disabled."
                )
            elif protection:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} protects its default branch "
                    f"{default_branch} but force push is allowed."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} does not protect its default "
                    f"branch {default_branch}."
                )

            findings.append(report)

        return findings
