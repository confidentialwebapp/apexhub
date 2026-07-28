from typing import List

from apexhub.lib.check.models import Check, CheckReportAtlassian
from apexhub.providers.atlassian.services.confluence.confluence_client import confluence_client


class atlassian_confluence_no_anonymous_access(Check):
    """Confluence spaces grant no permissions to anonymous users

    Confluence is where organisations keep runbooks, architecture diagrams, onboarding guides and credentials pasted 'temporarily' into a setup page. An anonymously readable space therefore hands an attacker a curated map of your systems and, frequently, working credentials — with no exploitation required and no authentication event to detect.
    """

    def execute(self) -> List[CheckReportAtlassian]:
        findings = []
        for space in confluence_client.spaces.values():
            if space.status != "current":
                continue

            report = CheckReportAtlassian(
                metadata=self.metadata(),
                resource=space,
                resource_name=f"{space.key} ({space.name})",
                resource_id=space.id,
            )

            if space.anonymous_permissions:
                unique = sorted(set(space.anonymous_permissions))
                report.status = "FAIL"
                report.status_extended = (
                    f"Confluence space {space.key} grants {len(unique)} permission(s) to "
                    f"anonymous users: {', '.join(unique)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Confluence space {space.key} grants no permissions to anonymous "
                    f"users."
                )

            findings.append(report)

        return findings
