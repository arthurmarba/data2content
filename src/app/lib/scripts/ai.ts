import OpenAI from "openai";

import { getCategoryById } from "@/app/lib/classification";
import type { ScriptIntelligenceContext } from "./intelligenceContext";

type ScriptDraft = {
  title: string;
  content: string;
};

type GenerateInput = {
  prompt: string;
  intelligenceContext?: ScriptIntelligenceContext | null;
};

type AdjustInput = {
  prompt: string;
  title: string;
  content: string;
  intelligenceContext?: ScriptIntelligenceContext | null;
};

const SHORTEN_INTENT_REGEX =
  /(resum|encurt|reduz|compact|mais curto|diminu|simplifi|sintetiz|vers[aã]o curta|menos palavras)/i;
const FIRST_PARAGRAPH_INTENT_REGEX =
  /(primeir[oa].{0,30}par[aá]grafo|par[aá]grafo inicial|abertura|introdu[cç][aã]o|intro)/i;
const HAS_CTA_REGEX =
  /(cta|comente|coment[aá]rio|salve|salvar|compartilhe|compartilha|me conta|me diga|link na bio)/i;
const MENTION_REGEX = /@([A-Za-z0-9._]{2,30})/g;
const HASHTAG_REGEX = /#([\p{L}0-9_]{2,40})/gu;

function clampText(value: unknown, fallback: string, max: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return fallback;
  return normalized.slice(0, max);
}

