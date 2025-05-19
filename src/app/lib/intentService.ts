// @/app/lib/intentService.ts – v2.18.7 (Intenção para Roteiro de Humor)
// - ADICIONADO: Nova intenção `humor_script_request`.
// - ADICIONADO: Keywords e lógica para detectar pedidos de roteiro de humor.
// - Mantém funcionalidades da v2.18.6.
// --------------------------------------------------

import { logger } from '@/app/lib/logger';
import { IUser, IUserPreferences }  from '@/app/models/User';
import { IDialogueState } from './stateService'; // Presume que IDialogueState está em stateService.ts

/* -------------------------------------------------- *
 * Tipagens internas
 * -------------------------------------------------- */
export type DeterminedIntent =
  | 'script_request'
  | 'humor_script_request' // NOVA INTENÇÃO
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
  | 'user_shared_goal'
  | 'user_mentioned_key_fact'
  | 'user_requests_memory_update';

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
      extractedPreference?: ExtractedPreferenceDetail;
      extractedGoal?: string;
      extractedFact?: string;
      memoryUpdateRequestContent?: string;
    }
  | { type: 'special_handled'; response: string };

/* -------------------------------------------------- *
 * Listas de keywords
 * -------------------------------------------------- */
const SCRIPT_KEYWORDS: string[] = [
  'roteiro','script','estrutura','outline','sequencia',
  'escreve pra mim','como fazer video sobre','estrutura de post','roteiriza'
];
// NOVAS KEYWORDS PARA ROTEIRO DE HUMOR
const HUMOR_SCRIPT_KEYWORDS: string[] = [
  'roteiro de humor', 'script engraçado', 'escrever comedia', 'cena comica', 'piada',
  'esquete de humor', 'roteiro para rir', 'video de humor', 'conteudo de humor',
  'ajuda com piada', 'como fazer video engraçado', 'dicas de comedia',
  'humoristico', 'comico'
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
const USER_FACT_HINT_KEYWORDS: string[] = ['fato sobre mim', 'importante saber', 'minha empresa', 'trabalho com', 'sou de', 'moro em', 'para que voce saiba mais sobre mim'];

const SIMPLE_CONFIRMATION_ACK_KEYWORDS: string[] = [
    'ok', 'okay', 'sim', 's', 'entendi', 'entendido', 'certo', 'combinado', 'perfeito', 'justo',
    'aguardando', 'esperando', 'no aguardo',
    'valeu', 'obrigado', 'obrigada', 'grato', 'grata', 'show', 'blz', 'beleza', 'pode crer',
    '👍', '👌',
    'recebido', 'anotado', 'confirmado', 'positivo', 'afirmativo', 'isso', 'exato', 'aham', 'uhum',
    'pode ser', 'pode', 'claro', 'com certeza', 'quero', 'manda', 'dale', 'bora', 'tá', 'ta bom'
];


/* -------------------------------------------------- *
 * Utilidades
 * -------------------------------------------------- */
const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const toNormSet = (arr: string[]) => new Set(arr.map(normalize));

const N_SCRIPT_KW    = toNormSet(SCRIPT_KEYWORDS);
const N_HUMOR_SCRIPT_KW = toNormSet(HUMOR_SCRIPT_KEYWORDS); // NOVO SET
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
const isHumorScriptRequest = (txt: string) => includesKw(txt, N_HUMOR_SCRIPT_KW); // NOVA FUNÇÃO HELPER
const isPlanRequest     = (txt: string) => includesKw(txt, N_PLAN_KW);
const isScriptRequest   = (txt: string) => {
    // Se for um pedido de roteiro de humor, não é um pedido de roteiro genérico.
    if (isHumorScriptRequest(txt)) return false;
    return includesKw(txt, N_SCRIPT_KW);
}
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
    if (words.length <= 3 && words.some(w => N_AFFIRM_KW.has(w))) {
        const nonAffirmativeWords = words.filter(w => !N_AFFIRM_KW.has(w));
        if (nonAffirmativeWords.every(w => w.length <= 4 || w === 'tuca')) {
            return true;
        }
    }
    return words.length <= 2 && N_AFFIRM_KW.has(norm);
}

function isSimpleNegative(norm: string): boolean {
    const words = norm.split(/\s+/);
    if (words.length <= 4 && words.some(w => N_NEG_KW.has(w))) {
        const nonNegativeWords = words.filter(w => !N_NEG_KW.has(w));
         if (nonNegativeWords.every(w => w.length <= 4 || w === 'tuca')) {
            return true;
        }
    }
    return words.length <= 3 && N_NEG_KW.has(norm);
}

