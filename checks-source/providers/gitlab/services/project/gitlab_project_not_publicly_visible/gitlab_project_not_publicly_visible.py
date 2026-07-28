from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.project.project_client import project_client


class gitlab_project_not_publicly_visible(Check):
    """GitLab projects are not publicly visible

    Public projects leak far more than source: job logs often contain internal hostnames and unmasked variable values, and the commit history exposes contributor identities and internal service names useful for reconnaissance. Public repositories are continuously scraped by automated credential harvesters, so an accidentally public project is typically enumerated within minutes.
    """

    def execute(self) -> List[CheckReportGitLab]:
        findings = []
        for project in project_client.projects.values():
            report = CheckReportGitLab(
                metadata=self.metadata(),
                resource=project,
                resource_name=project.path_with_namespace,
                resource_id=project.id,
            )

            if project.visibility == "public":
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.path_with_namespace} is publicly visible at "
                    f"{project.web_url}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.path_with_namespace} visibility is "
                    f"{project.visibility}."
                )

            findings.append(report)

        return findings
