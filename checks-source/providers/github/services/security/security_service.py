from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.github.lib.service.service import GithubService


class Security(GithubService):
    """Retrieve GitHub organization security, Actions and integration settings."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.organizations: dict[str, GithubOrgSecurity] = {}
        self._list_organization_security()

    def _list_organization_security(self):
        for client in self.clients:
            try:
                for org in client.get_user().get_orgs():
                    security = GithubOrgSecurity(
                        id=org.id,
                        name=org.login,
                        advanced_security_enabled=_raw(
                            org, "advanced_security_enabled_for_new_repositories"
                        ),
                        secret_scanning_enabled=_raw(
                            org, "secret_scanning_enabled_for_new_repositories"
                        ),
                        secret_scanning_push_protection=_raw(
                            org,
                            "secret_scanning_push_protection_enabled_for_new_repositories",
                        ),
                        dependabot_alerts_enabled=_raw(
                            org, "dependabot_alerts_enabled_for_new_repositories"
                        ),
                    )
                    self._fetch_actions_permissions(org, security)
                    self._fetch_webhooks(org, security)
                    self._fetch_oauth_policy(org, security)
                    self.organizations[security.name] = security

                logger.info(
                    f"Security - Read configuration for "
                    f"{len(self.organizations)} organization(s)"
                )
            except Exception as error:
                logger.error(
                    f"Security - Error listing organization security settings: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )

    def _fetch_actions_permissions(self, org, security: "GithubOrgSecurity"):
        """Read the default GITHUB_TOKEN permissions for Actions workflows."""
        try:
            _, data = org._requester.requestJsonAndCheck(
                "GET", f"/orgs/{org.login}/actions/permissions/workflow"
            )
            security.default_workflow_permissions = data.get(
                "default_workflow_permissions", "write"
            )
            security.can_approve_pull_request_reviews = bool(
                data.get("can_approve_pull_request_reviews", True)
            )
        except Exception as error:
            logger.info(
                f"Security - Actions permissions not readable for {org.login}: {error}"
            )

    def _fetch_webhooks(self, org, security: "GithubOrgSecurity"):
        try:
            for hook in org.get_hooks():
                config = hook.config or {}
                security.webhooks.append(
                    GithubWebhook(
                        id=hook.id,
                        url=config.get("url", ""),
                        active=bool(hook.active),
                        insecure_ssl=str(config.get("insecure_ssl", "0")) == "1",
                        has_secret=bool(config.get("secret")),
                    )
                )
        except Exception as error:
            logger.info(f"Security - Webhooks not readable for {org.login}: {error}")

    def _fetch_oauth_policy(self, org, security: "GithubOrgSecurity"):
        """Read whether third-party OAuth application access is restricted."""
        try:
            _, data = org._requester.requestJsonAndCheck(
                "GET", f"/orgs/{org.login}"
            )
            # The field is absent when the viewer is not an organization owner.
            restriction = data.get("members_can_create_repositories")
            security.oauth_app_access_restricted = data.get(
                "two_factor_requirement_enabled"
            ) is not None and bool(
                data.get("members_allowed_repository_creation_type") is not None
                or restriction is not None
            )
            security.web_commit_signoff_required = bool(
                data.get("web_commit_signoff_required", False)
            )
        except Exception as error:
            logger.info(
                f"Security - Organization detail not readable for {org.login}: {error}"
            )


def _raw(org, attribute: str) -> Optional[bool]:
    """Read an organization attribute that older API versions may omit."""
    value = getattr(org, attribute, None)
    if value is None:
        value = (getattr(org, "_rawData", None) or {}).get(attribute)
    return None if value is None else bool(value)


class GithubWebhook(BaseModel):
    """An organization webhook."""

    id: int
    url: str = ""
    active: bool = True
    insecure_ssl: bool = False
    has_secret: bool = False


class GithubOrgSecurity(BaseModel):
    """GitHub organization security configuration."""

    id: int
    name: str
    advanced_security_enabled: Optional[bool] = None
    secret_scanning_enabled: Optional[bool] = None
    secret_scanning_push_protection: Optional[bool] = None
    dependabot_alerts_enabled: Optional[bool] = None
    default_workflow_permissions: str = "write"
    can_approve_pull_request_reviews: bool = True
    oauth_app_access_restricted: bool = False
    web_commit_signoff_required: bool = False
    webhooks: list[GithubWebhook] = Field(default_factory=list)
