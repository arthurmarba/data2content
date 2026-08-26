import { isScriptAdjustmentEnabled } from "./scriptAdjustmentFeatureFlag";

export type ScriptAdjustmentExperimentCohort = "control" | "video_only" | "personalized";

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

export function resolveScriptAdjustmentExperiment(params: {
  userId: string;
  env?: EnvLike;
}): ScriptAdjustmentExperimentCohort {
  const env = params.env ?? process.env;
  if (!isScriptAdjustmentEnabled(env)) return "control";
  if (env.VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_EXPERIMENT_ENABLED !== "1") return "personalized";
  const bucket = stableBucket(params.userId);
  if (bucket < 34) return "control";
  if (bucket < 67) return "video_only";
  return "personalized";
}

