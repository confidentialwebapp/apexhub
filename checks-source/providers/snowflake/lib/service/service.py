from concurrent.futures import ThreadPoolExecutor, as_completed

from apexhub.lib.logger import logger
from apexhub.providers.snowflake.exceptions.exceptions import (
    SnowflakeAPIError,
    SnowflakeRateLimitError,
)

MAX_WORKERS = 5


class SnowflakeService:
    """Base class for Snowflake services: shared connection and query helpers."""

    def __init__(self, service: str, provider):
        self.provider = provider
        self.audit_config = provider.audit_config
        self.fixer_config = provider.fixer_config
        self.service = service.lower() if not service.islower() else service

        self.connection = provider.session.connection
        self.account = provider.identity.account
        self.thread_pool = ThreadPoolExecutor(max_workers=MAX_WORKERS)

    def _query(self, statement: str, params: tuple = ()) -> list[dict]:
        """Run a read-only statement and return rows as dictionaries.

        Args:
            statement: SQL to execute. Must be read-only (SHOW/SELECT/DESC).
            params: Bind parameters.

        Returns:
            List of rows keyed by lower-cased column name; an empty list when
            the role lacks privileges on the object, so checks degrade
            gracefully rather than aborting the scan.
        """
        cursor = None
        try:
            cursor = self.connection.cursor()
            cursor.execute(statement, params)
            columns = [column[0].lower() for column in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        except Exception as error:
            message = str(error)
            if "does not exist or not authorized" in message or "Insufficient privileges" in message:
                logger.info(
                    f"{self.service} - Not authorized for statement; grant the scan "
                    f"role access to SNOWFLAKE.ACCOUNT_USAGE. ({message})"
                )
                return []
            if "Request rate limit" in message or "429" in message:
                raise SnowflakeRateLimitError(file=__file__, message=message)
            raise SnowflakeAPIError(
                file=__file__, original_exception=error, message=message
            )
        finally:
            if cursor is not None:
                cursor.close()

    def _show(self, what: str) -> list[dict]:
        """Run a SHOW command, returning an empty list when unauthorized."""
        return self._query(f"SHOW {what}")

    def _parameter(self, name: str, scope: str = "ACCOUNT") -> str:
        """Read a single account or object parameter value."""
        rows = self._query(f"SHOW PARAMETERS LIKE '{name}' IN {scope}")
        return rows[0].get("value", "") if rows else ""

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
                item_id = getattr(item, "name", str(item))
                logger.error(
                    f"{self.service} - Threading error processing {item_id}: "
                    f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
                )

        return results
