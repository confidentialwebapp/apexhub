from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.okta.lib.service.service import OktaService


class User(OktaService):
    """Retrieve Okta users with their status, factors and last login."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.users: dict[str, OktaUser] = {}
        self._list_users()
        self._list_factors()

    def _list_users(self):
        try:
            users, response, error = self._run(
                self.client.list_users({"limit": 200})
            )
            if error:
                logger.error(f"User - Error listing users: {error}")
                return

            while True:
                for raw in users or []:
                    user = OktaUser(
                        id=raw.id,
                        login=getattr(raw.profile, "login", ""),
                        email=getattr(raw.profile, "email", ""),
                        status=str(raw.status),
                        created=_as_datetime(raw.created),
                        last_login=_as_datetime(raw.last_login),
                        password_changed=_as_datetime(raw.password_changed),
                    )
                    self.users[user.id] = user

                if not response or not response.has_next():
                    break
                users, error = self._run(response.next())
                if error:
                    logger.error(f"User - Error paginating users: {error}")
                    break

            logger.info(f"User - Found {len(self.users)} user(s)")
        except Exception as error:
            logger.error(
                f"User - Error listing users: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _list_factors(self):
        """Attach the enrolled MFA factors for each active user."""
        for user in self.users.values():
            if user.status not in ("ACTIVE", "PASSWORD_EXPIRED", "RECOVERY"):
                continue
            try:
                factors, _, error = self._run(
                    self.client.list_factors(user.id)
                )
                if error:
                    logger.info(f"User - Factors not readable for {user.login}: {error}")
                    continue
                for factor in factors or []:
                    if str(factor.status) == "ACTIVE":
                        user.factors.append(str(factor.factor_type))
            except Exception as error:
                logger.error(
                    f"User - Error listing factors for {user.login}: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )


def _as_datetime(value) -> Optional[datetime]:
    if value is None or isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


class OktaUser(BaseModel):
    """Okta user representation."""

    id: str
    login: str = ""
    email: str = ""
    status: str = "ACTIVE"
    created: Optional[datetime] = None
    last_login: Optional[datetime] = None
    password_changed: Optional[datetime] = None
    factors: list[str] = Field(default_factory=list)
