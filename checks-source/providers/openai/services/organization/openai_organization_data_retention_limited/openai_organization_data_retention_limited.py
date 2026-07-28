from typing import List

from apexhub.lib.check.models import Check, CheckReportOpenAI
from apexhub.providers.openai.services.organization.organization_client import organization_client


class openai_organization_data_retention_limited(Check):
    """OpenAI organizations limit prompt data retention and opt out of training

    Prompts routinely carry customer records, source code and internal documents that were never classified for third-party storage. Where retention is unbounded, that content sits outside your environment beyond the reach of your own deletion and residency commitments, and any breach of the provider's storage becomes a breach of your data.
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

        retention = organization.data_retention_days

        if organization.zero_data_retention and organization.training_opt_out:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} uses zero data "
                f"retention and does not contribute data to model training."
            )
        elif not organization.training_opt_out:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} allows API data to "
                f"be used for model training."
            )
        elif retention is None:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} has no bounded data "
                f"retention window configured."
            )
        else:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} retains API data for "
                f"{retention} day(s) and does not contribute it to model training."
            )

        findings.append(report)
        return findings
