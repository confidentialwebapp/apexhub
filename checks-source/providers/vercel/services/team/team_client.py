from apexhub.providers.common.provider import Provider
from apexhub.providers.vercel.services.team.team_service import Team

team_client = Team(Provider.get_global_provider())
