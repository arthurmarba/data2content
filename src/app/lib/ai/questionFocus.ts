export type QuestionType =
    | 'why'
    | 'how'
    | 'what'
    | 'ranking'
    | 'plan'
    | 'price'
    | 'diagnosis'
    | 'general';

export type TimeframeFocus = {
    label: string;
    normalized: string;
    tokens: string[];
};

export type QuestionFocus = {
    question: string;
    anchor: string;
    anchorTokens: string[];
    type: QuestionType;
    intentHint?: string | null;
    defaults: {
        metric?: boolean;
        timeframe?: boolean;
        format?: boolean;
    };
    signals: {
        mentionsSpecificPost: boolean;
        hasPostIdentifier: boolean;
    };
    required: {
        format?: string;
        metric?: string;
        timeframe?: TimeframeFocus;
    };
    missing: string[];
    clarificationQuestion: string | null;
    needsClarification: boolean;
};

const STOPWORDS = new Set([
    'a', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'por', 'para', 'com', 'sem',
    'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'que', 'qual', 'quais', 'como', 'porque',
    'por', 'que', 'sobre', 'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas', 'isso',
    'esse', 'essa', 'esses', 'essas', 'este', 'esta', 'estes', 'estas', 'ai', 'ia', 'mobi', 'chat',
]);

const FORMAT_KEYWORDS: Array<{ format: string; keywords: string[] }> = [
    { format: 'reel', keywords: ['reel', 'reels', 'video curto', 'short', 'shorts'] },
    { format: 'carrossel', keywords: ['carrossel', 'carousel'] },
    { format: 'foto', keywords: ['foto', 'imagem', 'photo'] },
    { format: 'story', keywords: ['story', 'stories', 'storie', 'storie', 'status'] },
    { format: 'live', keywords: ['live', 'ao vivo'] },
];

const METRIC_KEYWORDS: Array<{ metric: string; keywords: string[] }> = [
    { metric: 'shares', keywords: ['compartilhamento', 'compartilhamentos', 'share', 'shares'] },
    { metric: 'saves', keywords: ['salvamento', 'salvamentos', 'save', 'saves', 'salvos'] },
    { metric: 'likes', keywords: ['curtida', 'curtidas', 'like', 'likes'] },
    { metric: 'comments', keywords: ['comentario', 'comentarios', 'comment', 'comments'] },
    { metric: 'reach', keywords: ['alcance', 'reach', 'impressao', 'impressoes'] },
    { metric: 'views', keywords: ['visualizacao', 'visualizacoes', 'views'] },
    { metric: 'engagement', keywords: ['engajamento', 'taxa de engajamento', 'er'] },
    { metric: 'interactions', keywords: ['interacoes', 'interacao', 'interacoes totais', 'interacao total'] },
    { metric: 'followers', keywords: ['seguidores', 'followers', 'crescimento de seguidores'] },
    { metric: 'retention', keywords: ['retencao', 'retention'] },
];

const PRICE_KEYWORDS = [
    'quanto cobrar',
    'preco',
    'valor',
    'cobrar',
    'precificar',
    'publi',
    'parceria',
    'contraproposta',
    'contra proposta',
    'contra-proposta',
];

const DELIVERABLE_KEYWORDS = ['reel', 'reels', 'story', 'stories', 'carrossel', 'foto', 'combo', 'pacote', 'post'];
const RANKING_KEYWORDS = ['melhores', 'piores', 'ranking', 'top', 'lista de', 'qual melhor'];
const BEST_TIME_KEYWORDS = ['melhor horario', 'melhor hora', 'melhor dia', 'quando postar'];
const POST_REF_KEYWORDS = ['esse post', 'este post', 'aquele post', 'post especifico'];

const normalizeText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const compactWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const extractFormat = (normalized: string): string | undefined => {
    for (const item of FORMAT_KEYWORDS) {
        if (item.keywords.some((kw) => normalized.includes(kw))) return item.format;
    }
    return undefined;
};

const extractMetric = (normalized: string): string | undefined => {
    for (const item of METRIC_KEYWORDS) {
        if (item.keywords.some((kw) => normalized.includes(kw))) return item.metric;
    }
    return undefined;
};

