from typing import List

from apexhub.lib.check.models import Check, CheckReportMongoDBAtlas
from apexhub.providers.mongodbatlas.services.access.access_client import access_client


class access_database_user_scoped_to_clusters(Check):
    """Atlas database users are scoped to specific clusters

    An unscoped user automatically gains access to clusters created after the credential was issued, so a project's blast radius grows silently as new environments are added. Where production and non-production clusters share a project, an unscoped development credential is a working production credential.
    """

    def execute(self) -> List[CheckReportMongoDBAtlas]:
        findings = []
        for user in access_client.database_users.values():
            report = CheckReportMongoDBAtlas(
                metadata=self.metadata(),
                resource=user,
                resource_name=f"{user.project_id}/{user.username}",
                resource_id=user.username,
            )

            if user.scopes:
                report.status = "PASS"
                report.status_extended = (
                    f"Database user {user.username} is scoped to "
                    f"{len(user.scopes)} resource(s): {', '.join(user.scopes)}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Database user {user.username} is not scoped and can access every "
                    f"cluster in project {user.project_id}."
                )

            findings.append(report)

        return findings
