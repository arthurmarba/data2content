// @/app/lib/intentService.ts – v2.20.9 (Adiciona comentários detalhados nos blocos lógicos)
// - MODIFICADO: Adicionados comentários inline detalhados na função determineIntent para explicar o fluxo de decisão.
// - Baseado na v2.20.8 (Adiciona comentários JSDoc/inline para as listas de KEYWORDS e resolve TODO).
// --------------------------------------------------

import { logger } from '@/app/lib/logger';
import { IUser, IUserPreferences }  from '@/app/models/User';
import { IDialogueState, ILastResponseContext } from './stateService';
import { SHORT_TERM_CONTEXT_VALIDITY_MINUTES } from '@/app/lib/constants';

// --- FEATURE FLAG PARA LÓGICA CONTEXTUAL ---
const ENABLE_CONTEXTUAL_INTENT_LOGIC = process.env.FEATURE_CONTEXTUAL_INTENT_LOGIC_ENABLED === 'true';
if (ENABLE_CONTEXTUAL_INTENT_LOGIC) {
    logger.info('[intentService] Lógica de Intenção Contextual ATIVADA via feature flag.');
} else {
    logger.info('[intentService] Lógica de Intenção Contextual DESATIVADA via feature flag.');
}
// ---------------------------------------------

// --- CONSTANTES PARA LIMIARES E HEURÍSTICAS ---
const MAX_WORDS_GREETING_ONLY = 4;
const MAX_NON_GREETING_WORDS_SHORT = 1; // Para palavras curtas (<=2 chars) em saudações
const MAX_WORDS_FAREWELL_ONLY = 3;

const MAX_WORDS_SIMPLE_AFFIRM_TYPE_1 = 3; // ex: "sim por favor tuca"
const MAX_WORDS_SIMPLE_AFFIRM_TYPE_2 = 2; // ex: "sim", "pode ser"
const MAX_LEN_NON_INTERACTIVE_WORD_AFFIRM_NEG = 4; // ex: "tuca", "obg"

const MAX_WORDS_SIMPLE_NEGATIVE_TYPE_1 = 4; // ex: "não, agora não tuca"
const MAX_WORDS_SIMPLE_NEGATIVE_TYPE_2 = 3; // ex: "não quero não"

const MAX_WORDS_SIMPLE_CONFIRM_ACK_TYPE_1 = 2; // ex: "ok", "entendi"
const MAX_WORDS_SIMPLE_CONFIRM_ACK_TYPE_2 = 5; // ex: "ok tuca muito obrigado"
const MAX_NON_CONFIRM_SIG_WORDS_ACK_TYPE_2 = 1;
const MAX_WORDS_SIMPLE_CONFIRM_ACK_PREFIXED = 3; // ex: "estou ok", "to dentro"

const MIN_LEN_EXTRACTED_CONTENT_DEFAULT = 5; // Para fatos, objetivos
const MIN_WORDS_EXTRACTED_CONTENT_DEFAULT = 2;
const MIN_LEN_MEMORY_UPDATE_CONTENT = 3;
const MIN_WORDS_MEMORY_UPDATE_CONTENT = 1;

const MAX_WORDS_DIRECT_RESPONSE_TO_AI_QUESTION = 35; // Limite da v2.20.6
const MAX_WORDS_CONTEXTUAL_FOLLOW_UP_KEYWORDS = 15;
const MAX_WORDS_CONTEXTUAL_FOLLOW_UP_FALLBACK_NO_AI_QUESTION = 7;
const MAX_WORDS_CONTEXTUAL_FOLLOW_UP_SUMMARY = 7; 
const CONTEXT_SUMMARY_SNIPPET_LENGTH = 100;
// --------------------------------------------------

/* -------------------------------------------------- *
 * Tipagens internas
 * -------------------------------------------------- */
export type DeterminedIntent =
  | 'script_request'
  | 'humor_script_request'
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
  | 'user_stated_preference'
  | 'demographic_query'
  | 'user_shared_goal'
  | 'user_mentioned_key_fact'
  | 'user_requests_memory_update'
  | 'ASK_CLARIFICATION_PREVIOUS_RESPONSE'
  | 'REQUEST_METRIC_DETAILS_FROM_CONTEXT'
  | 'EXPLAIN_DATA_SOURCE_FOR_ANALYSIS'
  | 'CONTINUE_PREVIOUS_TOPIC';

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
      confidence?: number;
      extractedPreference?: ExtractedPreferenceDetail;
      extractedGoal?: string;
      extractedFact?: string;
      memoryUpdateRequestContent?: string;
      resolvedContextTopic?: string;
    }
  | { type: 'special_handled'; response: string; confidence?: number };

/* -------------------------------------------------- *
 * Listas de keywords
 * -------------------------------------------------- */

