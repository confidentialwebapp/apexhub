from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.terraformcloud.lib.service.service import TerraformCloudService


class Organization(TerraformCloudService):
    """Retrieve HCP Terraform organizations with their authentication policy."""

    def __init__(self, provider):
        super().__init__("Organization", provider)
        self.organizations: dict[str, TerraformOrganization] = {}
        self._list_organizations()
        self.__threading_call__(
            self._get_audit_configuration, list(self.organizations.values())
        )

    def _list_organizations(self):
        try:
            for raw in self._paginate("/api/v2/organizations", "data"):
                attributes = raw.get("attributes") or {}
                organization = TerraformOrganization(
                    name=raw.get("id", ""),
                    email=attributes.get("email", ""),
                    two_factor_conformant=bool(
                        attributes.get("two-factor-conformant", False)
                    ),
                    sso_enabled=bool(attributes.get("saml-enabled", False)),
                    collaborator_auth_policy=attributes.get(
                        "collaborator-auth-policy", "password"
                    ),
                    owners_team_saml_role_id=attributes.get(
                        "owners-team-saml-role-id"
                    ),
                )
                self.organizations[organization.name] = organization
            logger.info(
                f"Organization - Found {len(self.organizations)} organization(s)"
            )
        except Exception as error:
            logger.error(
                f"Organization - Error listing organizations: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_audit_configuration(self, organization: "TerraformOrganization"):
        """Confirm the audit trail is readable for the organization."""
        try:
            trail = self._get(
                "/api/v2/organization/audit-trails",
                params={"page[size]": 1},
            )
            organization.audit_trail_readable = trail is not None
        except Exception as error:
            logger.error(
                f"Organization - Error reading audit trail for {organization.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class TerraformOrganization(BaseModel):
    """HCP Terraform organization representation."""

    name: str
    email: str = ""
    two_factor_conformant: bool = False
    sso_enabled: bool = False
    collaborator_auth_policy: str = "password"
    owners_team_saml_role_id: Optional[str] = None
    audit_trail_readable: bool = False
