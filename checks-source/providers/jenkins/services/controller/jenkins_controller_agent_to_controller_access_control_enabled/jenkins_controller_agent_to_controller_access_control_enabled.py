from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.controller.controller_client import controller_client


class jenkins_controller_agent_to_controller_access_control_enabled(Check):
    """Jenkins controllers enforce agent-to-controller access control

    Build agents run untrusted code by design — every merge request compiles on them. With agent-to-controller access control disabled, a build can read and write arbitrary files on the controller, including the `secrets/` directory holding the master key used to encrypt every stored credential. One malicious pull request then yields the entire credential store.
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

        enabled = controller.agent_to_controller_access_control

        if enabled is None:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller {controller.url} agent-to-controller access control "
                f"state could not be read."
            )
        elif enabled:
            report.status = "PASS"
            report.status_extended = (
                f"Jenkins controller {controller.url} enforces agent-to-controller access "
                f"control."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Jenkins controller {controller.url} has agent-to-controller access "
                f"control disabled."
            )

        findings.append(report)
        return findings
