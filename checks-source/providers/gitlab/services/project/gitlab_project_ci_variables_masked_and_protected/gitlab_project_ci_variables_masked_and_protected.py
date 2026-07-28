from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.project.project_client import project_client


class gitlab_project_ci_variables_masked_and_protected(Check):
    """GitLab CI/CD variables are masked and protected

    An unmasked variable is printed verbatim into job logs by any command that echoes its environment, and those logs are readable by every project member and often retained indefinitely. An unprotected variable is injected into pipelines on any branch, so anyone who can open a merge request can add a job that prints or exfiltrates the deployment credential.
    """

    def execute(self) -> List[CheckReportGitLab]:
        findings = []
        for project in project_client.projects.values():
            if project.archived or not project.ci_variables:
                continue

            for variable in project.ci_variables:
                report = CheckReportGitLab(
                    metadata=self.metadata(),
                    resource=variable,
                    resource_name=f"{project.path_with_namespace}/{variable.key}",
                    resource_id=f"{project.id}:{variable.key}",
                )

                if variable.masked and variable.protected:
                    report.status = "PASS"
                    report.status_extended = (
                        f"CI/CD variable {variable.key} in project "
                        f"{project.path_with_namespace} is masked and protected."
                    )
                else:
                    missing = []
                    if not variable.masked:
                        missing.append("not masked")
                    if not variable.protected:
                        missing.append("not protected")
                    report.status = "FAIL"
                    report.status_extended = (
                        f"CI/CD variable {variable.key} in project "
                        f"{project.path_with_namespace} is {' and '.join(missing)}."
                    )

                findings.append(report)

        return findings
