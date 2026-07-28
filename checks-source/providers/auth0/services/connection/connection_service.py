from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.auth0.lib.service.service import Auth0Service


class Connection(Auth0Service):
    """Retrieve Auth0 connections with their password and signup policies."""

    def __init__(self, provider):
        super().__init__("Connection", provider)
        self.connections: dict[str, Auth0Connection] = {}
        self._list_connections()

    def _list_connections(self):
        try:
            for raw in self._paginate("/api/v2/connections", "connections"):
                options = raw.get("options") or {}
                validation = options.get("passwordPolicy")
                complexity = (options.get("password_complexity_options") or {})
                connection = Auth0Connection(
                    id=raw.get("id", ""),
                    name=raw.get("name", ""),
                    strategy=raw.get("strategy", ""),
                    enabled_clients=raw.get("enabled_clients") or [],
                    password_policy=validation or "none",
                    min_password_length=complexity.get("min_length"),
                    brute_force_protection=bool(
                        options.get("brute_force_protection", False)
                    ),
                    disable_signup=bool(options.get("disable_signup", False)),
                    requires_username=bool(options.get("requires_username", False)),
                    import_mode=bool(options.get("import_mode", False)),
                )
                self.connections[connection.id] = connection
            logger.info(f"Connection - Found {len(self.connections)} connection(s)")
        except Exception as error:
            logger.error(
                f"Connection - Error listing connections: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class Auth0Connection(BaseModel):
    """Auth0 connection representation."""

    id: str
    name: str = ""
    strategy: str = ""
    enabled_clients: list[str] = Field(default_factory=list)
    password_policy: str = "none"
    min_password_length: Optional[int] = None
    brute_force_protection: bool = False
    disable_signup: bool = False
    requires_username: bool = False
    import_mode: bool = False
