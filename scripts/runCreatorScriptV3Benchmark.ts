import mongoose from "mongoose";

import { generateCreatorScriptV3 } from "../src/app/lib/scripts/creatorScriptGenerationV3";

const CASES = [
  { goal: "attention" as const, seconds: 15, prompt: "Crie um Reel sobre uma descoberta recente no meu nicho." },
  { goal: "depth" as const, seconds: 30, prompt: "Crie um Reel útil com três passos práticos sobre um problema recorrente da minha audiência." },
  { goal: "conversation" as const, seconds: 30, prompt: "Crie um Reel de opinião que convide a audiência a conversar sem usar clickbait." },
  { goal: "authority" as const, seconds: 45, prompt: "Crie um Reel que demonstre autoridade por meio de uma experiência concreta." },
  { goal: "conversion" as const, seconds: 45, prompt: "Crie um Reel que conduza naturalmente para conhecer meu trabalho, sem promessa exagerada." },
  { goal: "attention" as const, seconds: 60, prompt: "Crie uma história curta com virada sobre um aprendizado importante do meu tema." },
];

function arg(name: string): string | null {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

async function main() {
  const userId = arg("user");
  if (!userId || !mongoose.isValidObjectId(userId)) throw new Error("Use --user=<ObjectId do creator>.");
  const limit = Math.max(1, Math.min(CASES.length, Number(arg("limit") || CASES.length)));
  const results = [];
  for (const item of CASES.slice(0, limit)) {
    const result = await generateCreatorScriptV3({
      userId,
      prompt: item.prompt,
      goal: item.goal,
      targetDurationSeconds: item.seconds,
    });
    const row = {
      goal: item.goal,
      targetDurationSeconds: item.seconds,
      estimatedDurationSeconds: result.estimatedDurationSeconds,
      provider: result.provider,
      model: result.model,
      passed: result.validation.passed,
      durationWithinTolerance: result.validation.durationWithinTolerance,
      overlapDetected: Boolean(result.validation.verbatimOverlap),
      technicalScore: result.validation.technicalScore,
      evidenceStatus: result.evidenceReceipt.status,
      fullExemplarsUsed: result.evidenceReceipt.fullExemplarsUsed,
    };
    results.push(row);
    process.stdout.write(`${JSON.stringify(row)}\n`);
  }

  const passRate = results.filter((item) => item.passed).length / results.length;
  const overlapRate = results.filter((item) => item.overlapDetected).length / results.length;
  const averageTechnicalScore = results.reduce((sum, item) => sum + item.technicalScore, 0) / results.length;
  const summary = {
    schemaVersion: "creator_script_v3_benchmark_v1",
    cases: results.length,
    passRate: Number(passRate.toFixed(4)),
    overlapRate: Number(overlapRate.toFixed(4)),
    averageTechnicalScore: Number(averageTechnicalScore.toFixed(4)),
    gate: passRate >= 0.8 && overlapRate === 0 && averageTechnicalScore >= 0.68 ? "passed" : "failed",
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (summary.gate === "failed") process.exitCode = 1;
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
