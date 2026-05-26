from apexhub.lib.check.models import CheckReportOkta
from apexhub.lib.mutelist.mutelist import Mutelist
from apexhub.lib.outputs.utils import unroll_dict, unroll_tags


class OktaMutelist(Mutelist):
    def is_finding_muted(self, finding: CheckReportOkta, org_domain: str) -> bool:
        return self.is_muted(
            org_domain,
            finding.check_metadata.CheckID,
            "*",
            finding.resource_name,
            unroll_dict(unroll_tags(finding.resource_tags)),
        )
