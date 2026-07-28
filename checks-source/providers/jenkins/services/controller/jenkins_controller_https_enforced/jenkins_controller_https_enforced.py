from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.controller.controller_client import controller_client


class jenkins_controller_https_enforced(Check):
    """Jenkins controllers are served over HTTPS

    Over plain HTTP, the Jenkins session cookie and API token travel in cleartext and can be captured by anyone positioned on the network path, including on a shared office or VPN segment. Because a captured administrator session grants script console access, this escalates directly to code execution on every build agent.
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

        root_url = controller.root_url or controller.url

        if root_url.startswith("https://"):
            report.status = "PASS"
            report.status_extended = (
                f"Jenkins controller is served over HTTPS at {root_url}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller is not served over HTTPS (root URL: {root_url})."
            )

        findings.append(report)
        return findings
