// src/app/lib/creatorWeeklyReport/diagnosisWriter.ts
//
// Escreve o diagnóstico da semana a partir dos fatos — e confere antes de aceitar.
//
// O texto substitui os cartões de padrão no Perfil, então ele carrega a regra que
// os cartões carregavam: número só com amostra, nada inventado. A conferência é
// mecânica: todo número do texto precisa existir nos fatos; frase de venda e
// "poste mais" reprovam. Reprovado, o modelo tenta uma segunda vez sabendo o que
// errou. Reprovado de novo, não há diagnóstico nesta tentativa — melhor a tela
// dizer que atrasou do que publicar um número que ninguém mediu.

import { llmGenerate } from "@/app/lib/llm";
import {
  allowedNumbers,
  normalizeNumberToken,
  type DiagnosisFacts,
} from "./diagnosisFacts";
import type { CreatorWeeklyDiagnosisContent } from "./types";

export const DIAGNOSIS_PROMPT_VERSION = "diagnostico_v2";

export const DIAGNOSIS_LIMITS = {
  headline: 80,
  paragraph: 260,
  paragraphs: 2,
  nextTest: 200,
  question: 110,
} as const;

export const DIAGNOSIS_SYSTEM_PROMPT = `Você escreve o diagnóstico semanal da Data2Content para um criador de conteúdo. Ele aparece no Perfil do app, no lugar de uma lista de números, e é lido em 15 segundos. A conversa continua no Claude: o diagnóstico abre a porta, não esgota o assunto.

Quem lê é o próprio criador. Fale com ele de "você", em português do Brasil, com calma e sem jargão de marketing. Você é um parceiro que leu os posts dele, não um painel de métricas.

O que você recebe são FATOS já calculados. Sua tarefa é juntar os fatos numa leitura, não descobrir fatos novos.

Regras que não se quebram:
1. Todo número do texto tem que estar nos fatos, escrito com algarismos. Nunca calcule, arredonde de outro jeito, some ou estime número novo. Se não estiver nos fatos, não escreva.
2. Todo multiplicador vem com a amostra: "2,3× o seu normal, em 6 posts". Nunca um número sozinho.
3. O normal é a mediana do próprio criador nos últimos 90 dias. Nunca compare com outro criador nem com média de mercado.
4. "regras" já se repetiram o bastante para virar decisão. "testes" renderam acima do normal em poucos posts: são aposta, e você diz isso. Nunca trate um teste como regra.
5. Território, narrativa, asset e tom: use as palavras exatas do mapa. Não invente rótulo novo. Sem mapa, não fale de narrativa.
6. Post com menos dias que "maturidadeDias" ainda está acumulando números. Não chame isso de queda.
7. Nunca fale de plano, preço, assinatura, algoritmo ou "poste mais". Nunca prometa resultado.
8. Diga o que ainda não dá para saber, sem enrolar. Mas não termine em "talvez": termine num teste que decide.

Formato (JSON):
- headline: uma frase, até ${DIAGNOSIS_LIMITS.headline} caracteres, que diz o que a semana revela. Sem ponto de exclamação. Diferente de "manchetePassada".
- paragraphs: UM parágrafo curto (no máximo ${DIAGNOSIS_LIMITS.paragraphs}), até ${DIAGNOSIS_LIMITS.paragraph} caracteres. Diz o que está funcionando, com a evidência, e o que a semana mostrou. Sem repetir a manchete.
- nextTest: uma ação concreta para a próxima semana, até ${DIAGNOSIS_LIMITS.nextTest} caracteres, e o que o resultado dela vai dizer. Ela não aparece no Perfil: abre a conversa no Claude.
- question: a pergunta que fica em aberto, até ${DIAGNOSIS_LIMITS.question} caracteres, terminando com "?". É o botão que leva ao Claude: específica dos fatos deste criador, algo que ele vai querer conversar. Nunca genérica como "quer saber mais?".`;

export const DIAGNOSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    paragraphs: { type: "array", items: { type: "string" } },
    nextTest: { type: "string" },
    question: { type: "string" },
  },
  required: ["headline", "paragraphs", "nextTest", "question"],
} as const;

export function buildDiagnosisPrompt(facts: DiagnosisFacts, feedback?: string[]): string {
  const base = `Fatos da semana (JSON):\n${JSON.stringify(facts, null, 2)}`;
  if (!feedback?.length) return base;
  return `${base}\n\nSua resposta anterior foi recusada por:\n${feedback.map((item) => `- ${item}`).join("\n")}\nEscreva de novo corrigindo isso.`;
}

const NUMBER_WORDS: Record<string, number> = {
  dois: 2, duas: 2, "três": 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
  oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14,
  quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
};

const FORBIDDEN: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /R\$/, reason: "fala de preço" },
  { pattern: /\bassinatur/i, reason: "fala de assinatura" },
  { pattern: /\bupgrade\b/i, reason: "fala de upgrade" },
  { pattern: /\bplano (pro|anual|mensal)\b/i, reason: "fala de plano" },
  { pattern: /\balgoritmo/i, reason: "fala de algoritmo" },
  { pattern: /\bposte mais\b/i, reason: "manda postar mais" },
];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export type DiagnosisValidation =
  | { ok: true; content: CreatorWeeklyDiagnosisContent }
  | { ok: false; problems: string[] };

