from apexhub.lib.check.models import Check_Report_GCP
from apexhub.lib.mutelist.mutelist import Mutelist
from apexhub.lib.outputs.utils import unroll_dict, unroll_tags


class GCPMutelist(Mutelist):
    def is_finding_muted(
        self,
        finding: Check_Report_GCP,
    ) -> bool:
        return self.is_muted(
            finding.project_id,
            finding.check_metadata.CheckID,
            finding.location,
            finding.resource_name,
            unroll_dict(unroll_tags(finding.resource_tags)),
        )
