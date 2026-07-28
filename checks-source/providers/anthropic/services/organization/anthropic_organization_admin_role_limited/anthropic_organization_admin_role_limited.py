from typing import List

from apexhub.lib.check.models import Check, CheckReportAnthropic
from apexhub.providers.anthropic.services.organization.organization_client import organization_client


class anthropic_organization_admin_role_limited(Check):
    """Anthropic organizations limit the number of admin members

    Every additional admin is another account whose compromise yields full control of the organization, including the ability to issue keys that outlive the intrusion. Admin roles granted for a one-off task and never revoked are the usual cause, and because the console is used infrequently, the excess grants are rarely noticed.
    """

    def execute(self) -> List[CheckReportAnthropic]:
        max_admins = self.audit_config.get("max_organization_admins", 3)

        findings = []
        organization = organization_client.organization
        if organization is None:
            return findings

        report = CheckReportAnthropic(
            metadata=self.metadata(),
            resource=organization,
            resource_name=organization.name or organization.id,
            resource_id=organization.id,
        )

        admins = [member for member in organization.members if member.role == "admin"]
        total = len(organization.members)

        if not organization.members:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} membership could not "
                f"be read; confirm the admin key has organization read scope."
            )
        elif len(admins) <= max_admins and len(admins) * 2 <= total:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} has {len(admins)} "
                f"admin(s) out of {total} member(s)."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} has {len(admins)} "
                f"admin(s) out of {total} member(s), above the threshold of {max_admins}."
            )

        findings.append(report)
        return findings
