// @/app/lib/intentService.ts – v2.18.1 (Correção de Tipo)
// - CORRIGIDO: Erro de tipo em detectUserPreference. Definida interface ExtractedPreferenceDetail.
// - Mantém funcionalidades da v2.18.0.
// --------------------------------------------------

import { logger } from '@/app/lib/logger';
// IUserPreferences importado para tipagem em IntentResult
import { IUser, IUserPreferences }  from '@/app/models/User';
import { IDialogueState } from './stateService'; 

/* -------------------------------------------------- *
 * Tipagens internas (ATUALIZADO v2.18.1)
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
  | 'meta_query_personal'
  | 'user_confirms_pending_action'
  | 'user_denies_pending_action'
  | 'generate_proactive_alert'
  | 'ask_community_inspiration'
  // --- NOVAS INTENÇÕES PARA MEMÓRIA DE LONGO PRAZO (v2.18.0) ---
  | 'user_stated_preference'     // Usuário declara uma preferência
  | 'user_shared_goal'           // Usuário compartilha um objetivo
  | 'user_mentioned_key_fact'    // Usuário menciona um fato chave
  | 'user_requests_memory_update'; // Usuário pede explicitamente para Tuca lembrar de algo
  // --- FIM DAS NOVAS INTENÇÕES PARA MEMÓRIA ---

// Interface para o detalhe da preferência extraída (NOVO v2.18.1)
interface ExtractedPreferenceDetail {
  field: keyof IUserPreferences;
  value: string;
  rawValue?: string;
}

export type IntentResult =
  | { 
      type: 'intent_determined'; 
      intent: DeterminedIntent; 
      pendingActionContext?: any;
      // --- CAMPOS PARA DADOS EXTRAÍDOS (MEMÓRIA - v2.18.0) ---
      extractedPreference?: ExtractedPreferenceDetail; // Usando a nova interface
      extractedGoal?: string;
      extractedFact?: string;
      memoryUpdateRequestContent?: string;
    }
  | { type: 'special_handled'; response: string };

/* -------------------------------------------------- *
 * Listas de keywords (Mantido da v2.18.0)
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
const COMMUNITY_INSPIRATION_KEYWORDS: string[] = [
  'inspiração', 'inspirações', 'exemplos de posts', 'ideias da comunidade', 
  'posts de outros criadores', 'ver o que outros fizeram', 'referências da comunidade',
  'community inspiration', 'preciso de uma luz', 'me dá uma referência', 
  'exemplos da comunidade', 'conteúdo da comunidade', 'mostra exemplos',
  'quero ver exemplos', 'exemplos de sucesso'
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
const AFFIRMATIVE_KEYWORDS: string[] = [ 
  'sim', 's', 'pode ser', 'pode', 'claro', 'com certeza', 'quero', 'manda', 'ok', 'dale', 'bora', 'positivo', 'afirmativo', 'isso', 'exato', 'aham', 'uhum'
];
const NEGATIVE_KEYWORDS: string[] = [ 
  'não', 'nao', 'n', 'agora não', 'deixa pra depois', 'depois', 'outra hora', 'negativo', 'nada', 'nem', 'nunca'
];

const USER_REQUESTS_MEMORY_UPDATE_KEYWORDS: string[] = [
    'lembre-se que', 'lembre que', 'anote que', 'anota aí que', 'guarde que', 'salve que', 'memorize que', 'lembrar que',
    'anotar que', 'salvar que', 'não esqueça que', 'quero que voce lembre que'
];
const USER_PREFERENCE_HINT_KEYWORDS: string[] = ['prefiro', 'gosto de', 'não gosto de', 'odeio', 'meu tom', 'formato', 'evito falar'];
const USER_GOAL_HINT_KEYWORDS: string[] = ['meu objetivo é', 'minha meta é', 'quero alcançar', 'pretendo', 'almejo', 'meu foco é', 'planejo'];
const USER_FACT_HINT_KEYWORDS: string[] = ['fato sobre mim', 'importante saber', 'minha empresa', 'trabalho com', 'sou de', 'moro em'];


/* -------------------------------------------------- *
 * Utilidades (Mantido da v2.18.0)
 * -------------------------------------------------- */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const toNormSet = (arr: string[]) => new Set(arr.map(normalize));

