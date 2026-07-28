from typing import List

from apexhub.lib.check.models import Check, CheckReportBitbucket
from apexhub.providers.bitbucket.services.repository.repository_client import repository_client


class bitbucket_repository_main_branch_restricted(Check):
    """Bitbucket repositories restrict direct pushes to the main branch

    An unrestricted main branch allows any user with write access to commit straight to the branch that drives deployment pipelines, with no pull request and no reviewer. It also permits branch deletion and history rewrites that destroy the evidence of what was actually built and shipped.
    """

    def execute(self) -> List[CheckReportBitbucket]:
        findings = []
        for repo in repository_client.repositories.values():
            report = CheckReportBitbucket(
                metadata=self.metadata(),
                resource=repo,
                resource_name=repo.full_name,
                resource_id=repo.uuid,
            )

            main = repo.main_branch
            if not main:
                report.status = "PASS"
                report.status_extended = (
                    f"Repository {repo.full_name} has no main branch to restrict."
                )
                findings.append(report)
                continue

            push_rules = [
                rule
                for rule in repo.branch_restrictions
                if rule.kind == "push" and rule.pattern in (main, "*", "production")
            ]

            if push_rules:
                report.status = "PASS"
                report.status_extended = (
                    f"Repository {repo.full_name} restricts direct pushes to {main}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Repository {repo.full_name} does not restrict direct pushes to {main}."
                )

            findings.append(report)

        return findings
