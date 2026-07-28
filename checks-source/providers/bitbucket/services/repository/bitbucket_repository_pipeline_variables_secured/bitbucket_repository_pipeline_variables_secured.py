from typing import List

from apexhub.lib.check.models import Check, CheckReportBitbucket
from apexhub.providers.bitbucket.services.repository.repository_client import repository_client


class bitbucket_repository_pipeline_variables_secured(Check):
    """Bitbucket Pipelines variables holding credentials are secured

    An unsecured variable is readable in the repository settings by every user with write access and is printed verbatim into build logs by any step that dumps its environment. Build logs are retained and widely readable, so an unsecured deployment credential is effectively published to the whole workspace.
    """

    def execute(self) -> List[CheckReportBitbucket]:
        SECRET_HINTS = (
            "secret",
            "token",
            "password",
            "passwd",
            "apikey",
            "api_key",
            "private_key",
            "credential",
            "access_key",
        )

        findings = []
        for repo in repository_client.repositories.values():
            for variable in repo.pipeline_variables:
                key_lower = variable.key.lower()
                if not any(hint in key_lower for hint in SECRET_HINTS):
                    continue

                report = CheckReportBitbucket(
                    metadata=self.metadata(),
                    resource=variable,
                    resource_name=f"{repo.full_name}/{variable.key}",
                    resource_id=variable.uuid,
                )

                if variable.secured:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Pipeline variable {variable.key} in repository {repo.full_name} "
                        f"is secured."
                    )
                else:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Pipeline variable {variable.key} in repository {repo.full_name} "
                        f"appears to hold a credential but is not secured."
                    )

                findings.append(report)

        return findings