const N_SCRIPT_KW    = toNormSet(SCRIPT_KEYWORDS);
const N_PLAN_KW      = toNormSet(CONTENT_PLAN_KEYWORDS);
const N_RANK_KW      = toNormSet(RANKING_KEYWORDS);
const N_REPORT_KW    = toNormSet(REPORT_KEYWORDS);
const N_IDEAS_KW     = toNormSet(CONTENT_IDEAS_KEYWORDS);
const N_COMMUNITY_INSP_KW = toNormSet(COMMUNITY_INSPIRATION_KEYWORDS);
const N_BEST_PERF_KW = toNormSet(ASK_BEST_PERFORMER_KEYWORDS);
const N_BEST_TIME_KW = toNormSet(BEST_TIME_KEYWORDS);
const N_GREET_KW     = toNormSet(GREETING_KEYWORDS);
const N_FAREWELL_KW  = toNormSet(FAREWELL_KEYWORDS);
const N_SOCIAL_KW    = toNormSet(SOCIAL_QUERY_KEYWORDS);
const N_META_KW      = toNormSet(META_QUERY_PERSONAL_KEYWORDS);
const N_AFFIRM_KW    = toNormSet(AFFIRMATIVE_KEYWORDS);
const N_NEG_KW       = toNormSet(NEGATIVE_KEYWORDS);
const N_USER_MEM_UPDATE_KW = toNormSet(USER_REQUESTS_MEMORY_UPDATE_KEYWORDS);

const includesKw = (txt: string, kwSet: Set<string>) =>
  [...kwSet].some((kw) => txt.includes(kw));

const pickRandom = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error('pickRandom: array vazio');
  const idx = Math.floor(Math.random() * arr.length);
  const item = arr[idx];
  if (item === undefined) throw new Error('pickRandom: item indefinido');
  return item;
};

/* -------------------------------------------------- *
 * Helpers de intenção (ATUALIZADO v2.18.1 - Correção de tipo)
 * -------------------------------------------------- */
const isPlanRequest     = (txt: string) => includesKw(txt, N_PLAN_KW);
const isScriptRequest   = (txt: string) => includesKw(txt, N_SCRIPT_KW);
const isRankingRequest  = (txt: string) => includesKw(txt, N_RANK_KW);
const isCommunityInspirationRequest = (txt: string) => includesKw(txt, N_COMMUNITY_INSP_KW);
const isIdeasRequest    = (txt: string) => {
    if (isCommunityInspirationRequest(txt)) return false;
    return includesKw(txt, N_IDEAS_KW);
};
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

function isSimpleAffirmative(norm: string): boolean {
    const words = norm.split(/\s+/);
    return words.length <= 2 && N_AFFIRM_KW.has(norm);
}

function isSimpleNegative(norm: string): boolean {
    const words = norm.split(/\s+/);
    return words.length <= 3 && N_NEG_KW.has(norm);
}

/**
 * Tenta extrair uma declaração de preferência do usuário.
 * @param normalizedText Texto normalizado da mensagem do usuário.
 * @param rawText Texto original da mensagem do usuário.
 * @returns Um objeto com `isMatch: true` e `extractedPreference` se uma preferência for detectada, senão `isMatch: false`.
 */
