function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

export function isVideoNarrativeRealAnalysisE2EEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED);
}
