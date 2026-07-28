from typing import List

from apexhub.lib.check.models import Check, CheckReportGithub
from apexhub.providers.github.services.security.security_client import security_client


class security_secret_scanning_push_protection_enabled(Check):
    """GitHub organizations enable secret scanning push protection by default

    Secret scanning alone reports a credential after it has already been pushed, at which point it exists in every clone, fork and CI cache — and on a public repository, automated harvesters typically find it within seconds. Push protection is the only control that prevents the exposure rather than reporting it, which is the difference between a warning and a mandatory credential rotation.
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

            scanning = org.secret_scanning_enabled
            push_protection = org.secret_scanning_push_protection

            if scanning is None and push_protection is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {org.name} secret scanning settings could not be read; "
                    f"the token needs organization owner scope to assess them."
                )
            elif scanning and push_protection:
                report.status = "PASS"
                report.status_extended = (
                    f"Organization {org.name} enables secret scanning and push protection "
                    f"for new repositories."
                )
            elif scanning:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {org.name} enables secret scanning but not push "
                    f"protection, so credentials are detected only after they are pushed."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Organization {org.name} does not enable secret scanning for new "
                    f"repositories."
                )

            findings.append(report)

        return findings
