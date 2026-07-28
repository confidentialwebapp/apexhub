from typing import List

from apexhub.lib.check.models import Check, CheckReportMongoDBAtlas
from apexhub.providers.mongodbatlas.services.access.access_client import access_client


class access_private_endpoint_configured(Check):
    """Atlas projects reach clusters over a private endpoint

    Without a private endpoint, cluster connections traverse the public internet and access depends entirely on the IP access list — which breaks the moment an application's egress address changes and is routinely widened under operational pressure. Private endpoints make the cluster unreachable from the internet regardless of what the access list says, which is a materially stronger control.
    """

    def execute(self) -> List[CheckReportMongoDBAtlas]:
        findings = []
        by_project: dict = {}
        for endpoint in access_client.private_endpoints.values():
            by_project.setdefault(endpoint.project_id, []).append(endpoint)

        for project_id in self.provider.identity.project_ids:
            endpoints = by_project.get(project_id, [])

            report = CheckReportMongoDBAtlas(
                metadata=self.metadata(),
                resource=endpoints,
                resource_name=project_id,
                resource_id=project_id,
            )

            available = [
                endpoint
                for endpoint in endpoints
                if endpoint.status.upper() in ("AVAILABLE", "WAITING_FOR_USER")
            ]

            if available:
                report.status = "PASS"
                report.status_extended = (
                    f"Project {project_id} has {len(available)} private endpoint "
                    f"service(s) across "
                    f"{', '.join(sorted({endpoint.cloud_provider for endpoint in available}))}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Project {project_id} has no private endpoint service; clusters are "
                    f"reachable only over public addresses."
                )

            findings.append(report)

        return findings
