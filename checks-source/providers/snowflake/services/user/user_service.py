from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.snowflake.lib.service.service import SnowflakeService


class User(SnowflakeService):
    """Retrieve Snowflake users with authentication and role assignment detail."""

    def __init__(self, provider):
        super().__init__("User", provider)
        self.users: dict[str, SnowflakeUser] = {}
        self._list_users()

    def _list_users(self):
        try:
            rows = self._query(
                """
                SELECT name, login_name, disabled, has_password, has_rsa_public_key,
                       ext_authn_duo, default_role, last_success_login, created_on,
                       owner, type
                FROM SNOWFLAKE.ACCOUNT_USAGE.USERS
                WHERE deleted_on IS NULL
                """
            )
            if not rows:
                # Fall back to SHOW USERS when ACCOUNT_USAGE is not granted.
                rows = self._show("USERS")

            for raw in rows:
                user = SnowflakeUser(
                    name=raw.get("name", ""),
                    login_name=raw.get("login_name", ""),
                    user_type=(raw.get("type") or "PERSON").upper(),
                    disabled=_as_bool(raw.get("disabled")),
                    has_password=_as_bool(raw.get("has_password")),
                    has_rsa_public_key=_as_bool(raw.get("has_rsa_public_key")),
                    mfa_enrolled=_as_bool(raw.get("ext_authn_duo")),
                    default_role=raw.get("default_role") or "",
                    last_success_login=_as_datetime(raw.get("last_success_login")),
                    created_on=_as_datetime(raw.get("created_on")),
                    owner=raw.get("owner") or "",
                )
                self.users[user.name] = user
            logger.info(f"User - Found {len(self.users)} user(s)")
        except Exception as error:
            logger.error(
                f"User - Error listing users: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


def _as_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("true", "yes", "y", "1")


def _as_datetime(value) -> Optional[datetime]:
    if value is None or isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


class SnowflakeUser(BaseModel):
    """Snowflake user representation."""

    name: str
    login_name: str = ""
    user_type: str = "PERSON"
    disabled: bool = False
    has_password: bool = False
    has_rsa_public_key: bool = False
    mfa_enrolled: bool = False
    default_role: str = ""
    last_success_login: Optional[datetime] = None
    created_on: Optional[datetime] = None
    owner: str = ""
