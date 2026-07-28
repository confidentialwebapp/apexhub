from typing import List

from apexhub.lib.check.models import Check, CheckReportOpenAI
from apexhub.providers.openai.services.organization.organization_client import organization_client


class openai_organization_audit_log_export_configured(Check):
    """OpenAI organizations export audit logs to an external system

    API key creation is the single most security-relevant event in an OpenAI organization, and without exported logs there is no durable record of who minted which key and when. During an investigation into leaked model access or unexpected spend, that gap makes it impossible to distinguish legitimate provisioning from an attacker establishing persistence.
    """

    def execute(self) -> List[CheckReportOpenAI]:
        findings = []
        organization = organization_client.organization
        if organization is None:
            return findings

        report = CheckReportOpenAI(
            metadata=self.metadata(),
            resource=organization,
            resource_name=organization.name or organization.id,
            resource_id=organization.id,
        )

        if organization.audit_log_export_configured:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} exports audit logs "
                f"to an external system."
            )
        elif organization.audit_log_readable:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} has a readable audit "
                f"log but no export configured."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} audit log is not "
                f"readable; confirm the plan includes audit log access."
            )

        findings.append(report)
        return findings
