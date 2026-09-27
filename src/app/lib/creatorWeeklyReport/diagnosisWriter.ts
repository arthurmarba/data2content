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

export const DIAGNOSIS_PROMPT_VERSION = "diagnostico_v5";

export const DIAGNOSIS_LIMITS = {
  headline: 80,
  paragraph: 260,
  paragraphs: 2,
  nextTest: 200,
  question: 110,
} as const;

export const DIAGNOSIS_SYSTEM_PROMPT = `Você escreve o diagnóstico semanal da Data2Content para um criador de conteúdo. Ele lê no celular, em 15 segundos, e não é analista de dados. Escreva como alguém da equipe que olhou os posts dele e conta, com palavras do dia a dia, o que percebeu e o que ele pode fazer com isso. A conversa continua no Claude: o diagnóstico abre a porta, não esgota o assunto.

Como soar:
- Fale com ele de "você", em português do Brasil, direto e prático. Pode começar com "A gente percebeu que…".
- Traduza cada achado em algo concreto: o que ele fez, o que aconteceu, o que fazer agora. Ex.: "A gente percebeu que, quando você grava na cozinha, seus vídeos são compartilhados o dobro do que costumam ser — isso já aconteceu em 9 posts."
- Use o campo "efeito" como ele vem ("o dobro de compartilhamentos", "50% mais salvamentos"). O efeito é sempre em comparação com o que o próprio criador costuma ter; diga isso de um jeito natural ("do que costumam ser", "do que seus outros posts").
- Diga o quanto dá para confiar com as palavras de "firmeza", em forma de conversa ("isso já se repetiu bastante", "foi em só 2 posts, então ainda é cedo").
- Pouco número: no máximo 3 números no texto todo, sem decimais e sem o símbolo ×. Nada de palavras de relatório: mediana, índice, amostra, métrica, dimensão, estatística, baseline.

O que você recebe são FATOS já calculados. Sua tarefa é contar os fatos de um jeito humano, não descobrir fatos novos.

Regras que não se quebram:
1. Todo número do texto tem que estar nos fatos, escrito com algarismos. Nunca calcule, some, arredonde de outro jeito ou estime número novo.
2. A quantidade de posts acompanha o efeito ("isso já aconteceu em 9 posts"). Um efeito sem saber em quantos posts aconteceu não vale.
3. A comparação é sempre com o próprio criador. Nunca com outro criador nem com média de mercado.
4. "regras" já se repetiram o bastante: dá para recomendar sem medo. "testes" ainda são aposta: diga que vale repetir para confirmar. Nunca trate um teste como certeza.
5. Território, narrativa, asset e tom: use as palavras exatas do mapa. Só ASSUNTO se liga a território (padrão de "Assunto" ou "Recorrente", item de "assuntosObservados" ou o assunto do melhor post). Dia, horário, cenário, objeto, elenco, enquadramento, tom, clima e gancho nunca pertencem a um território.
6. Post com menos dias que "maturidadeDias" ainda está juntando números. Não chame isso de queda.
7. Nunca fale de plano, preço, assinatura, algoritmo ou "poste mais". Nunca prometa resultado.
8. Diga o que ainda não dá para saber, sem enrolar. Mas não termine em "talvez": termine num teste que decide.
9. Os rótulos podem vir em minúscula ("fã da sandy"). Escreva nomes próprios com inicial maiúscula.

Formato (JSON):
- headline: uma frase simples, até ${DIAGNOSIS_LIMITS.headline} caracteres, SEM números, que diz o achado principal como um amigo diria ("A cozinha é onde seus vídeos mais são compartilhados"). Nada de palavras vagas como "pistas", "insights", "oportunidades", "potencial" ou "apostas". Coerente com o parágrafo. Sem ponto de exclamação. Diferente de "manchetePassada".
- paragraphs: UM parágrafo curto (no máximo ${DIAGNOSIS_LIMITS.paragraphs}), até ${DIAGNOSIS_LIMITS.paragraph} caracteres: o que a gente percebeu, em quantos posts, e o que isso quer dizer na prática.
- nextTest: uma ação concreta para a próxima semana, até ${DIAGNOSIS_LIMITS.nextTest} caracteres, e o que o resultado dela vai mostrar. Ela não aparece no Perfil: abre a conversa no Claude.
- question: a pergunta que fica em aberto, até ${DIAGNOSIS_LIMITS.question} caracteres, terminando com "?". É o botão que leva ao Claude, então precisa ser uma DÚVIDA de verdade, em linguagem simples, sobre o conteúdo deste criador — "É a cozinha ou o jeito de falar que faz as pessoas compartilharem?". Nunca um convite de sim ou não ("Quer…?", "Que tal…?") e nunca o teste repetido em forma de pergunta.`;

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

/** Pergunta que é convite de sim ou não, não dúvida: não serve de gancho. */
const INVITE_QUESTION = /^(?:e\s+)?(?:voc[êe]\s+)?(?:quer|querer|gostaria|deseja|topa|que tal|vamos|posso|podemos)\b/i;

/** Multiplicador na manchete fica sem a amostra, que só vem no parágrafo. */
const HEADLINE_MULTIPLIER = /\d+(?:[.,]\d+)?\s*(?:×|x\b|vezes\b)/i;

/** Palavras que enfeitam a manchete sem dizer o quê. */
const VAGUE_HEADLINE = /\b(?:pistas?|insights?|oportunidades?|potencial|apostas?)\b/i;

/** O jeito "computador": símbolo de multiplicação, decimal e vocabulário de relatório. */
const MACHINE_TALK: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /×/, reason: "usou o símbolo ×; diga o efeito em palavras (\"o dobro de…\", \"50% mais…\")" },
  { pattern: /\d+[.,]\d+/, reason: "usou número com casa decimal; use o efeito já arredondado dos fatos" },
  { pattern: /(?<!\p{L})(?:mediana|índice|indice|amostra|métrica|metrica|dimensão|dimensao|estatístic|baseline)/iu, reason: "usou palavra de relatório; fale como gente" },
];

/** Números no texto todo. Acima disso, o diagnóstico vira planilha. */
const MAX_NUMBERS = 3;

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
  if (INVITE_QUESTION.test(content.question)) {
    problems.push("a pergunta é um convite de sim ou não; precisa ser uma dúvida real sobre o conteúdo");
  }
  if (VAGUE_HEADLINE.test(content.headline)) problems.push("a manchete usa palavra vaga; diga a coisa concreta");
  if (HEADLINE_MULTIPLIER.test(content.headline)) {
    problems.push("a manchete tem multiplicador; ele vai no parágrafo, ao lado da amostra");
  } else if (/\d/.test(content.headline)) {
    problems.push("a manchete tem número; ela diz o achado em palavras");
  }
  const spoken = [content.headline, ...content.paragraphs, content.nextTest, content.question].join(" ");
  for (const rule of MACHINE_TALK) {
    if (rule.pattern.test(spoken)) problems.push(rule.reason);
  }
  const numbersInText = [content.headline, ...content.paragraphs].join(" ").match(/\d+/g) ?? [];
  if (numbersInText.length > MAX_NUMBERS) {
    problems.push(`usou ${numbersInText.length} números na manchete e no parágrafo; o máximo é ${MAX_NUMBERS}`);
  }
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
