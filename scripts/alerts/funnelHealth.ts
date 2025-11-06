/**
 * Stub de monitoramento do funil de propostas.
 * Executar com: `tsx scripts/alerts/funnelHealth.ts`
 *
 * TODO: integrar com a fonte oficial de analytics (ex.: BigQuery, PostHog, Superset API).
 */

type FunnelSnapshot = {
  environment: string;
  timestamp: string;
  metrics: {
    mediaKitViewed: number;
    proposalSubmitted: number;
    emailSentViaPlatform: number;
  };
};

const ENVIRONMENT = process.env.NEXT_PUBLIC_ANALYTICS_ENV || process.env.NODE_ENV || "development";

async function fetchEventsCount(eventName: string, sinceIso: string): Promise<number> {
  // TODO: substituir por implementação real (ex.: consulta SQL ou API).
  if (process.env.STAGE0_ALERTS_DRY_RUN === "true") {
    return Math.floor(Math.random() * 25);
  }

  console.warn(`[alerts] fetchEventsCount(${eventName}) ainda não implementado. since=${sinceIso}`);
  return 0;
}

async function buildSnapshot(): Promise<FunnelSnapshot> {
  const nowIso = new Date().toISOString();
  const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // última hora

  const [mediaKitViewed, proposalSubmitted, emailSentViaPlatform] = await Promise.all([
    fetchEventsCount("media_kit_viewed", sinceIso),
    fetchEventsCount("proposal_submitted", sinceIso),
    fetchEventsCount("email_sent_via_platform", sinceIso),
  ]);

  return {
    environment: ENVIRONMENT,
    timestamp: nowIso,
    metrics: {
      mediaKitViewed,
      proposalSubmitted,
      emailSentViaPlatform,
    },
  };
}

async function sendAlert(message: string) {
  // TODO: conectar em Slack/Webhook/Email.
  console.log(`[alerts] ${message}`);
}

async function main() {
  const snapshot = await buildSnapshot();
  const { mediaKitViewed, proposalSubmitted, emailSentViaPlatform } = snapshot.metrics;

  console.info(`[alerts] Snapshot ${snapshot.timestamp} env=${snapshot.environment}`);
  console.info(`  media_kit_viewed=${mediaKitViewed}`);
  console.info(`  proposal_submitted=${proposalSubmitted}`);
  console.info(`  email_sent_via_platform=${emailSentViaPlatform}`);

  if (mediaKitViewed > 0) {
    const conversion = proposalSubmitted / mediaKitViewed;
    if (conversion < 0.05) {
      await sendAlert(
        `⚠️ Conversão media_kit_viewed→proposal_submitted abaixo de 5% (${(conversion * 100).toFixed(
          1,
        )}%)`,
      );
    }
  }

  if (emailSentViaPlatform === 0) {
    await sendAlert("🚨 Nenhum email_sent_via_platform registrado na última hora.");
  }
}

main().catch((error) => {
  console.error("[alerts] Falha ao executar monitoramento do funil", error);
  process.exitCode = 1;
});
