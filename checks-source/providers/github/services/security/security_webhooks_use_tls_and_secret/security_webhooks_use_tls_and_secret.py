from typing import List

from apexhub.lib.check.models import Check, CheckReportGithub
from apexhub.providers.github.services.security.security_client import security_client


class security_webhooks_use_tls_and_secret(Check):
    """GitHub organization webhooks verify TLS and are signed with a secret

    Webhook payloads carry repository names, commit contents, branch references and sometimes tokens, so an unverified TLS connection exposes them to interception and lets an attacker impersonate GitHub to the receiver. Without a signing secret the receiver cannot distinguish a genuine GitHub delivery from a forged one, which turns any webhook-triggered deployment into an unauthenticated remote trigge
    """

    def execute(self) -> List[CheckReportGithub]:
        findings = []
        for org in security_client.organizations.values():
            for webhook in org.webhooks:
                if not webhook.active:
                    continue

                report = CheckReportGithub(
                    metadata=self.metadata(),
                    resource=webhook,
                    resource_name=f"{org.name}/{webhook.url}",
                    resource_id=str(webhook.id),
                )

                issues = []
                if webhook.insecure_ssl:
                    issues.append("SSL verification is disabled")
                if not webhook.url.startswith("https://"):
                    issues.append("the payload URL is not HTTPS")
                if not webhook.has_secret:
                    issues.append("no signing secret is configured")

                if issues:
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Webhook {webhook.url} in organization {org.name}: "
                        f"{'; '.join(issues)}."
                    )
                else:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Webhook {webhook.url} in organization {org.name} uses HTTPS with "
                        f"SSL verification and a signing secret."
                    )

                findings.append(report)

        return findings
