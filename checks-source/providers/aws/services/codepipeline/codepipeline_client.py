from apexhub.providers.aws.services.codepipeline.codepipeline_service import (
    CodePipeline,
)
from apexhub.providers.common.provider import Provider

codepipeline_client = CodePipeline(Provider.get_global_provider())
