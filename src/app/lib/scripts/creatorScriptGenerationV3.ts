import { GoogleGenAI, createUserContent } from "@google/genai";

import { logger } from "@/app/lib/logger";
import { logGeminiUsage } from "@/app/lib/llm/geminiUsageLog";
import {
  buildGenerateScriptPrompt,
  enforceTechnicalScriptContract,
  evaluateTechnicalScriptQuality,
  generateScriptFromPrompt,
  resolveBlueprintDensityProfile,
  resolveEditorialAnchorTitle,
  sanitizeScriptIdentityLeakage,
  type ScriptSemanticReviewMeta,
} from "./ai";
import type { ScriptIntelligenceContext } from "./intelligenceContext";
import {
  buildCreatorScriptEvidencePack,
  type CreatorScriptEvidencePack,
  type CreatorScriptGoal,
} from "./creatorScriptEvidencePack";

export type CreatorScriptV3Result = {
  title: string;
  content: string;
  provider: "gemini" | "openai_fallback" | "local_fallback";
  model: string;
  evidenceReceipt: CreatorScriptEvidencePack["receipt"];
  generationVersion: "creator_script_generation_v3";
  estimatedDurationSeconds: number;
  targetDurationSeconds: number;
  validation: {
    passed: boolean;
    durationWithinTolerance: boolean;
    verbatimOverlap: string | null;
    technicalScore: number;
    warnings: string[];
  };
  reviewMeta?: ScriptSemanticReviewMeta;
};

type GenerateCreatorScriptV3Input = {
  userId: string;
  prompt: string;
  title?: string;
  goal?: CreatorScriptGoal;
  targetDurationSeconds?: number | null;
  intelligenceContext?: ScriptIntelligenceContext | null;
};

function parseJsonDraft(raw: string | null | undefined): { title: string; content: string } | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1));
    const title = typeof value?.title === "string" ? value.title.trim() : "";
    const content = typeof value?.content === "string" ? value.content.trim() : "";
    return title && content ? { title: title.slice(0, 180), content: content.slice(0, 20_000) } : null;
  } catch {
    return null;
  }
}

