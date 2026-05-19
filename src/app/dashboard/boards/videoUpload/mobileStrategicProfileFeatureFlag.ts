export function isMobileStrategicProfileEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED === "1" ||
    env.MOBILE_STRATEGIC_PROFILE_SERVER_ENABLED === "1"
  );
}
