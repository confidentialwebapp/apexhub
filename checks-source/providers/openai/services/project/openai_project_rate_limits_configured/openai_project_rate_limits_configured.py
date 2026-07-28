from typing import List

from apexhub.lib.check.models import Check, CheckReportOpenAI
from apexhub.providers.openai.services.project.project_client import project_client


class openai_project_rate_limits_configured(Check):
    """OpenAI projects define per-project rate limits

    Without per-project limits, a leaked key or a runaway retry loop consumes the entire organization's quota and budget, taking every other project down with it — a denial of service against your own production traffic. Uncapped spend on a stolen key also converts a credential leak directly into unbounded financial loss.
    """

    def execute(self) -> List[CheckReportOpenAI]:
        findings = []
        for project in project_client.projects.values():
            if project.status != "active":
                continue

            report = CheckReportOpenAI(
                metadata=self.metadata(),
                resource=project,
                resource_name=project.name or project.id,
                resource_id=project.id,
            )

            if project.rate_limits_configured:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.name or project.id} defines per-project rate limits."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.name or project.id} defines no per-project rate "
                    f"limits and can consume the organization's full quota."
                )

            findings.append(report)

        return findings
