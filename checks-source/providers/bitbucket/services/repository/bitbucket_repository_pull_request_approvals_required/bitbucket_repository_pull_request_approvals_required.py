from typing import List

from apexhub.lib.check.models import Check, CheckReportBitbucket
from apexhub.providers.bitbucket.services.repository.repository_client import repository_client


class bitbucket_repository_pull_request_approvals_required(Check):
    """Bitbucket repositories require pull request approvals before merge

    Without a required approval, a single account both authors and merges the change, so the pull request workflow records a review that never occurred. An attacker holding one developer credential can introduce a malicious build step or dependency and merge it immediately, defeating the primary control over what enters the release pipeline.
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

            approval_rules = [
                rule
                for rule in repo.branch_restrictions
                if rule.kind == "require_approvals_to_merge" and (rule.value or 0) >= 1
            ]

            if approval_rules:
                required = max(rule.value or 0 for rule in approval_rules)
                report.status = "PASS"
                report.status_extended = (
                    f"Repository {repo.full_name} requires {required} pull request "
                    f"approval(s) before merge."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Repository {repo.full_name} does not require pull request approvals "
                    f"before merge."
                )

            findings.append(report)

        return findings
