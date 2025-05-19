// @/app/lib/intentService.ts – v2.18.3 (Refinamentos Gerais de Detecção)
// - OTIMIZADO: Adicionado logging detalhado e revisão de regex nas funções:
//   - detectUserPreference
//   - detectUserKeyFact (logging já existia, mantido e revisado)
//   - detectMemoryUpdateRequest (logging já existia, mantido e revisado)
// - Mantém funcionalidades da v2.18.2.
// --------------------------------------------------

import { logger } from '@/app/lib/logger';
import { IUser, IUserPreferences }  from '@/app/models/User'; // IUserPreferences importado para tipagem
import { IDialogueState } from './stateService'; 

/* -------------------------------------------------- *
 * Tipagens internas (Mantido da v2.18.2)
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
 * Listas de keywords (Mantido da v2.18.2)
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
 * Utilidades (Mantido da v2.18.2)
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
 * Helpers de intenção (ATUALIZADO v2.18.3)
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
 * ATUALIZADO v2.18.3: Logging detalhado e revisão de regex.
 * @param normalizedText Texto normalizado da mensagem do usuário.
 * @param rawText Texto original da mensagem do usuário.
 * @returns Um objeto com `isMatch: true` e `extractedPreference` se uma preferência for detectada, senão `isMatch: false`.
 */
function detectUserPreference(normalizedText: string, rawText: string): { isMatch: boolean; extractedPreference?: ExtractedPreferenceDetail } {
    const TAG = '[intentService][detectUserPreference v2.18.3]';
    logger.debug(`${TAG} Checking for user preference. Raw text: "${rawText.substring(0,100)}"`);
    let match;

    // Preferência de Tom da IA
    // Regex revisada para garantir espaços (\s+) e capturar variações comuns.
    const toneRegex = /(?:(?:prefiro|gosto\s+de|meu)(?:\s+um)?\s+tom(?:\s+é)?|tom\s+da\s+ia(?:\s+é)?)\s+(mais\s+formal|direto\s+ao\s+ponto|super\s+descontra[ií]do|formal|descontra[ií]do|direto)/i;
    match = rawText.match(toneRegex);
    logger.debug(`${TAG} Checking tone preference. Regex match result: ${JSON.stringify(match)}`);
    if (match && match[1]) { // O grupo de captura agora é o valor do tom
        const toneValueRaw = match[1].trim();
        const toneValueNormalized = normalize(toneValueRaw);
        let finalTone: IUserPreferences['preferredAiTone'] = 'direto_ao_ponto'; // Default
        
        if (toneValueNormalized.includes('mais formal') || toneValueNormalized === 'formal') finalTone = 'mais_formal';
        else if (toneValueNormalized.includes('direto ao ponto') || toneValueNormalized === 'direto') finalTone = 'direto_ao_ponto';
        else if (toneValueNormalized.includes('super descontrai') || toneValueNormalized.includes('descontraido')) finalTone = 'super_descontraido'; // Corrigido para 'super_descontraido'

        logger.info(`${TAG} Preferência de tom detectada: ${finalTone} (Raw: ${toneValueRaw})`);
        return { 
            isMatch: true, 
            extractedPreference: { field: 'preferredAiTone', value: finalTone, rawValue: toneValueRaw } 
        };
    }

    // Preferência de Formato
    // Regex revisada para incluir mais variações e garantir espaços (\s+)
    const formatRegex = /(?:(?:eu|eu\s+realmente|eu\s+também)\s+)?(?:prefiro|gosto(?:\s+mais)?\s+de|queria|quero|adoro|amo|curto)\s+(reels|vídeos?\s+longos?|vídeos?\s+curtos?|posts?\s+de\s+imagem|carrossel|stories|conteúdo\s+em\s+vídeo|postagens\s+escritas|artigos)/i;
    match = rawText.match(formatRegex);
    logger.debug(`${TAG} Checking format preference. Regex match result: ${JSON.stringify(match)}`);
    if (match && match[1]) { // match[1] é o formato
        const formatValue = match[1].trim();
        logger.info(`${TAG} Preferência de formato detectada: ${formatValue}`);
        return { 
            isMatch: true, 
            extractedPreference: { field: 'preferredFormats', value: formatValue, rawValue: formatValue } 
        };
    }
    
    // Tópicos Não Gostados
    // Regex revisada para garantir espaços (\s+) e cobrir variações
    const dislikedTopicRegex = /(?:(?:eu\s+)?(?:n(?:ã|a)o\s+gosto\s+de|evito|n(?:ã|a)o\s+quero)\s+(?:falar\s+sobre|abordar|discutir|postar\s+sobre|criar\s+sobre)|detesto|odeio)\s+(pol[ií]tica|esportes|futebol|religi[aã]o|finan[cç]as(?: pessoais)?|tecnologia|games|jogos|viagens?|reality\s+shows?)/i;
    match = rawText.match(dislikedTopicRegex);
    logger.debug(`${TAG} Checking disliked topics. Regex match result: ${JSON.stringify(match)}`);
    if (match && match[1]) { // match[1] é o tópico
        const dislikedValue = match[1].trim();
        logger.info(`${TAG} Tópico não gostado detectado: ${dislikedValue}`);
        return { 
            isMatch: true, 
            extractedPreference: { field: 'dislikedTopics', value: dislikedValue, rawValue: dislikedValue } 
        };
    }
    
    logger.debug(`${TAG} No user preference detected for raw text: "${rawText.substring(0,100)}"`);
    return { isMatch: false };
}

