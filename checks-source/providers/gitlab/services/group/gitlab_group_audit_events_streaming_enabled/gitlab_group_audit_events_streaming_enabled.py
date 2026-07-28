from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.group.group_client import group_client


class gitlab_group_audit_events_streaming_enabled(Check):
    """GitLab groups stream audit events to an external destination

    Audit events held only inside GitLab are subject to retention limits and, more importantly, are visible to the same administrators whose actions they record. An attacker who reaches owner privileges can alter group configuration and let the in-product record age out, leaving no independent evidence for incident reconstruction.
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

            if group.audit_streaming_destinations:
                report.status = "PASS"
                report.status_extended = (
                    f"Group {group.full_path} streams audit events to "
                    f"{len(group.audit_streaming_destinations)} external destination(s)."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Group {group.full_path} does not stream audit events to an external "
                    f"destination."
                )

            findings.append(report)

        return findings
