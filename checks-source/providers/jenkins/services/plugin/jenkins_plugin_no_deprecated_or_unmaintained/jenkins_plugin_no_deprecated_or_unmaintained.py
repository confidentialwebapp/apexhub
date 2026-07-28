from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.plugin.plugin_client import plugin_client


class jenkins_plugin_no_deprecated_or_unmaintained(Check):
    """Jenkins plugins are not deprecated and are up to date

    A deprecated plugin receives no security fixes, so any vulnerability found in it stays permanently unpatched inside the controller JVM. Accumulated pending updates also make emergency patching slower: when an advisory lands, a controller many versions behind cannot take the fix without a risky bulk upgrade, extending the exposure window.
    """

    def execute(self) -> List[CheckReportJenkins]:
        findings = []
        for plugin in plugin_client.plugins.values():
            report = CheckReportJenkins(
                metadata=self.metadata(),
                resource=plugin,
                resource_name=plugin.short_name,
                resource_id=f"{plugin.short_name}:{plugin.version}",
            )

            if plugin.deprecated:
                report.status = "FAIL"
                report.status_extended = (
                    f"Plugin {plugin.short_name} {plugin.version} is deprecated and no "
                    f"longer receives security fixes."
                )
            elif plugin.enabled and plugin.has_update:
                report.status = "FAIL"
                report.status_extended = (
                    f"Plugin {plugin.short_name} {plugin.version} is enabled and has a "
                    f"pending update."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Plugin {plugin.short_name} {plugin.version} is supported and up to date."
                )

            findings.append(report)

        return findings