/** Palavras-chave para identificar pedidos de roteiro de conteúdo geral. */
const SCRIPT_KEYWORDS: string[] = [
  'roteiro','script','estrutura','outline','sequencia',
  'escreve pra mim','como fazer video sobre','estrutura de post','roteiriza'
];
/** Palavras-chave para identificar pedidos de roteiro de humor. */
const HUMOR_SCRIPT_KEYWORDS: string[] = [
  'roteiro de humor', 'script engraçado', 'escrever comedia', 'cena comica', 'piada',
  'esquete de humor', 'roteiro para rir', 'video de humor', 'conteudo de humor',
  'ajuda com piada', 'como fazer video engraçado', 'dicas de comedia',
  'humoristico', 'comico'
];
/** Palavras-chave para identificar pedidos de planejamento de conteúdo. */
const CONTENT_PLAN_KEYWORDS: string[] = [
  'planejamento','plano de conteudo','agenda de posts','calendario editorial',
  'o que postar essa semana','sugestao de agenda','me da um plano','cria um plano'
];
/** Palavras-chave para identificar pedidos de ranking (melhores/piores posts). */
const RANKING_KEYWORDS: string[] = [
  'ranking','rank','melhores','piores','top','quais sao os','lista de'
];
/** Palavras-chave para identificar pedidos de relatório ou análise de performance. */
const REPORT_KEYWORDS: string[] = [
  'relatorio','plano','estratégia','detalhado','completo','performance',
  'analisa','analise','visão geral','resultado','resultados','desempenho'
];
/** Palavras-chave para identificar pedidos de ideias de conteúdo. */
const CONTENT_IDEAS_KEYWORDS: string[] = [
  'ideia','ideias','conteúdo','sugestão de post','sugestões de post','sugere',
  'sugestão','o que postar','inspiração','exemplos de posts','dicas de conteúdo',
  'ideias criativas'
];
/** Palavras-chave para identificar pedidos de inspiração na comunidade. */
const COMMUNITY_INSPIRATION_KEYWORDS: string[] = [
  'inspiração', 'inspirações', 'exemplos de posts', 'ideias da comunidade',
  'posts de outros criadores', 'ver o que outros fizeram', 'referências da comunidade',
  'community inspiration', 'preciso de uma luz', 'me dá uma referência',
  'exemplos da comunidade', 'conteúdo da comunidade', 'mostra exemplos',
  'quero ver exemplos', 'exemplos de sucesso'
];
/** Palavras-chave para identificar perguntas sobre o que performa melhor. */
const ASK_BEST_PERFORMER_KEYWORDS: string[] = [
  'qual tipo','qual conteudo','qual proposta','qual contexto','gera mais',
  'melhor desempenho','maior desempenho','recordista em','performam melhor',
  'quais dao mais','o que da mais'
];
/** Palavras-chave para identificar perguntas sobre melhores dias/horários para postar. */
const BEST_TIME_KEYWORDS: string[] = [
  'melhor dia','melhor hora','melhor horario','qual dia','qual hora',
  'qual horario','quando postar','frequencia','cadencia'
];
/** Palavras-chave para identificar saudações. */
const GREETING_KEYWORDS: string[] = [
  'oi','olá','ola','tudo bem','bom dia','boa tarde','boa noite','e aí','eae', 'opa', 'fala'
];
/** Palavras-chave para identificar despedidas. */
const FAREWELL_KEYWORDS: string[] = [
  'tchau', 'adeus', 'até mais', 'ate logo', 'falou', 'fui', 'até amanhã', 'desligar'
];
/** Palavras-chave para identificar perguntas de natureza social ou pessoal direcionadas à IA. */
const SOCIAL_QUERY_KEYWORDS: string[] = [
  'amigo', 'amiga', 'gosta de mim', 'sozinho', 'sozinha', 'sentimento', 'sente', 'triste', 'feliz',
  'namorado', 'namorada', 'casado', 'solteiro', 'como voce esta se sentindo', 'voce esta bem',
  'quer ser meu', 'quer sair', 'vamos conversar sobre', 'minha vida'
];
/** Palavras-chave para identificar perguntas sobre a natureza da IA (meta-perguntas). */
const META_QUERY_PERSONAL_KEYWORDS: string[] = [
  'quem é voce', 'voce é um robo', 'quem te criou', 'qual seu proposito', 'voce é real', 'inteligencia artificial',
  'voce pensa', 'voce sonha', 'voce dorme', 'onde voce mora', 'qual sua idade', 'seu nome é tuca', 'por que tuca',
  'voce é o tuca', 'fale sobre voce'
];
/** Palavras-chave afirmativas. */
const AFFIRMATIVE_KEYWORDS: string[] = [
  'sim', 's', 'pode ser', 'pode', 'claro', 'com certeza', 'quero', 'manda', 'ok', 'dale', 'bora', 'positivo', 'afirmativo', 'isso', 'exato', 'aham', 'uhum'
];
/** Palavras-chave negativas. */
const NEGATIVE_KEYWORDS: string[] = [
  'não', 'nao', 'n', 'agora não', 'deixa pra depois', 'depois', 'outra hora', 'negativo', 'nada', 'nem', 'nunca'
];
/** Palavras-chave que indicam que o usuário está pedindo para a IA memorizar algo. */
const USER_REQUESTS_MEMORY_UPDATE_KEYWORDS: string[] = [
    'lembre-se que', 'lembre que', 'anote que', 'anota aí que', 'guarde que', 'salve que', 'memorize que', 'lembrar que',
    'anotar que', 'salvar que', 'não esqueça que', 'quero que voce lembre que'
];
/** Palavras-chave que indicam que o usuário está declarando uma preferência. */
const USER_PREFERENCE_HINT_KEYWORDS: string[] = ['prefiro', 'gosto de', 'não gosto de', 'odeio', 'meu tom', 'formato', 'evito falar'];
/** Palavras-chave que indicam que o usuário está compartilhando um objetivo. */
const USER_GOAL_HINT_KEYWORDS: string[] = ['meu objetivo é', 'minha meta é', 'quero alcançar', 'pretendo', 'almejo', 'meu foco é', 'planejo'];
/** Palavras-chave que indicam que o usuário está compartilhando um fato sobre si ou seu negócio. */
const USER_FACT_HINT_KEYWORDS: string[] = ['fato sobre mim', 'importante saber', 'minha empresa', 'trabalho com', 'sou de', 'moro em', 'para que voce saiba mais sobre mim'];
/** Palavras-chave e emojis comuns para confirmações e reconhecimentos simples. */
const SIMPLE_CONFIRMATION_ACK_KEYWORDS: string[] = [
    'ok', 'okay', 'sim', 's', 'entendi', 'entendido', 'certo', 'combinado', 'perfeito', 'justo',
    'aguardando', 'esperando', 'no aguardo',
    'valeu', 'obrigado', 'obrigada', 'grato', 'grata', 'show', 'blz', 'beleza', 'pode crer',
    '👍', // Emoji de joinha
    'recebido', 'anotado', 'confirmado', 'positivo', 'afirmativo', 'isso', 'exato', 'aham', 'uhum',
    'pode ser', 'pode', 'claro', 'com certeza', 'quero', 'manda', 'dale', 'bora', 'tá', 'ta bom'
];
/** Palavras-chave que indicam que o usuário está pedindo um esclarecimento. */
const CLARIFICATION_KEYWORDS: string[] = [
    'como assim', 'explica melhor', 'o que voce quer dizer', 'nao entendi', 'detalha', 'em que sentido',
    'pode elaborar', 'me explica de novo', 'fiquei com uma duvida sobre', 'sobre o que voce disse', 'o que quis dizer', 'não ficou claro'
];
/** Palavras-chave que indicam que o usuário está perguntando sobre a fonte dos dados de uma análise. */
const DATA_SOURCE_KEYWORDS: string[] = [
    'quais dados', 'se baseou em que', 'de onde tirou isso', 'qual a fonte', 'esses numeros vem de onde',
    'que dados voce usou', 'qual foi a base', 'como voce chegou nisso', 'quais conteudos voce se baseou'
];
/** Palavras-chave que indicam que o usuário está pedindo mais detalhes sobre métricas ou análises. */
const METRIC_DETAILS_KEYWORDS: string[] = [
    'me da a media', 'e os numeros', 'qual foi o resultado', 'mostra os detalhes disso', 'aprofundar nisso',
    'quero ver os detalhes', 'quais foram as medias', 'detalha essa metrica', 'me mostre os dados', 'quais os numeros'
];
/** Palavras-chave para identificar perguntas sobre demografia do público. */
const DEMOGRAPHICS_KEYWORDS: string[] = [
  'demografia', 'demográfico', 'demograficos', 'perfil do público',
  'idade do público', 'faixa etária', 'idade média', 'gênero dos seguidores',
  'publico feminino', 'publico masculino', 'onde moram', 'quais países', 'quais cidades'
];
/** Palavras-chave que indicam que o usuário deseja continuar ou aprofundar o tópico anterior. */
const CONTINUE_TOPIC_KEYWORDS: string[] = [
    'e sobre isso', 'continuando', 'voltando ao assunto', 'sobre o que falamos', 'mais sobre isso',
    'me fala mais', 'e o outro ponto', 'alem disso', 'prosseguindo', 'e mais', 'sobre aquilo', 'desenvolve mais', 'continue',
    'em relação a isso', 'sobre esse ponto', 'gostaria de saber mais sobre'
];