// Assinatura da função corrigida para usar ExtractedPreferenceDetail (v2.18.1)
function detectUserPreference(normalizedText: string, rawText: string): { isMatch: boolean; extractedPreference?: ExtractedPreferenceDetail } {
    let match;

    match = rawText.match(/(?:(?:prefiro|gosto de|meu)(?: um)? tom(?: é)?|tom da ia(?: é)?) (mais formal|direto ao ponto|super descontra[ií]do|formal|descontra[ií]do|direto)/i);
    if (match && match[1]) {
        const toneValue = normalize(match[1]);
        let finalTone: IUserPreferences['preferredAiTone'] = toneValue as string; 
        if (toneValue.includes('formal')) finalTone = 'mais_formal';
        else if (toneValue.includes('direto')) finalTone = 'direto_ao_ponto';
        else if (toneValue.includes('descontrai') || toneValue.includes('descontraído')) finalTone = 'super_descontraido';
        
        return { 
            isMatch: true, 
            extractedPreference: { field: 'preferredAiTone', value: finalTone, rawValue: match[1] } 
        };
    }

    match = rawText.match(/(?:(?:eu|eu realmente|eu também) )?(?:prefiro|gosto (?:mais )?de|queria|quero|adoro|amo|curto) (reels|vídeos? longos?|vídeos? curtos?|posts? de imagem|carrossel|stories|conteúdo em vídeo|postagens escritas|artigos)/i);
    if (match && match[1]) {
        return { 
            isMatch: true, 
            extractedPreference: { field: 'preferredFormats', value: match[1], rawValue: match[1] } 
        };
    }
    
    match = rawText.match(/(?:(?:eu )?(?:n(?:ã|a)o gosto de|evito|n(?:ã|a)o quero) (?:falar sobre|abordar|discutir|postar sobre|criar sobre)|detesto) (pol[ií]tica|esportes|futebol|religi[aã]o|finan[cç]as(?: pessoais)?|tecnologia|games|jogos|viagens?)/i);
    if (match && match[1]) {
        return { 
            isMatch: true, 
            extractedPreference: { field: 'dislikedTopics', value: match[1], rawValue: match[1] } 
        };
    }
    
    return { isMatch: false };
}

function detectUserGoal(normalizedText: string, rawText: string): { isMatch: boolean; extractedGoal?: string } {
    const goalRegex = /(?:meu principal objetivo é|meu objetivo é|minha meta é|quero alcançar|pretendo|almejo|meu foco é|o que eu quero é|busco|estou trabalhando para|planejo) (.*)/i;
    const match = rawText.match(goalRegex);
    if (match && match[1] && match[1].trim().length > 5) { 
        const goalDescription = match[1].trim();
        if (goalDescription.startsWith("que você") || goalDescription.startsWith("você")) {
            return { isMatch: false };
        }
        return { isMatch: true, extractedGoal: goalDescription };
    }
    return { isMatch: false };
}

function detectUserKeyFact(normalizedText: string, rawText: string): { isMatch: boolean; extractedFact?: string } {
    const factRegex = /(?:um fato (?:importante )?sobre mim (?:é que)?|só para (?:você|vc) saber,?|para sua informa[cç][aã]o,?|importante dizer que|gostaria de compartilhar que|eu trabalho com|minha especialidade é|sou formado em|moro em) (.*)/i;
    const match = rawText.match(factRegex);
    if (match && match[1] && match[1].trim().length > 5) {
        const factDescription = match[1].trim();
        if (factDescription.startsWith("que você") || factDescription.startsWith("você")) {
            return { isMatch: false };
        }
        return { isMatch: true, extractedFact: factDescription };
    }
    return { isMatch: false };
}

function detectMemoryUpdateRequest(normalizedText: string, rawText: string): { isMatch: boolean; memoryUpdateRequestContent?: string } {
    const requestRegex = new RegExp(`(?:tuca,? )?(?:${USER_REQUESTS_MEMORY_UPDATE_KEYWORDS.join('|')}) (.*)`, 'i');
    const match = rawText.match(requestRegex);
    
    if (match && match[1] && match[1].trim().length > 3) {
        return { isMatch: true, memoryUpdateRequestContent: match[1].trim() };
    }
    return { isMatch: false };
}


/* -------------------------------------------------- *
 * CASOS ESPECIAIS RÁPIDOS (Mantido da v2.18.0)
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
        `Opa, ${user.name || 'tudo bem'}! Tudo certo? O que manda?`,
      ]),
    };
  }

  const thanksKeywords = ['obrigado','obrigada','valeu','show','thanks','vlw', 'thx', 'agradecido', 'agradecida'];
  if (thanksKeywords.includes(normalized)) {
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
        `Até a próxima, ${user.name || ''}!`.trim(),
      ]),
    };
  }

  return null;
}

/* -------------------------------------------------- *
 * FUNÇÃO PRINCIPAL (exportada) (Mantido da v2.18.0)
 * -------------------------------------------------- */
