from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.group.group_client import group_client


class gitlab_group_ip_restriction_enabled(Check):
    """GitLab groups restrict access by IP address range

    Without an IP allowlist, a stolen personal access token is usable from anywhere in the world, and token theft leaves no authentication trail to alert on. Network-level scoping turns an exfiltrated credential into a much weaker artifact, because it must also be replayed from inside an approved network range.
    """

    def execute(self) -> List[CheckReportGitLab]:
        findings = []
        for group in group_client.groups.values():
            report = CheckReportGitLab(
                metadata=self.metadata(),
                resource=group,
                resource_name=group.full_path,
                resource_id=group.id,
            )

            if group.ip_restriction_ranges:
                report.status = "PASS"
                report.status_extended = (
                    f"Group {group.full_path} restricts access to "
                    f"{len(group.ip_restriction_ranges)} IP range(s): "
                    f"{', '.join(group.ip_restriction_ranges)}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Group {group.full_path} does not restrict access by IP address range."
                )

            findings.append(report)

        return findings
