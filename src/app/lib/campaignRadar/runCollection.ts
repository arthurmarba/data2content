import RunModel from "@/app/models/CampaignRadarRun";
import { connectToDatabase } from "@/app/lib/mongoose";
import { collectCampaignRadar, campaignReportDate } from "./collect";
import { ingestCandidate } from "./adminService";
import { ensureRadarIndexes } from "./indexes";

export async function runCampaignRadarCollection(now = new Date()) {
  await connectToDatabase();
  await ensureRadarIndexes();
  const day = campaignReportDate(now);
  try {
    // Índice único diário impede duas requisições de duplicarem a coleta.
    await RunModel.create({ day, status: "running", startedAt: now });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) return { skipped: true, reason: "Coleta do dia já iniciada." };
    throw error;
  }
  let processed = 0;
  try {
    const batch = await collectCampaignRadar({ now });
    await RunModel.updateOne({ day }, { $set: { sources: batch.sources } });
    for (const opportunity of batch.opportunities) {
      await ingestCandidate(opportunity, "automatic", "radar:collector", now);
      processed++;
      await RunModel.updateOne({ day }, { $set: { processed } });
    }
    await RunModel.updateOne({ day }, { $set: { status: "completed", completedAt: new Date(), processed, apiCost: 0, sources: batch.sources } });
    return { skipped: false, processed, apiCost: 0, sources: batch.sources };
  } catch (error) {
    await RunModel.updateOne({ day }, { $set: { status: "failed", completedAt: new Date(), processed, error: "Falha na coleta ou persistência; consultar os logs do servidor." } });
    throw error;
  }
}
