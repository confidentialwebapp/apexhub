from typing import List

from apexhub.lib.check.models import Check, CheckReportMongoDBAtlas
from apexhub.providers.mongodbatlas.services.access.access_client import access_client


class access_api_key_least_privilege(Check):
    """Atlas organization API keys do not hold owner privileges

    An owner-scoped API key is a long-lived credential with full control of the Atlas organization, and it is typically stored in the automation that provisions clusters — CI variables, Terraform state, or a configuration file. Its compromise allows an attacker to open the network access list to the internet and create a database user, reaching the data without touching any existing credential.
    """

    def execute(self) -> List[CheckReportMongoDBAtlas]:
        OWNER_ROLES = {"ORG_OWNER", "GROUP_OWNER"}

        findings = []
        for key in access_client.api_keys.values():
            report = CheckReportMongoDBAtlas(
                metadata=self.metadata(),
                resource=key,
                resource_name=key.description or key.id,
                resource_id=key.id,
            )

            owner_roles = sorted({role for role in key.roles if role in OWNER_ROLES})

            if owner_roles:
                report.status = "FAIL"
                report.status_extended = (
                    f"API key {key.description or key.id} holds owner role(s): "
                    f"{', '.join(owner_roles)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"API key {key.description or key.id} holds "
                    f"{len(key.roles)} non-owner role(s)."
                )

            findings.append(report)

        return findings
