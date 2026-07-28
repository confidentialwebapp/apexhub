/**
 * Python scaffolding templates for first-party APEX Hub providers.
 *
 * Emitted into `checks-source/providers/<id>/` so the in-app "Source code"
 * viewer (src/components/SourceCode.tsx) resolves the same paths it already
 * uses for the vendored upstream providers.
 */

/** Base HTTP service class shared by every service of an API-backed provider. */
export function serviceBase(def) {
  const P = def.pyClass; // e.g. "GitLab"
  const auth = def.auth ?? { header: "Authorization", scheme: "Bearer" };
  const authLine =
    auth.scheme === null
      ? `"${auth.header}": provider.session.token,`
      : `"${auth.header}": f"${auth.scheme} {provider.session.token}",`;

  return `import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from apexhub.lib.logger import logger
from apexhub.providers.${def.id}.exceptions.exceptions import (
    ${P}APIError,
    ${P}RateLimitError,
)

MAX_WORKERS = 10


class ${P}Service:
    """Base class for ${def.name} services: shared provider context and HTTP client."""

    def __init__(self, service: str, provider):
        self.provider = provider
        self.audit_config = provider.audit_config
        self.fixer_config = provider.fixer_config
        self.service = service.lower() if not service.islower() else service

        self._http_session = requests.Session()
        self._http_session.headers.update(
            {
                ${authLine}
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
        )
        self._base_url = provider.session.base_url

        self.thread_pool = ThreadPoolExecutor(max_workers=MAX_WORKERS)

    def _get(self, path: str, params: dict = None) -> dict:
        """Make a rate-limit-aware GET request to the ${def.name} API.

        Args:
            path: API path (e.g., "${def.samplePath}").
            params: Query parameters.

        Returns:
            Parsed JSON response, or None when the endpoint is not permitted
            for the current token scope (403) so checks can degrade gracefully.

        Raises:
            ${P}RateLimitError: If rate limited after retries.
            ${P}APIError: If the API returns an error.
        """
        if params is None:
            params = {}

        url = f"{self._base_url}{path}"
        max_retries = self.audit_config.get("max_retries", 3)

        for attempt in range(max_retries + 1):
            try:
                response = self._http_session.get(url, params=params, timeout=30)

                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 5))
                    if attempt < max_retries:
                        logger.warning(
                            f"{self.service} - Rate limited, retrying after {retry_after}s "
                            f"(attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(retry_after)
                        continue
                    raise ${P}RateLimitError(
                        file=__file__,
                        message=f"Rate limited on {path} after {max_retries} retries.",
                    )

                if response.status_code in (401, 403):
                    logger.info(
                        f"{self.service} - Access denied for {path} "
                        f"({response.status_code}). This may be caused by plan or "
                        "token scope restrictions."
                    )
                    return None

                if response.status_code == 404:
                    logger.info(f"{self.service} - {path} not found (404).")
                    return None

                response.raise_for_status()
                return response.json()

            except ${P}RateLimitError:
                raise
            except requests.exceptions.HTTPError as error:
                raise ${P}APIError(
                    file=__file__,
                    original_exception=error,
                    message=f"HTTP error on {path}: {error}",
                )
            except requests.exceptions.RequestException as error:
                if attempt < max_retries:
                    logger.warning(
                        f"{self.service} - Request error on {path}, retrying "
                        f"(attempt {attempt + 1}/{max_retries}): {error}"
                    )
                    time.sleep(2**attempt)
                    continue
                raise ${P}APIError(
                    file=__file__,
                    original_exception=error,
                    message=f"Request failed on {path} after {max_retries} retries: {error}",
                )

        return {}
${def.serviceBaseExtra ?? ""}
    def _paginate(self, path: str, key: str = None, params: dict = None) -> list:
        """Paginate through a ${def.name} list endpoint.

        Args:
            path: API path.
            key: JSON key holding the item list; None when the body is a bare array.
            params: Additional query parameters.

        Returns:
            Combined list of items across all pages.
        """
        if params is None:
            params = {}

        params.setdefault("${def.pageSizeParam ?? "per_page"}", ${def.pageSize ?? 100})
        page = 1
        all_items = []

        while True:
            params["${def.pageParam ?? "page"}"] = page
            data = self._get(path, params)
            if data is None:
                break

            items = data if isinstance(data, list) else data.get(key or "items", [])
            if not items:
                break

            all_items.extend(items)
            if len(items) < params["${def.pageSizeParam ?? "per_page"}"]:
                break
            page += 1

            if page > 200:  # hard stop against a misbehaving cursor
                logger.warning(f"{self.service} - Pagination cap reached on {path}.")
                break

        return all_items

    def __threading_call__(self, call, iterator):
        """Execute a function across multiple items using the shared thread pool."""
        items = list(iterator) if not isinstance(iterator, list) else iterator

        futures = {self.thread_pool.submit(call, item): item for item in items}
        results = []

        for future in as_completed(futures):
            try:
                result = future.result()
                if result is not None:
                    results.append(result)
            except Exception as error:
                item = futures[future]
                item_id = getattr(item, "id", str(item))
                logger.error(
                    f"{self.service} - Threading error processing {item_id}: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )

        return results
`;
}