const extractTimeframe = (raw: string, normalized: string): TimeframeFocus | undefined => {
    const numericMatch = normalized.match(/(ultim[oa]s?|ultima|ultimo)?\s*(\d+)\s*(dias|semanas|meses|anos)/);
    if (numericMatch) {
        const value = numericMatch[2] || '';
        const unit = numericMatch[3] || '';
        const label = numericMatch[1] ? `${numericMatch[1]} ${value} ${unit}` : `${value} ${unit}`;
        const compactLabel = compactWhitespace(label);
        return {
            label: compactLabel,
            normalized: compactLabel.replace(/ultim[oa]s?|ultima|ultimo/gi, '').trim(),
            tokens: [value, unit.replace(/s$/, '')],
        };
    }

    if (normalized.includes('semana passada')) {
        return { label: 'semana passada', normalized: 'semana passada', tokens: ['semana', 'passada'] };
    }
    if (normalized.includes('mes passado')) {
        return { label: 'mes passado', normalized: 'mes passado', tokens: ['mes', 'passado'] };
    }
    if (normalized.includes('ultimo mes')) {
        return { label: 'ultimo mes', normalized: 'ultimo mes', tokens: ['ultimo', 'mes'] };
    }
    if (normalized.includes('ultimos 7 dias')) {
        return { label: 'ultimos 7 dias', normalized: '7 dias', tokens: ['7', 'dias'] };
    }
    return undefined;
};

const detectType = (normalized: string, intentHint?: string | null): QuestionType => {
    if (PRICE_KEYWORDS.some((kw) => normalized.includes(kw))) return 'price';
    if (normalized.includes('por que') || normalized.startsWith('pq ') || normalized.startsWith('porq')) return 'why';
    if (normalized.includes('como') || normalized.includes('devo')) return 'how';
    if (normalized.includes('melhor') || normalized.includes('ranking') || normalized.includes('top')) return 'ranking';
    if (normalized.includes('plano') || normalized.includes('calendario') || normalized.includes('estrategia')) return 'plan';
    if (normalized.includes('analise') || normalized.includes('diagnostico')) return 'diagnosis';
    if (intentHint && intentHint.includes('plan')) return 'plan';
    return 'general';
};

const buildAnchor = (
    raw: string,
    normalized: string,
    type: QuestionType,
    format?: string,
    metric?: string,
    timeframe?: TimeframeFocus,
): string => {
    if (type === 'price') return 'quanto cobrar';
    if (normalized.includes('melhor horario') || normalized.includes('melhores horarios')) {
        return 'melhores horarios para postar';
    }
    if (normalized.includes('melhor dia')) {
        return 'melhor dia para postar';
    }
    if (type === 'plan') return 'plano de conteudo';
    if (type === 'ranking') return 'ranking de melhores posts';
    const cleanRaw = compactWhitespace(raw.replace(/\?+$/g, ''));
    if (cleanRaw.length <= 80) return cleanRaw;
    if (metric && format && timeframe) {
        return `resultado em ${metric} no formato ${format} (${timeframe.label})`;
    }
    if (metric && format) {
        return `resultado em ${metric} no formato ${format}`;
    }
    return cleanRaw.slice(0, 80).trim();
};

const buildAnchorTokens = (anchor: string): string[] => {
    const normalized = normalizeText(anchor);
    const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
    const filtered = tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
    return filtered.slice(0, 10);
};

const needsDeliverableDetails = (normalized: string) =>
    PRICE_KEYWORDS.some((kw) => normalized.includes(kw)) &&
    !DELIVERABLE_KEYWORDS.some((kw) => normalized.includes(kw));

const hasSpecificPostReference = (normalized: string) => {
    if (POST_REF_KEYWORDS.some((kw) => normalized.includes(kw))) return true;
    if (normalized.includes('post') && normalized.includes('esse')) return true;
    if (normalized.includes('post') && normalized.includes('este')) return true;
    if (normalized.includes('post') && normalized.includes('aquele')) return true;
    return false;
};

