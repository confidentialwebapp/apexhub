from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.auth0.lib.service.service import Auth0Service


class Tenant(Auth0Service):
    """Retrieve Auth0 tenant settings, attack protection and log streams."""

    def __init__(self, provider):
        super().__init__("Tenant", provider)
        self.tenant: Optional[Auth0Tenant] = None
        self._get_tenant()

    def _get_tenant(self):
        try:
            settings = self._get("/api/v2/tenants/settings") or {}
            brute_force = self._get("/api/v2/attack-protection/brute-force-protection") or {}
            suspicious = (
                self._get("/api/v2/attack-protection/suspicious-ip-throttling") or {}
            )
            breached = (
                self._get("/api/v2/attack-protection/breached-password-detection") or {}
            )
            streams = self._get("/api/v2/log-streams") or []
            guardian = self._get("/api/v2/guardian/factors") or []

            self.tenant = Auth0Tenant(
                name=settings.get("friendly_name", "") or self._base_url,
                domain=self._base_url,
                idle_session_lifetime_hours=settings.get("idle_session_lifetime"),
                session_lifetime_hours=settings.get("session_lifetime"),
                brute_force_protection=bool(brute_force.get("enabled", False)),
                suspicious_ip_throttling=bool(suspicious.get("enabled", False)),
                breached_password_detection=bool(breached.get("enabled", False)),
                log_streams=[
                    Auth0LogStream(
                        id=raw.get("id", ""),
                        name=raw.get("name", ""),
                        type=raw.get("type", ""),
                        status=raw.get("status", "paused"),
                    )
                    for raw in streams
                    if isinstance(raw, dict)
                ],
                enabled_mfa_factors=[
                    raw.get("name", "")
                    for raw in guardian
                    if isinstance(raw, dict) and raw.get("enabled")
                ],
            )
            logger.info(f"Tenant - Read configuration for {self.tenant.name}")
        except Exception as error:
            logger.error(
                f"Tenant - Error reading tenant configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class Auth0LogStream(BaseModel):
    """An Auth0 log stream delivering tenant events to an external sink."""

    id: str
    name: str = ""
    type: str = ""
    status: str = "paused"


class Auth0Tenant(BaseModel):
    """Auth0 tenant representation."""

    name: str
    domain: str = ""
    idle_session_lifetime_hours: Optional[int] = None
    session_lifetime_hours: Optional[int] = None
    brute_force_protection: bool = False
    suspicious_ip_throttling: bool = False
    breached_password_detection: bool = False
    log_streams: list[Auth0LogStream] = Field(default_factory=list)
    enabled_mfa_factors: list[str] = Field(default_factory=list)
