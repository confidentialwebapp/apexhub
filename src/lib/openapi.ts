import { stats } from "./data";

export function buildOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "APEX Hub API",
      version: "1.0.0",
      description:
        "Read-only API for browsing cloud security checks and compliance frameworks. " +
        `Data sourced from the open-source Prowler project (${stats.source}). ` +
        `Snapshot generated ${stats.generatedAt}.`,
      license: { name: "Data: Apache-2.0", url: "https://github.com/prowler-cloud/prowler/blob/master/LICENSE" },
    },
    servers: [{ url: "/", description: "This deployment" }],
    tags: [
      { name: "checks", description: "Security checks" },
      { name: "compliance", description: "Compliance frameworks" },
      { name: "meta", description: "Dataset metadata" },
    ],
    paths: {
      "/api/check/search": {
        get: {
          tags: ["checks"],
          summary: "Search security checks",
          description: "Full-text search over check id, title, description, provider, service, resource type and categories.",
          parameters: [
            { name: "term", in: "query", schema: { type: "string" }, description: "Search term. Empty returns all (sorted by severity)." },
            { name: "limit", in: "query", schema: { type: "integer", default: 200, maximum: 1000 } },
          ],
          responses: {
            200: {
              description: "Matching checks",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/CheckIndexItem" } } } },
            },
          },
        },
      },
      "/api/check/{key}": {
        get: {
          tags: ["checks"],
          summary: "Get a single check",
          parameters: [{ name: "key", in: "path", required: true, schema: { type: "string" }, description: "Check key in the form `<provider>.<checkId>` (e.g. `aws.s3_bucket_public_access`)." }],
          responses: {
            200: { description: "Check detail", content: { "application/json": { schema: { $ref: "#/components/schemas/CheckFull" } } } },
            404: { description: "Not found" },
          },
        },
      },
      "/api/compliance/search": {
        get: {
          tags: ["compliance"],
          summary: "Search compliance frameworks",
          parameters: [
            { name: "term", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 200, maximum: 1000 } },
          ],
          responses: {
            200: { description: "Matching frameworks", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/ComplianceIndexItem" } } } } },
          },
        },
      },
      "/api/compliance/{id}": {
        get: {
          tags: ["compliance"],
          summary: "Get a single compliance framework (with requirements)",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Framework id (e.g. `cis_3.0_aws`)." }],
          responses: {
            200: { description: "Framework detail", content: { "application/json": { schema: { $ref: "#/components/schemas/ComplianceFull" } } } },
            404: { description: "Not found" },
          },
        },
      },
      "/api/admin/config": {
        get: {
          tags: ["meta"],
          summary: "Dataset summary and counts",
          responses: { 200: { description: "Config", content: { "application/json": { schema: { type: "object" } } } } },
        },
      },
    },
    components: {
      schemas: {
        CheckIndexItem: {
          type: "object",
          properties: {
            key: { type: "string" },
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            provider: { type: "string" },
            service: { type: "string" },
            subservice: { type: "string", nullable: true },
            severity: { type: "string", enum: ["critical", "high", "medium", "low", "informational"] },
            type: { type: "array", items: { type: "string" } },
            categories: { type: "array", items: { type: "string" } },
            resourceType: { type: "string" },
          },
        },
        CheckFull: {
          allOf: [
            { $ref: "#/components/schemas/CheckIndexItem" },
            {
              type: "object",
              properties: {
                resourceGroup: { type: "string" },
                risk: { type: "string" },
                relatedUrl: { type: "string" },
                additionalUrls: { type: "array", items: { type: "string" } },
                remediation: {
                  type: "object",
                  properties: {
                    cli: { type: "string" },
                    nativeIaC: { type: "string" },
                    terraform: { type: "string" },
                    other: { type: "string" },
                    recommendationText: { type: "string" },
                    recommendationUrl: { type: "string" },
                  },
                },
                dependsOn: { type: "array", items: { type: "string" } },
                relatedTo: { type: "array", items: { type: "string" } },
                notes: { type: "string" },
              },
            },
          ],
        },
        ComplianceIndexItem: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            framework: { type: "string" },
            version: { type: "string" },
            provider: { type: "string" },
            description: { type: "string" },
            requirementsCount: { type: "integer" },
            checksCount: { type: "integer" },
          },
        },
        ComplianceFull: {
          allOf: [
            { $ref: "#/components/schemas/ComplianceIndexItem" },
            {
              type: "object",
              properties: {
                requirements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string" },
                      checks: { type: "array", items: { type: "string" } },
                      attributes: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
          ],
        },
      },
    },
  };
}
