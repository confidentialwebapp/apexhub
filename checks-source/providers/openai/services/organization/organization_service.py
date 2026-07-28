from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.openai.lib.service.service import OpenAIService


class Organization(OpenAIService):
    """Retrieve OpenAI organization settings, members and audit log configuration."""

    def __init__(self, provider):
        super().__init__("Organization", provider)
        self.organization: Optional[OpenAIOrganization] = None
        self._get_organization()

    def _get_organization(self):
        try:
            users = self._paginate("/v1/organization/users", "data")
            invites = self._paginate("/v1/organization/invites", "data")
            # A single recent page is enough to confirm the audit log is populated
            # and readable; full history is not needed for a posture check.
            audit_logs = self._get(
                "/v1/organization/audit_logs", params={"limit": 1}
            )
            settings = self._get("/v1/organization/settings") or {}

            self.organization = OpenAIOrganization(
                id=self.provider.identity.organization_id or "",
                name=self.provider.identity.organization_name or "",
                mfa_required=bool(settings.get("mfa_required", False)),
                sso_enforced=bool(settings.get("sso_enforced", False)),
                domain_verified=bool(settings.get("domain_verified", False)),
                zero_data_retention=bool(settings.get("zero_data_retention", False)),
                data_retention_days=settings.get("retention_days"),
                training_opt_out=bool(settings.get("training_opt_out", True)),
                audit_log_readable=audit_logs is not None,
                audit_log_export_configured=bool(
                    settings.get("audit_log_export_enabled", False)
                ),
                members=[
                    OpenAIMember(
                        id=raw.get("id", ""),
                        email=raw.get("email", ""),
                        name=raw.get("name", ""),
                        role=raw.get("role", "reader"),
                        added_at=raw.get("added_at"),
                    )
                    for raw in users
                ],
                pending_invites=[
                    raw.get("email", "") for raw in invites
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


class OpenAIMember(BaseModel):
    """A member of an OpenAI organization."""

    id: str
    email: str = ""
    name: str = ""
    role: str = "reader"
    added_at: Optional[int] = None


class OpenAIOrganization(BaseModel):
    """OpenAI organization representation."""

    id: str
    name: str = ""
    mfa_required: bool = False
    sso_enforced: bool = False
    domain_verified: bool = False
    zero_data_retention: bool = False
    data_retention_days: Optional[int] = None
    training_opt_out: bool = True
    audit_log_readable: bool = False
    audit_log_export_configured: bool = False
    members: list[OpenAIMember] = Field(default_factory=list)
    pending_invites: list[str] = Field(default_factory=list)
