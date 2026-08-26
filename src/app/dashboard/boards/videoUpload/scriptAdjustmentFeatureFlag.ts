type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

/** Enabled by default so a deploy contains the completed experience; set 0 for rollback. */
export function isScriptAdjustmentEnabled(env: EnvLike = process.env): boolean {
  return env.VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_ENABLED !== "0";
}

export function isCreatorStructureEvidenceEnabled(env: EnvLike = process.env): boolean {
  return isScriptAdjustmentEnabled(env) && env.VIDEO_NARRATIVE_SCRIPT_ADJUSTMENT_CREATOR_ENABLED !== "0";
}