/* -------------------------------------------------- *
 * Utilidades
 * -------------------------------------------------- */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const toNormSet = (arr: string[]) => new Set(arr.map(normalize));

// Sets normalizados para busca eficiente de keywords
const N_SCRIPT_KW    = toNormSet(SCRIPT_KEYWORDS);
const N_HUMOR_SCRIPT_KW = toNormSet(HUMOR_SCRIPT_KEYWORDS);
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
const N_SIMPLE_CONFIRM_ACK_KW = toNormSet(SIMPLE_CONFIRMATION_ACK_KEYWORDS);
const N_CLARIFICATION_KW = toNormSet(CLARIFICATION_KEYWORDS);
const N_DATA_SOURCE_KW   = toNormSet(DATA_SOURCE_KEYWORDS);
const N_METRIC_DETAILS_KW = toNormSet(METRIC_DETAILS_KEYWORDS);
const N_CONTINUE_TOPIC_KW = toNormSet(CONTINUE_TOPIC_KEYWORDS);
const N_DEMOGRAPHICS_KW = toNormSet(DEMOGRAPHICS_KEYWORDS);

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
 * Helpers de intenção
 * -------------------------------------------------- */
const isHumorScriptRequest = (txt: string) => includesKw(txt, N_HUMOR_SCRIPT_KW);
const isPlanRequest     = (txt: string) => includesKw(txt, N_PLAN_KW);
const isScriptRequest   = (txt: string) => {
    if (isHumorScriptRequest(txt)) return false; // Evita classificar pedido de humor como script genérico
    return includesKw(txt, N_SCRIPT_KW);
}
const isRankingRequest  = (txt: string) => includesKw(txt, N_RANK_KW);
const isCommunityInspirationRequest = (txt: string) => includesKw(txt, N_COMMUNITY_INSP_KW);
const isIdeasRequest    = (txt: string) => {
    if (isCommunityInspirationRequest(txt)) return false; // Evita classificar pedido de inspiração comunitária como ideias genéricas
    return includesKw(txt, N_IDEAS_KW);
};
const isReportRequest   = (txt: string) => includesKw(txt, N_REPORT_KW);
const isBestPerfRequest = (txt: string) => includesKw(txt, N_BEST_PERF_KW);
const isBestTimeRequest = (txt: string) => {
  // Lógica específica para "melhor dia/dias" que pode não estar nas keywords genéricas
  if (txt.includes('melhores dias') || txt.includes('melhor dia')) return true;
  return includesKw(txt, N_BEST_TIME_KW);
};
const isSocialQueryRequest = (txt: string) => includesKw(txt, N_SOCIAL_KW);
const isMetaQueryRequest   = (txt: string) => includesKw(txt, N_META_KW);
const isClarificationRequest = (txt: string) => includesKw(txt, N_CLARIFICATION_KW);
const isDataSourceRequest    = (txt: string) => includesKw(txt, N_DATA_SOURCE_KW);
const isMetricDetailsRequest = (txt: string) => includesKw(txt, N_METRIC_DETAILS_KW);
const isContinueTopicRequest = (txt: string) => includesKw(txt, N_CONTINUE_TOPIC_KW);
const isDemographicsRequest = (txt: string) => includesKw(txt, N_DEMOGRAPHICS_KW);

/** Verifica se a mensagem é apenas uma saudação curta. */
function isGreetingOnly(norm: string): boolean {
  if (!includesKw(norm, N_GREET_KW)) return false;
  const words = norm.split(/\s+/);
  if (words.length > MAX_WORDS_GREETING_ONLY) return false;
  // Permite palavras curtas (ex: 'e', 'ai') ou o nome 'tuca' junto com a saudação.
  const nonGreetingWords = words.filter(w => !N_GREET_KW.has(w) && w.length > MAX_NON_GREETING_WORDS_SHORT && w !== 'tuca');
  return nonGreetingWords.length === 0;
}

/** Verifica se a mensagem é apenas uma despedida curta. */
function isFarewellOnly(norm: string): boolean {
  if (!includesKw(norm, N_FAREWELL_KW)) return false;
  const words = norm.split(/\s+/);
  if (words.length > MAX_WORDS_FAREWELL_ONLY) return false;
  const nonFarewellWords = words.filter(w => !N_FAREWELL_KW.has(w));
  return nonFarewellWords.length === 0;
}

/** Verifica se a mensagem é uma afirmação simples e curta. */
function isSimpleAffirmative(norm: string): boolean {
    const words = norm.split(/\s+/);
    // Cenário 1: Poucas palavras, uma delas afirmativa, e as outras são curtas ou "tuca".
    if (words.length <= MAX_WORDS_SIMPLE_AFFIRM_TYPE_1 && words.some(w => N_AFFIRM_KW.has(w))) {
        const nonAffirmativeWords = words.filter(w => !N_AFFIRM_KW.has(w));
        if (nonAffirmativeWords.every(w => w.length <= MAX_LEN_NON_INTERACTIVE_WORD_AFFIRM_NEG || w === 'tuca')) {
            return true;
        }
    }
    // Cenário 2: Mensagem muito curta que é em si uma palavra afirmativa.
    return words.length <= MAX_WORDS_SIMPLE_AFFIRM_TYPE_2 && N_AFFIRM_KW.has(norm);
}

/** Verifica se a mensagem é uma negação simples e curta. */
function isSimpleNegative(norm: string): boolean {
    const words = norm.split(/\s+/);
    // Cenário 1: Poucas palavras, uma delas negativa, e as outras são curtas ou "tuca".
    if (words.length <= MAX_WORDS_SIMPLE_NEGATIVE_TYPE_1 && words.some(w => N_NEG_KW.has(w))) {
        const nonNegativeWords = words.filter(w => !N_NEG_KW.has(w));
         if (nonNegativeWords.every(w => w.length <= MAX_LEN_NON_INTERACTIVE_WORD_AFFIRM_NEG || w === 'tuca')) {
            return true;
        }
    }
    // Cenário 2: Mensagem muito curta que é em si uma palavra negativa.
    return words.length <= MAX_WORDS_SIMPLE_NEGATIVE_TYPE_2 && N_NEG_KW.has(norm);
}

/**
 * Verifica se o texto normalizado é uma confirmação ou reconhecimento simples.
 * Ex: "ok", "entendido", "valeu tuca".
 */
