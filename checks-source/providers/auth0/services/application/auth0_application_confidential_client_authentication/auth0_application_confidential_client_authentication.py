from typing import List

from apexhub.lib.check.models import Check, CheckReportAuth0
from apexhub.providers.auth0.services.application.application_client import application_client


class auth0_application_confidential_client_authentication(Check):
    """Auth0 confidential applications authenticate at the token endpoint

    A confidential client with `token_endpoint_auth_method` set to `none` will exchange an authorization code without proving its identity, so any party holding a stolen code can complete the exchange. Conversely, a browser-based application configured as confidential ships a client secret that is trivially extractable from its bundle, giving that secret away to every visitor.
    """

    def execute(self) -> List[CheckReportAuth0]:
        CONFIDENTIAL_TYPES = {"regular_web", "non_interactive"}

        findings = []
        for app in application_client.applications.values():
            report = CheckReportAuth0(
                metadata=self.metadata(),
                resource=app,
                resource_name=app.name or app.client_id,
                resource_id=app.client_id,
            )

            method = (app.token_endpoint_auth_method or "none").lower()

            if app.app_type in CONFIDENTIAL_TYPES:
                if method == "none":
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Application {app.name or app.client_id} is a confidential "
                        f"{app.app_type} client but does not authenticate at the token "
                        f"endpoint."
                    )
                else:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Application {app.name or app.client_id} authenticates at the "
                        f"token endpoint using {method}."
                    )
            elif app.app_type == "spa":
                if method != "none":
                    report.status = "FAIL"
                    report.status_extended = (
                        f"Application {app.name or app.client_id} is a single-page "
                        f"application but uses '{method}', which requires a client secret "
                        f"it cannot protect."
                    )
                else:
                    report.status = "PASS"
                    report.status_extended = (
                        f"Application {app.name or app.client_id} is a public client and "
                        f"holds no token endpoint secret."
                    )
            else:
                continue

            findings.append(report)

        return findings
