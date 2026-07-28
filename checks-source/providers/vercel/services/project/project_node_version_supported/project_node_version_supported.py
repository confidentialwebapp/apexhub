from typing import List

from apexhub.lib.check.models import Check, CheckReportVercel
from apexhub.providers.vercel.services.project.project_client import project_client


class project_node_version_supported(Check):
    """Vercel projects run a supported Node.js version

    An end-of-life runtime accumulates unpatched vulnerabilities in the JavaScript engine and the standard library, including HTTP request parsing and TLS handling that process untrusted input on every request. Because the runtime sits underneath the application, no amount of application-level review addresses those flaws, and Vercel eventually stops building projects pinned to retired versions.
    """

    def execute(self) -> List[CheckReportVercel]:
        # Node.js releases past end of life; update as the release schedule advances.
        END_OF_LIFE = {"12.x", "14.x", "16.x", "18.x", "12", "14", "16", "18"}

        findings = []
        for project in project_client.projects.values():
            version = (project.node_version or "").strip()
            if not version:
                continue

            report = CheckReportVercel(
                metadata=self.metadata(),
                resource=project,
                resource_name=project.name,
                resource_id=project.id,
            )

            if version in END_OF_LIFE:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project.name} runs Node.js {version}, which has reached end "
                    f"of life and no longer receives security patches."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project.name} runs Node.js {version}."
                )

            findings.append(report)

        return findings