export function isSimpleConfirmationOrAcknowledgement(normalizedText: string): boolean {
    const TAG = '[intentService][isSimpleConfirmationOrAcknowledgement v2.20.5]'; 
    if (!normalizedText || normalizedText.trim() === '') {
        return false;
    }
    const words = normalizedText.split(/\s+/);
    const wordCount = words.length;

    // Cenário 1: Mensagens muito curtas (até X palavras) onde todas são keywords de confirmação.
    if (wordCount <= MAX_WORDS_SIMPLE_CONFIRM_ACK_TYPE_1) {
        if (words.every(word => N_SIMPLE_CONFIRM_ACK_KW.has(word))) {
            logger.debug(`${TAG} Texto "${normalizedText}" identificado como confirmação/ack (curto, todas keywords).`);
            return true;
        }
    }
    // Cenário 2: Mensagens um pouco mais longas (até Y palavras).
    if (wordCount <= MAX_WORDS_SIMPLE_CONFIRM_ACK_TYPE_2) {
        const confirmationWords = words.filter(word => N_SIMPLE_CONFIRM_ACK_KW.has(word));
        const confirmationWordsCount = confirmationWords.length;
        // Palavras que não são de confirmação, nem "tuca", e têm mais de 1 caractere (para ignorar "e", "a", etc.).
        const nonConfirmationSignificantWords = words.filter(word =>
            !N_SIMPLE_CONFIRM_ACK_KW.has(word) &&
            word !== 'tuca' &&
            word.length > 1 
        );
        // Se há palavras de confirmação e nenhuma outra palavra significativa.
        if (confirmationWordsCount > 0 && nonConfirmationSignificantWords.length === 0) {
            logger.debug(`${TAG} Texto "${normalizedText}" identificado como confirmação/ack (keywords + opcionalmente 'tuca' ou palavras insignificantes).`);
            return true;
        }
        // Se a maioria das palavras é de confirmação e há no máximo N outras palavras significativas.
        if (confirmationWordsCount >= Math.ceil(wordCount / 2) && nonConfirmationSignificantWords.length <= MAX_NON_CONFIRM_SIG_WORDS_ACK_TYPE_2) {
             logger.debug(`${TAG} Texto "${normalizedText}" identificado como confirmação/ack (maioria keywords, <= ${MAX_NON_CONFIRM_SIG_WORDS_ACK_TYPE_2} palavra nova significativa).`);
            return true;
        }
    }
    // Cenário 3: Frases que começam com "estou" ou "to" seguidas de uma keyword de confirmação.
    if (wordCount <= MAX_WORDS_SIMPLE_CONFIRM_ACK_PREFIXED && (normalizedText.startsWith('estou ') || normalizedText.startsWith('to '))) {
        const remainingTextFirstWord = words[1]; // Pega a segunda palavra
        if (remainingTextFirstWord && N_SIMPLE_CONFIRM_ACK_KW.has(remainingTextFirstWord)) {
            logger.debug(`${TAG} Texto "${normalizedText}" identificado como confirmação/ack (início com "estou/to" + keyword).`);
            return true;
        }
    }
    logger.debug(`${TAG} Texto "${normalizedText}" NÃO identificado como confirmação/ack simples.`);
    return false;
}

/** Detecta se o usuário está expressando uma preferência (tom, formato, tópico não gostado). */
function detectUserPreference(normalizedText: string, rawText: string): { isMatch: boolean; extractedPreference?: ExtractedPreferenceDetail } {
    const TAG = '[intentService][detectUserPreference v2.20.5]'; 
    let match;
    // Regex para tom da IA
    const toneRegex = /(?:(?:prefiro|gosto\s+de|meu)(?:\s+um)?\s+tom(?:\s+é)?|tom\s+da\s+ia(?:\s+é)?)\s+(mais\s+formal|direto\s+ao\s+ponto|super\s+descontra[ií]do|formal|descontra[ií]do|direto)/i;
    match = rawText.match(toneRegex);
    if (match && match[1]) {
        const toneValueRaw = match[1].trim();
        const toneValueNormalized = normalize(toneValueRaw);
        let finalTone: IUserPreferences['preferredAiTone'] = 'direto_ao_ponto'; // Padrão
        if (toneValueNormalized.includes('mais formal') || toneValueNormalized === 'formal') finalTone = 'mais_formal';
        else if (toneValueNormalized.includes('direto ao ponto') || toneValueNormalized === 'direto') finalTone = 'direto_ao_ponto';
        else if (toneValueNormalized.includes('super descontrai') || toneValueNormalized.includes('descontraido')) finalTone = 'super_descontraido';
        logger.info(`${TAG} Preferência de tom detectada: ${finalTone} (Raw: ${toneValueRaw})`);
        return { isMatch: true, extractedPreference: { field: 'preferredAiTone', value: finalTone, rawValue: toneValueRaw } };
    }
    // Regex para formato preferido
    const formatRegex = /(?:(?:eu|eu\s+realmente|eu\s+também)\s+)?(?:prefiro|gosto(?:\s+mais)?\s+de|queria|quero|adoro|amo|curto)\s+(reels|vídeos?\s+longos?|vídeos?\s+curtos?|posts?\s+de\s+imagem|carrossel|stories|conteúdo\s+em\s+vídeo|postagens\s+escritas|artigos)/i;
    match = rawText.match(formatRegex);
    if (match && match[1]) {
        const formatValue = match[1].trim();
        logger.info(`${TAG} Preferência de formato detectada: ${formatValue}`);
        return { isMatch: true, extractedPreference: { field: 'preferredFormats', value: formatValue, rawValue: formatValue } };
    }
    // Regex para tópico não gostado
    const dislikedTopicRegex = /(?:(?:eu\s+)?(?:n(?:ã|a)o\s+gosto\s+de|n(?:ã|a)o\s+quero)\s+(?:falar\s+sobre|abordar|discutir|postar\s+sobre|criar\s+sobre)|(?:tuca(?:,\s*)?)?(?:por\s+favor(?:,\s*)?)?evite\s+(?:falar\s+sobre|abordar|discutir|postar\s+sobre|criar\s+sobre)|detesto|odeio)\s+(pol[ií]tica|esportes|futebol|religi[aã]o|finan[cç]as(?: pessoais)?|tecnologia|games|jogos|viagens?|reality\s+shows?)/i;
    match = rawText.match(dislikedTopicRegex);
    if (match && match[1]) {
        const dislikedValue = match[1].trim();
        logger.info(`${TAG} Tópico não gostado detectado: ${dislikedValue}`);
        return { isMatch: true, extractedPreference: { field: 'dislikedTopics', value: dislikedValue, rawValue: dislikedValue } };
    }
    return { isMatch: false };
}

/** Detecta se o usuário está compartilhando um objetivo de longo prazo. */
function detectUserGoal(normalizedText: string, rawText: string): { isMatch: boolean; extractedGoal?: string } {
    const TAG = '[intentService][detectUserGoal v2.20.5]'; 
    const lowerRawText = rawText.toLowerCase();
    // Lista de frases comuns que introduzem um objetivo
    const goalKeywordsAndPhrases: string[] = [
        "meu objetivo principal é", "meu objetivo principal é de", "meu objetivo é", "meu objetivo de",
        "minha meta principal é", "minha meta é", "minha meta de",
        "quero alcançar", "quero atingir", "quero conseguir",
        "pretendo", "almejo", "meu foco é", "meu foco principal é",
        "o que eu quero é", "o que eu realmente quero é",
        "busco", "estou trabalhando para", "planejo", "meu plano é"
    ];
    for (const keyword of goalKeywordsAndPhrases) {
        const normalizedKeyword = normalize(keyword);
        if (normalizedText.startsWith(normalizedKeyword + " ")) {
            let potentialGoal = rawText.substring(keyword.length).trim();
            // Validações adicionais para garantir que é um objetivo significativo
            if (potentialGoal.length > MIN_LEN_EXTRACTED_CONTENT_DEFAULT && 
                !normalize(potentialGoal).startsWith("que voce") && 
                !normalize(potentialGoal).startsWith("voce") && 
                potentialGoal.split(/\s+/).length >= MIN_WORDS_EXTRACTED_CONTENT_DEFAULT) {
                logger.info(`${TAG} Goal detected via startsWith ("${keyword}"): "${potentialGoal}"`);
                return { isMatch: true, extractedGoal: potentialGoal };
            }
        }
    }
    // Regex de fallback usando hints
    const goalRegexFallback = new RegExp(`(?:${USER_GOAL_HINT_KEYWORDS.join('|')})\\s+([\\w\\sÀ-ÖØ-öø-ÿ.,'-]+)`, 'i');
    const match = rawText.match(goalRegexFallback);
    if (match && match[1]) {
        const goalDescription = match[1].trim();
        if (goalDescription.length > MIN_LEN_EXTRACTED_CONTENT_DEFAULT && 
            !normalize(goalDescription).startsWith("que voce") && 
            !normalize(goalDescription).startsWith("voce") && 
            goalDescription.split(/\s+/).length >= MIN_WORDS_EXTRACTED_CONTENT_DEFAULT) {
            logger.info(`${TAG} Goal detected via fallback regex: "${goalDescription}"`);
            return { isMatch: true, extractedGoal: goalDescription };
        }
    }
    return { isMatch: false };
}