function words(value: string): string[] {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function findVerbatimOverlap(candidate: string, sources: string[], size = 8): string | null {
  const candidateWords = words(candidate);
  if (candidateWords.length < size) return null;
  const sourceNgrams = new Set<string>();
  for (const source of sources) {
    const sourceWords = words(source);
    for (let i = 0; i <= sourceWords.length - size; i += 1) {
      sourceNgrams.add(sourceWords.slice(i, i + size).join(" "));
    }
  }
  for (let i = 0; i <= candidateWords.length - size; i += 1) {
    const ngram = candidateWords.slice(i, i + size).join(" ");
    if (sourceNgrams.has(ngram)) return ngram;
  }
  return null;
}

function spokenText(content: string): string {
  return content.split("\n")
    .map((line) => line.trim())
    .filter((line) => /^Fala:/i.test(line))
    .map((line) => line.replace(/^Fala:\s*/i, ""))
    .join(" ");
}

export function estimateScriptDurationSeconds(content: string, wordsPerSecond?: number | null): number {
  const speech = spokenText(content) || content;
  const count = words(speech).length;
  const pace = typeof wordsPerSecond === "number" && wordsPerSecond >= 1.3 && wordsPerSecond <= 4
    ? wordsPerSecond : 2.35;
  return Math.max(1, Math.round(count / pace));
}

function compactEvidencePack(pack: CreatorScriptEvidencePack) {
  return {
    request: pack.request,
    dna: {
      confidence: pack.dna?.confidence,
      voice: pack.dna?.voice,
      narrative: pack.dna?.narrative,
      visual: pack.dna?.visual,
      subjects: pack.dna?.subjects?.slice(0, 10),
      audience: pack.dna?.audience,
      coverage: pack.dna?.coverage,
    },
    winningExemplars: pack.winningExemplars.map((item) => ({
      source: item.source,
      fullText: item.source === "planned_and_observed" ? null : item.fullText,
      plannedScriptText: item.plannedScriptText,
      observedTranscriptText: item.observedTranscriptText,
      hook: item.hook,
      cta: item.cta,
      structure: item.structure,
      subjects: item.subjects,
      durationSeconds: item.durationSeconds,
      performanceIndex: item.performanceIndex,
      relevance: item.relevance,
    })),
    contrastExemplar: pack.contrastExemplar ? {
      fullText: pack.contrastExemplar.source === "planned_and_observed"
        ? null : pack.contrastExemplar.fullText,
      plannedScriptText: pack.contrastExemplar.plannedScriptText,
      observedTranscriptText: pack.contrastExemplar.observedTranscriptText,
      structure: pack.contrastExemplar.structure,
      performanceIndex: pack.contrastExemplar.performanceIndex,
    } : null,
    generationConstraints: pack.generationConstraints,
    receipt: pack.receipt,
  };
}

function buildV3Prompt(input: GenerateCreatorScriptV3Input, pack: CreatorScriptEvidencePack): string {
  const base = buildGenerateScriptPrompt({
    prompt: input.prompt,
    title: input.title,
    intelligenceContext: input.intelligenceContext,
  });
  return `${base}\n\n` +
    `EVIDÊNCIA EDITORIAL V3 DA DATA2CONTENT\n` +
    `${JSON.stringify(compactEvidencePack(pack))}\n\n` +
    `Regras adicionais obrigatórias:\n` +
    `- Aprenda com o texto INTEGRAL dos exemplares, incluindo ritmo, progressão, vocabulário e transições.\n` +
    `- Não copie 8 ou mais palavras consecutivas de nenhum exemplar. Recrie o padrão, não a frase.\n` +
    `- A Fala de cada cena deve ser literal, completa e pronta para o criador dizer; não escreva apenas "explique" ou "conte".\n` +
    `- O conjunto das Falas deve caber aproximadamente em ${pack.generationConstraints.targetDurationSeconds} segundos.\n` +
    `- Use cenário, objeto e enquadramento somente quando fizer sentido para o assunto; não force todos os sinais do DNA.\n` +
    `- Use demografia somente para clareza e exemplos, nunca para estereotipar.\n` +
    `- Resultado histórico é evidência correlacional, não promessa de performance.\n` +
    `- Retorne apenas JSON com title e content.`;
}

async function callGemini(prompt: string): Promise<{ draft: { title: string; content: string }; model: string } | null> {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  const model = (process.env.GEMINI_SCRIPT_MODEL || "gemini-2.5-flash").trim();
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: createUserContent([prompt]),
    config: {
      systemInstruction: "Você é o motor de roteiros da Data2Content. Use somente as evidências do próprio criador e cumpra o contrato JSON.",
      responseMimeType: "application/json",
      temperature: 0.35,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  logGeminiUsage("script_generation", model, response);
  const draft = parseJsonDraft(response.text);
  return draft ? { draft, model } : null;
}

async function repairWithGemini(params: {
  basePrompt: string;
  draft: { title: string; content: string };
  overlap: string | null;
  estimatedDuration: number;
  targetDuration: number;
}) {
  const issues = [
    params.overlap ? `Há cópia literal proibida: "${params.overlap}".` : "",
    Math.abs(params.estimatedDuration - params.targetDuration) > Math.max(7, params.targetDuration * 0.25)
      ? `A duração estimada é ${params.estimatedDuration}s; ajuste para ${params.targetDuration}s.` : "",
  ].filter(Boolean);
  if (!issues.length) return null;
  return callGemini(
    `${params.basePrompt}\n\nREVISÃO OBRIGATÓRIA\n${issues.map((item) => `- ${item}`).join("\n")}\n` +
    `Roteiro a corrigir:\n${JSON.stringify(params.draft)}\n` +
    `Preserve o assunto e a estratégia. Retorne somente JSON com title e content.`,
  );
}

function validate(params: {
  content: string;
  pack: CreatorScriptEvidencePack;
}) {
  const target = params.pack.generationConstraints.targetDurationSeconds;
  const estimated = estimateScriptDurationSeconds(params.content, params.pack.dna?.voice?.wordsPerSecond);
  const tolerance = Math.max(7, target * 0.25);
  const durationWithinTolerance = Math.abs(estimated - target) <= tolerance;
  const overlap = findVerbatimOverlap(
    params.content,
    params.pack.winningExemplars.flatMap((item) => [
      item.fullText,
      item.plannedScriptText || "",
      item.observedTranscriptText || "",
    ]),
  );
  const quality = evaluateTechnicalScriptQuality(params.content, params.pack.request.prompt);
  const warnings = [
    ...params.pack.receipt.warnings,
    !durationWithinTolerance ? `Duração estimada ${estimated}s fora da meta de ${target}s.` : "",
    overlap ? "Trecho excessivamente semelhante a um exemplar histórico." : "",
    quality.perceivedQuality < 0.72 ? "Qualidade técnica abaixo do alvo interno." : "",
  ].filter(Boolean);
  return {
    estimated,
    durationWithinTolerance,
    overlap,
    quality,
    warnings,
    passed: durationWithinTolerance && !overlap && quality.perceivedQuality >= 0.68,
  };
}

export async function generateCreatorScriptV3(input: GenerateCreatorScriptV3Input): Promise<CreatorScriptV3Result> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Informe um prompt para gerar o roteiro.");
  const pack = await buildCreatorScriptEvidencePack({
    userId: input.userId,
    prompt,
    goal: input.goal,
    targetDurationSeconds: input.targetDurationSeconds,
  });
  const v3Prompt = buildV3Prompt(input, pack);
  const anchor = resolveEditorialAnchorTitle({
    prompt,
    title: input.title,
    intelligenceContext: input.intelligenceContext,
  });
  const density = resolveBlueprintDensityProfile(prompt);
  const identitySources = [prompt, input.title || "", anchor];
  let provider: CreatorScriptV3Result["provider"] = "gemini";
  let model = (process.env.GEMINI_SCRIPT_MODEL || "gemini-2.5-flash").trim();
  let draft: { title: string; content: string } | null = null;
  let reviewMeta: ScriptSemanticReviewMeta | undefined;

  try {
    const gemini = await callGemini(v3Prompt);
    draft = gemini?.draft || null;
    if (gemini?.model) model = gemini.model;
  } catch (error) {
    logger.warn("[scripts][v3][gemini_failed]", {
      error: error instanceof Error ? error.message : String(error || ""),
    });
  }

  if (!draft) {
    const fallback = await generateScriptFromPrompt({
      prompt,
      title: input.title,
      intelligenceContext: input.intelligenceContext,
    });
    draft = { title: fallback.title, content: fallback.content };
    reviewMeta = fallback.reviewMeta;
    provider = process.env.OPENAI_API_KEY ? "openai_fallback" : "local_fallback";
    model = process.env.OPENAI_MODEL || "local";
  }

  const sanitized = sanitizeScriptIdentityLeakage(draft, identitySources);
  let normalized = enforceTechnicalScriptContract({
    title: input.title?.trim() || sanitized.title,
    content: sanitized.content,
  }, `${anchor}\n${prompt}`, {
    runQualityPass: true,
    editorialDecision: input.intelligenceContext?.editorialDecision,
    preferredSceneCount: pack.generationConstraints.preferredSceneCount || density.preferredSceneCount,
    maxSceneCount: Math.max(pack.generationConstraints.preferredSceneCount, density.maxSceneCount),
  });
  let checked = validate({ content: normalized.content, pack });

  if (provider === "gemini" && (!checked.durationWithinTolerance || checked.overlap)) {
    try {
      const repaired = await repairWithGemini({
        basePrompt: v3Prompt,
        draft: normalized,
        overlap: checked.overlap,
        estimatedDuration: checked.estimated,
        targetDuration: pack.generationConstraints.targetDurationSeconds,
      });
      if (repaired?.draft) {
        const repairedSafe = sanitizeScriptIdentityLeakage(repaired.draft, identitySources);
        normalized = enforceTechnicalScriptContract(repairedSafe, `${anchor}\n${prompt}`, {
          runQualityPass: true,
          editorialDecision: input.intelligenceContext?.editorialDecision,
          preferredSceneCount: pack.generationConstraints.preferredSceneCount,
          maxSceneCount: Math.max(pack.generationConstraints.preferredSceneCount, density.maxSceneCount),
        });
        checked = validate({ content: normalized.content, pack });
      }
    } catch (error) {
      logger.warn("[scripts][v3][repair_failed]", {
        error: error instanceof Error ? error.message : String(error || ""),
      });
    }
  }

  return {
    title: normalized.title,
    content: normalized.content,
    provider,
    model,
    evidenceReceipt: pack.receipt,
    generationVersion: "creator_script_generation_v3",
    estimatedDurationSeconds: checked.estimated,
    targetDurationSeconds: pack.generationConstraints.targetDurationSeconds,
    validation: {
      passed: checked.passed,
      durationWithinTolerance: checked.durationWithinTolerance,
      verbatimOverlap: checked.overlap,
      technicalScore: checked.quality.perceivedQuality,
      warnings: checked.warnings,
    },
    reviewMeta,
  };
}

export async function critiqueCreatorScriptV3(params: {
  userId: string;
  content: string;
  prompt?: string;
  targetDurationSeconds?: number | null;
}) {
  const prompt = params.prompt?.trim() || "Avalie este roteiro para o meu perfil";
  const pack = await buildCreatorScriptEvidencePack({
    userId: params.userId,
    prompt,
    targetDurationSeconds: params.targetDurationSeconds,
  });
  const checked = validate({ content: params.content, pack });
  return {
    schemaVersion: "creator_script_critique_v1",
    generatedAt: new Date().toISOString(),
    passed: checked.passed,
    estimatedDurationSeconds: checked.estimated,
    targetDurationSeconds: pack.generationConstraints.targetDurationSeconds,
    creatorFitConfidence: pack.generationConstraints.creatorFitConfidence,
    technicalQuality: checked.quality,
    issues: checked.warnings,
    recommendations: [
      !checked.durationWithinTolerance
        ? `Ajuste o volume de fala para aproximadamente ${pack.generationConstraints.targetDurationSeconds}s.` : "",
      checked.overlap ? "Reescreva o trecho semelhante preservando apenas o padrão narrativo." : "",
      checked.quality.hookStrength < 0.65 ? "Deixe a primeira fala mais concreta e específica para o assunto." : "",
      checked.quality.shootabilityScore < 0.65 ? "Acrescente cenário, ação, objeto ou enquadramento filmável." : "",
      checked.quality.ctaStrength < 0.65 ? "Feche com uma continuação natural da conversa." : "",
    ].filter(Boolean),
    evidenceReceipt: pack.receipt,
  };
}