export function isSimpleConfirmationOrAcknowledgement(normalizedText: string): boolean {
    const TAG = '[intentService][isSimpleConfirmationOrAcknowledgement v2.18.7]'; // Log version updated
    if (!normalizedText || normalizedText.trim() === '') {
        return false;
    }

    const words = normalizedText.split(/\s+/);
    const wordCount = words.length;

    if (wordCount <= 2) {
        if (words.every(word => N_SIMPLE_CONFIRM_ACK_KW.has(word))) {
            logger.debug(`${TAG} Texto "${normalizedText}" identificado como confirmação/ack (curto, todas keywords).`);
            return true;
        }
    }

    if (wordCount <= 5) {
        const confirmationWords = words.filter(word => N_SIMPLE_CONFIRM_ACK_KW.has(word));
        const confirmationWordsCount = confirmationWords.length;
        
        const nonConfirmationSignificantWords = words.filter(word => 
            !N_SIMPLE_CONFIRM_ACK_KW.has(word) && 
            word !== 'tuca' && 
            word.length > 1
        );

        if (confirmationWordsCount > 0 && nonConfirmationSignificantWords.length === 0) {
            logger.debug(`${TAG} Texto "${normalizedText}" identificado como confirmação/ack (keywords + opcionalmente 'tuca' ou palavras insignificantes).`);
            return true;
        }

        if (confirmationWordsCount >= Math.ceil(wordCount / 2) && nonConfirmationSignificantWords.length <= 1) {
             logger.debug(`${TAG} Texto "${normalizedText}" identificado como confirmação/ack (maioria keywords, <=1 palavra nova significativa).`);
            return true;
        }
    }
    
    if (wordCount <= 3 && (normalizedText.startsWith('estou ') || normalizedText.startsWith('to '))) {
        const remainingTextFirstWord = words[1];
        if (remainingTextFirstWord && N_SIMPLE_CONFIRM_ACK_KW.has(remainingTextFirstWord)) {
            logger.debug(`${TAG} Texto "${normalizedText}" identificado como confirmação/ack (início com "estou/to" + keyword).`);
            return true;
        }
    }

    logger.debug(`${TAG} Texto "${normalizedText}" NÃO identificado como confirmação/ack simples.`);
    return false;
}

function detectUserPreference(normalizedText: string, rawText: string): { isMatch: boolean; extractedPreference?: ExtractedPreferenceDetail } {
    const TAG = '[intentService][detectUserPreference v2.18.7]';
    let match;

    const toneRegex = /(?:(?:prefiro|gosto\s+de|meu)(?:\s+um)?\s+tom(?:\s+é)?|tom\s+da\s+ia(?:\s+é)?)\s+(mais\s+formal|direto\s+ao\s+ponto|super\s+descontra[ií]do|formal|descontra[ií]do|direto)/i;
    match = rawText.match(toneRegex);
    if (match && match[1]) {
        const toneValueRaw = match[1].trim();
        const toneValueNormalized = normalize(toneValueRaw);
        let finalTone: IUserPreferences['preferredAiTone'] = 'direto_ao_ponto';
        if (toneValueNormalized.includes('mais formal') || toneValueNormalized === 'formal') finalTone = 'mais_formal';
        else if (toneValueNormalized.includes('direto ao ponto') || toneValueNormalized === 'direto') finalTone = 'direto_ao_ponto';
        else if (toneValueNormalized.includes('super descontrai') || toneValueNormalized.includes('descontraido')) finalTone = 'super_descontraido';
        logger.info(`${TAG} Preferência de tom detectada: ${finalTone} (Raw: ${toneValueRaw})`);
        return { isMatch: true, extractedPreference: { field: 'preferredAiTone', value: finalTone, rawValue: toneValueRaw } };
    }

    const formatRegex = /(?:(?:eu|eu\s+realmente|eu\s+também)\s+)?(?:prefiro|gosto(?:\s+mais)?\s+de|queria|quero|adoro|amo|curto)\s+(reels|vídeos?\s+longos?|vídeos?\s+curtos?|posts?\s+de\s+imagem|carrossel|stories|conteúdo\s+em\s+vídeo|postagens\s+escritas|artigos)/i;
    match = rawText.match(formatRegex);
    if (match && match[1]) {
        const formatValue = match[1].trim();
        logger.info(`${TAG} Preferência de formato detectada: ${formatValue}`);
        return { isMatch: true, extractedPreference: { field: 'preferredFormats', value: formatValue, rawValue: formatValue } };
    }

    const dislikedTopicRegex = /(?:(?:eu\s+)?(?:n(?:ã|a)o\s+gosto\s+de|n(?:ã|a)o\s+quero)\s+(?:falar\s+sobre|abordar|discutir|postar\s+sobre|criar\s+sobre)|(?:tuca(?:,\s*)?)?(?:por\s+favor(?:,\s*)?)?evite\s+(?:falar\s+sobre|abordar|discutir|postar\s+sobre|criar\s+sobre)|detesto|odeio)\s+(pol[ií]tica|esportes|futebol|religi[aã]o|finan[cç]as(?: pessoais)?|tecnologia|games|jogos|viagens?|reality\s+shows?)/i;
    match = rawText.match(dislikedTopicRegex);
    if (match && match[1]) {
        const dislikedValue = match[1].trim();
        logger.info(`${TAG} Tópico não gostado detectado: ${dislikedValue}`);
        return { isMatch: true, extractedPreference: { field: 'dislikedTopics', value: dislikedValue, rawValue: dislikedValue } };
    }
    return { isMatch: false };
}

