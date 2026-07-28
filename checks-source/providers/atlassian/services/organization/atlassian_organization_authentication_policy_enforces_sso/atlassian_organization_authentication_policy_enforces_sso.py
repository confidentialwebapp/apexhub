from typing import List

from apexhub.lib.check.models import Check, CheckReportAtlassian
from apexhub.providers.atlassian.services.organization.organization_client import organization_client


class atlassian_organization_authentication_policy_enforces_sso(Check):
    """Atlassian organizations enforce SSO through an authentication policy

    Atlassian authentication policies only apply to managed accounts on verified domains — accounts outside that boundary keep signing in with Atlassian passwords no matter what the policy says. Since Jira and Confluence hold vulnerability tickets, incident records, runbooks and architecture documentation, an account outside the policy is an unmonitored route into the organisation's internal knowledge
    """

    def execute(self) -> List[CheckReportAtlassian]:
        findings = []
        organization = organization_client.organization
        if organization is None:
            return findings

        report = CheckReportAtlassian(
            metadata=self.metadata(),
            resource=organization,
            resource_name=organization.name or organization.id,
            resource_id=organization.id,
        )

        if not organization.verified_domains:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} has no verified "
                f"domain, so authentication policies govern no accounts."
            )
            findings.append(report)
            return findings

        non_enforcing = [
            policy
            for policy in organization.authentication_policies
            if policy.status.lower() == "enabled" and not policy.sso_enforced
        ]
        enforcing = [
            policy for policy in organization.authentication_policies if policy.sso_enforced
        ]

        if enforcing and not non_enforcing:
            report.status = "PASS"
            report.status_extended = (
                f"Organization {organization.name or organization.id} enforces SSO across "
                f"{len(enforcing)} authentication policy(ies) covering "
                f"{len(organization.verified_domains)} verified domain(s)."
            )
        elif enforcing:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} enforces SSO in some "
                f"policies but {len(non_enforcing)} enabled policy(ies) do not: "
                f"{', '.join(policy.name or policy.id for policy in non_enforcing)}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                f"Organization {organization.name or organization.id} has no "
                f"authentication policy enforcing SSO."
            )

        findings.append(report)
        return findings
