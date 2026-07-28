from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.job.job_client import job_client


class jenkins_job_build_log_retention_configured(Check):
    """Jenkins jobs have a build log retention policy

    With no discarder, build history grows without bound until the controller runs out of disk and stops scheduling, and administrators then delete history in bulk under pressure — destroying the record needed to determine what a compromised pipeline actually built. Conversely, indefinite retention keeps build logs containing internal hostnames and occasionally leaked secrets available far longer than
    """

    def execute(self) -> List[CheckReportJenkins]:
        findings = []
        for job in job_client.jobs.values():
            if job.config_xml is None:
                continue

            report = CheckReportJenkins(
                metadata=self.metadata(),
                resource=job,
                resource_name=job.full_name,
                resource_id=job.full_name,
            )

            if job.log_rotation_configured:
                report.status = "PASS"
                report.status_extended = (
                    f"Job {job.full_name} defines a build log retention policy."
                )
            else:
                report.status = "FAIL"
                report.status_extended = (
                    f"Job {job.full_name} does not define a build log retention policy."
                )

            findings.append(report)

        return findings
