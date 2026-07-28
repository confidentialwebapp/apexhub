/** Jenkins (self-hosted controller) — build system and supply-chain posture. */

const controller_service = `import json

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
`;

const plugin_service = `from typing import Optional

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
`;

const job_service = `from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.jenkins.lib.service.service import JenkinsService


class Job(JenkinsService):
    """Retrieve Jenkins jobs with their raw configuration and retention policy."""

    def __init__(self, provider):
        super().__init__("Job", provider)
        self.jobs: dict[str, JenkinsJob] = {}
        self._list_jobs()
        self.__threading_call__(self._get_job_config, list(self.jobs.values()))

    def _list_jobs(self):
        try:
            data = self._get(
                "/api/json",
                params={"tree": "jobs[name,url,fullName,_class,color]"},
            ) or {}
            for raw in data.get("jobs", []):
                job = JenkinsJob(
                    full_name=raw.get("fullName", raw.get("name", "")),
                    name=raw.get("name", ""),
                    url=raw.get("url", ""),
                    job_class=raw.get("_class", ""),
                )
                self.jobs[job.full_name] = job
            logger.info(f"Job - Found {len(self.jobs)} job(s)")
        except Exception as error:
            logger.error(
                f"Job - Error listing jobs: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _get_job_config(self, job: "JenkinsJob"):
        try:
            response = self._http_session.get(
                f"{job.url.rstrip('/')}/config.xml", timeout=30
            )
            if response.status_code in (401, 403, 404):
                logger.info(f"Job - Config not readable for {job.full_name}.")
                return
            response.raise_for_status()
            job.config_xml = response.text

            # Log rotation is expressed as a build discarder in the job config.
            job.log_rotation_configured = (
                "<logRotator" in job.config_xml or "BuildDiscarderProperty" in job.config_xml
            )
        except Exception as error:
            logger.error(
                f"Job - Error fetching config for {job.full_name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class JenkinsJob(BaseModel):
    """Jenkins job representation."""

    full_name: str
    name: str = ""
    url: str = ""
    job_class: str = ""
    config_xml: Optional[str] = None
    log_rotation_configured: bool = False
`;

