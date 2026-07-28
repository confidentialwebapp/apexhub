from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.okta.lib.service.service import OktaService

POLICY_TYPES = ("PASSWORD", "MFA_ENROLL", "ACCESS_POLICY")


class Policy(OktaService):
    """Retrieve Okta password, MFA enrolment and authentication policies."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.policies: dict[str, OktaPolicy] = {}
        self._list_policies()

    def _list_policies(self):
        for policy_type in POLICY_TYPES:
            try:
                policies, _, error = self._run(
                    self.client.list_policies({"type": policy_type})
                )
                if error:
                    logger.info(
                        f"Policy - {policy_type} policies not readable: {error}"
                    )
                    continue

                for raw in policies or []:
                    settings = getattr(raw, "settings", None)
                    password = getattr(settings, "password", None) if settings else None
                    complexity = (
                        getattr(password, "complexity", None) if password else None
                    )
                    lockout = getattr(password, "lockout", None) if password else None

                    policy = OktaPolicy(
                        id=raw.id,
                        name=getattr(raw, "name", ""),
                        type=policy_type,
                        status=str(getattr(raw, "status", "ACTIVE")),
                        priority=getattr(raw, "priority", None),
                        min_length=getattr(complexity, "min_length", None)
                        if complexity
                        else None,
                        exclude_username=bool(
                            getattr(complexity, "exclude_username", False)
                        )
                        if complexity
                        else False,
                        dictionary_check=bool(
                            getattr(
                                getattr(complexity, "dictionary", None),
                                "common",
                                None,
                            )
                        )
                        if complexity
                        else False,
                        max_attempts=getattr(lockout, "max_attempts", None)
                        if lockout
                        else None,
                    )
                    self.policies[policy.id] = policy
            except Exception as error:
                logger.error(
                    f"Policy - Error listing {policy_type} policies: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )

        logger.info(f"Policy - Found {len(self.policies)} policy(ies)")


class OktaPolicy(BaseModel):
    """Okta policy representation."""

    id: str
    name: str = ""
    type: str = ""
    status: str = "ACTIVE"
    priority: Optional[int] = None
    min_length: Optional[int] = None
    exclude_username: bool = False
    dictionary_check: bool = False
    max_attempts: Optional[int] = None
