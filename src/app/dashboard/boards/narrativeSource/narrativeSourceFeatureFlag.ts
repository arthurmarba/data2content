const NARRATIVE_SOURCE_ENV_FLAG = "NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED";

export function isNarrativeSourceEngineEnabled(): boolean {
  return process.env[NARRATIVE_SOURCE_ENV_FLAG] === "1";
}
