from typing import List

from apexhub.lib.check.models import Check, CheckReportDatabricks
from apexhub.providers.databricks.services.unitycatalog.unitycatalog_client import unitycatalog_client


class databricks_unitycatalog_external_location_not_broadly_granted(Check):
    """Unity Catalog external locations are not granted to all account users

    An external location maps to a cloud storage prefix, so a grant on it bypasses table-level controls entirely — the holder can read the underlying files directly regardless of column masks or row filters applied to the tables above them. Granting to `account users` extends that raw storage access to everyone in the account, including service principals created for unrelated purposes.
    """

    def execute(self) -> List[CheckReportDatabricks]:
        BROAD_PRINCIPALS = {"account users", "users", "all account users"}
        SENSITIVE_PRIVILEGES = {"WRITE_FILES", "CREATE_EXTERNAL_TABLE", "ALL_PRIVILEGES"}

        findings = []
        for location in unitycatalog_client.external_locations.values():
            report = CheckReportDatabricks(
                metadata=self.metadata(),
                resource=location,
                resource_name=location.name,
                resource_id=location.name,
            )

            problems = []
            for grant in location.grants:
                principal = (grant.principal or "").strip().lower()
                privileges = {privilege.upper() for privilege in grant.privileges}

                if principal in BROAD_PRINCIPALS and privileges:
                    problems.append(
                        f"{grant.principal} holds {', '.join(sorted(privileges))}"
                    )
                elif privileges & SENSITIVE_PRIVILEGES and principal in BROAD_PRINCIPALS:
                    problems.append(
                        f"{grant.principal} holds {', '.join(sorted(privileges & SENSITIVE_PRIVILEGES))}"
                    )

            if problems:
                report.status = "FAIL"
                report.status_extended = (
                    f"External location {location.name} ({location.url}) is broadly "
                    f"granted: {'; '.join(problems)}."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"External location {location.name} has no grants to built-in "
                    f"account-wide groups."
                )

            findings.append(report)

        return findings
