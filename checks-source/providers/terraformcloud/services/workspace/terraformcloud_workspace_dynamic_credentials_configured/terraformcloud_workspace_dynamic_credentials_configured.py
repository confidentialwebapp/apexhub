from typing import List

from apexhub.lib.check.models import Check, CheckReportTerraformCloud
from apexhub.providers.terraformcloud.services.workspace.workspace_client import workspace_client


class terraformcloud_workspace_dynamic_credentials_configured(Check):
    """HCP Terraform workspaces use dynamic provider credentials

    A static cloud access key stored in a Terraform workspace is a long-lived credential with provisioning privileges — typically broad enough to create IAM principals, which makes it a privilege escalation path into the whole cloud account. It never expires, exists in a system many engineers can read, and its compromise is not detectable from the cloud side, since the calls look like ordinary Terrafo
    """

    def execute(self) -> List[CheckReportTerraformCloud]:
        STATIC_CREDENTIAL_KEYS = {
            "AWS_ACCESS_KEY_ID",
            "AWS_SECRET_ACCESS_KEY",
            "AWS_SESSION_TOKEN",
            "ARM_CLIENT_SECRET",
            "GOOGLE_CREDENTIALS",
            "GOOGLE_APPLICATION_CREDENTIALS",
            "VAULT_TOKEN",
        }
        DYNAMIC_AUTH_PREFIX = "TFC_"
        DYNAMIC_AUTH_SUFFIX = "_PROVIDER_AUTH"

        findings = []
        for workspace in workspace_client.workspaces.values():
            env_keys = {
                variable.key.upper()
                for variable in workspace.variables
                if variable.category == "env"
            }

            static = env_keys & STATIC_CREDENTIAL_KEYS
            dynamic = {
                key
                for key in env_keys
                if key.startswith(DYNAMIC_AUTH_PREFIX) and key.endswith(DYNAMIC_AUTH_SUFFIX)
            }

            # Workspaces with no provider credentials at all are out of scope here.
            if not static and not dynamic:
                continue

            report = CheckReportTerraformCloud(
                metadata=self.metadata(),
                resource=workspace,
                resource_name=f"{workspace.organization}/{workspace.name}",
                resource_id=workspace.id,
            )

            if dynamic and not static:
                report.status = "PASS"
                report.status_extended = (
                    f"Workspace {workspace.name} uses dynamic provider credentials "
                    f"({', '.join(sorted(dynamic))})."
                )
            elif dynamic:
                report.status = "FAIL"
                report.status_extended = (
                    f"Workspace {workspace.name} configures dynamic provider credentials "
                    f"but still holds static credential(s): {', '.join(sorted(static))}."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Workspace {workspace.name} authenticates with static cloud "
                    f"credential(s): {', '.join(sorted(static))}."
                )

            findings.append(report)

        return findings
