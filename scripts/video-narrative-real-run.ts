import { pathToFileURL } from "node:url";
import {
  buildGeminiVideoNarrativeRealRunInputFromEnv,
  formatGeminiVideoNarrativeRealRunResult,
  runGeminiVideoNarrativeRealRun,
} from "../src/app/dashboard/boards/videoUpload/geminiVideoNarrativeRealRunHarness";

export async function runVideoNarrativeRealRunScript(): Promise<void> {
  const input = buildGeminiVideoNarrativeRealRunInputFromEnv(process.env);
  const result = await runGeminiVideoNarrativeRealRun({
    input,
    env: {
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || null,
      enabled: process.env.VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED || null,
      model: process.env.VIDEO_NARRATIVE_GEMINI_MODEL || null,
    },
  });

  console.log(formatGeminiVideoNarrativeRealRunResult(result));
  process.exitCode = result.ok ? 0 : 1;
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isDirectRun) {
  void runVideoNarrativeRealRunScript();
}
