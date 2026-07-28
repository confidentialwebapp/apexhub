from pydantic import BaseModel, Field

from apexhub.lib.logger import logger
from apexhub.providers.slack.lib.service.service import SlackService


class Channel(SlackService):
    """Retrieve Slack conversations with their sharing and visibility state."""

    def __init__(self, provider):
        super().__init__("Channel", provider)
        self.channels: dict[str, SlackChannel] = {}
        self._list_channels()

    def _list_channels(self):
        try:
            cursor = None
            while True:
                params = {"limit": 200, "types": "public_channel,private_channel"}
                if cursor:
                    params["cursor"] = cursor

                data = self._get("/api/conversations.list", params=params)
                if data is None:
                    break

                for raw in data.get("channels", []):
                    channel = SlackChannel(
                        id=raw.get("id", ""),
                        name=raw.get("name", ""),
                        is_private=raw.get("is_private", False),
                        is_archived=raw.get("is_archived", False),
                        is_shared=raw.get("is_shared", False),
                        is_ext_shared=raw.get("is_ext_shared", False),
                        is_org_shared=raw.get("is_org_shared", False),
                        num_members=raw.get("num_members", 0),
                    )
                    self.channels[channel.id] = channel

                cursor = (data.get("response_metadata") or {}).get("next_cursor")
                if not cursor:
                    break

            logger.info(f"Channel - Found {len(self.channels)} channel(s)")
        except Exception as error:
            logger.error(
                f"Channel - Error listing channels: "
                f"{error.__class__.__name__}[{error.__traceback__.tb_lineno}]: {error}"
            )


class SlackChannel(BaseModel):
    """Slack conversation representation."""

    id: str
    name: str = ""
    is_private: bool = False
    is_archived: bool = False
    is_shared: bool = False
    is_ext_shared: bool = False
    is_org_shared: bool = False
    num_members: int = 0
