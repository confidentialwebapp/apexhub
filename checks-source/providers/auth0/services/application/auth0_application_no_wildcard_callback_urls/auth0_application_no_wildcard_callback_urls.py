from typing import List

from apexhub.lib.check.models import Check, CheckReportAuth0
from apexhub.providers.auth0.services.application.application_client import application_client


class auth0_application_no_wildcard_callback_urls(Check):
    """Auth0 applications use exact HTTPS callback URLs

    The callback URL list is the only thing binding an authorization code to the application that requested it. A wildcard entry lets an attacker redirect the flow to a host they control — an unclaimed subdomain, or any path on a domain with an open redirect — and receive the victim's authorization code, exchanging it for tokens without ever touching the user's credentials. This is one of the most rel
    """

    def execute(self) -> List[CheckReportAuth0]:
        INTERACTIVE_TYPES = {"spa", "regular_web", "native"}

        findings = []
        for app in application_client.applications.values():
            report = CheckReportAuth0(
                metadata=self.metadata(),
                resource=app,
                resource_name=app.name or app.client_id,
                resource_id=app.client_id,
            )

            # Machine-to-machine clients complete no redirect flow.
            if app.app_type not in INTERACTIVE_TYPES:
                continue

            issues = []
            urls = list(app.callbacks) + list(app.web_origins)

            wildcards = [url for url in urls if "*" in url]
            if wildcards:
                issues.append(f"wildcard URL(s): {', '.join(wildcards)}")

            insecure = [
                url
                for url in urls
                if url.startswith("http://")
                and "localhost" not in url
                and "127.0.0.1" not in url
            ]
            if insecure:
                issues.append(f"plaintext HTTP URL(s): {', '.join(insecure)}")

            if not app.callbacks:
                issues.append("no allowed callback URLs configured")

            if issues:
                report.status = "FAIL"
                report.status_extended = (
                    f"Application {app.name or app.client_id} has {'; '.join(issues)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Application {app.name or app.client_id} uses "
                    f"{len(app.callbacks)} exact HTTPS callback URL(s)."
                )

            findings.append(report)

        return findings
