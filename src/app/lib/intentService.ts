// @/app/lib/intentService.ts – v2.14 (clean & fixed pickRandom)
// --------------------------------------------------

import { logger } from '@/app/lib/logger';
import { IUser }  from '@/app/models/User';

/* -------------------------------------------------- *
 *  Tipagens internas
 * -------------------------------------------------- */
export type DeterminedIntent =
  | 'script_request'
  | 'content_plan'
  | 'ranking_request'
  | 'general'
  | 'report'
  | 'content_ideas'
  | 'greeting'
  | 'clarification_follow_up'
  | 'proactive_script_accept'
  | 'proactive_script_reject'
  | 'ASK_BEST_PERFORMER'
  | 'ASK_BEST_TIME';

export type IntentResult =
  | { type: 'intent_determined'; intent: DeterminedIntent }
  | { type: 'special_handled'; response: string };

export interface IDialogueState {
  lastInteraction?: number;
  lastGreetingSent?: number;
  recentPlanIdeas?: { identifier: string; description: string }[] | null;
  recentPlanTimestamp?: number;
  lastOfferedScriptIdea?: {
    aiGeneratedIdeaDescription: string;
    originalSource: any;
    timestamp: number;
  } | null;
}

/* -------------------------------------------------- *
 *  Listas de keywords
 * -------------------------------------------------- */
const SCRIPT_KEYWORDS: string[] = [
  'roteiro','script','estrutura','outline','sequencia',
  'escreve pra mim','como fazer video sobre','estrutura de post','roteiriza'
];
const CONTENT_PLAN_KEYWORDS: string[] = [
  'planejamento','plano de conteudo','agenda de posts','calendario editorial',
  'o que postar essa semana','sugestao de agenda','me da um plano','cria um plano'
];
const RANKING_KEYWORDS: string[] = [
  'ranking','rank','melhores','piores','top','quais sao os','lista de'
];
const REPORT_KEYWORDS: string[] = [
  'relatorio','plano','estratégia','detalhado','completo','performance',
  'analisa','analise','visão geral','resultado','resultados','desempenho'
];
const CONTENT_IDEAS_KEYWORDS: string[] = [
  'ideia','ideias','conteúdo','sugestão de post','sugestões de post','sugere',
  'sugestão','o que postar','inspiração','exemplos de posts','dicas de conteúdo',
  'ideias criativas'
];
const ASK_BEST_PERFORMER_KEYWORDS: string[] = [
  'qual tipo','qual conteudo','qual proposta','qual contexto','gera mais',
  'melhor desempenho','maior desempenho','recordista em','performam melhor',
  'quais dao mais','o que da mais'
];
const BEST_TIME_KEYWORDS: string[] = [
  'melhor dia','melhor hora','melhor horario','qual dia','qual hora',
  'qual horario','quando postar','frequencia','cadencia'
];
const GREETING_KEYWORDS: string[] = [
  'oi','olá','ola','tudo bem','bom dia','boa tarde','boa noite','e aí','eae'
];

/* -------------------------------------------------- *
 *  Utilidades
 * -------------------------------------------------- */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const toNormSet = (arr: string[]) => new Set(arr.map(normalize));

const N_SCRIPT_KW    = toNormSet(SCRIPT_KEYWORDS);
const N_PLAN_KW      = toNormSet(CONTENT_PLAN_KEYWORDS);
const N_RANK_KW      = toNormSet(RANKING_KEYWORDS);
const N_REPORT_KW    = toNormSet(REPORT_KEYWORDS);
const N_IDEAS_KW     = toNormSet(CONTENT_IDEAS_KEYWORDS);
const N_BEST_PERF_KW = toNormSet(ASK_BEST_PERFORMER_KEYWORDS);
const N_BEST_TIME_KW = toNormSet(BEST_TIME_KEYWORDS);
const N_GREET_KW     = toNormSet(GREETING_KEYWORDS);

