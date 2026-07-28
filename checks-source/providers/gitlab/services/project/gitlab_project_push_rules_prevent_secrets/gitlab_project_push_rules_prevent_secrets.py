from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.project.project_client import project_client


class gitlab_project_push_rules_prevent_secrets(Check):
    """GitLab projects reject commits containing secrets

    Once a credential is committed it exists in the git history of every clone and fork, and rewriting history does not recall the copies already pulled by CI runners, mirrors and developer machines. Treating the secret as compromised and rotating it is the only real remedy, so preventing the push is materially cheaper than detecting it afterwards.
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

            rules = project.push_rules
            if rules and rules.prevent_secrets:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.path_with_namespace} rejects pushes containing "
                    f"secret files."
                )
            elif rules:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} has push rules configured but "
                    f"does not reject pushes containing secret files."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} has no push rules configured."
                )

            findings.append(report)

        return findings
