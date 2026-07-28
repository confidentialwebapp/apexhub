from typing import Optional

from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.okta.lib.service.service import OktaService


class Application(OktaService):
    """Retrieve Okta applications with their sign-on mode and assignment scope."""

    def __init__(self, provider):
        super().__init__(__class__.__name__, provider)
        self.applications: dict[str, OktaApplication] = {}
        self._list_applications()

    def _list_applications(self):
        try:
            apps, response, error = self._run(
                self.client.list_applications({"limit": 200})
            )
            if error:
                logger.error(f"Application - Error listing applications: {error}")
                return

            while True:
                for raw in apps or []:
                    settings = getattr(raw, "settings", None)
                    sign_on = getattr(settings, "sign_on", None) if settings else None
                    application = OktaApplication(
                        id=raw.id,
                        label=getattr(raw, "label", ""),
                        name=getattr(raw, "name", ""),
                        status=str(getattr(raw, "status", "ACTIVE")),
                        sign_on_mode=str(getattr(raw, "sign_on_mode", "")),
                        visibility_hidden=bool(
                            getattr(
                                getattr(raw, "visibility", None), "hide", None
                            )
                        ),
                        destination_url=str(
                            getattr(sign_on, "destination_override_url", "") or ""
                        ),
                    )
                    self.applications[application.id] = application

                if not response or not response.has_next():
                    break
                apps, error = self._run(response.next())
                if error:
                    logger.error(f"Application - Error paginating: {error}")
                    break

            logger.info(
                f"Application - Found {len(self.applications)} application(s)"
            )
        except Exception as error:
            logger.error(
                f"Application - Error listing applications: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class OktaApplication(BaseModel):
    """Okta application representation."""

    id: str
    label: str = ""
    name: str = ""
    status: str = "ACTIVE"
    sign_on_mode: str = ""
    visibility_hidden: bool = False
    destination_url: str = ""
