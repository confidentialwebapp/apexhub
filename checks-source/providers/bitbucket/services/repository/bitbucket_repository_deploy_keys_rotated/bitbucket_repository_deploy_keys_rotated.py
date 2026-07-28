from typing import List

from apexhub.lib.check.models import Check, CheckReportBitbucket
from apexhub.providers.bitbucket.services.repository.repository_client import repository_client


class bitbucket_repository_deploy_keys_rotated(Check):
    """Bitbucket repository deploy keys are in active use and rotated

    A deploy key does not expire, is not tied to a person, and survives the offboarding of whoever created it. An unused key is therefore a standing credential with no owner — if the private half was copied to a developer laptop or a decommissioned CI host, it stays valid indefinitely and its use is difficult to attribute during an investigation.
    """

    def execute(self) -> List[CheckReportBitbucket]:
        from datetime import datetime, timedelta, timezone

        max_idle_days = self.audit_config.get("max_deploy_key_idle_days", 90)
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_idle_days)

        findings = []
        for repo in repository_client.repositories.values():
            for key in repo.deploy_keys:
                report = CheckReportBitbucket(
                    metadata=self.metadata(),
                    resource=key,
                    resource_name=f"{repo.full_name}/{key.label or key.id}",
                    resource_id=key.id,
                )

                if not key.last_used:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Deploy key {key.label or key.id} on repository {repo.full_name} "
                        f"has never been used."
                    )
                    findings.append(report)
                    continue

                try:
                    last_used = datetime.fromisoformat(key.last_used.replace("Z", "+00:00"))
                except ValueError:
                    last_used = None

                if last_used is None:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Deploy key {key.label or key.id} on repository {repo.full_name} "
                        f"has an unreadable last-used timestamp."
                    )
                elif last_used < cutoff:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Deploy key {key.label or key.id} on repository {repo.full_name} "
                        f"has not been used since {last_used.date()} "
                        f"(threshold {max_idle_days} days)."
                    )
                else:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Deploy key {key.label or key.id} on repository {repo.full_name} "
                        f"was last used on {last_used.date()}."
                    )

                findings.append(report)

        return findings
