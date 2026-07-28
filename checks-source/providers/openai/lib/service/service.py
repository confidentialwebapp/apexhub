import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

from apexhub.lib.logger import logger
from apexhub.providers.openai.exceptions.exceptions import (
    OpenAIAPIError,
    OpenAIRateLimitError,
)

MAX_WORKERS = 10


class OpenAIService:
    """Base class for OpenAI Platform services: shared provider context and HTTP client."""

    def __init__(self, service: str, provider):
        self.provider = provider
        self.audit_config = provider.audit_config
        self.fixer_config = provider.fixer_config
        self.service = service.lower() if not service.islower() else service

        self._http_session = requests.Session()
        self._http_session.headers.update(
            {
                "Authorization": f"Bearer {provider.session.token}",
                "Accept": "application/json",
                "Content-Type": "application/json",
            }
        )
        self._base_url = provider.session.base_url

        self.thread_pool = ThreadPoolExecutor(max_workers=MAX_WORKERS)

    def _get(self, path: str, params: dict = None) -> dict:
        """Make a rate-limit-aware GET request to the OpenAI Platform API.

        Args:
            path: API path (e.g., "/v1/organization/projects").
            params: Query parameters.

        Returns:
            Parsed JSON response, or None when the endpoint is not permitted
            for the current token scope (403) so checks can degrade gracefully.

        Raises:
            OpenAIRateLimitError: If rate limited after retries.
            OpenAIAPIError: If the API returns an error.
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
                    raise OpenAIRateLimitError(
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

            except OpenAIRateLimitError:
                raise
            except requests.exceptions.HTTPError as error:
                raise OpenAIAPIError(
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
                raise OpenAIAPIError(
                    file=__file__,
                    original_exception=error,
                    message=f"Request failed on {path} after {max_retries} retries: {error}",
                )

        return {}

    def _paginate(self, path: str, key: str = None, params: dict = None) -> list:
        """Paginate through a OpenAI Platform list endpoint.

        Args:
            path: API path.
            key: JSON key holding the item list; None when the body is a bare array.
            params: Additional query parameters.

        Returns:
            Combined list of items across all pages.
        """
        if params is None:
            params = {}

        params.setdefault("limit", 100)
        page = 1
        all_items = []

        while True:
            params["after"] = page
            data = self._get(path, params)
            if data is None:
                break

            items = data if isinstance(data, list) else data.get(key or "items", [])
            if not items:
                break

            all_items.extend(items)
            if len(items) < params["limit"]:
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
