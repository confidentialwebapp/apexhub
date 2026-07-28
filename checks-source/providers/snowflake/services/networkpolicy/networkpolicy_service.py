from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.snowflake.lib.service.service import SnowflakeService


class NetworkPolicy(SnowflakeService):
    """Retrieve Snowflake network policies and their address lists."""

    def __init__(self, provider):
        super().__init__("NetworkPolicy", provider)
        self.policies: dict[str, SnowflakeNetworkPolicy] = {}
        self._list_policies()
        self.__threading_call__(self._describe_policy, list(self.policies.values()))

    def _list_policies(self):
        try:
            for raw in self._show("NETWORK POLICIES"):
                policy = SnowflakeNetworkPolicy(
                    name=raw.get("name", ""),
                    comment=raw.get("comment") or "",
                )
                self.policies[policy.name] = policy
            logger.info(f"NetworkPolicy - Found {len(self.policies)} network policy(ies)")
        except Exception as error:
            logger.error(
                f"NetworkPolicy - Error listing network policies: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )

    def _describe_policy(self, policy: "SnowflakeNetworkPolicy"):
        try:
            for row in self._query(f"DESC NETWORK POLICY {policy.name}"):
                name = (row.get("name") or "").upper()
                value = row.get("value") or ""
                entries = [item.strip() for item in value.split(",") if item.strip()]
                if name == "ALLOWED_IP_LIST":
                    policy.allowed_ip_list = entries
                elif name == "BLOCKED_IP_LIST":
                    policy.blocked_ip_list = entries
        except Exception as error:
            logger.error(
                f"NetworkPolicy - Error describing {policy.name}: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class SnowflakeNetworkPolicy(BaseModel):
    """Snowflake network policy representation."""

    name: str
    comment: str = ""
    allowed_ip_list: list[str] = Field(default_factory=list)
    blocked_ip_list: list[str] = Field(default_factory=list)
