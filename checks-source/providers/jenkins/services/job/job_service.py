from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.jenkins.lib.service.service import JenkinsService


class Job(JenkinsService):
    """Retrieve Jenkins jobs with their raw configuration and retention policy."""

    def __init__(self, provider):
        super().__init__("Job", provider)
        self.jobs: dict[str, JenkinsJob] = {}
        self._list_jobs()
        self.__threading_call__(self._get_job_config, list(self.jobs.values()))

    def _list_jobs(self):
        try:
            data = self._get(
                "/api/json",
                params={"tree": "jobs[name,url,fullName,_class,color]"},
            ) or {}
            for raw in data.get("jobs", []):
                job = JenkinsJob(
                    full_name=raw.get("fullName", raw.get("name", "")),
                    name=raw.get("name", ""),
                    url=raw.get("url", ""),
                    job_class=raw.get("_class", ""),
                )
                self.jobs[job.full_name] = job
            logger.info(f"Job - Found {len(self.jobs)} job(s)")
        except Exception as error:
            logger.error(
                f"Job - Error listing jobs: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_job_config(self, job: "JenkinsJob"):
        try:
            response = self._http_session.get(
                f"{job.url.rstrip('/')}/config.xml", timeout=30
            )
            if response.status_code in (401, 403, 404):
                logger.info(f"Job - Config not readable for {job.full_name}.")
                return
            response.raise_for_status()
            job.config_xml = response.text

            # Log rotation is expressed as a build discarder in the job config.
            job.log_rotation_configured = (
                "<logRotator" in job.config_xml or "BuildDiscarderProperty" in job.config_xml
            )
        except Exception as error:
            logger.error(
                f"Job - Error fetching config for {job.full_name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class JenkinsJob(BaseModel):
    """Jenkins job representation."""

    full_name: str
    name: str = ""
    url: str = ""
    job_class: str = ""
    config_xml: Optional[str] = None
    log_rotation_configured: bool = False
