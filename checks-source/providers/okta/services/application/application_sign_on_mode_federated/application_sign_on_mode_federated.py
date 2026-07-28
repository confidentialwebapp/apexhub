from typing import List

from apexhub.lib.check.models import Check, CheckReportOkta
from apexhub.providers.okta.services.application.application_client import application_client


class application_sign_on_mode_federated(Check):
    """Okta applications use federated sign-on rather than stored passwords

    Password-replay sign-on modes mean Okta holds a reusable credential for the downstream application, so compromising the Okta org yields working passwords for those systems directly rather than only session assertions. Those credentials also bypass the downstream application's own MFA, and they survive an Okta session revocation because the password itself is unchanged.
    """

    def execute(self) -> List[CheckReportOkta]:
        PASSWORD_REPLAY_MODES = {
            "SECURE_PASSWORD_STORE",
            "BASIC_AUTH",
            "BOOKMARK",
            "AUTO_LOGIN",
        }

        findings = []
        for application in application_client.applications.values():
            if application.status != "ACTIVE":
                continue

            report = CheckReportOkta(
                metadata=self.metadata(),
                resource=application,
                resource_name=application.label or application.name,
                resource_id=application.id,
            )

            mode = (application.sign_on_mode or "").upper()

            if mode in PASSWORD_REPLAY_MODES:
                report.status = "FAIL"
                report.status_extended = (
                    f"Application {application.label or application.name} uses the "
                    f"password-replay sign-on mode {mode}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Application {application.label or application.name} uses the "
                    f"federated sign-on mode {mode or 'unknown'}."
                )

            findings.append(report)

        return findings