function detectUserGoal(normalizedText: string, rawText: string): { isMatch: boolean; extractedGoal?: string } {
    const TAG = '[intentService][detectUserGoal v2.18.7]';
    const lowerRawText = rawText.toLowerCase();
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
            if (potentialGoal.length > 5 && !normalize(potentialGoal).startsWith("que voce") && !normalize(potentialGoal).startsWith("voce") && potentialGoal.split(/\s+/).length >= 2) {
                logger.info(`${TAG} Goal detected via startsWith ("${keyword}"): "${potentialGoal}"`);
                return { isMatch: true, extractedGoal: potentialGoal };
            }
        }
    }

    const goalRegexFallback = new RegExp(`(?:${USER_GOAL_HINT_KEYWORDS.join('|')})\\s+([\\w\\sÀ-ÖØ-öø-ÿ.,'-]+)`, 'i');
    const match = rawText.match(goalRegexFallback);

    if (match && match[1]) {
        const goalDescription = match[1].trim();
        if (goalDescription.length > 5 && !normalize(goalDescription).startsWith("que voce") && !normalize(goalDescription).startsWith("voce") && goalDescription.split(/\s+/).length >= 2) {
            logger.info(`${TAG} Goal detected via fallback regex: "${goalDescription}"`);
            return { isMatch: true, extractedGoal: goalDescription };
        }
    }
    return { isMatch: false };
}

function detectUserKeyFact(normalizedText: string, rawText: string): { isMatch: boolean; extractedFact?: string } {
    const TAG = '[intentService][detectUserKeyFact v2.18.7]';
    const factRegex = /(?:(?:um\s+)?fato\s+(?:importante\s+)?(?:sobre\s+mim|a\s+meu\s+respeito)\s+(?:é\s+que)?|só\s+para\s+(?:você|vc)\s+saber,?|para\s+sua\s+informa[cç][aã]o,?|para\s+que\s+(?:voc[êe]|vc)\s+saiba\s+(?:mais\s+)?sobre\s+mim,?|gostaria\s+de\s+compartilhar\s+que|é\s+importante\s+dizer\s+que|eu\s+trabalho\s+com|minha\s+especialidade\s+é\s+em|sou\s+(?:formado|formada|especialista)\s+em|moro\s+em|minha\s+empresa\s+(?:é|se\s+chama)|meu\s+nicho\s+é)\s+([\s\S]+)/i;
    const match = rawText.match(factRegex);

    if (match && match[1]) {
        const factDescription = match[1].trim();
        if (factDescription.length > 5 && !normalize(factDescription).startsWith("que voce") && !normalize(factDescription).startsWith("voce") && factDescription.split(/\s+/).length >= 2) {
            logger.info(`${TAG} Key fact detected: "${factDescription}"`);
            return { isMatch: true, extractedFact: factDescription };
        }
    }
    return { isMatch: false };
}

function detectMemoryUpdateRequest(normalizedText: string, rawText: string): { isMatch: boolean; memoryUpdateRequestContent?: string } {
    const TAG = '[intentService][detectMemoryUpdateRequest v2.18.7]';
    const requestKeywordsJoined = USER_REQUESTS_MEMORY_UPDATE_KEYWORDS.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const requestRegex = new RegExp(`(?:tuca(?:,\\s*)?)?(?:${requestKeywordsJoined})\\s+([\\s\\S]+)`, 'i');
    const match = rawText.match(requestRegex);

    if (match && match[1]) {
        const content = match[1].trim();
        if (content.length > 3 && content.split(/\s+/).length >= 1) {
            logger.info(`${TAG} Memory update request detected. Content: "${content}"`);
            return { isMatch: true, memoryUpdateRequestContent: content };
        }
    }
    return { isMatch: false };
}


/* -------------------------------------------------- *
 * CASOS ESPECIAIS RÁPIDOS
 * -------------------------------------------------- */
