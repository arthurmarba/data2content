// @/app/lib/intentService.ts – v2.15.1 (Corrige type guard para special.response)
// --------------------------------------------------

import { logger } from '@/app/lib/logger';
import { IUser }  from '@/app/models/User';

/* -------------------------------------------------- *
 * Tipagens internas
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
  | 'ASK_BEST_TIME'
  | 'social_query'
  | 'meta_query_personal';

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
 * Listas de keywords
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
  'oi','olá','ola','tudo bem','bom dia','boa tarde','boa noite','e aí','eae', 'opa', 'fala'
];
const FAREWELL_KEYWORDS: string[] = [
  'tchau', 'adeus', 'até mais', 'ate logo', 'falou', 'fui', 'até amanhã', 'desligar'
];
const SOCIAL_QUERY_KEYWORDS: string[] = [
  'amigo', 'amiga', 'gosta de mim', 'sozinho', 'sozinha', 'sentimento', 'sente', 'triste', 'feliz',
  'namorado', 'namorada', 'casado', 'solteiro', 'como voce esta se sentindo', 'voce esta bem',
  'quer ser meu', 'quer sair', 'vamos conversar sobre', 'minha vida'
];
const META_QUERY_PERSONAL_KEYWORDS: string[] = [
  'quem é voce', 'voce é um robo', 'quem te criou', 'qual seu proposito', 'voce é real', 'inteligencia artificial',
  'voce pensa', 'voce sonha', 'voce dorme', 'onde voce mora', 'qual sua idade', 'seu nome é tuca', 'por que tuca',
  'voce é o tuca', 'fale sobre voce'
];


/* -------------------------------------------------- *
 * Utilidades
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
const N_FAREWELL_KW  = toNormSet(FAREWELL_KEYWORDS);
const N_SOCIAL_KW    = toNormSet(SOCIAL_QUERY_KEYWORDS);
const N_META_KW      = toNormSet(META_QUERY_PERSONAL_KEYWORDS);

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
 * Helpers de intenção
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
const isSocialQueryRequest = (txt: string) => includesKw(txt, N_SOCIAL_KW);
const isMetaQueryRequest   = (txt: string) => includesKw(txt, N_META_KW);

function isGreetingOnly(norm: string): boolean {
  if (!includesKw(norm, N_GREET_KW)) return false;
  const words = norm.split(/\s+/);
  if (words.length > 4) return false;
  const nonGreetingWords = words.filter(w => !N_GREET_KW.has(w) && w.length > 2);
  return nonGreetingWords.length <= 1;
}

function isFarewellOnly(norm: string): boolean {
  if (!includesKw(norm, N_FAREWELL_KW)) return false;
  const words = norm.split(/\s+/);
  if (words.length > 3) return false;
  const nonFarewellWords = words.filter(w => !N_FAREWELL_KW.has(w));
  return nonFarewellWords.length === 0;
}


/* -------------------------------------------------- *
 * CASOS ESPECIAIS RÁPIDOS
 * -------------------------------------------------- */
async function quickSpecialHandle(
  user: IUser,
  normalized: string,
  greeting: string
): Promise<IntentResult | null> {
  if (isGreetingOnly(normalized)) {
    return {
      type: 'special_handled',
      response: pickRandom([
        `${greeting} Em que posso ajudar hoje?`,
        `${greeting} Como posso ser útil?`,
        `${greeting} Pronto para começar o dia? Me diga o que precisa!`,
        `Opa, ${user.name || 'tudo bem'}! Tudo certo? O que manda?`, // Usando user.name
      ]),
    };
  }

  // Inclui 'valeu', 'vlw', 'thx', 'agradecido', 'agradecida' em lowercase
  const thanksKeywords = ['obrigado','obrigada','valeu','show','thanks','vlw', 'thx', 'agradecido', 'agradecida'];
  if (thanksKeywords.includes(normalized)) { // Normalized já está em lowercase
    return {
      type: 'special_handled',
      response: pickRandom([
        'Disponha! 😊 Se precisar de mais algo, é só chamar.',
        'De nada! Qual o próximo passo?',
        '👍 Fico à disposição. Algo mais?',
        'Por nada! Sempre bom ajudar. Precisa de outra coisa?',
      ]),
    };
  }

  if (isFarewellOnly(normalized)) {
    return {
      type: 'special_handled',
      response: pickRandom([
        'Até mais! 👋',
        'Tchau, tchau! Se cuida!',
        'Falou! Precisando, estou por aqui.',
        `Até a próxima, ${user.name || ''}!`.trim(), // Usando user.name e trim para caso seja vazio
      ]),
    };
  }

  return null;
}

/* -------------------------------------------------- *
 * FUNÇÃO PRINCIPAL (exportada)
 * -------------------------------------------------- */
export async function determineIntent(
  normalizedText : string,
  user           : IUser,
  rawText        : string, // Mantido para logs ou futuras lógicas contextuais mais complexas
  dialogueState  : IDialogueState, // Mantido para futuras lógicas contextuais
  greeting       : string,
  userId         : string
): Promise<IntentResult> {
  const tag = '[intentService.determineIntent v2.15.1]'; // ALTERADO: Versão
  logger.debug(`${tag} analisando: "${normalizedText}" para user ${userId} (${user.name || 'Nome não disponível'})`);

  const special = await quickSpecialHandle(user, normalizedText, greeting);
  // ***** CORREÇÃO APLICADA AQUI *****
  if (special && special.type === 'special_handled') {
    // Agora o TypeScript sabe que special.response existe e é seguro acessá-lo.
    logger.info(`${tag} intenção especial resolvida: "${special.response.slice(0,50)}..." para user ${userId}`);
    return special;
  }
  // Se 'special' não for 'special_handled' (ou for null), a lógica continua abaixo.

  let intent: DeterminedIntent;

  if      (isBestTimeRequest(normalizedText)) intent = 'ASK_BEST_TIME';
  else if (isPlanRequest(normalizedText))     intent = 'content_plan';
  else if (isScriptRequest(normalizedText))   intent = 'script_request';
  else if (isBestPerfRequest(normalizedText)) intent = 'ASK_BEST_PERFORMER';
  else if (isIdeasRequest(normalizedText))    intent = 'content_ideas';
  else if (isRankingRequest(normalizedText))  intent = 'ranking_request';
  else if (isReportRequest(normalizedText))   intent = 'report';
  else if (isSocialQueryRequest(normalizedText)) {
    intent = 'social_query';
  }
  else if (isMetaQueryRequest(normalizedText)) {
    intent = 'meta_query_personal';
  }
  else {
    intent = 'general';
  }

  logger.info(`${tag} intenção final determinada: ${intent} para user ${userId}`);
  return { type: 'intent_determined', intent };
}

/* -------------------------------------------------- *
 * Helpers expostos para consultantService
 * -------------------------------------------------- */
export const normalizeText = normalize;
export function getRandomGreeting(userName = 'criador') {
  return pickRandom([
    `Oi ${userName}!`,
    `Olá ${userName}!`,
    `E aí, ${userName}? Como vai?`,
    `Fala, ${userName}! Tudo certo?`,
  ]);
}