/**
 * Tenta extrair um objetivo de longo prazo do usuário.
 * ATUALIZADO v2.18.3: Melhorada lógica de keywords e regex de fallback. Logging detalhado.
 * @param normalizedText Texto normalizado.
 * @param rawText Texto original.
 * @returns Objeto com `isMatch: true` e `extractedGoal` se detectado, senão `isMatch: false`.
 */
function detectUserGoal(normalizedText: string, rawText: string): { isMatch: boolean; extractedGoal?: string } {
    const TAG = '[intentService][detectUserGoal v2.18.3]'; 
    const lowerRawText = rawText.toLowerCase(); // Usar rawText para preservar capitalização original se necessário no futuro
    logger.debug(`${TAG} Checking for user goal. Raw text: "${rawText.substring(0,100)}"`);
    
    // Keywords mais robustas e ordenadas por especificidade (aproximada)
    const goalKeywordsAndPhrases: string[] = [
        "meu objetivo principal é", "meu objetivo principal é de", "meu objetivo é", "meu objetivo de",
        "minha meta principal é", "minha meta é", "minha meta de",
        "quero alcançar", "quero atingir", "quero conseguir",
        "pretendo", "almejo", "meu foco é", "meu foco principal é",
        "o que eu quero é", "o que eu realmente quero é",
        "busco", "estou trabalhando para", "planejo", "meu plano é"
        // Adicionar mais variações conforme observado nos logs
    ];

    for (const keyword of goalKeywordsAndPhrases) {
        const normalizedKeyword = normalize(keyword); // Normalizar keyword para comparação
        if (normalizedText.startsWith(normalizedKeyword + " ")) { // Garantir que é um prefixo de frase
            let potentialGoal = rawText.substring(keyword.length).trim(); // Extrair do rawText para manter formatação original
            logger.debug(`${TAG} Keyword "${keyword}" matched via startsWith. Potential goal: "${potentialGoal}"`);
            
            // Filtros adicionais para evitar falsos positivos
            if (potentialGoal.length > 5 && 
                !normalize(potentialGoal).startsWith("que voce") && 
                !normalize(potentialGoal).startsWith("voce") &&
                potentialGoal.split(/\s+/).length >= 2) { // Exige pelo menos duas palavras para o objetivo
                logger.info(`${TAG} Goal detected via startsWith ("${keyword}"): "${potentialGoal}"`);
                return { isMatch: true, extractedGoal: potentialGoal };
            } else {
                logger.debug(`${TAG} Potential goal via startsWith ("${keyword}") did not meet criteria (length: ${potentialGoal.length}, startsWithVocê: ${normalize(potentialGoal).startsWith("voce")}, wordCount: ${potentialGoal.split(/\s+/).length}).`);
            }
        }
    }
    
    // Regex de fallback mais genérica, mas ainda ancorada em intenção de objetivo
    // Captura o que vem depois da keyword de objetivo.
    const goalRegexFallback = new RegExp(`(?:${USER_GOAL_HINT_KEYWORDS.join('|')})\\s+([\\w\\sÀ-ÖØ-öø-ÿ.,'-]+)`, 'i');
    const match = rawText.match(goalRegexFallback);
    logger.debug(`${TAG} Checking with fallback regex. Regex match result: ${JSON.stringify(match)}`);

    if (match && match[1]) {
        const goalDescription = match[1].trim();
        logger.debug(`${TAG} Fallback regex matched. Group 1: "${match[1]}", Trimmed: "${goalDescription}", Length: ${goalDescription.length}`);
        if (goalDescription.length > 5 && 
            !normalize(goalDescription).startsWith("que voce") && 
            !normalize(goalDescription).startsWith("voce") &&
            goalDescription.split(/\s+/).length >= 2) {
            logger.info(`${TAG} Goal detected via fallback regex: "${goalDescription}"`);
            return { isMatch: true, extractedGoal: goalDescription };
        } else {
            logger.debug(`${TAG} Goal description via fallback regex too short or starts with 'você'. Length: ${goalDescription.length}, WordCount: ${goalDescription.split(/\s+/).length}`);
        }
    }
    logger.debug(`${TAG} No goal detected for raw text: "${rawText.substring(0,100)}"`);
    return { isMatch: false };
}