export default {
  id: "jenkins",
  name: "Jenkins",
  pyClass: "Jenkins",
  baseUrl: "https://jenkins.example.com",
  selfHosted: true,
  samplePath: "/api/json",
  errorCodeBase: 14200,
  credentialsRemediation:
    "Set JENKINS_URL to the controller URL and JENKINS_TOKEN to a base64-encoded 'user:api-token' pair. Generate the API token under the user's Configure page; Overall/Administer is required to read the security configuration.",
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Jenkins assesses a Jenkins controller across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It covers the authorization strategy, agent-to-controller isolation, CSRF protection, plugin advisories and credential handling in job configuration — the controls that decide whether a build system can be turned into a deployment backdoor.",

  auth: { header: "Authorization", scheme: "Basic" },

  services: {
    controller: { pyClass: "Controller", source: controller_service },
    plugin: { pyClass: "Plugin", source: plugin_service },
    job: { pyClass: "Job", source: job_service },
  },

  checks: [
    {
      id: "jenkins_controller_authorization_strategy_not_permissive",
      service: "controller",
      pillar: "iam",
      severity: "critical",
      title: "Jenkins controllers do not use a permissive authorization strategy",
      resourceType: "Jenkins::Controller",
      resourceGroup: "iam",
      categories: ["ci-cd", "authentication"],
      description:
        "The Jenkins **authorization strategy** decides what an authenticated user may do. `AuthorizationStrategy$Unsecured` grants everyone full control, and `FullControlOnceLoggedInAuthorizationStrategy` grants every logged-in user administrator rights. This check requires a granular strategy such as matrix or project-based matrix authorization.",
      risk:
        "Administrator rights on a Jenkins controller are equivalent to **arbitrary code execution on every agent**, plus read access to every stored credential. With a permissive strategy, any user who can authenticate — including through an open signup realm — can reach the Groovy script console, decrypt stored deployment credentials and push code to production. Internet-exposed Jenkins instances left in this state are routinely mass-exploited.",
      urls: [
        "https://www.jenkins.io/doc/book/security/managing-security/",
        "https://www.jenkins.io/doc/book/security/access-control/",
      ],
      relatedTo: ["jenkins_controller_security_realm_configured"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to Jenkins as an administrator\n2. Go to **Manage Jenkins > Security**\n3. Under **Authorization**, select `Matrix-based security` or `Project-based Matrix Authorization Strategy`\n4. Grant `Overall/Administer` only to the platform team\n5. Grant `Overall/Read` plus per-job permissions to everyone else, and remove all permissions from `Anonymous`\n6. Save, then confirm from a non-admin session that the script console is unreachable",
        terraform:
          '# Jenkins Configuration as Code (jenkins.yaml)\njenkins:\n  authorizationStrategy:\n    projectMatrix:\n      entries:\n        - group:\n            name: "platform-admins"\n            permissions: ["Overall/Administer"]\n        - group:\n            name: "developers"\n            permissions: ["Overall/Read", "Job/Build"]',
        text:
          "Use matrix or project-based matrix authorization, grant Overall/Administer to a named platform group only, and strip all permissions from the anonymous user. Manage the strategy through Configuration as Code so it cannot drift.",
      },
      body: `PERMISSIVE = (
    "hudson.security.AuthorizationStrategy$Unsecured",
    "hudson.security.FullControlOnceLoggedInAuthorizationStrategy",
    "hudson.security.LegacyAuthorizationStrategy",
)

findings = []
controller = controller_client.controller
if controller is None:
    return findings

report = CheckReportJenkins(
    metadata=self.metadata(),
    resource=controller,
    resource_name=controller.url,
    resource_id=controller.url,
)

strategy = controller.authorization_strategy

if strategy is None:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller {controller.url} authorization strategy could not be "
        f"read; grant Overall/Administer to the scanning token to assess it."
    )
elif not controller.use_security:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller {controller.url} has security disabled entirely."
    )
elif strategy in PERMISSIVE:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller {controller.url} uses the permissive authorization "
        f"strategy {strategy.split('.')[-1]}."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Jenkins controller {controller.url} uses the granular authorization "
        f"strategy {strategy.split('.')[-1]}."
    )

findings.append(report)
return findings`,
    },

    {
      id: "jenkins_controller_security_realm_configured",
      service: "controller",
      pillar: "iam",
      severity: "critical",
      title: "Jenkins controllers use a managed security realm",
      resourceType: "Jenkins::Controller",
      resourceGroup: "iam",
      categories: ["ci-cd", "authentication"],
      description:
        "The **security realm** determines how Jenkins authenticates users. `SecurityRealm$None` disables authentication, and the built-in database with signup enabled lets anyone create an account. This check requires a managed realm — LDAP, SAML, OIDC or the built-in database with signup disabled.",
      risk:
        "With authentication disabled or open signup enabled, **anyone who can reach the controller** becomes a user, and combined with a permissive authorization strategy that means immediate administrative access. Because Jenkins holds the credentials used to deploy, this is one of the shortest paths from network exposure to full production compromise.",
      urls: [
        "https://www.jenkins.io/doc/book/security/managing-security/#access-control",
        "https://www.jenkins.io/doc/book/security/securing-jenkins/",
      ],
      relatedTo: ["jenkins_controller_authorization_strategy_not_permissive"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to Jenkins as an administrator\n2. Go to **Manage Jenkins > Security**\n3. Under **Security Realm**, select your identity provider (SAML, OpenID Connect or LDAP)\n4. If using the built-in database, clear **Allow users to sign up**\n5. Save and verify that an unauthenticated session is redirected to the login page\n6. Disable any local accounts that duplicate identities now managed by the IdP",
        terraform:
          '# Jenkins Configuration as Code (jenkins.yaml)\njenkins:\n  securityRealm:\n    oic:\n      clientId: "${JENKINS_OIDC_CLIENT_ID}"\n      wellKnownOpenIDConfigurationUrl: "https://idp.example.com/.well-known/openid-configuration"\n  # or, for the built-in database:\n  # local:\n  #   allowsSignup: false',
        text:
          "Authenticate Jenkins against your corporate identity provider so joiner-mover-leaver processes apply, and never leave signup enabled on the built-in user database.",
      },
      body: `INSECURE_REALMS = (
    "hudson.security.SecurityRealm$None",
    "hudson.security.LegacySecurityRealm",
)

findings = []
controller = controller_client.controller
if controller is None:
    return findings

report = CheckReportJenkins(
    metadata=self.metadata(),
    resource=controller,
    resource_name=controller.url,
    resource_id=controller.url,
)

realm = controller.security_realm

if not controller.use_security or realm is None or realm in INSECURE_REALMS:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller {controller.url} does not use a managed security "
        f"realm (realm: {realm or 'none'})."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Jenkins controller {controller.url} authenticates users through "
        f"{realm.split('.')[-1]}."
    )

findings.append(report)
return findings`,
    },

    {
      id: "jenkins_controller_csrf_protection_enabled",
      service: "controller",
      pillar: "attacksurface",
      severity: "high",
      title: "Jenkins controllers enable CSRF protection",
      resourceType: "Jenkins::Controller",
      resourceGroup: "network",
      categories: ["ci-cd"],
      description:
        "Jenkins issues a **crumb** that state-changing requests must present, preventing another site from acting as an authenticated user's browser. This check verifies that a crumb issuer is configured and that it does not exclude the client IP from the crumb, which weakens the token.",
      risk:
        "Without CSRF protection, visiting a hostile page while signed in to Jenkins is enough for that page to **trigger builds, modify jobs or create an administrator account** using the victim's session. Because Jenkins builds execute arbitrary code with production credentials, a single click by an administrator can hand over the build system.",
      urls: [
        "https://www.jenkins.io/doc/book/security/csrf-protection/",
        "https://www.jenkins.io/doc/book/security/managing-security/",
      ],
      remediation: {
        cli: "",
        other:
          "1. Sign in to Jenkins as an administrator\n2. Go to **Manage Jenkins > Security**\n3. Under **CSRF Protection**, ensure a crumb issuer is selected\n4. Clear **Enable proxy compatibility** unless a reverse proxy genuinely requires it, since it removes the client IP from the crumb\n5. Save and confirm that scripted API clients send the `Jenkins-Crumb` header",
        terraform:
          '# Jenkins Configuration as Code (jenkins.yaml)\njenkins:\n  crumbIssuer:\n    standard:\n      excludeClientIPFromCrumb: false',
        text:
          "Keep the default crumb issuer enabled and leave proxy compatibility off so the crumb remains bound to the client IP. Update API clients to fetch and send the crumb header rather than disabling the protection.",
      },
      body: `findings = []
controller = controller_client.controller
if controller is None:
    return findings

report = CheckReportJenkins(
    metadata=self.metadata(),
    resource=controller,
    resource_name=controller.url,
    resource_id=controller.url,
)

if not controller.crumb_issuer:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller {controller.url} has CSRF protection disabled."
    )
elif controller.crumb_excludes_client_ip:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller {controller.url} enables CSRF protection but excludes "
        f"the client IP from the crumb, weakening it."
    )
else:
    report.status = "PASS"
    report.status_extended = (
        f"Jenkins controller {controller.url} enables CSRF protection with a "
        f"client-IP-bound crumb."
    )

findings.append(report)
return findings`,
    },

    {
      id: "jenkins_controller_agent_to_controller_access_control_enabled",
      service: "controller",
      pillar: "attacksurface",
      severity: "high",
      title: "Jenkins controllers enforce agent-to-controller access control",
      resourceType: "Jenkins::Controller",
      resourceGroup: "compute",
      categories: ["ci-cd", "trust-boundaries"],
      description:
        "**Agent-to-controller access control** restricts which commands and file paths a build agent may invoke on the controller. This check verifies that the protection is enabled rather than disabled by the master kill switch.",
      risk:
        "Build agents run **untrusted code by design** — every merge request compiles on them. With agent-to-controller access control disabled, a build can read and write arbitrary files on the controller, including the `secrets/` directory holding the master key used to encrypt every stored credential. One malicious pull request then yields the entire credential store.",
      urls: [
        "https://www.jenkins.io/doc/book/security/controller-isolation/",
        "https://www.jenkins.io/doc/book/security/services/",
      ],
      relatedTo: ["jenkins_controller_authorization_strategy_not_permissive"],
      remediation: {
        cli: "",
        other:
          "1. Sign in to Jenkins as an administrator\n2. Go to **Manage Jenkins > Security**\n3. Under **Agent → Controller Security**, ensure the access control is **enabled**\n4. Review the file access rules and command allowlist, removing entries that are no longer needed\n5. Save, then run a representative build to confirm nothing legitimate was relying on the bypass\n6. Do not run builds on the built-in node: set its executor count to `0`",
        terraform:
          '# Jenkins Configuration as Code (jenkins.yaml)\njenkins:\n  numExecutors: 0\n  remotingSecurity:\n    enabled: true',
        text:
          "Enable agent-to-controller access control, set the built-in node's executor count to zero so no build runs on the controller, and keep the file access rules as narrow as the builds allow.",
      },
      body: `findings = []
controller = controller_client.controller
if controller is None:
    return findings

report = CheckReportJenkins(
    metadata=self.metadata(),
    resource=controller,
    resource_name=controller.url,
    resource_id=controller.url,
)

enabled = controller.agent_to_controller_access_control

if enabled is None:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller {controller.url} agent-to-controller access control "
        f"state could not be read."
    )
elif enabled:
    report.status = "PASS"
    report.status_extended = (
        f"Jenkins controller {controller.url} enforces agent-to-controller access "
        f"control."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller {controller.url} has agent-to-controller access "
        f"control disabled."
    )

findings.append(report)
return findings`,
    },

    {
      id: "jenkins_controller_https_enforced",
      service: "controller",
      pillar: "encryption",
      severity: "high",
      title: "Jenkins controllers are served over HTTPS",
      resourceType: "Jenkins::Controller",
      resourceGroup: "network",
      categories: ["encryption"],
      description:
        "This check verifies that the Jenkins root URL uses `https`, so session cookies, API tokens and build output are encrypted in transit between users and the controller.",
      risk:
        "Over plain HTTP, the Jenkins **session cookie and API token travel in cleartext** and can be captured by anyone positioned on the network path, including on a shared office or VPN segment. Because a captured administrator session grants script console access, this escalates directly to code execution on every build agent.",
      urls: [
        "https://www.jenkins.io/doc/book/system-administration/security/",
        "https://www.jenkins.io/doc/book/installing/initial-settings/",
      ],
      remediation: {
        cli: "",
        other:
          "1. Terminate TLS at a reverse proxy (nginx, Apache, or a cloud load balancer) in front of Jenkins, or configure the built-in Jetty listener with a keystore\n2. Redirect all HTTP traffic to HTTPS at the proxy\n3. Go to **Manage Jenkins > System** and set the **Jenkins URL** to the `https://` address\n4. Enable HSTS at the proxy\n5. Bind the Jenkins HTTP listener to `127.0.0.1` so it is reachable only through the proxy",
        terraform:
          '# Jenkins Configuration as Code (jenkins.yaml)\nunclassified:\n  location:\n    url: "https://jenkins.example.com/"\n    adminAddress: "platform@example.com"',
        text:
          "Serve Jenkins over HTTPS with a valid certificate, redirect HTTP to HTTPS, set the Jenkins URL to the https address, and bind the plain HTTP listener to localhost only.",
      },
      body: `findings = []
controller = controller_client.controller
if controller is None:
    return findings

report = CheckReportJenkins(
    metadata=self.metadata(),
    resource=controller,
    resource_name=controller.url,
    resource_id=controller.url,
)

root_url = controller.root_url or controller.url

if root_url.startswith("https://"):
    report.status = "PASS"
    report.status_extended = (
        f"Jenkins controller is served over HTTPS at {root_url}."
    )
else:
    report.status = "FAIL"
    report.status_extended = (
        f"Jenkins controller is not served over HTTPS (root URL: {root_url})."
    )

findings.append(report)
return findings`,
    },

    {
      id: "jenkins_plugin_no_known_vulnerabilities",
      service: "plugin",
      pillar: "attacksurface",
      severity: "critical",
      title: "Jenkins plugins have no known security advisories",
      resourceType: "Jenkins::Plugin",
      resourceGroup: "compute",
      categories: ["ci-cd", "vulnerability-management"],
      description:
        "The Jenkins update centre publishes **security warnings** for plugin versions with known vulnerabilities. This check reports installed plugins that carry an advisory for the version in use.",
      risk:
        "Plugins execute inside the controller JVM with **full controller privileges**, so a vulnerable plugin is not a peripheral concern — advisories routinely describe unauthenticated remote code execution or credential disclosure. Jenkins plugin CVEs are widely weaponised within days of publication, and an exposed controller running a flagged plugin is a standard mass-scanning target.",
      urls: [
        "https://www.jenkins.io/security/advisories/",
        "https://www.jenkins.io/doc/book/managing/plugins/",
      ],
      relatedTo: ["jenkins_plugin_no_deprecated_or_unmaintained"],
      remediation: {
        cli: "java -jar jenkins-cli.jar -s \"$JENKINS_URL\" -auth @token install-plugin <plugin>:<fixed-version> -restart",
        other:
          "1. Sign in to Jenkins as an administrator\n2. Go to **Manage Jenkins > Plugins > Updates**\n3. Update every plugin listed with a security warning to the fixed version\n4. Where no fix exists, uninstall the plugin and remove the jobs that depend on it\n5. Restart the controller to load the updated plugins\n6. Subscribe to the Jenkins security advisory mailing list so future advisories are seen promptly",
        terraform:
          '# plugins.txt consumed by the jenkins/jenkins image plugin installer\n# Pin fixed versions and update them through your normal change process.\ngit:5.2.2\ncredentials:1337.v60b_d7b_c7b_c9d\nworkflow-cps:3908.vd6b_b_5a_a_74b_45',
        text:
          "Update or remove every plugin carrying a security advisory, restart the controller, and pin plugin versions in a managed manifest so updates go through change control instead of ad-hoc clicks.",
      },
      body: `findings = []
for plugin in plugin_client.plugins.values():
    if not plugin.security_warnings:
        continue

    report = CheckReportJenkins(
        metadata=self.metadata(),
        resource=plugin,
        resource_name=plugin.short_name,
        resource_id=f"{plugin.short_name}:{plugin.version}",
    )

    advisories = ", ".join(
        warning.id for warning in plugin.security_warnings if warning.id
    )
    report.status = "FAIL"
    report.status_extended = (
        f"Plugin {plugin.short_name} {plugin.version} has "
        f"{len(plugin.security_warnings)} security advisory(ies)"
        f"{': ' + advisories if advisories else ''}."
    )
    findings.append(report)

for plugin in plugin_client.plugins.values():
    if plugin.security_warnings:
        continue

    report = CheckReportJenkins(
        metadata=self.metadata(),
        resource=plugin,
        resource_name=plugin.short_name,
        resource_id=f"{plugin.short_name}:{plugin.version}",
    )
    report.status = "PASS"
    report.status_extended = (
        f"Plugin {plugin.short_name} {plugin.version} has no known security "
        f"advisories."
    )
    findings.append(report)

return findings`,
    },

    {
      id: "jenkins_plugin_no_deprecated_or_unmaintained",
      service: "plugin",
      pillar: "attacksurface",
      severity: "medium",
      title: "Jenkins plugins are not deprecated and are up to date",
      resourceType: "Jenkins::Plugin",
      resourceGroup: "compute",
      categories: ["ci-cd", "vulnerability-management"],
      description:
        "This check reports installed plugins marked **deprecated** by the update centre, and enabled plugins with a pending update, both of which indicate that the controller is drifting away from a supportable configuration.",
      risk:
        "A deprecated plugin receives **no security fixes**, so any vulnerability found in it stays permanently unpatched inside the controller JVM. Accumulated pending updates also make emergency patching slower: when an advisory lands, a controller many versions behind cannot take the fix without a risky bulk upgrade, extending the exposure window.",
      urls: [
        "https://www.jenkins.io/doc/book/managing/plugins/",
        "https://www.jenkins.io/doc/developer/plugin-governance/deprecating-plugins/",
      ],
      relatedTo: ["jenkins_plugin_no_known_vulnerabilities"],
      remediation: {
        cli: "java -jar jenkins-cli.jar -s \"$JENKINS_URL\" -auth @token list-plugins | grep -e ')$'",
        other:
          "1. Sign in to Jenkins as an administrator\n2. Go to **Manage Jenkins > Plugins > Installed plugins**\n3. Identify plugins flagged as deprecated and find the documented replacement\n4. Migrate the affected jobs, then uninstall the deprecated plugin\n5. Apply pending updates on a regular cadence rather than only when an advisory forces it\n6. Uninstall plugins that no job actually uses — the smallest plugin set is the easiest to keep current",
        terraform:
          '# Track the intended plugin set in version control and apply it on rebuild:\n#   docker build --build-arg PLUGINS_FILE=plugins.txt .\n# Review plugins.txt each release for deprecated entries.',
        text:
          "Replace deprecated plugins with their documented successors, keep the remainder current on a regular cadence, and uninstall plugins no job uses so the update surface stays small.",
      },
      body: `findings = []
for plugin in plugin_client.plugins.values():
    report = CheckReportJenkins(
        metadata=self.metadata(),
        resource=plugin,
        resource_name=plugin.short_name,
        resource_id=f"{plugin.short_name}:{plugin.version}",
    )

    if plugin.deprecated:
        report.status = "FAIL"
        report.status_extended = (
            f"Plugin {plugin.short_name} {plugin.version} is deprecated and no "
            f"longer receives security fixes."
        )
    elif plugin.enabled and plugin.has_update:
        report.status = "FAIL"
        report.status_extended = (
            f"Plugin {plugin.short_name} {plugin.version} is enabled and has a "
            f"pending update."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Plugin {plugin.short_name} {plugin.version} is supported and up to date."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "jenkins_job_no_plaintext_secrets_in_config",
      service: "job",
      pillar: "encryption",
      severity: "critical",
      title: "Jenkins job configurations contain no plaintext secrets",
      resourceType: "Jenkins::Job",
      resourceGroup: "secrets",
      categories: ["ci-cd", "secrets"],
      description:
        "This check scans each job's `config.xml` for credential-like literals — API keys, tokens, passwords and private key blocks — that are stored directly in the job definition rather than referenced from the Jenkins credentials store.",
      risk:
        "A secret written into `config.xml` is stored **unencrypted on the controller filesystem**, is visible to every user with Job/Configure, and is copied into any backup, `job/*/config.xml` API response and Configuration-as-Code export. Unlike a credentials-store entry it is never masked in build logs, so it also leaks to anyone who can read a build.",
      urls: [
        "https://www.jenkins.io/doc/book/using/using-credentials/",
        "https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#handling-credentials",
      ],
      remediation: {
        cli: "",
        other:
          "1. Add the secret to **Manage Jenkins > Credentials** as a Secret text or Username with password credential\n2. Reference it from the pipeline with `withCredentials([string(credentialsId: 'my-secret', variable: 'TOKEN')])`\n3. Remove the literal from the job configuration\n4. Rotate the secret: it has been readable on disk, in backups and in the config API\n5. Restrict `Job/Configure` so fewer users can read job definitions\n6. Prefer short-lived credentials issued per build over long-lived stored secrets",
        terraform:
          "// Jenkinsfile\nwithCredentials([string(credentialsId: 'deploy-token', variable: 'DEPLOY_TOKEN')]) {\n  sh 'deploy.sh'   // $DEPLOY_TOKEN is masked in the build log\n}",
        text:
          "Move every literal secret from job configuration into the Jenkins credentials store, reference it through withCredentials so it is masked in logs, and rotate anything that was previously stored in plaintext.",
      },
      body: `import re

# Credential-shaped literals: an assignment to a secret-ish name, or a PEM block.
SECRET_PATTERNS = (
    re.compile(
        r"(password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key)"
        r"\\s*[:=>]\\s*[\\"']?[A-Za-z0-9/+=_\\-]{12,}",
        re.IGNORECASE,
    ),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\\bAKIA[0-9A-Z]{16}\\b"),
    re.compile(r"\\bghp_[A-Za-z0-9]{36}\\b"),
)

# Jenkins stores credentials-plugin values encrypted in this wrapper element.
ENCRYPTED = re.compile(r"<[^>]*class=\\"hudson.util.Secret\\"[^>]*>|\\{AQA[A-Za-z0-9+/=]+\\}")

findings = []
for job in job_client.jobs.values():
    if not job.config_xml:
        continue

    report = CheckReportJenkins(
        metadata=self.metadata(),
        resource=job,
        resource_name=job.full_name,
        resource_id=job.full_name,
    )

    config = ENCRYPTED.sub("", job.config_xml)
    matched = [
        pattern.pattern for pattern in SECRET_PATTERNS if pattern.search(config)
    ]

    if matched:
        report.status = "FAIL"
        report.status_extended = (
            f"Job {job.full_name} configuration contains {len(matched)} "
            f"plaintext credential pattern(s)."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Job {job.full_name} configuration contains no plaintext credentials."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "jenkins_job_build_log_retention_configured",
      service: "job",
      pillar: "logging",
      severity: "low",
      title: "Jenkins jobs have a build log retention policy",
      resourceType: "Jenkins::Job",
      resourceGroup: "logging",
      categories: ["logging", "ci-cd"],
      description:
        "This check verifies that each job defines a **build discarder**, setting how many builds and logs are kept. A defined policy makes retention an explicit decision rather than an accident of disk space.",
      risk:
        "With no discarder, build history grows without bound until the controller **runs out of disk** and stops scheduling, and administrators then delete history in bulk under pressure — destroying the record needed to determine what a compromised pipeline actually built. Conversely, indefinite retention keeps build logs containing internal hostnames and occasionally leaked secrets available far longer than any policy intends.",
      urls: [
        "https://www.jenkins.io/doc/book/pipeline/syntax/#options",
        "https://www.jenkins.io/doc/book/managing/system-configuration/",
      ],
      remediation: {
        cli: "",
        other:
          "1. Open the job in Jenkins\n2. Click **Configure**\n3. Enable **Discard old builds**\n4. Set **Max # of builds to keep** and **Days to keep builds** to match your retention policy\n5. Use **Advanced** to keep artifacts for a shorter window than logs\n6. For pipelines, declare it in the Jenkinsfile so the policy is version controlled\n7. Ship build logs to a central log store if you need retention beyond the controller",
        terraform:
          "// Jenkinsfile\noptions {\n  buildDiscarder(logRotator(numToKeepStr: '50', daysToKeepStr: '90', artifactNumToKeepStr: '5'))\n}",
        text:
          "Declare a build discarder in the Jenkinsfile so retention is version controlled, keep artifacts for a shorter window than logs, and forward logs to a central store when longer retention is required for investigations.",
      },
      body: `findings = []
for job in job_client.jobs.values():
    if job.config_xml is None:
        continue

    report = CheckReportJenkins(
        metadata=self.metadata(),
        resource=job,
        resource_name=job.full_name,
        resource_id=job.full_name,
    )

    if job.log_rotation_configured:
        report.status = "PASS"
        report.status_extended = (
            f"Job {job.full_name} defines a build log retention policy."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Job {job.full_name} does not define a build log retention policy."
        )

    findings.append(report)

return findings`,
    },
  ],
};
