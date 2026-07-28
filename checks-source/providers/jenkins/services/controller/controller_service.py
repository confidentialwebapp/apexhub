import json

from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.jenkins.lib.service.service import JenkinsService

# Jenkins exposes most of its security configuration only through the object
# model, not the REST API, so the controller posture is read with a read-only
# Groovy expression evaluated on the controller.
SECURITY_SCRIPT = """
import jenkins.model.Jenkins
import jenkins.security.s2m.AdminWhitelistRule
import hudson.security.csrf.DefaultCrumbIssuer

def j = Jenkins.get()
def realm = j.getSecurityRealm()
def strategy = j.getAuthorizationStrategy()
def crumb = j.getCrumbIssuer()
def rule = j.getInjector()?.getInstance(AdminWhitelistRule.class)

println groovy.json.JsonOutput.toJson([
  version              : j.getVersion(),
  useSecurity          : j.isUseSecurity(),
  securityRealm        : realm?.getClass()?.getName(),
  authorizationStrategy: strategy?.getClass()?.getName(),
  crumbIssuer          : crumb?.getClass()?.getName(),
  crumbProxyCompat     : (crumb instanceof DefaultCrumbIssuer) ? crumb.isExcludeClientIPFromCrumb() : false,
  agentToControllerAcl : rule == null ? null : !rule.getMasterKillSwitch(),
  rootUrl              : j.getRootUrl(),
  slaveAgentPort       : j.getSlaveAgentPort(),
])
"""


class Controller(JenkinsService):
    """Retrieve the global security configuration of a Jenkins controller."""

    def __init__(self, provider):
        super().__init__("Controller", provider)
        self.controller: Optional[JenkinsController] = None
        self._get_controller()

    def _run_script(self, script: str) -> Optional[str]:
        """Evaluate a read-only Groovy expression through the script console."""
        try:
            response = self._http_session.post(
                f"{self._base_url}/scriptText",
                data={"script": script},
                timeout=60,
            )
            if response.status_code in (401, 403):
                logger.info(
                    "Controller - Script console access denied; the token needs "
                    "Overall/Administer to read the security configuration."
                )
                return None
            response.raise_for_status()
            return response.text
        except Exception as error:
            logger.error(
                f"Controller - Error evaluating script: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )
            return None

    def _get_controller(self):
        try:
            root = self._get("/api/json") or {}
            output = self._run_script(SECURITY_SCRIPT)
            config = json.loads(output) if output else {}

            self.controller = JenkinsController(
                url=self._base_url,
                version=config.get("version", root.get("version", "unknown")),
                use_security=bool(config.get("useSecurity", False)),
                security_realm=config.get("securityRealm"),
                authorization_strategy=config.get("authorizationStrategy"),
                crumb_issuer=config.get("crumbIssuer"),
                crumb_excludes_client_ip=bool(config.get("crumbProxyCompat", False)),
                agent_to_controller_access_control=config.get("agentToControllerAcl"),
                root_url=config.get("rootUrl") or root.get("url"),
                agent_port=config.get("slaveAgentPort"),
            )
            logger.info(f"Controller - Read configuration for {self._base_url}")
        except Exception as error:
            logger.error(
                f"Controller - Error reading controller configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class JenkinsController(BaseModel):
    """Jenkins controller representation."""

    url: str
    version: str = "unknown"
    use_security: bool = False
    security_realm: Optional[str] = None
    authorization_strategy: Optional[str] = None
    crumb_issuer: Optional[str] = None
    crumb_excludes_client_ip: bool = False
    agent_to_controller_access_control: Optional[bool] = None
    root_url: Optional[str] = None
    agent_port: Optional[int] = None
