from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.snowflake.lib.service.service import SnowflakeService


class Account(SnowflakeService):
    """Retrieve Snowflake account-level security parameters and integrations."""

    def __init__(self, provider):
        super().__init__("Account", provider)
        self.account_config: Optional[SnowflakeAccount] = None
        self._get_account()

    def _get_account(self):
        try:
            integrations = self._show("INTEGRATIONS")
            stages = self._query(
                """
                SELECT stage_name, stage_schema, stage_catalog, stage_type,
                       stage_url, storage_integration
                FROM SNOWFLAKE.ACCOUNT_USAGE.STAGES
                WHERE deleted IS NULL AND stage_type ILIKE 'External%'
                """
            )

            self.account_config = SnowflakeAccount(
                name=self.account,
                network_policy=self._parameter("NETWORK_POLICY"),
                periodic_data_rekeying=self._parameter(
                    "PERIODIC_DATA_REKEYING"
                ).lower()
                == "true",
                data_retention_time_in_days=int(
                    self._parameter("DATA_RETENTION_TIME_IN_DAYS") or 0
                ),
                min_data_retention_time_in_days=int(
                    self._parameter("MIN_DATA_RETENTION_TIME_IN_DAYS") or 0
                ),
                require_storage_integration_for_stage_creation=self._parameter(
                    "REQUIRE_STORAGE_INTEGRATION_FOR_STAGE_CREATION"
                ).lower()
                == "true",
                sso_integrations=[
                    integration.get("name", "")
                    for integration in integrations
                    if "SAML2" in (integration.get("type") or "").upper()
                    or "EXTERNAL_OAUTH" in (integration.get("type") or "").upper()
                ],
                scim_integrations=[
                    integration.get("name", "")
                    for integration in integrations
                    if "SCIM" in (integration.get("type") or "").upper()
                ],
                external_stages=[
                    SnowflakeExternalStage(
                        name=stage.get("stage_name", ""),
                        schema_name=stage.get("stage_schema", ""),
                        database_name=stage.get("stage_catalog", ""),
                        url=stage.get("stage_url") or "",
                        storage_integration=stage.get("storage_integration"),
                    )
                    for stage in stages
                ],
            )
            logger.info(f"Account - Read configuration for account {self.account}")
        except Exception as error:
            logger.error(
                f"Account - Error reading account configuration: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class SnowflakeExternalStage(BaseModel):
    """An external stage defined in the Snowflake account."""

    name: str
    schema_name: str = ""
    database_name: str = ""
    url: str = ""
    storage_integration: Optional[str] = None

    @property
    def qualified_name(self) -> str:
        return f"{self.database_name}.{self.schema_name}.{self.name}"


class SnowflakeAccount(BaseModel):
    """Snowflake account representation."""

    name: str
    network_policy: str = ""
    periodic_data_rekeying: bool = False
    data_retention_time_in_days: int = 0
    min_data_retention_time_in_days: int = 0
    require_storage_integration_for_stage_creation: bool = False
    sso_integrations: list[str] = Field(default_factory=list)
    scim_integrations: list[str] = Field(default_factory=list)
    external_stages: list[SnowflakeExternalStage] = Field(default_factory=list)
