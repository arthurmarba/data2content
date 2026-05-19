export function isTemporaryUploadSessionEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED === "1";
}

export function isRealUploadEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED === "true";
}
