import {
  campaignRadarSourceRegistry,
  pluginDistributionValidationIssues,
} from "../../src/app/lib/campaignRadar/sourceRegistry";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const entries = campaignRadarSourceRegistry.map((entry) => ({
  sourceId: entry.sourceId,
  sourcePlatform: entry.sourcePlatform,
  status: entry.pluginDistribution.status,
  authorizationBasis: entry.pluginDistribution.authorizationBasis,
  evidenceReference: entry.pluginDistribution.evidenceReference,
  termsUrl: entry.pluginDistribution.termsUrl,
  robotsUrl: entry.pluginDistribution.robotsUrl,
  reviewedAt: entry.pluginDistribution.reviewedAt,
  reviewedBy: entry.pluginDistribution.reviewedBy,
  issues: pluginDistributionValidationIssues(entry),
}));

const summary = {
  total: entries.length,
  approved: entries.filter((entry) => entry.status === "approved").length,
  pendingLegalReview: entries.filter((entry) => entry.status === "pending_legal_review").length,
  blocked: entries.filter((entry) => entry.status === "blocked").length,
  invalid: entries.filter((entry) => entry.issues.length > 0).length,
};

console.log(
  JSON.stringify(
    {
      schemaVersion: "campaign_radar_plugin_distribution_audit_v1",
      generatedAt: new Date().toISOString(),
      summary,
      entries,
    },
    null,
    2,
  ),
);

if (summary.invalid > 0) {
  console.error("Registro inválido: corrija as inconsistências antes de importar ou liberar o MCP.");
  process.exit(1);
}

if (
  hasFlag("require-release-ready") &&
  (summary.approved === 0 || summary.pendingLegalReview > 0)
) {
  console.error(
    `Liberação bloqueada: ${summary.approved} fonte(s) aprovada(s), ${summary.pendingLegalReview} pendente(s) e ${summary.blocked} bloqueada(s).`,
  );
  process.exit(2);
}
