const GEMINI_VIDEO_NARRATIVE_ENV_FLAG = "VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED";

export function isGeminiVideoNarrativeEnabled(): boolean {
  return process.env[GEMINI_VIDEO_NARRATIVE_ENV_FLAG] === "true";
}
