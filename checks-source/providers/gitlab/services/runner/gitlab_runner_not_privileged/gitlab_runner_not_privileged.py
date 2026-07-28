from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.runner.runner_client import runner_client


class gitlab_runner_not_privileged(Check):
    """GitLab runners do not execute jobs in privileged containers

    A privileged container is not a security boundary: any job can mount the host filesystem, reach the Docker socket and read the build caches, registry credentials and job tokens of every other project that shares the runner. A single untrusted merge request pipeline therefore escalates to full compromise of the runner host and lateral access across tenants.
    """

    def execute(self) -> List[CheckReportGitLab]:
        findings = []
        for runner in runner_client.runners.values():
            report = CheckReportGitLab(
                metadata=self.metadata(),
                resource=runner,
                resource_name=runner.description or f"runner-{runner.id}",
                resource_id=runner.id,
            )

            if runner.privileged:
                report.status = "FAIL"
                scope = "shared" if runner.is_shared else runner.runner_type
                report.status_extended = (
                    f"Runner {runner.description or runner.id} ({scope}) executes jobs in "
                    f"privileged containers."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Runner {runner.description or runner.id} does not execute jobs in "
                    f"privileged containers."
                )

            findings.append(report)

        return findings
