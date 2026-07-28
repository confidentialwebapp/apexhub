from typing import List

from apexhub.lib.check.models import Check, CheckReportGithub
from apexhub.providers.github.services.security.security_client import security_client


class security_dependabot_alerts_enabled_by_default(Check):
    """GitHub organizations enable Dependabot alerts for new repositories

    Vulnerable transitive dependencies are the most common route into an application's supply chain, and they are invisible without automated alerting because nobody reads a lockfile. Where alerting is opt-in per repository, coverage decays as new repositories are created, so the repositories least likely to be monitored are the newest and least reviewed ones.
    """

    def execute(self) -> List[CheckReportGithub]:
        findings = []
        for org in security_client.organizations.values():
            report = CheckReportGithub(
                metadata=self.metadata(),
                resource=org,
                resource_name=org.name,
                resource_id=str(org.id),
            )

            enabled = org.dependabot_alerts_enabled

            if enabled is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {org.name} Dependabot settings could not be read; the "
                    f"token needs organization owner scope to assess them."
                )
            elif enabled:
                report.status = "PASS"
                report.status_extended = (
                    f"Organization {org.name} enables Dependabot alerts for new "
                    f"repositories."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {org.name} does not enable Dependabot alerts for new "
                    f"repositories."
                )

            findings.append(report)

        return findings
