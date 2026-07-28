from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.plugin.plugin_client import plugin_client


class jenkins_plugin_no_known_vulnerabilities(Check):
    """Jenkins plugins have no known security advisories

    Plugins execute inside the controller JVM with full controller privileges, so a vulnerable plugin is not a peripheral concern — advisories routinely describe unauthenticated remote code execution or credential disclosure. Jenkins plugin CVEs are widely weaponised within days of publication, and an exposed controller running a flagged plugin is a standard mass-scanning target.
    """

    def execute(self) -> List[CheckReportJenkins]:
        findings = []
        for plugin in plugin_client.plugins.values():
            if not plugin.security_warnings:
                continue

            report = CheckReportJenkins(
                metadata=self.metadata(),
                resource=plugin,
                resource_name=plugin.short_name,
                resource_id=f"{plugin.short_name}:{plugin.version}",
            )

            advisories = ", ".join(
                warning.id for warning in plugin.security_warnings if warning.id
            )
            report.status = "FAIL"
            report.status_extended = (
                f"Plugin {plugin.short_name} {plugin.version} has "
                f"{len(plugin.security_warnings)} security advisory(ies)"
                f"{': ' + advisories if advisories else ''}."
            )
            findings.append(report)

        for plugin in plugin_client.plugins.values():
            if plugin.security_warnings:
                continue

            report = CheckReportJenkins(
                metadata=self.metadata(),
                resource=plugin,
                resource_name=plugin.short_name,
                resource_id=f"{plugin.short_name}:{plugin.version}",
            )
            report.status = "PASS"
            report.status_extended = (
                f"Plugin {plugin.short_name} {plugin.version} has no known security "
                f"advisories."
            )
            findings.append(report)

        return findings
