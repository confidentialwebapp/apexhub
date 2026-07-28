from typing import Any, Optional

from pydantic import BaseModel, Field


class JenkinsSession(BaseModel):
    """Jenkins API session information."""

    token: str = Field(exclude=True, repr=False)
    base_url: str
    http_session: Any = Field(default=None, exclude=True)


class JenkinsIdentityInfo(BaseModel):
    """Jenkins identity and scoping information."""

    account_id: Optional[str] = None
    account_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    plan: Optional[str] = None
    scopes: list[str] = Field(default_factory=list)
