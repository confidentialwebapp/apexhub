from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.gitlab.lib.service.service import GitLabService


class Runner(GitLabService):
    """Retrieve GitLab CI runners and their executor configuration."""

    def __init__(self, provider):
        super().__init__("Runner", provider)
        self.runners: dict[str, GitLabRunner] = {}
        self._list_runners()
        self.__threading_call__(self._get_runner_detail, list(self.runners.values()))

    def _list_runners(self):
        try:
            for raw in self._paginate("/runners/all"):
                runner = GitLabRunner(
                    id=str(raw.get("id")),
                    description=raw.get("description", ""),
                    runner_type=raw.get("runner_type", "project_type"),
                    is_shared=raw.get("is_shared", False),
                    online=raw.get("online", False),
                    status=raw.get("status", "unknown"),
                )
                self.runners[runner.id] = runner
            logger.info(f"Runner - Found {len(self.runners)} runner(s)")
        except Exception as error:
            logger.error(
                f"Runner - Error listing runners: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_runner_detail(self, runner: "GitLabRunner"):
        try:
            raw = self._get(f"/runners/{runner.id}")
            if not raw:
                return
            runner.tag_list = raw.get("tag_list", [])
            runner.locked = raw.get("locked", False)
            runner.run_untagged = raw.get("run_untagged", True)
            runner.access_level = raw.get("access_level", "not_protected")
            # The executor config is surfaced on self-managed instances only.
            config = raw.get("config") or {}
            runner.privileged = bool(config.get("privileged", False))
            runner.executor = config.get("executor", raw.get("executor", "unknown"))
        except Exception as error:
            logger.error(
                f"Runner - Error fetching runner {runner.id}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class GitLabRunner(BaseModel):
    """GitLab CI runner representation."""

    id: str
    description: str = ""
    runner_type: str = "project_type"
    is_shared: bool = False
    online: bool = False
    status: str = "unknown"
    locked: bool = False
    run_untagged: bool = True
    access_level: str = "not_protected"
    privileged: bool = False
    executor: str = "unknown"
    tag_list: list[str] = Field(default_factory=list)
