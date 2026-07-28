from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.salesforce.lib.service.service import SalesforceService


class User(SalesforceService):
    """Retrieve Salesforce users with their profile, permissions and MFA status."""

    def __init__(self, provider):
        super().__init__("User", provider)
        self.users: dict[str, SalesforceUser] = {}
        self._list_users()
        self._attach_mfa_registration()

    def _query(self, soql: str) -> list[dict]:
        data = self._get("/services/data/v61.0/query", params={"q": soql})
        return (data or {}).get("records", [])

    def _list_users(self):
        try:
            rows = self._query(
                "SELECT Id, Username, Name, IsActive, LastLoginDate, "
                "Profile.Name, Profile.PermissionsModifyAllData, "
                "Profile.PermissionsAuthorApex, Profile.PermissionsManageUsers, "
                "UserType FROM User WHERE IsActive = true"
            )
            for raw in rows:
                profile = raw.get("Profile") or {}
                user = SalesforceUser(
                    id=raw.get("Id", ""),
                    username=raw.get("Username", ""),
                    name=raw.get("Name", ""),
                    is_active=raw.get("IsActive", False),
                    user_type=raw.get("UserType", "Standard"),
                    last_login=raw.get("LastLoginDate"),
                    profile_name=profile.get("Name", ""),
                    modify_all_data=bool(profile.get("PermissionsModifyAllData")),
                    author_apex=bool(profile.get("PermissionsAuthorApex")),
                    manage_users=bool(profile.get("PermissionsManageUsers")),
                )
                self.users[user.id] = user
            logger.info(f"User - Found {len(self.users)} active user(s)")
        except Exception as error:
            logger.error(
                f"User - Error listing users: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _attach_mfa_registration(self):
        """Mark users that have registered at least one verification method."""
        try:
            rows = self._query(
                "SELECT UserId, Factor FROM TwoFactorMethodsInfo"
            )
            for raw in rows:
                user = self.users.get(raw.get("UserId", ""))
                if user is not None:
                    user.mfa_factors.append(raw.get("Factor", "unknown"))
        except Exception as error:
            logger.error(
                f"User - Error reading MFA registration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class SalesforceUser(BaseModel):
    """Salesforce user representation."""

    id: str
    username: str = ""
    name: str = ""
    is_active: bool = False
    user_type: str = "Standard"
    last_login: Optional[str] = None
    profile_name: str = ""
    modify_all_data: bool = False
    author_apex: bool = False
    manage_users: bool = False
    mfa_factors: list[str] = Field(default_factory=list)
