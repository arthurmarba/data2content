import Candidate from "@/app/models/CampaignRadarCandidate";
import Run from "@/app/models/CampaignRadarRun";

let ready: Promise<void> | undefined;
export function ensureRadarIndexes(): Promise<void> {
  // As garantias de concorrência não dependem do autoIndex do ambiente.
  ready ??= Promise.all([Candidate.createIndexes(), Run.createIndexes()]).then(() => undefined).catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}