const hasPostIdentifier = (raw: string) => {
    if (/https?:\/\/\S+/i.test(raw)) return true;
    if (/\b(id|post|postagem)\s*[:#]?\s*[a-z0-9_-]{6,}\b/i.test(raw)) return true;
    return false;
};

const needsMetric = (normalized: string, intentHint?: string | null, type?: QuestionType) => {
    if (type === 'ranking') return true;
    if (RANKING_KEYWORDS.some((kw) => normalized.includes(kw))) return true;
    if (BEST_TIME_KEYWORDS.some((kw) => normalized.includes(kw))) return true;
    if (intentHint === 'ranking_request' || intentHint === 'ASK_BEST_PERFORMER' || intentHint === 'ASK_BEST_TIME') return true;
    return false;
};

export function deriveClarificationQuestion(missing: string[]): string | null {
    if (missing.length > 1) {
        const labels = buildMissingLabelList(missing);
        if (labels) {
            return `Preciso de ${labels}. Pode informar ${labels}?`;
        }
    }
    if (missing.includes('entrega')) {
        return 'Qual a entrega exata (Reels, Stories, combo) e existe exclusividade ou uso de imagem?';
    }
    if (missing.includes('metric')) {
        return 'Qual metrica voce quer usar (alcance, compartilhamentos, salvamentos, engajamento)?';
    }
    if (missing.includes('periodo')) {
        return 'Qual periodo voce quer analisar (ex: ultimos 30 ou 90 dias)?';
    }
    if (missing.includes('formato')) {
        return 'Qual formato voce quer analisar (Reels, Carrossel, Foto, Stories)?';
    }
    if (missing.includes('post_ref')) {
        return 'Qual post voce quer analisar? Pode enviar o link ou o ID.';
    }
    return null;
}

export const buildMissingLabelList = (missing: string[]) => {
    const labelMap: Record<string, string> = {
        entrega: 'entrega',
        metric: 'metrica',
        periodo: 'periodo',
        formato: 'formato',
        post_ref: 'post',
    };
    const labels = missing.map((key) => labelMap[key]).filter(Boolean);
    if (!labels.length) return '';
    if (labels.length === 1) return labels[0];
    return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
};

export function extractQuestionFocus(rawText: string, intentHint?: string | null): QuestionFocus {
    const question = compactWhitespace(rawText || '');
    const normalized = normalizeText(question);
    const format = extractFormat(normalized);
    const metric = extractMetric(normalized);
    const timeframe = extractTimeframe(question, normalized);
    const type = detectType(normalized, intentHint);
    const anchor = buildAnchor(question, normalized, type, format, metric, timeframe);
    const anchorTokens = buildAnchorTokens(anchor);
    const mentionsSpecificPost = hasSpecificPostReference(normalized);
    const hasIdentifier = hasPostIdentifier(question);

    const missing: string[] = [];
    if (needsDeliverableDetails(normalized)) {
        missing.push('entrega');
    }
    if (!metric && needsMetric(normalized, intentHint, type)) {
        missing.push('metric');
    }
    if (hasSpecificPostReference(normalized) && !hasPostIdentifier(question)) {
        missing.push('post_ref');
    }

    const clarificationQuestion = deriveClarificationQuestion(missing);

    return {
        question,
        anchor,
        anchorTokens,
        type,
        intentHint,
        defaults: {},
        signals: {
            mentionsSpecificPost,
            hasPostIdentifier: hasIdentifier,
        },
        required: {
            format,
            metric,
            timeframe,
        },
        missing,
        clarificationQuestion,
        needsClarification: missing.length > 0,
    };
}

export function buildQuestionFocusPrompt(focus: QuestionFocus): string {
    const requiredParts: string[] = [];
    if (focus.required.format) requiredParts.push(`formato=${focus.required.format}`);
    if (focus.required.metric) requiredParts.push(`metrica=${focus.required.metric}`);
    if (focus.required.timeframe) requiredParts.push(`periodo=${focus.required.timeframe.label}`);

    const requiredText = requiredParts.length ? requiredParts.join(' | ') : 'nenhuma';
    const missingText = focus.missing.length ? `- faltando: ${focus.missing.join(', ')}` : '';
    const defaultsParts: string[] = [];
    if (focus.defaults.metric && focus.required.metric) defaultsParts.push(`metrica=${focus.required.metric}`);
    if (focus.defaults.timeframe && focus.required.timeframe) defaultsParts.push(`periodo=${focus.required.timeframe.label}`);
    if (focus.defaults.format && focus.required.format) defaultsParts.push(`formato=${focus.required.format}`);
    const defaultsText = defaultsParts.length ? `- padroes aplicados: ${defaultsParts.join(' | ')}` : '';

    return [
        'FOCO DA PERGUNTA (WEB):',
        `- question_anchor: "${focus.anchor}"`,
        `- tipo: ${focus.type}`,
        `- restricoes: ${requiredText}`,
        '- obrigatorio: a primeira frase deve responder ao question_anchor.',
        '- se faltar dado essencial, faca 1 pergunta direta e pare.',
        defaultsText,
        missingText,
    ]
        .filter(Boolean)
        .join('\n');
}
