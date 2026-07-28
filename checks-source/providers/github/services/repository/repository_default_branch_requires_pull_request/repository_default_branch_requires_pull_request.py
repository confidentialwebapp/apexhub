from typing import List

from apexhub.lib.check.models import Check, CheckReportGithub
from apexhub.providers.github.services.repository.repository_client import repository_client


class repository_default_branch_requires_pull_request(Check):
    """GitHub default branches require a pull request before merging

    A protection rule that permits direct pushes makes the approval count, status checks and code owner requirements irrelevant, because a commit that never becomes a pull request never encounters them. The repository appears protected in the settings page while the primary control path can simply be bypassed with `git push`.
    """

    def execute(self) -> List[CheckReportGithub]:
        findings = []
        for repository in repository_client.repositories.values():
            if repository.archived:
                continue

            branch = repository.default_branch
            report = CheckReportGithub(
                metadata=self.metadata(),
                resource=repository,
                resource_name=repository.full_name,
                resource_id=str(repository.id),
            )

            if branch is None or branch.require_pull_request is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"Repository {repository.full_name} default branch protection could "
                    f"not be read; pull request enforcement cannot be confirmed."
                )
            elif branch.require_pull_request:
                report.status = "PASS"
                report.status_extended = (
                    f"Repository {repository.full_name} requires a pull request before "
                    f"merging into {branch.name}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Repository {repository.full_name} allows direct pushes to "
                    f"{branch.name} without a pull request."
                )

            findings.append(report)

        return findings
