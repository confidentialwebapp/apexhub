from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.atlassian.lib.service.service import AtlassianService


class Organization(AtlassianService):
    """Retrieve Atlassian organization authentication policies and domains."""

    def __init__(self, provider):
        super().__init__("Organization", provider)
        self.organization: Optional[AtlassianOrganization] = None
        self._get_organization()

    def _get_organization(self):
        try:
            org_id = self.provider.identity.organization_id
            if not org_id:
                logger.info("Organization - No organization id configured.")
                return

            policies = self._paginate(
                f"/admin/v1/orgs/{org_id}/policies",
                "data",
                params={"type": "authentication-policy"},
            )
            domains = self._paginate(f"/admin/v1/orgs/{org_id}/domains", "data")
            org = self._get(f"/admin/v1/orgs/{org_id}") or {}
            attributes = (org.get("data") or {}).get("attributes") or {}

            self.organization = AtlassianOrganization(
                id=org_id,
                name=attributes.get("name", ""),
                data_residency_region=attributes.get("region"),
                byok_enabled=bool(attributes.get("byokEnabled", False)),
                verified_domains=[
                    (domain.get("attributes") or {}).get("name", "")
                    for domain in domains
                    if (domain.get("attributes") or {}).get("status") == "VERIFIED"
                ],
                authentication_policies=[
                    AtlassianAuthPolicy(
                        id=policy.get("id", ""),
                        name=(policy.get("attributes") or {}).get("name", ""),
                        status=(policy.get("attributes") or {}).get(
                            "status", "disabled"
                        ),
                        sso_enforced=bool(
                            ((policy.get("attributes") or {}).get("ssoEnforced"))
                        ),
                        two_step_required=bool(
                            ((policy.get("attributes") or {}).get(
                                "twoStepVerificationRequired"
                            ))
                        ),
                        api_token_access=str(
                            (policy.get("attributes") or {}).get(
                                "apiTokenAccess", "unrestricted"
                            )
                        ),
                        is_default=bool(
                            (policy.get("attributes") or {}).get("defaultPolicy", False)
                        ),
                    )
                    for policy in policies
                ],
            )
            self._get_audit_settings()
            logger.info(
                f"Organization - Read configuration for {self.organization.name or org_id}"
            )
        except Exception as error:
            logger.error(
                f"Organization - Error reading organization configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_audit_settings(self):
        """Confirm the organization audit log is readable."""
        if self.organization is None:
            return
        try:
            events = self._get(
                f"/admin/v1/orgs/{self.organization.id}/events",
                params={"limit": 1},
            )
            self.organization.audit_log_readable = events is not None
        except Exception as error:
            logger.error(
                f"Organization - Error reading audit log: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class AtlassianAuthPolicy(BaseModel):
    """An Atlassian organization authentication policy."""

    id: str
    name: str = ""
    status: str = "disabled"
    sso_enforced: bool = False
    two_step_required: bool = False
    api_token_access: str = "unrestricted"
    is_default: bool = False


class AtlassianOrganization(BaseModel):
    """Atlassian organization representation."""

    id: str
    name: str = ""
    data_residency_region: Optional[str] = None
    byok_enabled: bool = False
    audit_log_readable: bool = False
    verified_domains: list[str] = Field(default_factory=list)
    authentication_policies: list[AtlassianAuthPolicy] = Field(default_factory=list)
