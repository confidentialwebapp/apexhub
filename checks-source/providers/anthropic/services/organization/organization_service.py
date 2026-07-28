from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.anthropic.lib.service.service import AnthropicService


class Organization(AnthropicService):
    """Retrieve Anthropic organization members, invites and security settings."""

    def __init__(self, provider):
        super().__init__("Organization", provider)
        self.organization: Optional[AnthropicOrganization] = None
        self._get_organization()

    def _get_organization(self):
        try:
            members = self._paginate("/v1/organizations/users", "data")
            invites = self._paginate("/v1/organizations/invites", "data")
            settings = self._get("/v1/organizations/settings") or {}

            self.organization = AnthropicOrganization(
                id=self.provider.identity.organization_id or "",
                name=self.provider.identity.organization_name or "",
                sso_enforced=bool(settings.get("sso_enforced", False)),
                mfa_required=bool(settings.get("mfa_required", False)),
                domain_verified=bool(settings.get("domain_verified", False)),
                scim_enabled=bool(settings.get("scim_enabled", False)),
                zero_data_retention=bool(settings.get("zero_data_retention", False)),
                audit_log_export_configured=bool(
                    settings.get("audit_log_export_enabled", False)
                ),
                members=[
                    AnthropicMember(
                        id=raw.get("id", ""),
                        email=raw.get("email", ""),
                        name=raw.get("name", ""),
                        role=raw.get("role", "user"),
                        added_at=raw.get("added_at"),
                    )
                    for raw in members
                ],
                pending_invites=[
                    raw.get("email", "")
                    for raw in invites
                    if raw.get("status") == "pending"
                ],
            )
            logger.info(
                f"Organization - Read configuration for "
                f"{self.organization.name or self.organization.id}"
            )
        except Exception as error:
            logger.error(
                f"Organization - Error reading organization configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class AnthropicMember(BaseModel):
    """A member of an Anthropic organization."""

    id: str
    email: str = ""
    name: str = ""
    role: str = "user"
    added_at: Optional[str] = None


class AnthropicOrganization(BaseModel):
    """Anthropic organization representation."""

    id: str
    name: str = ""
    sso_enforced: bool = False
    mfa_required: bool = False
    domain_verified: bool = False
    scim_enabled: bool = False
    zero_data_retention: bool = False
    audit_log_export_configured: bool = False
    members: list[AnthropicMember] = Field(default_factory=list)
    pending_invites: list[str] = Field(default_factory=list)
