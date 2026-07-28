from typing import List

from apexhub.lib.check.models import Check, CheckReportMongoDBAtlas
from apexhub.providers.mongodbatlas.services.access.access_client import access_client


class access_alert_configurations_defined(Check):
    """Atlas projects define enabled alert configurations

    Atlas auditing records events but does not act on them, so without alerts a network access list widened to 0.0.0.0/0 or a new database user created by an attacker goes unnoticed until someone happens to review the configuration. Those two actions are precisely how an intruder converts stolen API access into data access, and both are cheap to alert on.
    """

    def execute(self) -> List[CheckReportMongoDBAtlas]:
        findings = []
        for project_id in self.provider.identity.project_ids:
            enabled = access_client.alert_configs.get(project_id, [])

            report = CheckReportMongoDBAtlas(
                metadata=self.metadata(),
                resource=enabled,
                resource_name=project_id,
                resource_id=project_id,
            )

            if enabled:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project_id} has {len(enabled)} enabled alert "
                    f"configuration(s)."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project_id} has no enabled alert configuration."
                )

            findings.append(report)

        return findings
