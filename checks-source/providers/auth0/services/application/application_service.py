from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.auth0.lib.service.service import Auth0Service


class Application(Auth0Service):
    """Retrieve Auth0 applications with their callback URLs and grant configuration."""

    def __init__(self, provider):
        super().__init__("Application", provider)
        self.applications: dict[str, Auth0Application] = {}
        self._list_applications()

    def _list_applications(self):
        try:
            for raw in self._paginate("/api/v2/clients", "clients", params={
                "fields": "client_id,name,app_type,callbacks,web_origins,"
                          "grant_types,token_endpoint_auth_method,oidc_conformant,"
                          "refresh_token,jwt_configuration,cross_origin_authentication",
                "include_fields": "true",
            }):
                refresh = raw.get("refresh_token") or {}
                jwt_config = raw.get("jwt_configuration") or {}
                app = Auth0Application(
                    client_id=raw.get("client_id", ""),
                    name=raw.get("name", ""),
                    app_type=raw.get("app_type", "non_interactive"),
                    callbacks=raw.get("callbacks") or [],
                    web_origins=raw.get("web_origins") or [],
                    grant_types=raw.get("grant_types") or [],
                    token_endpoint_auth_method=raw.get(
                        "token_endpoint_auth_method", "none"
                    ),
                    oidc_conformant=bool(raw.get("oidc_conformant", False)),
                    cross_origin_authentication=bool(
                        raw.get("cross_origin_authentication", False)
                    ),
                    refresh_token_rotation=(
                        refresh.get("rotation_type", "non-rotating") == "rotating"
                    ),
                    refresh_token_expiration=refresh.get(
                        "expiration_type", "non-expiring"
                    ),
                    signing_algorithm=jwt_config.get("alg", "HS256"),
                )
                self.applications[app.client_id] = app
            logger.info(
                f"Application - Found {len(self.applications)} application(s)"
            )
        except Exception as error:
            logger.error(
                f"Application - Error listing applications: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class Auth0Application(BaseModel):
    """Auth0 application (client) representation."""

    client_id: str
    name: str = ""
    app_type: str = "non_interactive"
    callbacks: list[str] = Field(default_factory=list)
    web_origins: list[str] = Field(default_factory=list)
    grant_types: list[str] = Field(default_factory=list)
    token_endpoint_auth_method: str = "none"
    oidc_conformant: bool = False
    cross_origin_authentication: bool = False
    refresh_token_rotation: bool = False
    refresh_token_expiration: str = "non-expiring"
    signing_algorithm: str = "HS256"
