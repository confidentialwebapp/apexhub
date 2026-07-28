from typing import List

from apexhub.lib.check.models import Check, CheckReportAtlassian
from apexhub.providers.atlassian.services.jira.jira_client import jira_client


class atlassian_jira_no_anonymous_access(Check):
    """Jira projects grant no permissions to anonymous users

    Anonymous Jira access exposes the issue tracker to the internet, and issue tracking is where organisations record unpatched vulnerabilities, internal hostnames, credentials pasted into comments and the exact sequence of steps that reproduce a bug. Attackers actively search for open Jira instances precisely because they describe the target's weaknesses in the defenders' own words.
    """

    def execute(self) -> List[CheckReportAtlassian]:
        findings = []
        for project in jira_client.projects.values():
            report = CheckReportAtlassian(
                metadata=self.metadata(),
                resource=project,
                resource_name=f"{project.key} ({project.name})",
                resource_id=project.id,
            )

            if project.anonymous_grants:
                unique_grants = sorted(set(project.anonymous_grants))
                report.status = "FAIL"
                report.status_extended = (
                    f"Jira project {project.key} grants {len(unique_grants)} permission(s) "
                    f"to anonymous users: {', '.join(unique_grants)}."
                )
            elif not project.is_private:
                report.status = "FAIL"
                report.status_extended = (
                    f"Jira project {project.key} is not marked private."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Jira project {project.key} grants no permissions to anonymous users."
                )

            findings.append(report)

        return findings
