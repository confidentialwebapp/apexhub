from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.controller.controller_client import controller_client


class jenkins_controller_security_realm_configured(Check):
    """Jenkins controllers use a managed security realm

    With authentication disabled or open signup enabled, anyone who can reach the controller becomes a user, and combined with a permissive authorization strategy that means immediate administrative access. Because Jenkins holds the credentials used to deploy, this is one of the shortest paths from network exposure to full production compromise.
    """

    def execute(self) -> List[CheckReportJenkins]:
        INSECURE_REALMS = (
            "hudson.security.SecurityRealm$None",
            "hudson.security.LegacySecurityRealm",
        )

        findings = []
        controller = controller_client.controller
        if controller is None:
            return findings

        report = CheckReportJenkins(
            metadata=self.metadata(),
            resource=controller,
            resource_name=controller.url,
            resource_id=controller.url,
        )

        realm = controller.security_realm

        if not controller.use_security or realm is None or realm in INSECURE_REALMS:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller {controller.url} does not use a managed security "
                f"realm (realm: {realm or 'none'})."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Jenkins controller {controller.url} authenticates users through "
                f"{realm.split('.')[-1]}."
            )

        findings.append(report)
        return findings
