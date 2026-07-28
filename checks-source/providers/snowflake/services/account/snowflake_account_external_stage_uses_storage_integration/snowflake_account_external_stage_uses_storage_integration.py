from typing import List

from apexhub.lib.check.models import Check, CheckReportSnowflake
from apexhub.providers.snowflake.services.account.account_client import account_client


class snowflake_account_external_stage_uses_storage_integration(Check):
    """Snowflake external stages use a storage integration rather than embedded credentials

    An external stage created with inline credentials stores a long-lived cloud access key inside the stage definition, where it is visible to anyone who can run `DESC STAGE` and is copied into every clone, backup and DDL export. Those keys are typically over-permissioned on the bucket, so a Snowflake reader-level compromise escalates into direct access to the underlying data lake.
    """

    def execute(self) -> List[CheckReportSnowflake]:
        findings = []
        account = account_client.account_config
        if account is None:
            return findings

        for stage in account.external_stages:
            report = CheckReportSnowflake(
                metadata=self.metadata(),
                resource=stage,
                resource_name=stage.qualified_name,
                resource_id=stage.qualified_name,
            )

            if stage.storage_integration:
                report.status = "PASS"
                report.status_extended = (
                    f"External stage {stage.qualified_name} uses storage integration "
                    f"{stage.storage_integration}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"External stage {stage.qualified_name} ({stage.url}) does not use a "
                    f"storage integration and may hold embedded credentials."
                )

            findings.append(report)

        return findings