export async function determineIntent(
  normalizedText : string,
  user           : IUser,
  rawText        : string, 
  dialogueState  : IDialogueState,
  greeting       : string,
  userId         : string
): Promise<IntentResult> {
  const tag = '[intentService.determineIntent v2.18.1]'; 
  logger.debug(`${tag} analisando: "${normalizedText}" (raw: "${rawText.substring(0,50)}") para user ${userId} (${user.name || 'Nome não disponível'}). Estado: ${JSON.stringify(dialogueState)}`);

  if (dialogueState.lastAIQuestionType) {
    logger.debug(`${tag} Estado de diálogo indica pergunta pendente da IA: ${dialogueState.lastAIQuestionType}`);
    if (isSimpleAffirmative(normalizedText)) {
      logger.info(`${tag} Usuário confirmou ação pendente: ${dialogueState.lastAIQuestionType} com texto: "${normalizedText}"`);
      return {
        type: 'intent_determined',
        intent: 'user_confirms_pending_action',
        pendingActionContext: dialogueState.pendingActionContext
      };
    }
    if (isSimpleNegative(normalizedText)) {
      logger.info(`${tag} Usuário negou ação pendente: ${dialogueState.lastAIQuestionType} com texto: "${normalizedText}"`);
      return {
        type: 'intent_determined',
        intent: 'user_denies_pending_action',
        pendingActionContext: dialogueState.pendingActionContext
      };
    }
    logger.debug(`${tag} Resposta "${normalizedText}" não é afirmação/negação simples para pergunta pendente. Prosseguindo para detecção geral.`);
  }

  const special = await quickSpecialHandle(user, normalizedText, greeting);
  if (special && special.type === 'special_handled') {
    logger.info(`${tag} intenção especial resolvida: "${special.response.slice(0,50)}..." para user ${userId}`);
    return special;
  }

  const memoryUpdateRequest = detectMemoryUpdateRequest(normalizedText, rawText);
  if (memoryUpdateRequest.isMatch && memoryUpdateRequest.memoryUpdateRequestContent) { // Adicionada checagem para content
    logger.info(`${tag} Intenção detectada: user_requests_memory_update. Conteúdo: "${memoryUpdateRequest.memoryUpdateRequestContent}"`);
    return { 
        type: 'intent_determined', 
        intent: 'user_requests_memory_update', 
        memoryUpdateRequestContent: memoryUpdateRequest.memoryUpdateRequestContent 
    };
  }

  const userPreference = detectUserPreference(normalizedText, rawText);
  if (userPreference.isMatch && userPreference.extractedPreference) {
    logger.info(`${tag} Intenção detectada: user_stated_preference. Preferência: ${JSON.stringify(userPreference.extractedPreference)}`);
    return { 
        type: 'intent_determined', 
        intent: 'user_stated_preference', 
        extractedPreference: userPreference.extractedPreference 
    };
  }

  const userGoal = detectUserGoal(normalizedText, rawText);
  if (userGoal.isMatch && userGoal.extractedGoal) {
    logger.info(`${tag} Intenção detectada: user_shared_goal. Objetivo: "${userGoal.extractedGoal}"`);
    return { 
        type: 'intent_determined', 
        intent: 'user_shared_goal', 
        extractedGoal: userGoal.extractedGoal 
    };
  }

  const userKeyFact = detectUserKeyFact(normalizedText, rawText);
  if (userKeyFact.isMatch && userKeyFact.extractedFact) {
    logger.info(`${tag} Intenção detectada: user_mentioned_key_fact. Fato: "${userKeyFact.extractedFact}"`);
    return { 
        type: 'intent_determined', 
        intent: 'user_mentioned_key_fact', 
        extractedFact: userKeyFact.extractedFact 
    };
  }

  let intent: DeterminedIntent;

  if      (isBestTimeRequest(normalizedText)) intent = 'ASK_BEST_TIME';
  else if (isPlanRequest(normalizedText))     intent = 'content_plan';
  else if (isScriptRequest(normalizedText))   intent = 'script_request';
  else if (isBestPerfRequest(normalizedText)) intent = 'ASK_BEST_PERFORMER';
  else if (isCommunityInspirationRequest(normalizedText)) intent = 'ask_community_inspiration';
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

  logger.info(`${tag} intenção final determinada (não-memória ou fallback): ${intent} para user ${userId}`);
  return { type: 'intent_determined', intent };
}

/* -------------------------------------------------- *
 * Helpers expostos (Mantido da v2.18.0)
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
