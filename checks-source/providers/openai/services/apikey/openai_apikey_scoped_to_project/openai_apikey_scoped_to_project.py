from typing import List

from apexhub.lib.check.models import Check, CheckReportOpenAI
from apexhub.providers.openai.services.apikey.apikey_client import apikey_client


class openai_apikey_scoped_to_project(Check):
    """OpenAI API keys are scoped to a project rather than the organization

    An organization-scoped admin key can create further keys, add members and change billing, so leaking one is equivalent to losing the console itself rather than losing access to a single workload. Because these keys are often pasted into shared automation, one exposure grants durable, self-renewing control of the entire account.
    """

    def execute(self) -> List[CheckReportOpenAI]:
        findings = []
        for key in apikey_client.keys.values():
            report = CheckReportOpenAI(
                metadata=self.metadata(),
                resource=key,
                resource_name=key.name or key.id,
                resource_id=key.id,
            )

            if key.scope == "project":
                report.status = "PASS"
                report.status_extended = (
                    f"API key {key.name or key.id} is scoped to project "
                    f"{key.project_name or key.project_id}."
                )
                if key.owner_type == "user":
                    report.status_extended += (
                        f" It is owned by user {key.owner_name}; prefer a service account."
                    )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"API key {key.name or key.id} is scoped to the organization and "
                    f"carries administrative privileges."
                )

            findings.append(report)

        return findings
