from typing import List

from apexhub.lib.check.models import Check, CheckReportGitLab
from apexhub.providers.gitlab.services.group.group_client import group_client


class gitlab_group_two_factor_authentication_required(Check):
    """GitLab groups require two-factor authentication

    Source control is a primary target for credential stuffing, because a single valid password grants the ability to modify code that is automatically built and deployed. Without enforced 2FA, one reused developer password compromises the group's repositories, CI variables and package registry, and the attacker's activity is indistinguishable from the legitimate user's.
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

            grace = group.two_factor_grace_period

            if not group.require_two_factor_authentication:
                report.status = "FAIL"
                report.status_extended = (
                    f"Group {group.full_path} does not require two-factor authentication."
                )
            elif grace is not None and grace > 24:
                report.status = "FAIL"
                report.status_extended = (
                    f"Group {group.full_path} requires two-factor authentication but "
                    f"allows a grace period of {grace} hours."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Group {group.full_path} requires two-factor authentication."
                )

            findings.append(report)

        return findings