/** Detecta se o usuário está compartilhando um fato chave sobre si ou seu negócio. */
function detectUserKeyFact(normalizedText: string, rawText: string): { isMatch: boolean; extractedFact?: string } {
    const TAG = '[intentService][detectUserKeyFact v2.20.5]';
    // Regex para capturar frases que introduzem um fato
    const factRegex = /(?:(?:um\s+)?fato\s+(?:importante\s+)?(?:sobre\s+mim|a\s+meu\s+respeito)\s+(?:é\s+que)?|só\s+para\s+(?:você|vc)\s+saber,?|para\s+sua\s+informa[cç][aã]o,?|para\s+que\s+(?:voc[êe]|vc)\s+saiba\s+(?:mais\s+)?sobre\s+mim,?|gostaria\s+de\s+compartilhar\s+que|é\s+importante\s+dizer\s+que|eu\s+trabalho\s+com|minha\s+especialidade\s+é\s+em|sou\s+(?:formado|formada|especialista)\s+em|moro\s+em|minha\s+empresa\s+(?:é|se\s+chama)|meu\s+nicho\s+é)\s+([\s\S]+)/i;
    const match = rawText.match(factRegex);
    if (match && match[1]) {
        const factDescription = match[1].trim();
        // Validações para garantir que é um fato significativo
        if (factDescription.length > MIN_LEN_EXTRACTED_CONTENT_DEFAULT && 
            !normalize(factDescription).startsWith("que voce") && 
            !normalize(factDescription).startsWith("voce") && 
            factDescription.split(/\s+/).length >= MIN_WORDS_EXTRACTED_CONTENT_DEFAULT) {
            logger.info(`${TAG} Key fact detected: "${factDescription}"`);
            return { isMatch: true, extractedFact: factDescription };
        }
    }
    return { isMatch: false };
}

/** Detecta se o usuário está pedindo para a IA memorizar uma informação. */
function detectMemoryUpdateRequest(normalizedText: string, rawText: string): { isMatch: boolean; memoryUpdateRequestContent?: string } {
    const TAG = '[intentService][detectMemoryUpdateRequest v2.20.5]';
    const requestKeywordsJoined = USER_REQUESTS_MEMORY_UPDATE_KEYWORDS.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const requestRegex = new RegExp(`(?:tuca(?:,\\s*)?)?(?:${requestKeywordsJoined})\\s+([\\s\\S]+)`, 'i');
    const match = rawText.match(requestRegex);
    if (match && match[1]) {
        const content = match[1].trim();
        if (content.length > MIN_LEN_MEMORY_UPDATE_CONTENT && content.split(/\s+/).length >= MIN_WORDS_MEMORY_UPDATE_CONTENT) {
            logger.info(`${TAG} Memory update request detected. Content: "${content}"`);
            return { isMatch: true, memoryUpdateRequestContent: content };
        }
    }
    return { isMatch: false };
}

/** Lida com interações muito simples e comuns (saudações, agradecimentos, despedidas) retornando uma resposta pré-definida. */
async function quickSpecialHandle(
  user: IUser,
  normalized: string,
  greeting: string
): Promise<IntentResult | null> {
  const TAG = '[intentService][quickSpecialHandle v2.20.5]';
  const userFirstName = user.name ? user.name.split(' ')[0]! : 'tudo bem';
  if (isGreetingOnly(normalized)) {
    logger.debug(`${TAG} Greeting detected.`);
    return {
      type: 'special_handled',
      response: pickRandom([
        `${greeting} Em que posso ajudar hoje?`,
        `${greeting} Como posso ser útil?`,
        `${greeting} Pronto para começar o dia? Me diga o que precisa!`,
        `Opa, ${userFirstName}! Tudo certo? O que manda?`,
      ]),
    };
  }
  const thanksKeywords = ['obrigado','obrigada','valeu','show','thanks','vlw', 'thx', 'agradecido', 'agradecida', 'de nada', 'disponha'];
  const normalizedThanks = thanksKeywords.map(normalize);
  if (normalizedThanks.some(kw => normalized.startsWith(kw) && normalized.split(/\s+/).length <= 3 )) {
    logger.debug(`${TAG} Thanks detected.`);
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
    logger.debug(`${TAG} Farewell detected.`);
    return {
      type: 'special_handled',
      response: pickRandom([
        'Até mais! 👋',
        'Tchau, tchau! Se cuida!',
        'Falou! Precisando, estou por aqui.',
        `Até a próxima, ${userFirstName}!`.trim(),
      ]),
    };
  }
  return null;
}

/* -------------------------------------------------- *
 * FUNÇÃO PRINCIPAL (exportada)
 * -------------------------------------------------- */
/**
 * Determina a intenção do usuário com base no texto da mensagem e no contexto da conversa.
 * @param normalizedText Texto da mensagem do usuário, já normalizado.
 * @param user Objeto do usuário.
 * @param rawText Texto original da mensagem do usuário.
 * @param dialogueState Estado atual do diálogo.
 * @param greeting Saudação personalizada.
 * @param userId ID do usuário (para logging).
 * @returns Um objeto IntentResult.
 */
