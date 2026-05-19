export function isMobileStrategicProfilePreviewEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED === "1";
}
