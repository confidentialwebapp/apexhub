from typing import List

from apexhub.lib.check.models import Check, CheckReportOkta
from apexhub.providers.okta.services.policy.policy_client import policy_client


class policy_mfa_enrollment_required(Check):
    """Okta orgs have an active MFA enrollment policy

    Without an active enrolment policy, MFA is available but not required, so coverage depends entirely on individual users choosing to enrol. In practice that leaves a long tail of unprotected accounts — and attackers specifically enumerate for them, since one unenrolled user provides the same federated access as any other.
    """

    def execute(self) -> List[CheckReportOkta]:
        findings = []
        active = [
            policy
            for policy in policy_client.policies.values()
            if policy.type == "MFA_ENROLL" and policy.status == "ACTIVE"
        ]

        report = CheckReportOkta(
            metadata=self.metadata(),
            resource=active,
            resource_name="MFA enrollment policy",
            resource_id="mfa-enroll",
        )

        if active:
            report.status = "PASS"
            report.status_extended = (
                f"Okta org has {len(active)} active MFA enrollment policy(ies): "
                f"{', '.join(policy.name for policy in active)}."
            )
        else:
            report.status = "FAIL"
            report.status_extended = (
                "Okta org has no active MFA enrollment policy; factor enrolment is "
                "optional."
            )

        findings.append(report)
        return findings
