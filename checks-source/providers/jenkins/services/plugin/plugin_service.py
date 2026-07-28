from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.jenkins.lib.service.service import JenkinsService


class Plugin(JenkinsService):
    """Retrieve installed Jenkins plugins and the update centre advisories for them."""

    def __init__(self, provider):
        super().__init__("Plugin", provider)
        self.plugins: dict[str, JenkinsPlugin] = {}
        self._list_plugins()
        self._get_security_warnings()

    def _list_plugins(self):
        try:
            data = self._get(
                "/pluginManager/api/json",
                params={"depth": "1"},
            ) or {}
            for raw in data.get("plugins", []):
                plugin = JenkinsPlugin(
                    short_name=raw.get("shortName", ""),
                    long_name=raw.get("longName", ""),
                    version=str(raw.get("version", "")),
                    enabled=raw.get("enabled", False),
                    active=raw.get("active", False),
                    has_update=raw.get("hasUpdate", False),
                    deprecated=bool(raw.get("deprecations")),
                    url=raw.get("url"),
                )
                self.plugins[plugin.short_name] = plugin
            logger.info(f"Plugin - Found {len(self.plugins)} plugin(s)")
        except Exception as error:
            logger.error(
                f"Plugin - Error listing plugins: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_security_warnings(self):
        """Attach update centre security advisories to the installed plugins."""
        try:
            data = self._get("/updateCenter/api/json", params={"depth": "2"}) or {}
            for site in data.get("sites", []):
                for warning in site.get("securityWarnings", []) or []:
                    name = warning.get("plugin") or warning.get("name", "")
                    plugin = self.plugins.get(name)
                    if plugin is None:
                        continue
                    plugin.security_warnings.append(
                        JenkinsSecurityWarning(
                            id=warning.get("id", ""),
                            message=warning.get("message", ""),
                            url=warning.get("url", ""),
                        )
                    )
        except Exception as error:
            logger.error(
                f"Plugin - Error fetching security warnings: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class JenkinsSecurityWarning(BaseModel):
    """An update centre security advisory affecting an installed plugin."""

    id: str = ""
    message: str = ""
    url: str = ""


class JenkinsPlugin(BaseModel):
    """Jenkins plugin representation."""

    short_name: str
    long_name: str = ""
    version: str = ""
    enabled: bool = False
    active: bool = False
    has_update: bool = False
    deprecated: bool = False
    url: Optional[str] = None
    security_warnings: list[JenkinsSecurityWarning] = Field(default_factory=list)