/**
 * Tenta extrair um fato chave mencionado pelo usuário.
 * ATUALIZADO v2.18.3: Logging detalhado e revisão de regex.
 * @param normalizedText Texto normalizado.
 * @param rawText Texto original.
 * @returns Objeto com `isMatch: true` e `extractedFact` se detectado, senão `isMatch: false`.
 */
function detectUserKeyFact(normalizedText: string, rawText: string): { isMatch: boolean; extractedFact?: string } {
    const TAG = '[intentService][detectUserKeyFact v2.18.3]';
    logger.debug(`${TAG} Checking for key fact. Raw text: "${rawText.substring(0,100)}"`);
    // Regex revisada para ser mais flexível e capturar frases comuns.
    // Inclui variações como "um fato sobre mim", "minha empresa é X", "trabalho com Y", "sou Z"
    const factRegex = /(?:(?:um\s+)?fato\s+(?:importante\s+)?(?:sobre\s+mim|a\s+meu\s+respeito)\s+(?:é\s+que)?|só\s+para\s+(?:você|vc)\s+saber,?|para\s+sua\s+informa[cç][aã]o,?|gostaria\s+de\s+compartilhar\s+que|é\s+importante\s+dizer\s+que|eu\s+trabalho\s+com|minha\s+especialidade\s+é\s+em|sou\s+(?:formado|especialista)\s+em|moro\s+em|minha\s+empresa\s+(?:é|se\s+chama)|meu\s+nicho\s+é)\s+([\w\sÀ-ÖØ-öø-ÿ.,'"\-À-ÿ]+)/i;
    const match = rawText.match(factRegex);
    logger.debug(`${TAG} Regex match result: ${JSON.stringify(match)}`);

    if (match && match[1]) {
        const factDescription = match[1].trim();
        logger.debug(`${TAG} Regex matched. Group 1: "${match[1]}", Trimmed: "${factDescription}", Length: ${factDescription.length}`);
        if (factDescription.length > 5 && 
            !normalize(factDescription).startsWith("que voce") && 
            !normalize(factDescription).startsWith("voce") &&
            factDescription.split(/\s+/).length >= 2) { // Exige pelo menos duas palavras
            logger.info(`${TAG} Key fact detected: "${factDescription}"`);
            return { isMatch: true, extractedFact: factDescription };
        } else {
             logger.debug(`${TAG} Fact description via regex too short, starts with 'você', or not enough words. Length: ${factDescription.length}, WordCount: ${factDescription.split(/\s+/).length}`);
        }
    }
    logger.debug(`${TAG} No key fact detected for raw text: "${rawText.substring(0,100)}"`);
    return { isMatch: false };
}

/**
 * Detecta se o usuário está explicitamente pedindo para Tuca lembrar/anotar algo.
 * ATUALIZADO v2.18.3: Logging detalhado e revisão de regex.
 * @param normalizedText Texto normalizado.
 * @param rawText Texto original.
 * @returns Objeto com `isMatch: true` e `memoryUpdateRequestContent` se detectado, senão `isMatch: false`.
 */
function detectMemoryUpdateRequest(normalizedText: string, rawText: string): { isMatch: boolean; memoryUpdateRequestContent?: string } {
    const TAG = '[intentService][detectMemoryUpdateRequest v2.18.3]';
    logger.debug(`${TAG} Checking for memory update request. Raw text: "${rawText.substring(0,100)}"`);
    // Regex revisada para ser mais abrangente e usar as keywords de N_USER_MEM_UPDATE_KW
    const requestKeywordsJoined = USER_REQUESTS_MEMORY_UPDATE_KEYWORDS.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const requestRegex = new RegExp(`(?:tuca,? )?(?:${requestKeywordsJoined})\\s+([\\w\\sÀ-ÖØ-öø-ÿ.,'"\-À-ÿ]+)`, 'i');
    const match = rawText.match(requestRegex);
    logger.debug(`${TAG} Regex match result: ${JSON.stringify(match)}`);
    
    if (match && match[1]) {
        const content = match[1].trim();
        logger.debug(`${TAG} Regex matched. Group 1: "${match[1]}", Trimmed: "${content}", Length: ${content.length}`);
        if (content.length > 3 && content.split(/\s+/).length >= 1) { // Permite conteúdo curto mas com pelo menos uma palavra
            logger.info(`${TAG} Memory update request detected. Content: "${content}"`);
            return { isMatch: true, memoryUpdateRequestContent: content };
        } else {
            logger.debug(`${TAG} Memory update request content too short or no words. Length: ${content.length}, WordCount: ${content.split(/\s+/).length}`);
        }
    }
    logger.debug(`${TAG} No memory update request detected for raw text: "${rawText.substring(0,100)}"`);
    return { isMatch: false };
}


/* -------------------------------------------------- *
 * CASOS ESPECIAIS RÁPIDOS (Mantido da v2.18.2)
 * -------------------------------------------------- */
async function quickSpecialHandle(
  user: IUser,
  normalized: string,
  greeting: string
): Promise<IntentResult | null> {
  const TAG = '[intentService][quickSpecialHandle v2.18.3]'; // Atualizando tag para consistência
  if (isGreetingOnly(normalized)) {
    logger.debug(`${TAG} Greeting detected.`);
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

  const thanksKeywords = ['obrigado','obrigada','valeu','show','thanks','vlw', 'thx', 'agradecido', 'agradecida', 'de nada', 'disponha'];
  const normalizedThanks = thanksKeywords.map(normalize);

  if (normalizedThanks.some(kw => normalized.startsWith(kw) && normalized.split(/\s+/).length <= 3 )) { // Permite frases curtas de agradecimento
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
        `Até a próxima, ${user.name || ''}!`.trim(),
      ]),
    };
  }
  logger.debug(`${TAG} No special quick handle matched.`);
  return null;
}