/** Confere forma, tamanho, números e vocabulário proibido. */
export function validateDiagnosis(raw: unknown, facts: DiagnosisFacts): DiagnosisValidation {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const content: CreatorWeeklyDiagnosisContent = {
    headline: text(source.headline),
    paragraphs: Array.isArray(source.paragraphs) ? source.paragraphs.map(text).filter(Boolean) : [],
    nextTest: text(source.nextTest),
    question: text(source.question),
  };
  const problems: string[] = [];

  if (!content.headline) problems.push("faltou a manchete");
  if (content.headline.length > DIAGNOSIS_LIMITS.headline) problems.push(`manchete passou de ${DIAGNOSIS_LIMITS.headline} caracteres`);
  if (content.paragraphs.length < 1 || content.paragraphs.length > DIAGNOSIS_LIMITS.paragraphs) {
    problems.push(`precisa de 1 a ${DIAGNOSIS_LIMITS.paragraphs} parágrafos`);
  }
  if (content.paragraphs.some((paragraph) => paragraph.length > DIAGNOSIS_LIMITS.paragraph)) {
    problems.push(`parágrafo passou de ${DIAGNOSIS_LIMITS.paragraph} caracteres`);
  }
  if (!content.nextTest) problems.push("faltou o teste da próxima semana");
  if (content.nextTest.length > DIAGNOSIS_LIMITS.nextTest) problems.push(`teste passou de ${DIAGNOSIS_LIMITS.nextTest} caracteres`);
  if (!content.question.endsWith("?")) problems.push("a pergunta precisa terminar com ?");
  if (content.question.length > DIAGNOSIS_LIMITS.question) problems.push(`pergunta passou de ${DIAGNOSIS_LIMITS.question} caracteres`);
  if (facts.manchetePassada && content.headline.toLocaleLowerCase("pt-BR") === facts.manchetePassada.toLocaleLowerCase("pt-BR")) {
    problems.push("repetiu a manchete da semana passada");
  }

  const allText = [content.headline, ...content.paragraphs, content.nextTest, content.question].join(" ");
  const allowed = allowedNumbers(facts);
  const invented = new Set<string>();
  for (const match of allText.matchAll(/\d+(?:[.,]\d+)?/g)) {
    if (!allowed.has(normalizeNumberToken(match[0]))) invented.add(match[0]);
  }
  for (const match of allText.toLocaleLowerCase("pt-BR").matchAll(/\p{L}+/gu)) {
    const value = NUMBER_WORDS[match[0]];
    if (value !== undefined && !allowed.has(String(value))) invented.add(match[0]);
  }
  if (invented.size > 0) {
    problems.push(`citou número que não está nos fatos: ${[...invented].join(", ")}`);
  }

  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(allText)) problems.push(rule.reason);
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, content };
}

export type DiagnosisGenerate = (params: {
  system: string;
  prompt: string;
}) => Promise<{ json: unknown; provider: string | null; model: string | null }>;

/** O caminho real: Gemini pelo núcleo, escopo próprio para medir o custo. */
export const generateDiagnosisWithLlm: DiagnosisGenerate = async ({ system, prompt }) => {
  const result = await llmGenerate(
    {
      system,
      prompt,
      json: true,
      jsonSchema: DIAGNOSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
      intensity: "medium",
      thinkingLevel: "medium",
      maxTokens: 1500,
      usageTag: "perfil_diagnostico",
    },
    { scope: "DIAGNOSIS" },
  );
  const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let json: unknown = null;
  try {
    json = JSON.parse(cleaned);
  } catch {
    // JSON quebrado vira recusa na conferência, com nova tentativa.
  }
  return { json, provider: result.provider, model: result.model };
};

export type DiagnosisWriteResult =
  | { ok: true; content: CreatorWeeklyDiagnosisContent; provider: string | null; model: string | null }
  | { ok: false; safeErrorCode: "diagnosis_rejected" | "diagnosis_llm_failed"; problems: string[] };

/** Escreve, confere e tenta uma segunda vez com o motivo da recusa. */
export async function writeDiagnosis(
  facts: DiagnosisFacts,
  generate: DiagnosisGenerate = generateDiagnosisWithLlm,
): Promise<DiagnosisWriteResult> {
  let feedback: string[] | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Awaited<ReturnType<DiagnosisGenerate>>;
    try {
      response = await generate({ system: DIAGNOSIS_SYSTEM_PROMPT, prompt: buildDiagnosisPrompt(facts, feedback) });
    } catch (error) {
      return { ok: false, safeErrorCode: "diagnosis_llm_failed", problems: [String(error).slice(0, 200)] };
    }
    const validation = validateDiagnosis(response.json, facts);
    if (validation.ok) {
      return { ok: true, content: validation.content, provider: response.provider, model: response.model };
    }
    feedback = validation.problems;
  }
  return { ok: false, safeErrorCode: "diagnosis_rejected", problems: feedback ?? [] };
}
