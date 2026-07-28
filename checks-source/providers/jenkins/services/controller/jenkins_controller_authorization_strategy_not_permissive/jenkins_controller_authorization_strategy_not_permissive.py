from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.controller.controller_client import controller_client


class jenkins_controller_authorization_strategy_not_permissive(Check):
    """Jenkins controllers do not use a permissive authorization strategy

    Administrator rights on a Jenkins controller are equivalent to arbitrary code execution on every agent, plus read access to every stored credential. With a permissive strategy, any user who can authenticate — including through an open signup realm — can reach the Groovy script console, decrypt stored deployment credentials and push code to production. Internet-exposed Jenkins instances left in thi
    """

    def execute(self) -> List[CheckReportJenkins]:
        PERMISSIVE = (
            "hudson.security.AuthorizationStrategy$Unsecured",
            "hudson.security.FullControlOnceLoggedInAuthorizationStrategy",
            "hudson.security.LegacyAuthorizationStrategy",
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

        strategy = controller.authorization_strategy

        if strategy is None:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller {controller.url} authorization strategy could not be "
                f"read; grant Overall/Administer to the scanning token to assess it."
            )
        elif not controller.use_security:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller {controller.url} has security disabled entirely."
            )
        elif strategy in PERMISSIVE:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller {controller.url} uses the permissive authorization "
                f"strategy {strategy.split('.')[-1]}."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Jenkins controller {controller.url} uses the granular authorization "
                f"strategy {strategy.split('.')[-1]}."
            )

        findings.append(report)
        return findings
