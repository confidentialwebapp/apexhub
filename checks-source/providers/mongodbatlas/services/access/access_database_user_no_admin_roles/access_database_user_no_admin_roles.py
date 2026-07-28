from typing import List

from apexhub.lib.check.models import Check, CheckReportMongoDBAtlas
from apexhub.providers.mongodbatlas.services.access.access_client import access_client


class access_database_user_no_admin_roles(Check):
    """Atlas database users do not hold cluster-wide administrative roles

    An application credential holding `readWriteAnyDatabase` can read and modify every database on the cluster, so a single SQL-injection-equivalent flaw or a leaked connection string exposes unrelated tenants and services sharing that cluster. `atlasAdmin` goes further, allowing the user to alter the cluster itself — including disabling the auditing that would record what happened.
    """

    def execute(self) -> List[CheckReportMongoDBAtlas]:
        BROAD_ROLES = {
            "atlasAdmin",
            "root",
            "dbAdminAnyDatabase",
            "readWriteAnyDatabase",
            "readAnyDatabase",
            "clusterAdmin",
            "backup",
            "restore",
        }

        findings = []
        for user in access_client.database_users.values():
            report = CheckReportMongoDBAtlas(
                metadata=self.metadata(),
                resource=user,
                resource_name=f"{user.project_id}/{user.username}",
                resource_id=user.username,
            )

            broad = sorted(
                {role.role_name for role in user.roles if role.role_name in BROAD_ROLES}
            )

            if broad:
                report.status = "FAIL"
                report.status_extended = (
                    f"Database user {user.username} holds cluster-wide role(s): "
                    f"{', '.join(broad)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Database user {user.username} holds {len(user.roles)} scoped role(s)."
                )

            findings.append(report)

        return findings
