from typing import List

from apexhub.lib.check.models import Check, CheckReportVercel
from apexhub.providers.vercel.services.project.project_client import project_client


class project_bot_protection_enabled(Check):
    """Vercel projects enable bot protection

    Without bot filtering, automated traffic reaches the routes that cost the most to serve: login endpoints for credential stuffing, signup forms for fake account creation, and any AI or database-backed route where each request has real compute cost. Because Vercel bills on execution, unfiltered bot traffic is simultaneously a security and a billing exposure, and it obscures genuine user metrics.
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

            enabled = project.bot_id_enabled

            if enabled is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.name} bot protection state could not be read."
                )
            elif enabled:
                report.status = "PASS"
                report.status_extended = f"Project {project.name} has bot protection enabled."
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.name} does not have bot protection enabled."
                )

            findings.append(report)

        return findings