const includesKw = (txt: string, kwSet: Set<string>) =>
  [...kwSet].some((kw) => txt.includes(kw));

/**
 * Retorna um elemento aleatório de arr, garantindo não-undefined.
 */
const pickRandom = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error('pickRandom: array vazio');
  const idx = Math.floor(Math.random() * arr.length);
  const item = arr[idx];
  if (item === undefined) throw new Error('pickRandom: item indefinido');
  return item;
};

/* -------------------------------------------------- *
 *  Helpers de intenção
 * -------------------------------------------------- */
const isPlanRequest     = (txt: string) => includesKw(txt, N_PLAN_KW);
const isScriptRequest   = (txt: string) => includesKw(txt, N_SCRIPT_KW);
const isRankingRequest  = (txt: string) => includesKw(txt, N_RANK_KW);
const isIdeasRequest    = (txt: string) => includesKw(txt, N_IDEAS_KW);
const isReportRequest   = (txt: string) => includesKw(txt, N_REPORT_KW);
const isBestPerfRequest = (txt: string) => includesKw(txt, N_BEST_PERF_KW);
const isBestTimeRequest = (txt: string) => {
  if (txt.includes('melhores dias') || txt.includes('melhor dia')) return true;
  return includesKw(txt, N_BEST_TIME_KW);
};

function isGreetingOnly(norm: string): boolean {
  if (!includesKw(norm, N_GREET_KW)) return false;
  const words = norm.split(/\s+/);
  return words.length <= 3 && words.every((w) => N_GREET_KW.has(w));
}

/* -------------------------------------------------- *
 *  CASOS ESPECIAIS RÁPIDOS
 * -------------------------------------------------- */
async function quickSpecialHandle(
  user: IUser,
  normalized: string,
  greeting: string
): Promise<IntentResult | null> {
  if (isGreetingOnly(normalized)) {
    return {
      type: 'special_handled',
      response: `${greeting} Em que posso ajudar?`,
    };
  }
  if (['obrigado','obrigada','valeu','show','thanks'].includes(normalized)) {
    return {
      type: 'special_handled',
      response: pickRandom([
        'Disponha! 😊',
        'Que bom! Qual o próximo passo?',
        '👍 Fico à disposição.',
      ]),
    };
  }
  return null;
}

/* -------------------------------------------------- *
 *  FUNÇÃO PRINCIPAL (exportada)
 * -------------------------------------------------- */
export async function determineIntent(
  normalizedText : string,
  user           : IUser,
  rawText        : string,
  dialogueState  : IDialogueState,
  greeting       : string,
  userId         : string
): Promise<IntentResult> {
  const tag = '[intentService.determineIntent v2.14]';
  logger.debug(`${tag} analisando: "${normalizedText}"`);

  const special = await quickSpecialHandle(user, normalizedText, greeting);
  if (special) return special;

  // Aqui você pode inserir a lógica contextual antes…

  let intent: DeterminedIntent = 'general';
  if      (isBestTimeRequest(normalizedText)) intent = 'ASK_BEST_TIME';
  else if (isPlanRequest(normalizedText))     intent = 'content_plan';
  else if (isScriptRequest(normalizedText))   intent = 'script_request';
  else if (isBestPerfRequest(normalizedText)) intent = 'ASK_BEST_PERFORMER';
  else if (isIdeasRequest(normalizedText))    intent = 'content_ideas';
  else if (isRankingRequest(normalizedText))  intent = 'ranking_request';
  else if (isReportRequest(normalizedText))   intent = 'report';

  logger.info(`${tag} intenção final: ${intent} para user ${userId}`);
  return { type: 'intent_determined', intent };
}

/* -------------------------------------------------- *
 *  Helpers expostos para consultantService
 * -------------------------------------------------- */
export const normalizeText = normalize;
export function getRandomGreeting(userName = 'criador') {
  return pickRandom([
    `Oi ${userName}!`,
    `Olá ${userName}!`,
    `E aí, ${userName}?`,
  ]);
}
