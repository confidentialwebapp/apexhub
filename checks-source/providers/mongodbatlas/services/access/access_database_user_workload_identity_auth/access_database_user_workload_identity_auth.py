from typing import List

from apexhub.lib.check.models import Check, CheckReportMongoDBAtlas
from apexhub.providers.mongodbatlas.services.access.access_client import access_client


class access_database_user_workload_identity_auth(Check):
    """Atlas application database users authenticate with workload identity

    A SCRAM password is embedded in the connection string, which propagates into environment files, container images, CI logs and application error traces. It does not expire and rotating it requires a coordinated deployment, so in practice it stays unchanged for years. Workload identity removes the stored secret entirely: the credential is issued per session against an identity the cloud provider att
    """

    def execute(self) -> List[CheckReportMongoDBAtlas]:
        PASSWORDLESS = {"AWS_IAM", "OIDC", "X509", "LDAP"}

        findings = []
        for user in access_client.database_users.values():
            report = CheckReportMongoDBAtlas(
                metadata=self.metadata(),
                resource=user,
                resource_name=f"{user.project_id}/{user.username}",
                resource_id=user.username,
            )

            if user.auth_type in PASSWORDLESS:
                report.status = "PASS"
                report.status_extended = (
                    f"Database user {user.username} authenticates with "
                    f"{user.auth_type}, so no static password is stored."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Database user {user.username} authenticates with a static SCRAM "
                    f"password."
                )

            findings.append(report)

        return findings
