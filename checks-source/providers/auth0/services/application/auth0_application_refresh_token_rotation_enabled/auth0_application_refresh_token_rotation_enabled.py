from typing import List

from apexhub.lib.check.models import Check, CheckReportAuth0
from apexhub.providers.auth0.services.application.application_client import application_client


class auth0_application_refresh_token_rotation_enabled(Check):
    """Auth0 public applications rotate and expire refresh tokens

    A non-rotating refresh token held by a browser or mobile application is a long-lived credential stored on the client, reachable through XSS, a malicious dependency or device compromise, and it grants indefinite re-authentication as the user. Rotation converts theft into a detectable event: reuse of a consumed token signals compromise and revokes the whole family.
    """

    def execute(self) -> List[CheckReportAuth0]:
        PUBLIC_TYPES = {"spa", "native"}

        findings = []
        for app in application_client.applications.values():
            if app.app_type not in PUBLIC_TYPES:
                continue
            if "refresh_token" not in app.grant_types:
                continue

            report = CheckReportAuth0(
                metadata=self.metadata(),
                resource=app,
                resource_name=app.name or app.client_id,
                resource_id=app.client_id,
            )

            issues = []
            if not app.refresh_token_rotation:
                issues.append("refresh token rotation is disabled")
            if app.refresh_token_expiration != "expiring":
                issues.append("refresh tokens do not expire")

            if issues:
                report.status = "FAIL"
                report.status_extended = (
                    f"Application {app.name or app.client_id} ({app.app_type}): "
                    f"{'; '.join(issues)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Application {app.name or app.client_id} rotates and expires refresh "
                    f"tokens."
                )

            findings.append(report)

        return findings