/** Provider-level pydantic models (session + identity). */
export function models(def) {
  const P = def.pyClass;
  // Self-hosted products have no canonical endpoint; the URL is supplied per scan.
  const baseUrl =
    def.selfHosted === true ? `base_url: str` : `base_url: str = "${def.baseUrl}"`;
  return `from typing import Any, Optional

from pydantic import BaseModel, Field


class ${P}Session(BaseModel):
    """${def.name} API session information."""

    token: str = Field(exclude=True, repr=False)
    ${baseUrl}
    http_session: Any = Field(default=None, exclude=True)


class ${P}IdentityInfo(BaseModel):
    """${def.name} identity and scoping information."""

    account_id: Optional[str] = None
    account_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    plan: Optional[str] = None
    scopes: list[str] = Field(default_factory=list)
`;
}

/** Provider exception hierarchy, matching the upstream numbered-code convention. */
export function exceptions(def) {
  const P = def.pyClass;
  const base = def.errorCodeBase;
  const entries = [
    ["CredentialsError", `${def.name} credentials not found or invalid.`, def.credentialsRemediation],
    ["AuthenticationError", `Authentication to the ${def.name} API failed.`, `Verify the API token is valid, unexpired, and has the required read scopes.`],
    ["SessionError", `Failed to create a ${def.name} API session.`, `Check network connectivity and ensure ${def.baseUrl} is reachable.`],
    ["IdentityError", `Failed to retrieve ${def.name} identity information.`, `Ensure the token has permission to read account and user information.`],
    ["APIError", `An error occurred while calling the ${def.name} API.`, `Check the ${def.name} status page and retry the request.`],
    ["RateLimitError", `Rate limited by the ${def.name} API.`, `Wait and retry; reduce scan concurrency if the limit is hit repeatedly.`],
  ];

  const codes = entries
    .map(
      ([name, message, remediation], i) =>
        `        (${base + i}, "${P}${name}"): {
            "message": "${message}",
            "remediation": "${remediation}",
        },`
    )
    .join("\n");

  const classes = entries
    .map(
      ([name]) => `

class ${P}${name}(${P}BaseException):
    """${name.replace(/([A-Z])/g, " $1").trim()} for the ${def.name} provider."""

    def __init__(self, file=None, original_exception=None, message=None):
        super().__init__(
            code=${base + entries.findIndex((e) => e[0] === name)},
            file=file,
            original_exception=original_exception,
            message=message,
        )`
    )
    .join("");

  return `# Exception codes from ${base} to ${base + 999} are reserved for ${def.name}.
from apexhub.exceptions.exceptions import ApexHubException


class ${P}BaseException(ApexHubException):
    """Base exception for ${def.name} provider errors."""

    ${P.toUpperCase()}_ERROR_CODES = {
${codes}
    }

    def __init__(self, code, file=None, original_exception=None, message=None):
        module_metadata = self.${P.toUpperCase()}_ERROR_CODES.get((code, self.__class__.__name__), {})
        if message:
            module_metadata["message"] = message
        super().__init__(
            code=code,
            source="${def.pyClass}",
            file=file,
            original_exception=original_exception,
            error_info=module_metadata,
        )
${classes}
`;
}

/** Per-service client singleton. */
export function serviceClient(def, svcKey, svc) {
  return `from apexhub.providers.${def.id}.services.${svcKey}.${svcKey}_service import ${svc.pyClass}
from apexhub.providers.common.provider import Provider

${svcKey}_client = ${svc.pyClass}(Provider.get_global_provider())
`;
}

/** A single check module. */
export function checkModule(def, check) {
  const svcKey = check.service;
  const report = `CheckReport${def.pyClass}`;
  const doc = check.docstring ?? check.title;
  // A check may read a second service's client to correlate resources.
  const clients = [svcKey, ...(check.alsoUses ?? [])];
  const imports = clients
    .map(
      (key) =>
        `from apexhub.providers.${def.id}.services.${key}.${key}_client import ${key}_client`
    )
    .join("\n");
  return `from typing import List

from apexhub.lib.check.models import Check, ${report}
${imports}


class ${check.id}(Check):
    """${doc}

    ${(check.classDoc ?? check.risk.replace(/\*\*/g, "")).slice(0, 400)}
    """

    def execute(self) -> List[${report}]:
${check.body
  .trimEnd()
  .split("\n")
  .map((l) => (l.trim() ? `        ${l}` : ""))
  .join("\n")}
`;
}
