type ProfileInput = any;

const truncate = (val: string, max = 240) => (val.length > max ? `${val.slice(0, max)}…` : val);
const sanitizeText = (val: string) => {
  const truncated = truncate(val, 480);
  // Remove padrões de prompt injection simples
  return truncated.replace(/ignore (all )?previous instructions/gi, "[redacted]");
};

export function buildChatContext(user: ProfileInput) {
  const profile = user?.creatorProfileExtended || {};
  const prefs = user?.userPreferences || {};
  const ctx: Record<string, any> = {
    contextVersion: "v1",
    survey: {},
    preferences: {},
  };

  if (Array.isArray(profile.stage) && profile.stage.length) ctx.survey.stage = profile.stage.slice(0, 2);
  if (Array.isArray(profile.niches) && profile.niches.length) ctx.survey.niches = profile.niches.slice(0, 3);
  if (profile.mainGoal3m) ctx.survey.mainGoal3m = profile.mainGoal3m;
  if (Array.isArray(profile.mainPains) && profile.mainPains.length) ctx.survey.mainPains = profile.mainPains.slice(0, 3);
  if (Array.isArray(profile.hardestStage) && profile.hardestStage.length) ctx.survey.hardestStage = profile.hardestStage.slice(0, 2);
  if (profile.mainGoalOther) ctx.survey.mainGoalOther = sanitizeText(profile.mainGoalOther);
  if (Array.isArray(profile.nextPlatform) && profile.nextPlatform.length) ctx.survey.nextPlatform = profile.nextPlatform.slice(0, 2);

  if (Array.isArray(profile.dreamBrands) && profile.dreamBrands.length) ctx.survey.dreamBrands = profile.dreamBrands.slice(0, 2);
  if (Array.isArray(profile.brandTerritories) && profile.brandTerritories.length) ctx.survey.brandTerritories = profile.brandTerritories.slice(0, 3);

  if (Array.isArray(prefs.preferredFormats) && prefs.preferredFormats.length) ctx.preferences.preferredFormats = prefs.preferredFormats.slice(0, 3);
  if (Array.isArray(prefs.dislikedTopics) && prefs.dislikedTopics.length) ctx.preferences.dislikedTopics = prefs.dislikedTopics.slice(0, 3);
  if (prefs.preferredAiTone) ctx.preferences.preferredAiTone = prefs.preferredAiTone;
  if (Array.isArray(profile.learningStyles) && profile.learningStyles.length) ctx.preferences.learningStyles = profile.learningStyles.slice(0, 2);

  // Fallback flags
  ctx.flags = {
    ragEnabled: Boolean((user as any)?.ragEnabled),
  };

  return ctx;
}

export function stringifyChatContext(ctx: ReturnType<typeof buildChatContext>) {
  try {
    return JSON.stringify(ctx, null, 2);
  } catch {
    return "";
  }
}