function splitParagraphs(value: string) {
  return value
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractMentions(value: string): Set<string> {
  const mentions = new Set<string>();
  for (const match of value.matchAll(MENTION_REGEX)) {
    const handle = String(match[1] || "").toLowerCase().trim();
    if (handle) mentions.add(handle);
  }
  return mentions;
}

function extractHashtags(value: string): Set<string> {
  const hashtags = new Set<string>();
  for (const match of value.matchAll(HASHTAG_REGEX)) {
    const tag = String(match[1] || "").toLowerCase().trim();
    if (tag) hashtags.add(tag);
  }
  return hashtags;
}

function compactWhitespace(value: string): string {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildIdentityAllowList(allowedTexts: string[]) {
  const mentions = new Set<string>();
  const hashtags = new Set<string>();

  for (const text of allowedTexts) {
    const source = String(text || "");
    for (const mention of extractMentions(source)) {
      mentions.add(mention);
    }
    for (const hashtag of extractHashtags(source)) {
      hashtags.add(hashtag);
    }
  }

  return { mentions, hashtags };
}

export function sanitizeScriptIdentityLeakage(draft: ScriptDraft, allowedTexts: string[]): ScriptDraft {
  const allowList = buildIdentityAllowList(allowedTexts);

  const sanitizeText = (value: string) => {
    const mentionsSanitized = value.replace(MENTION_REGEX, (match, handle) => {
      const normalized = String(handle || "").toLowerCase().trim();
      if (!normalized) return "";
      if (allowList.mentions.has(normalized)) return match;
      return "criador";
    });

    const hashtagsSanitized = mentionsSanitized.replace(HASHTAG_REGEX, (match, hashtag) => {
      const normalized = String(hashtag || "").toLowerCase().trim();
      if (!normalized) return "";
      if (allowList.hashtags.has(normalized)) return match;
      return "";
    });

    return compactWhitespace(hashtagsSanitized);
  };

  return {
    title: sanitizeText(draft.title),
    content: sanitizeText(draft.content),
  };
}

function fallbackGenerate(prompt: string): ScriptDraft {
  const normalized = prompt.trim();
  const titleBase = normalized ? normalized.split(/\s+/).slice(0, 7).join(" ") : "Novo roteiro";
  const title = clampText(titleBase, "Novo roteiro", 80);
  const content = clampText(
    `Gancho: ${normalized || "comece com uma frase que prenda atenção"}.\nDesenvolvimento: explique em 2-3 passos objetivos.\nCTA: finalize com uma ação clara para o público.`,
    "Estruture o roteiro em gancho, desenvolvimento e CTA.",
    12000
  );
  return { title, content };
}

function fallbackAdjust(input: AdjustInput): ScriptDraft {
  const appendix = input.prompt.trim()
    ? `\n\n[Ajuste solicitado]\n${input.prompt.trim()}`
    : "";
  return {
    title: clampText(input.title, "Roteiro ajustado", 80),
    content: clampText(`${input.content}${appendix}`, input.content, 12000),
  };
}

function resolveCategoryLabel(dimension: keyof NonNullable<ScriptIntelligenceContext["resolvedCategories"]>, id: string): string {
  const map = {
    proposal: "proposal",
    context: "context",
    format: "format",
    tone: "tone",
    references: "reference",
  } as const;

  const category = getCategoryById(id, map[dimension]);
  if (!category) return id;
  return `${category.label} (${id})`;
}

function buildIntelligencePromptBlock(context: ScriptIntelligenceContext | null | undefined): string {
  if (!context) return "";

  const resolved = context.resolvedCategories;
  const categoryLines = [
    resolved.proposal ? `- proposal: ${resolveCategoryLabel("proposal", resolved.proposal)}` : null,
    resolved.context ? `- context: ${resolveCategoryLabel("context", resolved.context)}` : null,
    resolved.format ? `- format: ${resolveCategoryLabel("format", resolved.format)}` : null,
    resolved.tone ? `- tone: ${resolveCategoryLabel("tone", resolved.tone)}` : null,
    resolved.references ? `- references: ${resolveCategoryLabel("references", resolved.references)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const dnaLines = context.dnaProfile.writingGuidelines.length
    ? context.dnaProfile.writingGuidelines.map((line) => `- ${line}`).join("\n")
    : "- Use linguagem natural em portugues do Brasil com CTA claro.";

  const captionExamples = context.captionEvidence
    .slice(0, 3)
    .map((item, index) => `${index + 1}) ${item.caption.replace(/\s+/g, " ").slice(0, 180)}`)
    .join("\n");

  const evidenceBlock = captionExamples
    ? `Exemplos reais de linguagem do criador (resumo):\n${captionExamples}`
    : "Sem exemplos suficientes de legenda. Use regras base do roteirista.";

  return (
    `\n\nContexto inteligente do criador (aplique silenciosamente, sem explicar ao usuario):\n` +
    `- Modo do pedido: ${context.promptMode}\n` +
    `- Métrica usada: ${context.metricUsed}\n` +
    `- Janela historica: ${context.lookbackDays} dias\n` +
    `${categoryLines || "- Sem categorias resolvidas."}\n` +
    `- Evidencias de DNA: ${context.dnaProfile.sampleSize} legendas\n` +
    `- Perfil de linguagem:\n${dnaLines}\n` +
    `${evidenceBlock}`
  );
}

function parseDraftFromResponse(raw: string): ScriptDraft {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    throw new Error("Resposta vazia do modelo");
  }

  const direct = (() => {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  })();

  let parsed = direct;
  if (!parsed) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = JSON.parse(trimmed.slice(start, end + 1));
    }
  }

  const title = clampText(parsed?.title, "Novo roteiro", 80);
  const content = clampText(parsed?.content, "Roteiro gerado.", 12000);
  return { title, content };
}

async function callModel(prompt: string): Promise<ScriptDraft | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: Number(process.env.OPENAI_TEMP || 0.4),
    response_format: { type: "json_object" } as any,
    messages: [
      {
        role: "system",
        content:
          "Você é especialista em roteiros para creators no Brasil. Responda estritamente JSON com {\"title\": string, \"content\": string}. Não inclua explicações, comentários, markdown ou campos extras.",
      },
      { role: "user", content: prompt },
    ],
  } as any);

  const raw = completion.choices?.[0]?.message?.content || "{}";
  return parseDraftFromResponse(raw);
}

function enforceGeneratedScriptContract(draft: ScriptDraft, fallbackPrompt: string): ScriptDraft {
  let title = clampText(draft.title, "Novo roteiro", 80);
  let content = clampText(draft.content, "", 12000);

  if (!content || content.length < 120) {
    const fallback = fallbackGenerate(fallbackPrompt);
    title = title || fallback.title;
    content = fallback.content;
  }

  const paragraphs = splitParagraphs(content);
  if (paragraphs.length < 2 && content.length < 200) {
    const fallback = fallbackGenerate(fallbackPrompt);
    content = fallback.content;
  }

  if (!HAS_CTA_REGEX.test(content)) {
    content = clampText(`${content}\n\nCTA: me conta nos comentarios se você quer mais roteiros assim.`, content, 12000);
  }

  return {
    title: clampText(title, "Novo roteiro", 80),
    content: clampText(content, "Roteiro gerado.", 12000),
  };
}

function sanitizeAdjustedScript(input: AdjustInput, draft: ScriptDraft): ScriptDraft {
  const originalTitle = clampText(input.title, "Roteiro ajustado", 80);
  const originalContent = clampText(input.content, "", 12000);
  const nextTitle = clampText(draft.title, originalTitle, 80);
  const nextContent = clampText(draft.content, originalContent, 12000);
  const prompt = input.prompt.trim();

  if (!originalContent) {
    return { title: nextTitle, content: nextContent };
  }

  const originalParagraphs = splitParagraphs(originalContent);
  const nextParagraphs = splitParagraphs(nextContent);
  const requestsShortVersion = SHORTEN_INTENT_REGEX.test(prompt);
  const requestsFirstParagraphOnly = FIRST_PARAGRAPH_INTENT_REGEX.test(prompt);

  if (requestsFirstParagraphOnly && originalParagraphs.length > 1 && nextParagraphs.length > 0) {
    const merged = [nextParagraphs[0], ...originalParagraphs.slice(1)].join("\n\n");
    return {
      title: nextTitle,
      content: clampText(merged, originalContent, 12000),
    };
  }

  const likelyLossOfContent =
    originalContent.length >= 500 &&
    nextContent.length < originalContent.length * 0.55 &&
    !requestsShortVersion;

  if (likelyLossOfContent) {
    return {
      title: nextTitle,
      content: originalContent,
    };
  }

  return { title: nextTitle, content: nextContent };
}

export async function generateScriptFromPrompt(input: GenerateInput): Promise<ScriptDraft> {
  const userPrompt = input.prompt.trim();
  if (!userPrompt) {
    throw new Error("Informe um prompt para gerar o roteiro.");
  }

  const intelligenceBlock = buildIntelligencePromptBlock(input.intelligenceContext);

  const llmPrompt =
    `Crie um roteiro completo em português do Brasil para creator.\n` +
    `Pedido do usuário: ${userPrompt}\n` +
    `${intelligenceBlock}\n\n` +
    `Regras obrigatórias:\n` +
    `- Retornar APENAS JSON válido com os campos title e content\n` +
    `- Entregar roteiro pronto para uso, sem explicar raciocínio\n` +
    `- Estrutura mínima: abertura forte, desenvolvimento e fechamento com CTA\n` +
    `- Linguagem natural, objetiva e adequada ao criador\n` +
    `- Não citar outros criadores, marcas ou perfis sem pedido explícito\n` +
    `- Não incluir @menções ou hashtags, exceto se o usuário pedir explicitamente\n` +
    `- Não usar markdown pesado nem listas longas`;

  try {
    const result = await callModel(llmPrompt);
    if (result) {
      const sanitized = sanitizeScriptIdentityLeakage(result, [userPrompt]);
      return enforceGeneratedScriptContract(sanitized, userPrompt);
    }
  } catch {
    // Fallback local.
  }

  const fallback = sanitizeScriptIdentityLeakage(fallbackGenerate(userPrompt), [userPrompt]);
  return enforceGeneratedScriptContract(fallback, userPrompt);
}

export async function adjustScriptFromPrompt(input: AdjustInput): Promise<ScriptDraft> {
  const userPrompt = input.prompt.trim();
  if (!userPrompt) {
    throw new Error("Descreva o ajuste que você quer aplicar.");
  }

  const intelligenceBlock = buildIntelligencePromptBlock(input.intelligenceContext);

  const llmPrompt =
    `Ajuste o roteiro existente com base no pedido do usuário.\n` +
    `Título atual: ${input.title}\n` +
    `Roteiro atual:\n${input.content}\n\n` +
    `${intelligenceBlock}\n\n` +
    `Ajuste solicitado: ${userPrompt}\n\n` +
    `Regras obrigatórias:\n` +
    `- Preserve integralmente o que não foi pedido para mudar\n` +
    `- Se o pedido for pontual (ex.: primeiro parágrafo), altere só esse trecho\n` +
    `- Retorne sempre o roteiro completo atualizado (nunca apenas um trecho)\n` +
    `- Não citar outros criadores, marcas ou perfis sem pedido explícito\n` +
    `- Não incluir @menções ou hashtags, exceto se o usuário pedir explicitamente\n` +
    `- Resposta em JSON válido com {"title","content"}\n` +
    `- Não inclua explicações fora do JSON`;

  const allowedIdentitySources = [userPrompt, input.title, input.content];

  try {
    const result = await callModel(llmPrompt);
    if (result) {
      const sanitized = sanitizeScriptIdentityLeakage(result, allowedIdentitySources);
      return sanitizeAdjustedScript(input, sanitized);
    }
  } catch {
    // Fallback local.
  }

  const fallback = sanitizeScriptIdentityLeakage(fallbackAdjust(input), allowedIdentitySources);
  return sanitizeAdjustedScript(input, fallback);
}
