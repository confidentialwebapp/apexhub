from typing import List

from apexhub.lib.check.models import Check, CheckReportAuth0
from apexhub.providers.auth0.services.application.application_client import application_client


class auth0_application_signing_algorithm_asymmetric(Check):
    """Auth0 applications sign tokens with an asymmetric algorithm

    HS256 signs and verifies with the same shared secret, so every party that validates a token also holds the key needed to forge one. A client secret leaked from a mobile binary, a repository or a misconfigured backend therefore allows an attacker to mint tokens for arbitrary users. RS256 removes this entirely: verifiers hold only the public key.
    """

    def execute(self) -> List[CheckReportAuth0]:
        ASYMMETRIC = {"RS256", "RS384", "RS512", "PS256", "ES256", "ES384", "ES512"}

        findings = []
        for app in application_client.applications.values():
            report = CheckReportAuth0(
                metadata=self.metadata(),
                resource=app,
                resource_name=app.name or app.client_id,
                resource_id=app.client_id,
            )

            algorithm = (app.signing_algorithm or "HS256").upper()

            if algorithm in ASYMMETRIC:
                report.status = "PASS"
                report.status_extended = (
                    f"Application {app.name or app.client_id} signs tokens with "
                    f"{algorithm}."
                )
                if not app.oidc_conformant:
                    report.status_extended += " OIDC conformant mode is not enabled."
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Application {app.name or app.client_id} signs tokens with the "
                    f"symmetric algorithm {algorithm}."
                )

            findings.append(report)

        return findings
