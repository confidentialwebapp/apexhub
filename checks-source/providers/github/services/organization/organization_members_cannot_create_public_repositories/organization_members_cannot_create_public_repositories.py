from typing import List

from apexhub.lib.check.models import Check, CheckReportGithub
from apexhub.providers.github.services.organization.organization_client import organization_client


class organization_members_cannot_create_public_repositories(Check):
    """GitHub organization members cannot create public repositories

    When any member can create a public repository, internal code reaches the internet through ordinary mistakes rather than deliberate publication — a repository created public by default, or a prototype that was never meant to leave. Automated scrapers index new public repositories within minutes, so the exposure window is effectively zero and any credential inside must be treated as compromised.
    """

    def execute(self) -> List[CheckReportGithub]:
        findings = []
        for organization in organization_client.organizations:
            report = CheckReportGithub(
                metadata=self.metadata(),
                resource=organization,
                resource_name=organization.name,
                resource_id=str(organization.id),
            )

            allowed = organization.members_can_create_public_repositories

            if allowed is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {organization.name} repository creation settings could "
                    f"not be read; the token needs organization owner scope."
                )
            elif allowed:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {organization.name} allows members to create public "
                    f"repositories."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Organization {organization.name} does not allow members to create "
                    f"public repositories."
                )

            findings.append(report)

        return findings