async function quickSpecialHandle(
  user: IUser,
  normalized: string,
  greeting: string
): Promise<IntentResult | null> {
  const TAG = '[intentService][quickSpecialHandle v2.18.7]';
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
export async function determineIntent(
  normalizedText : string,
  user           : IUser,
  rawText        : string,
  dialogueState  : IDialogueState,
  greeting       : string,
  userId         : string
): Promise<IntentResult> {
  const TAG = '[intentService.determineIntent v2.18.7]';
  logger.info(`${TAG} User ${userId}: Analisando texto para intenção... Raw: "${rawText.substring(0, 60)}..."`);


  if (dialogueState.lastAIQuestionType) {
    logger.debug(`${TAG} User ${userId}: Estado do diálogo indica pergunta pendente: ${dialogueState.lastAIQuestionType}`);
    if (isSimpleAffirmative(normalizedText)) {
      logger.info(`${TAG} User ${userId}: Confirmou ação pendente (${dialogueState.lastAIQuestionType}).`);
      return { type: 'intent_determined', intent: 'user_confirms_pending_action', pendingActionContext: dialogueState.pendingActionContext };
    }
    if (isSimpleNegative(normalizedText)) {
      logger.info(`${TAG} User ${userId}: Negou ação pendente (${dialogueState.lastAIQuestionType}).`);
      return { type: 'intent_determined', intent: 'user_denies_pending_action', pendingActionContext: dialogueState.pendingActionContext };
    }
    logger.debug(`${TAG} User ${userId}: Resposta não é afirmação/negação simples para pergunta pendente.`);
  }

  const special = await quickSpecialHandle(user, normalizedText, greeting);
  if (special && special.type === 'special_handled') {
    logger.info(`${TAG} User ${userId}: Intenção especial resolvida: ${special.response.substring(0,30)}...`);
    return special;
  }

  // Prioridade para detecção de intenções de memória
  const memoryUpdateRequest = detectMemoryUpdateRequest(normalizedText, rawText);
  if (memoryUpdateRequest.isMatch && memoryUpdateRequest.memoryUpdateRequestContent) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_requests_memory_update.`);
    return { type: 'intent_determined', intent: 'user_requests_memory_update', memoryUpdateRequestContent: memoryUpdateRequest.memoryUpdateRequestContent };
  }

  const userPreference = detectUserPreference(normalizedText, rawText);
  if (userPreference.isMatch && userPreference.extractedPreference) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_stated_preference (Campo: ${userPreference.extractedPreference.field}).`);
    return { type: 'intent_determined', intent: 'user_stated_preference', extractedPreference: userPreference.extractedPreference };
  }

  const userGoal = detectUserGoal(normalizedText, rawText);
  if (userGoal.isMatch && userGoal.extractedGoal) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_shared_goal.`);
    return { type: 'intent_determined', intent: 'user_shared_goal', extractedGoal: userGoal.extractedGoal };
  }

  const userKeyFact = detectUserKeyFact(normalizedText, rawText);
  if (userKeyFact.isMatch && userKeyFact.extractedFact) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_mentioned_key_fact.`);
    return { type: 'intent_determined', intent: 'user_mentioned_key_fact', extractedFact: userKeyFact.extractedFact };
  }

  // Lógica de intenção principal
  let intent: DeterminedIntent;

  // A nova intenção de roteiro de humor deve ser verificada ANTES de script_request genérico.
  if      (isHumorScriptRequest(normalizedText)) intent = 'humor_script_request';
  else if (isBestTimeRequest(normalizedText))    intent = 'ASK_BEST_TIME';
  else if (isPlanRequest(normalizedText))        intent = 'content_plan';
  else if (isScriptRequest(normalizedText))      intent = 'script_request'; // Agora só pega se não for humor_script_request
  else if (isBestPerfRequest(normalizedText))    intent = 'ASK_BEST_PERFORMER';
  else if (isCommunityInspirationRequest(normalizedText)) intent = 'ask_community_inspiration';
  else if (isIdeasRequest(normalizedText))       intent = 'content_ideas';
  else if (isRankingRequest(normalizedText))     intent = 'ranking_request';
  else if (isReportRequest(normalizedText))      intent = 'report';
  else if (isSocialQueryRequest(normalizedText)) {
    intent = 'social_query';
    logger.debug(`${TAG} User ${userId}: Intenção social query detectada.`);
  }
  else if (isMetaQueryRequest(normalizedText)) {
    intent = 'meta_query_personal';
    logger.debug(`${TAG} User ${userId}: Intenção meta query pessoal detectada.`);
  }
  else {
    intent = 'general';
    logger.debug(`${TAG} User ${userId}: Nenhuma intenção específica detectada, fallback para 'general'.`);
  }

  logger.info(`${TAG} User ${userId}: Intenção final determinada (não-memória ou fallback): ${intent}`);
  return { type: 'intent_determined', intent };
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
