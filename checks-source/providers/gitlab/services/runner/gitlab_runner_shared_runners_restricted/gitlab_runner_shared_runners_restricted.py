from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.runner.runner_client import runner_client


class gitlab_runner_shared_runners_restricted(Check):
    """GitLab shared runners are locked and do not run untagged jobs

    When a runner accepts untagged jobs from any project, an attacker who can open a merge request in the least protected project in the group can land a job on the same executor used by production pipelines. Build caches, mounted volumes and leftover credentials on that host then become reachable across trust boundaries that the project permissions imply are separate.
    """

    def execute(self) -> List[CheckReportGitLab]:
        findings = []
        for runner in runner_client.runners.values():
            if not runner.is_shared:
                continue

            report = CheckReportGitLab(
                metadata=self.metadata(),
                resource=runner,
                resource_name=runner.description or f"runner-{runner.id}",
                resource_id=runner.id,
            )

            issues = []
            if runner.run_untagged:
                issues.append("runs untagged jobs")
            if not runner.locked:
                issues.append("is not locked to its current projects")

            if issues:
                report.status = "FAIL"
                report.status_extended = (
                    f"Shared runner {runner.description or runner.id} "
                    f"{' and '.join(issues)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Shared runner {runner.description or runner.id} is locked to its "
                    f"current projects and requires tagged jobs."
                )

            findings.append(report)

        return findings