export async function determineIntent(
  normalizedText : string,
  user           : IUser,
  rawText        : string,
  dialogueState  : IDialogueState,
  greeting       : string,
  userId         : string
): Promise<IntentResult> {
  const TAG = '[intentService.determineIntent v2.20.7]'; 
  logger.info(`${TAG} User ${userId}: Analisando texto para intenção... Raw: "${rawText.substring(0, 60)}..."`);
  logger.debug(`${TAG} User ${userId}: Estado do diálogo recebido: lastInteraction: ${dialogueState.lastInteraction}, lastAIQuestionType: ${dialogueState.lastAIQuestionType}, lastResponseContext: ${JSON.stringify(dialogueState.lastResponseContext)}, summary: ${dialogueState.conversationSummary ? '"' + dialogueState.conversationSummary.substring(0,50) + '"...' : 'N/A'}`);
  let confidence = 0.35; // baseline conservador

  // 1. Verifica se há uma pergunta pendente da IA e se o usuário está respondendo diretamente a ela.
  if (dialogueState.lastAIQuestionType) {
    logger.debug(`${TAG} User ${userId}: Estado do diálogo indica pergunta pendente: ${dialogueState.lastAIQuestionType}`);
    if (isSimpleAffirmative(normalizedText)) {
      logger.info(`${TAG} User ${userId}: Confirmou ação pendente (${dialogueState.lastAIQuestionType}).`);
      return { type: 'intent_determined', intent: 'user_confirms_pending_action', pendingActionContext: dialogueState.pendingActionContext, confidence: 0.92 };
    }
    if (isSimpleNegative(normalizedText)) {
      logger.info(`${TAG} User ${userId}: Negou ação pendente (${dialogueState.lastAIQuestionType}).`);
      return { type: 'intent_determined', intent: 'user_denies_pending_action', pendingActionContext: dialogueState.pendingActionContext, confidence: 0.9 };
    }
    logger.debug(`${TAG} User ${userId}: Resposta não é afirmação/negação simples para pergunta pendente.`);
  }

  // 2. Lida com interações triviais (saudações, agradecimentos, despedidas).
  const special = await quickSpecialHandle(user, normalizedText, greeting);
  if (special && special.type === 'special_handled') {
    logger.info(`${TAG} User ${userId}: Intenção especial resolvida: ${special.response.substring(0,30)}...`);
    return { ...special, confidence: 0.8 };
  }

  // 3. Detecta se o usuário está tentando atualizar a memória da IA ou fornecer informações pessoais.
  const memoryUpdateRequest = detectMemoryUpdateRequest(normalizedText, rawText);
  if (memoryUpdateRequest.isMatch && memoryUpdateRequest.memoryUpdateRequestContent) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_requests_memory_update.`);
    return { type: 'intent_determined', intent: 'user_requests_memory_update', memoryUpdateRequestContent: memoryUpdateRequest.memoryUpdateRequestContent, confidence: 0.82 };
  }
  const userPreference = detectUserPreference(normalizedText, rawText);
  if (userPreference.isMatch && userPreference.extractedPreference) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_stated_preference (Campo: ${userPreference.extractedPreference.field}).`);
    return { type: 'intent_determined', intent: 'user_stated_preference', extractedPreference: userPreference.extractedPreference, confidence: 0.8 };
  }
  const userGoal = detectUserGoal(normalizedText, rawText);
  if (userGoal.isMatch && userGoal.extractedGoal) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_shared_goal.`);
    return { type: 'intent_determined', intent: 'user_shared_goal', extractedGoal: userGoal.extractedGoal, confidence: 0.78 };
  }
  const userKeyFact = detectUserKeyFact(normalizedText, rawText);
  if (userKeyFact.isMatch && userKeyFact.extractedFact) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_mentioned_key_fact.`);
    return { type: 'intent_determined', intent: 'user_mentioned_key_fact', extractedFact: userKeyFact.extractedFact, confidence: 0.78 };
  }

  // 4. Lógica de Intenção Contextual (se habilitada).
  if (ENABLE_CONTEXTUAL_INTENT_LOGIC) {
    const summaryNorm = dialogueState.conversationSummary ? normalize(dialogueState.conversationSummary) : "";
    const validityMinutes = typeof SHORT_TERM_CONTEXT_VALIDITY_MINUTES === 'number' ? SHORT_TERM_CONTEXT_VALIDITY_MINUTES : 240;

    const timeSinceLastInteractionMinutes = dialogueState.lastInteraction ? (Date.now() - dialogueState.lastInteraction) / (1000 * 60) : Infinity;
    const isRecentInteractionOverall = timeSinceLastInteractionMinutes < validityMinutes;

    const lastResponseCtx = dialogueState.lastResponseContext;
    const timeSinceLastResponseCtxMinutes = lastResponseCtx?.timestamp ? (Date.now() - lastResponseCtx.timestamp) / (1000 * 60) : Infinity;
    const isRecentAndRelevantResponseContext =
        lastResponseCtx &&
        (lastResponseCtx.topic || (lastResponseCtx.entities && lastResponseCtx.entities.length > 0) || typeof lastResponseCtx.wasQuestion === 'boolean') &&
        timeSinceLastResponseCtxMinutes < validityMinutes;

    logger.debug(`${TAG} User ${userId}: Avaliando lógica contextual. Validade (min): ${validityMinutes}. Recente (Interação Geral): ${isRecentInteractionOverall} (${timeSinceLastInteractionMinutes.toFixed(1)} min), Ctx Resposta Recente e Relevante: ${isRecentAndRelevantResponseContext} (idade: ${timeSinceLastResponseCtxMinutes.toFixed(1)} min), Summary: ${!!summaryNorm}`);

    let resolvedContextTopicForLLM: string | undefined = undefined;

    // 4.1. Lógica baseada no contexto da ÚLTIMA RESPOSTA da IA.
    if (isRecentAndRelevantResponseContext && lastResponseCtx) {
        logger.info(`${TAG} User ${userId}: Aplicando lógica contextual de CURTO PRAZO (lastResponseContext). Tópico: "${lastResponseCtx.topic}", Entidades: [${lastResponseCtx.entities?.join(', ')}], WasQuestion: ${lastResponseCtx.wasQuestion}`);
        resolvedContextTopicForLLM = lastResponseCtx.topic;

        const lastAiMessageWasAQuestion = dialogueState.lastAIQuestionType || lastResponseCtx.wasQuestion === true;
        logger.debug(`${TAG} User ${userId}: Última msg IA foi pergunta? ${lastAiMessageWasAQuestion}. lastAIQuestionType: ${dialogueState.lastAIQuestionType}. lastResponseCtx.wasQuestion: ${lastResponseCtx.wasQuestion}`);

        if (isClarificationRequest(normalizedText)) {
            logger.info(`${TAG} User ${userId}: Intenção (lastResponseContext): ASK_CLARIFICATION_PREVIOUS_RESPONSE.`);
            return { type: 'intent_determined', intent: 'ASK_CLARIFICATION_PREVIOUS_RESPONSE', resolvedContextTopic: lastResponseCtx.topic, confidence: 0.74 };
        }

        const lastResponseTopicNorm = lastResponseCtx.topic ? normalize(lastResponseCtx.topic) : "";
        const lastResponseEntitiesNorm = lastResponseCtx.entities?.map((e: string) => normalize(e)) || [];
        const mentionsMetricsOrAnalysisInLastResp =
            lastResponseTopicNorm.includes("metric") || lastResponseTopicNorm.includes("analis") ||
            lastResponseTopicNorm.includes("desempenho") || lastResponseTopicNorm.includes("resultado") ||
            lastResponseTopicNorm.includes("dados") ||
            lastResponseEntitiesNorm.some((e: string) => e.includes("metric") || e.includes("analis") || e.includes("desempenho") || e.includes("resultado") || e.includes("dados"));

        if (mentionsMetricsOrAnalysisInLastResp && isMetricDetailsRequest(normalizedText)) {
            logger.info(`${TAG} User ${userId}: Intenção (lastResponseContext): REQUEST_METRIC_DETAILS_FROM_CONTEXT.`);
            return { type: 'intent_determined', intent: 'REQUEST_METRIC_DETAILS_FROM_CONTEXT', resolvedContextTopic: lastResponseCtx.topic, confidence: 0.76 };
        }

        if (mentionsMetricsOrAnalysisInLastResp && isDataSourceRequest(normalizedText)) {
            logger.info(`${TAG} User ${userId}: Intenção (lastResponseContext): EXPLAIN_DATA_SOURCE_FOR_ANALYSIS.`);
            return { type: 'intent_determined', intent: 'EXPLAIN_DATA_SOURCE_FOR_ANALYSIS', resolvedContextTopic: lastResponseCtx.topic, confidence: 0.72 };
        }

        const wordsInText = normalizedText.split(/\s+/).length;
        // Se a última mensagem da IA foi uma pergunta e a resposta do usuário é relativamente curta.
        const isDirectResponseToAIQuestion = lastAiMessageWasAQuestion && wordsInText <= MAX_WORDS_DIRECT_RESPONSE_TO_AI_QUESTION;

        if (isDirectResponseToAIQuestion) {
            // Considera como continuação do tópico se não for uma simples afirmação/negação (já tratadas).
            if (wordsInText > 0 && !isSimpleAffirmative(normalizedText) && !isSimpleNegative(normalizedText)) {
                logger.info(`${TAG} User ${userId}: Intenção (lastResponseContext, resposta à pergunta da IA): CONTINUE_PREVIOUS_TOPIC (comprimento: ${wordsInText} palavras).`);
                return { type: 'intent_determined', intent: 'CONTINUE_PREVIOUS_TOPIC', resolvedContextTopic: lastResponseCtx.topic, confidence: 0.7 };
            }
        } else {
            // Se não for uma resposta direta a uma pergunta, mas for curta e usar keywords de continuação.
            const isFollowUpLength = wordsInText <= MAX_WORDS_CONTEXTUAL_FOLLOW_UP_KEYWORDS;
            if (isFollowUpLength && isContinueTopicRequest(normalizedText)) {
                logger.info(`${TAG} User ${userId}: Intenção (lastResponseContext, keywords): CONTINUE_PREVIOUS_TOPIC (comprimento: ${wordsInText} palavras).`);
                return { type: 'intent_determined', intent: 'CONTINUE_PREVIOUS_TOPIC', resolvedContextTopic: lastResponseCtx.topic, confidence: 0.68 };
            }
        }
        logger.debug(`${TAG} User ${userId}: Lógica de CURTO PRAZO (lastResponseContext) não determinou intenção. Palavras: ${wordsInText}, isContinueTopicRequest: ${isContinueTopicRequest(normalizedText)}, isDirectResponseToAIQuestion: ${isDirectResponseToAIQuestion}. Prosseguindo para resumo...`);
    }

    // 4.2. Lógica de Fallback baseada no RESUMO da conversa.
    if (isRecentInteractionOverall && summaryNorm) {
        logger.info(`${TAG} User ${userId}: Aplicando lógica contextual de RESUMO (conversationSummary). Resumo: "${summaryNorm.substring(0, CONTEXT_SUMMARY_SNIPPET_LENGTH)}..."`);
        resolvedContextTopicForLLM = summaryNorm.substring(0, CONTEXT_SUMMARY_SNIPPET_LENGTH) + "...";

        if (isClarificationRequest(normalizedText)) {
            logger.info(`${TAG} User ${userId}: Intenção (conversationSummary): ASK_CLARIFICATION_PREVIOUS_RESPONSE.`);
            return { type: 'intent_determined', intent: 'ASK_CLARIFICATION_PREVIOUS_RESPONSE', resolvedContextTopic: resolvedContextTopicForLLM, confidence: 0.65 };
        }

        const summaryMentionsMetricsOrAnalysis = (summaryNorm.includes("media") || summaryNorm.includes("desempenho") || summaryNorm.includes("horario") || summaryNorm.includes("resultado") || summaryNorm.includes("analis") || summaryNorm.includes("metricas") || summaryNorm.includes("dados"));

        if (summaryMentionsMetricsOrAnalysis && isMetricDetailsRequest(normalizedText)) {
            logger.info(`${TAG} User ${userId}: Intenção (conversationSummary): REQUEST_METRIC_DETAILS_FROM_CONTEXT.`);
            return { type: 'intent_determined', intent: 'REQUEST_METRIC_DETAILS_FROM_CONTEXT', resolvedContextTopic: resolvedContextTopicForLLM, confidence: 0.67 };
        }

        if (summaryMentionsMetricsOrAnalysis && isDataSourceRequest(normalizedText)) {
            logger.info(`${TAG} User ${userId}: Intenção (conversationSummary): EXPLAIN_DATA_SOURCE_FOR_ANALYSIS.`);
            return { type: 'intent_determined', intent: 'EXPLAIN_DATA_SOURCE_FOR_ANALYSIS', resolvedContextTopic: resolvedContextTopicForLLM, confidence: 0.64 };
        }

        const isShortFollowUpForSummary = normalizedText.split(/\s+/).length <= MAX_WORDS_CONTEXTUAL_FOLLOW_UP_SUMMARY;
        if (isShortFollowUpForSummary && isContinueTopicRequest(normalizedText)) {
            logger.info(`${TAG} User ${userId}: Intenção (conversationSummary): CONTINUE_PREVIOUS_TOPIC.`);
            return { type: 'intent_determined', intent: 'CONTINUE_PREVIOUS_TOPIC', resolvedContextTopic: resolvedContextTopicForLLM, confidence: 0.6 };
        }
        logger.debug(`${TAG} User ${userId}: Lógica de RESUMO (conversationSummary) não determinou intenção.`);
    } else if (ENABLE_CONTEXTUAL_INTENT_LOGIC) { // Loga apenas se a lógica contextual estava habilitada mas não foi aplicada.
        logger.info(`${TAG} User ${userId}: Nenhuma lógica contextual (curto prazo ou resumo) foi aplicada significativamente. Condições: Recente (Interação Geral): ${isRecentInteractionOverall}, Ctx Resposta Recente e Relevante: ${isRecentAndRelevantResponseContext}, Summary: ${!!summaryNorm}`);
    }
  }
  // --- FIM DA LÓGICA DE INTENÇÃO CONTEXTUAL ---


  // 5. Lógica de intenção principal baseada em keywords (se nenhuma intenção contextual forte foi detectada).
  let intent: DeterminedIntent;

  if      (isHumorScriptRequest(normalizedText)) intent = 'humor_script_request';
  else if (isBestTimeRequest(normalizedText))    intent = 'ASK_BEST_TIME';
  else if (isPlanRequest(normalizedText))        intent = 'content_plan';
  else if (isScriptRequest(normalizedText))      intent = 'script_request';
  else if (isBestPerfRequest(normalizedText))    intent = 'ASK_BEST_PERFORMER';
  else if (isDemographicsRequest(normalizedText)) intent = 'demographic_query';
  else if (isCommunityInspirationRequest(normalizedText)) intent = 'ask_community_inspiration';
  else if (isIdeasRequest(normalizedText))       intent = 'content_ideas';
  else if (isRankingRequest(normalizedText))     intent = 'ranking_request';
  else if (isReportRequest(normalizedText))      intent = 'report';
  else if (isSocialQueryRequest(normalizedText)) {
    intent = 'social_query';
  }
  else if (isMetaQueryRequest(normalizedText)) {
    intent = 'meta_query_personal';
  }
  else {
    // 6. Refinamento final do Fallback (se a lógica contextual estava habilitada mas não pegou antes das keywords).
    if (ENABLE_CONTEXTUAL_INTENT_LOGIC) {
        const validityMinutes = typeof SHORT_TERM_CONTEXT_VALIDITY_MINUTES === 'number' ? SHORT_TERM_CONTEXT_VALIDITY_MINUTES : 240;
        const timeSinceLastInteractionMinutes = dialogueState.lastInteraction ? (Date.now() - dialogueState.lastInteraction) / (1000 * 60) : Infinity;
        const isRecentInteractionOverall = timeSinceLastInteractionMinutes < validityMinutes;

        const lastResponseCtxFallback = dialogueState.lastResponseContext;
        const timeSinceLastResponseCtxFallbackMinutes = lastResponseCtxFallback?.timestamp ? (Date.now() - lastResponseCtxFallback.timestamp) / (1000 * 60) : Infinity;
        const isRecentResponseContextFallback = lastResponseCtxFallback &&
                                                (lastResponseCtxFallback.topic || (lastResponseCtxFallback.entities && lastResponseCtxFallback.entities.length > 0) || typeof lastResponseCtxFallback.wasQuestion === 'boolean') &&
                                                timeSinceLastResponseCtxFallbackMinutes < validityMinutes;

        const wordsInTextFallback = normalizedText.split(/\s+/).length;
        const lastAiMessageWasAQuestionFallback = dialogueState.lastAIQuestionType || (lastResponseCtxFallback?.wasQuestion === true);
        
        const isFollowUpLengthFallback = (isRecentResponseContextFallback && lastAiMessageWasAQuestionFallback) ? 
            wordsInTextFallback <= MAX_WORDS_DIRECT_RESPONSE_TO_AI_QUESTION : 
            wordsInTextFallback <= MAX_WORDS_CONTEXTUAL_FOLLOW_UP_FALLBACK_NO_AI_QUESTION; 


        let resolvedContextTopicForLLMFallback: string | undefined = undefined;

        // Se for uma resposta curta a uma pergunta da IA ou um seguimento curto com keywords de continuação/clarificação.
        if (isRecentResponseContextFallback && lastResponseCtxFallback?.topic && isFollowUpLengthFallback &&
            (isClarificationRequest(normalizedText) || isContinueTopicRequest(normalizedText) || (lastAiMessageWasAQuestionFallback && !isSimpleAffirmative(normalizedText) && !isSimpleNegative(normalizedText)  ) )
           ) {
            intent = isClarificationRequest(normalizedText) ? 'ASK_CLARIFICATION_PREVIOUS_RESPONSE' : 'CONTINUE_PREVIOUS_TOPIC';
            resolvedContextTopicForLLMFallback = lastResponseCtxFallback.topic;
            logger.info(`${TAG} User ${userId}: Intenção contextual de seguimento (fallback tardio, usando lastResponseContext), classificada como ${intent}.`);
            return { type: 'intent_determined', intent, resolvedContextTopic: resolvedContextTopicForLLMFallback, confidence: 0.58 };
        } else if (dialogueState.conversationSummary && isFollowUpLengthFallback && isRecentInteractionOverall && (isClarificationRequest(normalizedText) || isContinueTopicRequest(normalizedText))) {
            // Se não houver contexto da última resposta, mas houver resumo e for um seguimento curto.
            intent = isClarificationRequest(normalizedText) ? 'ASK_CLARIFICATION_PREVIOUS_RESPONSE' : 'CONTINUE_PREVIOUS_TOPIC';
            resolvedContextTopicForLLMFallback = dialogueState.conversationSummary.substring(0, CONTEXT_SUMMARY_SNIPPET_LENGTH) + "...";
            logger.info(`${TAG} User ${userId}: Intenção contextual de seguimento (fallback tardio, usando summaryNorm), classificada como ${intent}.`);
            return { type: 'intent_determined', intent, resolvedContextTopic: resolvedContextTopicForLLMFallback, confidence: 0.55 };
        }
    }
    // Se nenhuma das lógicas acima pegar, é 'general'.
    intent = 'general';
    logger.debug(`${TAG} User ${userId}: Nenhuma intenção específica ou contextual forte detectada, fallback para 'general'.`);
  }

  // Ajusta confiança com base na “força” da identificação (palavras-chave explícitas ganham mais peso).
  const keywordStrengthEntries: Array<[DeterminedIntent, number]> = [
    ['script_request', 0.82],
    ['humor_script_request', 0.82],
    ['content_plan', 0.85],
    ['ranking_request', 0.78],
    ['report', 0.78],
    ['content_ideas', 0.72],
    ['ask_community_inspiration', 0.72],
    ['ASK_BEST_PERFORMER', 0.75],
    ['ASK_BEST_TIME', 0.75],
    ['greeting', 0.65],
    ['clarification_follow_up', 0.6],
    ['proactive_script_accept', 0.7],
    ['proactive_script_reject', 0.7],
    ['social_query', 0.55],
    ['meta_query_personal', 0.55],
    ['user_confirms_pending_action', 0.92],
    ['user_denies_pending_action', 0.9],
    ['generate_proactive_alert', 0.7],
    ['user_stated_preference', 0.8],
    ['demographic_query', 0.7],
    ['user_shared_goal', 0.78],
    ['user_mentioned_key_fact', 0.78],
    ['user_requests_memory_update', 0.82],
    ['REQUEST_METRIC_DETAILS_FROM_CONTEXT', 0.76],
    ['EXPLAIN_DATA_SOURCE_FOR_ANALYSIS', 0.72],
    ['CONTINUE_PREVIOUS_TOPIC', 0.7],
    ['ASK_CLARIFICATION_PREVIOUS_RESPONSE', 0.65],
    ['general', 0.38],
  ];
  const keywordStrength = Object.fromEntries(keywordStrengthEntries) as Record<DeterminedIntent, number>;

  confidence = keywordStrength[intent] ?? confidence;

  logger.info(`${TAG} User ${userId}: Intenção final determinada: ${intent} (confidence=${confidence.toFixed(2)})`);
  return { type: 'intent_determined', intent, confidence };
}

/* -------------------------------------------------- *
 * Helpers expostos
 * -------------------------------------------------- */
export const normalizeText = normalize;

export function getRandomGreeting(userName?: string) {
  const namePart = userName ? userName : 'criador(a)';
  return pickRandom([
    `Oi ${namePart}!`,
    `Olá ${namePart}!`,
    `E aí, ${namePart}? Como vai?`,
    `Fala, ${namePart}! Tudo certo?`,
  ]);
}
