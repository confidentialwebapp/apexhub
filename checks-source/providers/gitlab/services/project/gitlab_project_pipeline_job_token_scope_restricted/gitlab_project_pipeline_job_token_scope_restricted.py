from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.project.project_client import project_client


class gitlab_project_pipeline_job_token_scope_restricted(Check):
    """GitLab CI job token scope is restricted to an allowlist

    With job token scope unrestricted, a pipeline in any project can present its `CI_JOB_TOKEN` to this project's API and read its repository, packages and registry. A single low-value project with a permissive `.gitlab-ci.yml` becomes a pivot into every other repository its members can access — a well-worn lateral movement path in CI supply chain attacks.
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

            if project.job_token_inbound_enabled:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.path_with_namespace} restricts CI job token access "
                    f"to an allowlist of projects."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} allows any project's CI job "
                    f"token to access it."
                )

            findings.append(report)

        return findings
