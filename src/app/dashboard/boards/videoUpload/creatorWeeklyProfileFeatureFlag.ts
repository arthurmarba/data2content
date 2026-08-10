export function isCreatorWeeklyProfileExperienceEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.MOBILE_PROFILE_WEEKLY_REPORT_EXPERIENCE_ENABLED !== "0";
}
