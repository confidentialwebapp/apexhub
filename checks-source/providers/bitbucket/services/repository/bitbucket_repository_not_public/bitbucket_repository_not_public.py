from typing import List

from apexhub.lib.check.models import Check, CheckReportBitbucket
from apexhub.providers.bitbucket.services.repository.repository_client import repository_client


class bitbucket_repository_not_public(Check):
    """Bitbucket repositories are private

    Public repositories are continuously indexed by automated credential scanners, so a key committed to one is typically harvested within minutes of the push. Beyond source, the exposed pull request and issue history reveals internal service names, infrastructure detail and contributor identities that support targeted phishing.
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

            if repo.is_private:
                report.status = "PASS"
                report.status_extended = f"Repository {repo.full_name} is private."
                if repo.fork_policy == "allow_forks":
                    report.status_extended += " Public forks are allowed."
            else:
                report.status = "FAIL"
                report.status_extended = f"Repository {repo.full_name} is publicly accessible."

            findings.append(report)

        return findings
