from typing import List

from apexhub.lib.check.models import Check, CheckReportVercel
from apexhub.providers.vercel.services.project.project_client import project_client


class project_firewall_enabled(Check):
    """Vercel projects have the firewall enabled

    With the firewall disabled, every request reaches the application's serverless functions directly, so abusive traffic is billed and executed rather than dropped at the edge. Application-layer attacks — credential stuffing against a login route, scraping, or a request flood — become both a security incident and an uncapped cost event, and the WAF rules configured at team level do nothing for that p
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

            enabled = project.firewall_enabled

            if enabled is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.name} firewall state could not be read; the token "
                    f"may lack the required scope or the plan may not include it."
                )
            elif enabled:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.name} has the firewall enabled."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.name} does not have the firewall enabled."
                )

            findings.append(report)

        return findings
