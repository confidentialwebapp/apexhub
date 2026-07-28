from typing import List

from apexhub.lib.check.models import Check, CheckReportOpenAI
from apexhub.providers.openai.services.apikey.apikey_client import apikey_client


class openai_apikey_no_stale_keys(Check):
    """OpenAI API keys are rotated and unused keys are removed

    OpenAI API keys do not expire, so a key pasted into a notebook, a container image or a chat message stays valid until someone deletes it. Unused keys are the ones nobody will notice being used, and because billing is per-token, a stolen key produces cost and data exposure long before anyone connects the spend to a leak.
    """

    def execute(self) -> List[CheckReportOpenAI]:
        from datetime import datetime, timedelta, timezone

        max_idle_days = self.audit_config.get("max_api_key_idle_days", 90)
        max_age_days = self.audit_config.get("max_api_key_age_days", 365)
        now = datetime.now(timezone.utc)
        idle_cutoff = now - timedelta(days=max_idle_days)
        age_cutoff = now - timedelta(days=max_age_days)

        findings = []
        for key in apikey_client.keys.values():
            report = CheckReportOpenAI(
                metadata=self.metadata(),
                resource=key,
                resource_name=key.name or key.id,
                resource_id=key.id,
            )

            last_used = (
                datetime.fromtimestamp(key.last_used_at, tz=timezone.utc)
                if key.last_used_at
                else None
            )
            created = (
                datetime.fromtimestamp(key.created_at, tz=timezone.utc)
                if key.created_at
                else None
            )

            if last_used is None:
                report.status = "FAIL"
                report.status_extended = f"API key {key.name or key.id} has never been used."
            elif last_used < idle_cutoff:
                report.status = "FAIL"
                report.status_extended = (
                    f"API key {key.name or key.id} was last used on {last_used.date()} "
                    f"(threshold {max_idle_days} days)."
                )
            elif created is not None and created < age_cutoff:
                report.status = "FAIL"
                report.status_extended = (
                    f"API key {key.name or key.id} was created on {created.date()} and has "
                    f"not been rotated within {max_age_days} days."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"API key {key.name or key.id} was last used on {last_used.date()}."
                )

            findings.append(report)

        return findings
