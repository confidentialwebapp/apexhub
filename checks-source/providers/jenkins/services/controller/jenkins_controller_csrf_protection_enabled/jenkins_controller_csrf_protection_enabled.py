from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.controller.controller_client import controller_client


class jenkins_controller_csrf_protection_enabled(Check):
    """Jenkins controllers enable CSRF protection

    Without CSRF protection, visiting a hostile page while signed in to Jenkins is enough for that page to trigger builds, modify jobs or create an administrator account using the victim's session. Because Jenkins builds execute arbitrary code with production credentials, a single click by an administrator can hand over the build system.
    """

    def execute(self) -> List[CheckReportJenkins]:
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

        if not controller.crumb_issuer:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller {controller.url} has CSRF protection disabled."
            )
        elif controller.crumb_excludes_client_ip:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller {controller.url} enables CSRF protection but excludes "
                f"the client IP from the crumb, weakening it."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Jenkins controller {controller.url} enables CSRF protection with a "
                f"client-IP-bound crumb."
            )

        findings.append(report)
        return findings
