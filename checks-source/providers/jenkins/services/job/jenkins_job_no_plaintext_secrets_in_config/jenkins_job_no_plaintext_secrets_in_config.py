from typing import List

from apexhub.lib.check.models import Check, CheckReportJenkins
from apexhub.providers.jenkins.services.job.job_client import job_client


class jenkins_job_no_plaintext_secrets_in_config(Check):
    """Jenkins job configurations contain no plaintext secrets

    A secret written into `config.xml` is stored unencrypted on the controller filesystem, is visible to every user with Job/Configure, and is copied into any backup, `job/*/config.xml` API response and Configuration-as-Code export. Unlike a credentials-store entry it is never masked in build logs, so it also leaks to anyone who can read a build.
    """

    def execute(self) -> List[CheckReportJenkins]:
        import re

        # Credential-shaped literals: an assignment to a secret-ish name, or a PEM block.
        SECRET_PATTERNS = (
            re.compile(
                r"(password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)"
                r"\s*[:=>]\s*[\"']?[A-Za-z0-9/+=_\-]{12,}",
                re.IGNORECASE,
            ),
            re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
            re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
            re.compile(r"\bghp_[A-Za-z0-9]{36}\b"),
        )

        # Jenkins stores credentials-plugin values encrypted in this wrapper element.
        ENCRYPTED = re.compile(r"<[^>]*class=\"hudson.util.Secret\"[^>]*>|\{AQA[A-Za-z0-9+/=]+\}")

        findings = []
        for job in job_client.jobs.values():
            if not job.config_xml:
                continue

            report = CheckReportJenkins(
                metadata=self.metadata(),
                resource=job,
                resource_name=job.full_name,
                resource_id=job.full_name,
            )

            config = ENCRYPTED.sub("", job.config_xml)
            matched = [
                pattern.pattern for pattern in SECRET_PATTERNS if pattern.search(config)
            ]

            if matched:
                report.status = "FAIL"
                report.status_extended = (
                    f"Job {job.full_name} configuration contains {len(matched)} "
                    f"plaintext credential pattern(s)."
                )
            else:
                report.status = "PASS"
                report.status_extended = (
                    f"Job {job.full_name} configuration contains no plaintext credentials."
                )

            findings.append(report)

        return findings
