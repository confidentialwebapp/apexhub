/**
 * Vercel — first-party checks extending the vendored upstream provider.
 *
 * Upstream covers deployment protection, WAF rules and SAML enforcement; this
 * layer adds edge protection state, runtime currency and private compute, all
 * of which are already present on the upstream VercelProject model.
 */

export default {
  id: "vercel",
  name: "Vercel",
  pyClass: "Vercel",
  extendsUpstream: true,
  threatscoreDescription:
    "APEX Hub ThreatScore Compliance Framework for Vercel assesses a Vercel team and its projects across four pillars: Identity and Access Management, Attack Surface, Logging and Monitoring, and Encryption. It extends upstream deployment protection and WAF coverage with per-project firewall state, bot filtering, Node.js runtime currency and private compute egress.",

  checks: [
    {
      id: "project_firewall_enabled",
      service: "project",
      pillar: "attacksurface",
      severity: "high",
      title: "Vercel projects have the firewall enabled",
      resourceType: "Vercel::Project::Firewall",
      resourceGroup: "network",
      categories: ["trust-boundaries", "resilience"],
      description:
        "This check verifies that each project has the **Vercel Firewall** enabled, which is the prerequisite for custom rules, managed rulesets, IP blocking and rate limiting to take effect.",
      risk:
        "With the firewall disabled, every request reaches the application's serverless functions directly, so **abusive traffic is billed and executed rather than dropped at the edge**. Application-layer attacks — credential stuffing against a login route, scraping, or a request flood — become both a security incident and an uncapped cost event, and the WAF rules configured at team level do nothing for that project.",
      urls: [
        "https://vercel.com/docs/security/vercel-firewall",
        "https://vercel.com/docs/security/vercel-waf",
      ],
      relatedTo: ["project_bot_protection_enabled"],
      remediation: {
        cli: "",
        other:
          "1. Open the project in the Vercel dashboard\n2. Go to **Settings > Firewall**\n3. Enable the firewall for the project\n4. Enable the **managed rulesets** appropriate to the application\n5. Add rate limiting on authentication and other expensive routes\n6. Review the firewall observability page after enabling to confirm legitimate traffic is not being blocked\n7. Enable **Attack Challenge Mode** as a documented response for an active incident",
        terraform: "",
        text:
          "Enable the firewall on every project, turn on the relevant managed rulesets, rate-limit authentication routes, and verify legitimate traffic is unaffected before relying on it.",
      },
      body: `findings = []
for project in project_client.projects.values():
    report = CheckReportVercel(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.name,
        resource_id=project.id,
    )

    enabled = project.firewall_enabled

    if enabled is None:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.name} firewall state could not be read; the token "
            f"may lack the required scope or the plan may not include it."
        )
    elif enabled:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.name} has the firewall enabled."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.name} does not have the firewall enabled."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "project_bot_protection_enabled",
      service: "project",
      pillar: "attacksurface",
      severity: "medium",
      title: "Vercel projects enable bot protection",
      resourceType: "Vercel::Project",
      resourceGroup: "network",
      categories: ["trust-boundaries", "resilience"],
      description:
        "**BotID** distinguishes automated clients from real browsers at the edge, before a request reaches a function. This check reports projects with bot protection disabled.",
      risk:
        "Without bot filtering, automated traffic reaches **the routes that cost the most to serve**: login endpoints for credential stuffing, signup forms for fake account creation, and any AI or database-backed route where each request has real compute cost. Because Vercel bills on execution, unfiltered bot traffic is simultaneously a security and a billing exposure, and it obscures genuine user metrics.",
      urls: [
        "https://vercel.com/docs/botid",
        "https://vercel.com/docs/security/vercel-waf/managed-rulesets",
      ],
      relatedTo: ["project_firewall_enabled"],
      remediation: {
        cli: "",
        other:
          "1. Open the project in the Vercel dashboard\n2. Go to **Settings > Security** and enable **BotID**\n3. Protect the specific routes that matter — authentication, signup, checkout, and any AI-backed endpoint\n4. Add the client-side integration so classification has browser signals to work with\n5. Verify legitimate integrations and monitoring probes are not being classified as bots\n6. Combine with rate limiting rather than relying on bot detection alone",
        terraform: "",
        text:
          "Enable BotID and protect authentication, signup and compute-expensive routes, wiring in the client integration and pairing it with rate limiting.",
      },
      body: `findings = []
for project in project_client.projects.values():
    report = CheckReportVercel(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.name,
        resource_id=project.id,
    )

    enabled = project.bot_id_enabled

    if enabled is None:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.name} bot protection state could not be read."
        )
    elif enabled:
        report.status = "PASS"
        report.status_extended = f"Project {project.name} has bot protection enabled."
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.name} does not have bot protection enabled."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "project_node_version_supported",
      service: "project",
      pillar: "attacksurface",
      severity: "medium",
      title: "Vercel projects run a supported Node.js version",
      resourceType: "Vercel::Project",
      resourceGroup: "compute",
      categories: ["vulnerability-management"],
      description:
        "This check reports projects pinned to a Node.js version that has reached end of life and therefore no longer receives security patches from either the Node.js project or Vercel.",
      risk:
        "An end-of-life runtime accumulates **unpatched vulnerabilities in the JavaScript engine and the standard library**, including HTTP request parsing and TLS handling that process untrusted input on every request. Because the runtime sits underneath the application, no amount of application-level review addresses those flaws, and Vercel eventually stops building projects pinned to retired versions.",
      urls: [
        "https://vercel.com/docs/functions/runtimes/node-js",
        "https://vercel.com/docs/functions/runtimes/node-js/node-js-versions",
      ],
      remediation: {
        cli: "",
        other:
          "1. Open the project in the Vercel dashboard\n2. Go to **Settings > General > Node.js Version**\n3. Select the current LTS release\n4. Update the `engines.node` field in `package.json` to match, so local and CI builds agree\n5. Run the test suite against the new version before promoting to production\n6. Deploy to a preview environment first and confirm behaviour, particularly around any native dependencies",
        terraform: "",
        text:
          "Move projects to the current Node.js LTS release, align the engines field in package.json, and validate on a preview deployment before promoting.",
      },
      body: `# Node.js releases past end of life; update as the release schedule advances.
END_OF_LIFE = {"12.x", "14.x", "16.x", "18.x", "12", "14", "16", "18"}

findings = []
for project in project_client.projects.values():
    version = (project.node_version or "").strip()
    if not version:
        continue

    report = CheckReportVercel(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.name,
        resource_id=project.id,
    )

    if version in END_OF_LIFE:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.name} runs Node.js {version}, which has reached end "
            f"of life and no longer receives security patches."
        )
    else:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.name} runs Node.js {version}."
        )

    findings.append(report)

return findings`,
    },

    {
      id: "project_secure_compute_configured",
      service: "project",
      pillar: "attacksurface",
      severity: "medium",
      title: "Vercel projects reaching private backends use Secure Compute",
      resourceType: "Vercel::Project",
      resourceGroup: "network",
      categories: ["trust-boundaries"],
      description:
        "**Secure Compute** places a project's functions in a dedicated VPC with static egress IPs, so a private backend can allowlist Vercel traffic precisely. This check reports projects with no Secure Compute configuration.",
      risk:
        "Without dedicated egress, functions leave through a **shared, rotating pool of addresses**, so any database or internal API they reach must either be internet-exposed or allowlist a broad range that other Vercel customers also use. Both outcomes weaken the network boundary around the backend, and the second means an allowlist entry does not actually identify your application.",
      urls: [
        "https://vercel.com/docs/security/secure-compute",
        "https://vercel.com/docs/security/secure-compute/connect-to-private-backend",
      ],
      relatedTo: ["project_firewall_enabled"],
      remediation: {
        cli: "",
        other:
          "1. Confirm the team's plan includes Secure Compute\n2. In the team settings, create a Secure Compute network in the region closest to the backend\n3. Assign the project's production and preview environments to that network\n4. Note the static egress IP addresses\n5. Restrict the backend's firewall or database access list to those addresses and remove the broad ranges\n6. Where a private connection is needed, peer the Secure Compute VPC with your own\n7. Verify preview deployments still reach the backend — they use a separate egress range",
        terraform: "",
        text:
          "Assign projects that reach private backends to a Secure Compute network, restrict the backend allowlist to the resulting static egress IPs, and confirm preview environments are covered too.",
      },
      body: `findings = []
for project in project_client.projects.values():
    report = CheckReportVercel(
        metadata=self.metadata(),
        resource=project,
        resource_name=project.name,
        resource_id=project.id,
    )

    if project.secure_compute:
        report.status = "PASS"
        report.status_extended = (
            f"Project {project.name} uses Secure Compute with dedicated egress."
        )
    else:
        report.status = "FAIL"
        report.status_extended = (
            f"Project {project.name} does not use Secure Compute; its functions "
            f"egress from a shared address pool."
        )

    findings.append(report)

return findings`,
    },
  ],
};
