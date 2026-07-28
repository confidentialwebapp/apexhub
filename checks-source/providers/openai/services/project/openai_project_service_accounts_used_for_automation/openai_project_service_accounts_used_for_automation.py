from typing import List

from apexhub.lib.check.models import Check, CheckReportOpenAI
from apexhub.providers.openai.services.project.project_client import project_client


class openai_project_service_accounts_used_for_automation(Check):
    """OpenAI projects use service accounts for automated workloads

    When production traffic runs on a personal API key, removing that person from the organization breaks production, so offboarding is quietly skipped and their access persists. Attribution also breaks down: every request in the audit log appears to come from an individual who may have had nothing to do with the workload.
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

            if project.service_accounts:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.name or project.id} has "
                    f"{len(project.service_accounts)} service account(s) for automation."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.name or project.id} has no service account; "
                    f"automation is running on user-owned keys."
                )

            findings.append(report)

        return findings
