from apexhub.providers.aws.services.codeartifact.codeartifact_service import (
    CodeArtifact,
)
from apexhub.providers.common.provider import Provider

codeartifact_client = CodeArtifact(Provider.get_global_provider())
