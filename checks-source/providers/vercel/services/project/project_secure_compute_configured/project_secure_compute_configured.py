from typing import List

from apexhub.lib.check.models import Check, CheckReportVercel
from apexhub.providers.vercel.services.project.project_client import project_client


class project_secure_compute_configured(Check):
    """Vercel projects reaching private backends use Secure Compute

    Without dedicated egress, functions leave through a shared, rotating pool of addresses, so any database or internal API they reach must either be internet-exposed or allowlist a broad range that other Vercel customers also use. Both outcomes weaken the network boundary around the backend, and the second means an allowlist entry does not actually identify your application.
    """

    def execute(self) -> List[CheckReportVercel]:
        findings = []
        for project in project_client.projects.values():
            report = CheckReportVercel(
                metadata=self.metadata(),
                resource=project,
                resource_name=project.name,
                resource_id=project.id,
            )

            if project.secure_compute:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.name} uses Secure Compute with dedicated egress."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.name} does not use Secure Compute; its functions "
                    f"egress from a shared address pool."
                )

            findings.append(report)

        return findings
