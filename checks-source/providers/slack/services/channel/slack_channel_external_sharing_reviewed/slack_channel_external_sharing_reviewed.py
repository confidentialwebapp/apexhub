from typing import List

from apexhub.lib.check.models import Check, CheckReportSlack
from apexhub.providers.slack.services.channel.channel_client import channel_client


class slack_channel_external_sharing_reviewed(Check):
    """Slack channels shared externally are private and actively used

    An externally shared channel gives another organisation's members a live view into your workspace, and when the channel is also public internally, anyone who joins it — including a newly compromised account — is exposed to that external party. Forgotten Connect channels from ended engagements are the common case: the counterparty retains access long after the commercial relationship stops.
    """

    def execute(self) -> List[CheckReportSlack]:
        findings = []
        for channel in channel_client.channels.values():
            if not (channel.is_ext_shared or channel.is_shared):
                continue
            if channel.is_archived:
                continue

            report = CheckReportSlack(
                metadata=self.metadata(),
                resource=channel,
                resource_name=channel.name or channel.id,
                resource_id=channel.id,
            )

            issues = []
            if channel.is_ext_shared and not channel.is_private:
                issues.append("is shared externally but public within the workspace")
            if channel.num_members == 0:
                issues.append("has no members but remains connected")

            if issues:
                report.status = "FAIL"
                report.status_extended = (
                    f"Channel #{channel.name} {' and '.join(issues)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Channel #{channel.name} is externally shared, private, and has "
                    f"{channel.num_members} member(s)."
                )

            findings.append(report)

        return findings
