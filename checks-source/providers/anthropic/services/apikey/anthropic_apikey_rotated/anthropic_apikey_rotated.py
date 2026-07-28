from typing import List

from apexhub.lib.check.models import Check, CheckReportAnthropic
from apexhub.providers.anthropic.services.apikey.apikey_client import apikey_client


class anthropic_apikey_rotated(Check):
    """Anthropic API keys are rotated and inactive keys are removed

    Anthropic API keys do not expire, so a key committed to a repository or pasted into a chat stays valid until someone deletes it. Long-lived keys also accumulate copies across environments, which means a single rotation event cannot reliably retire the exposure — the only durable fix is a rotation schedule short enough to bound how long a leak remains useful.
    """

    def execute(self) -> List[CheckReportAnthropic]:
        from datetime import datetime, timedelta, timezone

        max_age_days = self.audit_config.get("max_api_key_age_days", 365)
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)

        findings = []
        for key in apikey_client.keys.values():
            report = CheckReportAnthropic(
                metadata=self.metadata(),
                resource=key,
                resource_name=key.name or key.id,
                resource_id=key.id,
            )

            if key.status != "active":
                report.status = "FAIL"
                report.status_extended = (
                    f"API key {key.name or key.id} has status '{key.status}' but has not "
                    f"been deleted from the organization."
                )
                findings.append(report)
                continue

            created = None
            if key.created_at:
                try:
                    created = datetime.fromisoformat(key.created_at.replace("Z", "+00:00"))
                except ValueError:
                    created = None

            if created is None:
                report.status = "FAIL"
                report.status_extended = (
                    f"API key {key.name or key.id} has no readable creation date, so its "
                    f"age cannot be confirmed."
                )
            elif created < cutoff:
                report.status = "FAIL"
                report.status_extended = (
                    f"API key {key.name or key.id} was created on {created.date()} and has "
                    f"not been rotated within {max_age_days} days."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"API key {key.name or key.id} was created on {created.date()}, within "
                    f"the {max_age_days} day rotation window."
                )

            findings.append(report)

        return findings