/* -------------------------------------------------- *
 * FUNÇÃO PRINCIPAL (exportada) (ATUALIZADO v2.18.3)
 * -------------------------------------------------- */
export async function determineIntent(
  normalizedText : string,
  user           : IUser,
  rawText        : string, 
  dialogueState  : IDialogueState,
  greeting       : string,
  userId         : string // Adicionado para logging consistente
): Promise<IntentResult> {
  const TAG = '[intentService.determineIntent v2.18.3]'; 
  logger.info(`${TAG} User ${userId}: Analisando texto (raw: "${rawText.substring(0,100)}...", norm: "${normalizedText.substring(0,100)}...")`);
  logger.debug(`${TAG} User ${userId}: Estado do diálogo: ${JSON.stringify(dialogueState)}`);


  if (dialogueState.lastAIQuestionType) {
    logger.debug(`${TAG} User ${userId}: Estado de diálogo indica pergunta pendente da IA: ${dialogueState.lastAIQuestionType}`);
    if (isSimpleAffirmative(normalizedText)) {
      logger.info(`${TAG} User ${userId}: Confirmou ação pendente (${dialogueState.lastAIQuestionType}) com texto: "${normalizedText}"`);
      return {
        type: 'intent_determined',
        intent: 'user_confirms_pending_action',
        pendingActionContext: dialogueState.pendingActionContext
      };
    }
    if (isSimpleNegative(normalizedText)) {
      logger.info(`${TAG} User ${userId}: Negou ação pendente (${dialogueState.lastAIQuestionType}) com texto: "${normalizedText}"`);
      return {
        type: 'intent_determined',
        intent: 'user_denies_pending_action',
        pendingActionContext: dialogueState.pendingActionContext
      };
    }
    logger.debug(`${TAG} User ${userId}: Resposta "${normalizedText}" não é afirmação/negação simples para pergunta pendente. Prosseguindo para detecção geral.`);
  }

  const special = await quickSpecialHandle(user, normalizedText, greeting);
  if (special && special.type === 'special_handled') {
    logger.info(`${TAG} User ${userId}: Intenção especial resolvida: "${special.response.slice(0,50)}..."`);
    return special;
  }

  // Detecção de intenções de memória (ordem de prioridade)
  // 1. Pedido explícito de atualização de memória
  const memoryUpdateRequest = detectMemoryUpdateRequest(normalizedText, rawText);
  if (memoryUpdateRequest.isMatch && memoryUpdateRequest.memoryUpdateRequestContent) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_requests_memory_update. Conteúdo: "${memoryUpdateRequest.memoryUpdateRequestContent}"`);
    return { 
        type: 'intent_determined', 
        intent: 'user_requests_memory_update', 
        memoryUpdateRequestContent: memoryUpdateRequest.memoryUpdateRequestContent 
    };
  }

  // 2. Declaração de preferência
  const userPreference = detectUserPreference(normalizedText, rawText);
  if (userPreference.isMatch && userPreference.extractedPreference) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_stated_preference. Preferência: ${JSON.stringify(userPreference.extractedPreference)}`);
    return { 
        type: 'intent_determined', 
        intent: 'user_stated_preference', 
        extractedPreference: userPreference.extractedPreference 
    };
  }
  
  // 3. Compartilhamento de objetivo
  const userGoal = detectUserGoal(normalizedText, rawText);
  if (userGoal.isMatch && userGoal.extractedGoal) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_shared_goal. Objetivo: "${userGoal.extractedGoal}"`);
    return { 
        type: 'intent_determined', 
        intent: 'user_shared_goal', 
        extractedGoal: userGoal.extractedGoal 
    };
  }

  // 4. Menção de fato chave
  const userKeyFact = detectUserKeyFact(normalizedText, rawText);
  if (userKeyFact.isMatch && userKeyFact.extractedFact) {
    logger.info(`${TAG} User ${userId}: Intenção detectada: user_mentioned_key_fact. Fato: "${userKeyFact.extractedFact}"`);
    return { 
        type: 'intent_determined', 
        intent: 'user_mentioned_key_fact', 
        extractedFact: userKeyFact.extractedFact 
    };
  }

  // Detecção de intenções existentes (após checagens de memória)
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
 * Helpers expostos (Mantido da v2.18.2)
 * -------------------------------------------------- */
export const normalizeText = normalize; // Exportando normalize para uso externo se necessário

export function getRandomGreeting(userName?: string) { // userName opcional
  const namePart = userName ? userName : 'criador(a)'; // Default se nome não fornecido
  return pickRandom([
    `Oi ${namePart}!`,
    `Olá ${namePart}!`,
    `E aí, ${namePart}? Como vai?`,
    `Fala, ${namePart}! Tudo certo?`,
  ]);
}
