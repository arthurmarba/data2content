import type { ContextPack } from './answerEngine/types';
import { buildMissingLabelList, type QuestionFocus } from './questionFocus';

export type AnswerSpec = {
    anchor: string;
    anchorTokens: string[];
    requiredMentions: string[];
    requiredAnyOf: string[][];
    evidence?: {
        allowedUrls: string[];
        allowedIds: string[];
        postCount: number;
    };
    evidenceNumbersByMetric?: Record<string, number[]>;
    evidenceNumbersAll?: number[];
    personalizationTokens?: string[];
    requirePersonalization?: boolean;
};

export type RelevanceResult = {
    passed: boolean;
    score: number;
    issues: string[];
};

const normalizeText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STOPWORDS = new Set([
    'a', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'por', 'para', 'com', 'sem',
    'um', 'uma', 'uns', 'umas', 'no', 'na', 'nos', 'nas', 'que', 'qual', 'quais', 'como', 'porque',
    'por', 'que', 'sobre', 'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas', 'isso',
    'esse', 'essa', 'esses', 'essas', 'este', 'esta', 'estes', 'estas', 'ai', 'ia', 'mobi', 'chat',
]);
const GENERIC_PROFILE_TOKENS = new Set([
    'conteudo', 'conteudos', 'instagram', 'perfil', 'post', 'posts', 'rede', 'social', 'criador',
    'marca', 'seguidores', 'resultado', 'metricas', 'insights', 'engajamento', 'alcance',
]);
const GENERIC_TOPIC_TOKENS = new Set([
    'conteudo', 'conteudos', 'post', 'posts', 'perfil', 'instagram', 'planejamento', 'estrategia',
    'dica', 'analise', 'relatorio', 'ranking', 'melhor', 'pior', 'crescimento',
]);

const METRIC_SYNONYMS: Record<string, string[]> = {
    shares: ['compartilhamentos', 'shares', 'compart'],
    saves: ['salvamentos', 'saves', 'salvos'],
    likes: ['curtidas', 'likes'],
    comments: ['comentarios', 'comments'],
    reach: ['alcance', 'reach', 'impressoes', 'impressao'],
    views: ['visualizacoes', 'views'],
    engagement: ['engajamento', 'taxa de engajamento', 'er'],
    interactions: ['interacoes', 'interacao', 'interacoes totais', 'total de interacoes', 'total interacoes'],
    er: ['taxa de engajamento', 'engajamento', 'er'],
    followers: ['seguidores', 'followers'],
    retention: ['retencao', 'retention'],
};

const FORMAT_SYNONYMS: Record<string, string[]> = {
    reel: ['reel', 'reels', 'video'],
    carrossel: ['carrossel', 'carousel'],
    foto: ['foto', 'imagem'],
    story: ['story', 'stories'],
    live: ['live', 'ao vivo'],
};

const STRONG_CLAIM_TERMS = [
    'melhor',
    'top',
    'recorde',
    'garantido',
    'certeza',
    'com certeza',
    'sempre',
    'nunca',
    'obrigatorio',
];
const RECOMMENDATION_TERMS = [
    'recomendo',
    'recomendacao',
    'recomendacoes',
    'faca',
    'poste',
    'use',
    'priorize',
    'aplique',
    'siga',
];

const METRIC_GROUP_ALIAS: Record<string, string> = {
    er: 'engagement',
    engagement: 'engagement',
};
const METRIC_TERM_TO_KEY: Record<string, string> = {};
Object.entries(METRIC_SYNONYMS).forEach(([metricKey, terms]) => {
    const normalizedKey = normalizeText(metricKey);
    METRIC_TERM_TO_KEY[normalizedKey] = metricKey;
    terms.forEach((term) => {
        const normalized = normalizeText(term);
        if (normalized) METRIC_TERM_TO_KEY[normalized] = metricKey;
    });
});
const METRIC_TERMS = Object.keys(METRIC_TERM_TO_KEY);
const NUMBER_PATTERN = /[<>~]?\d[\d.,kKmM%]*/;

const normalizeMetricKey = (metricKey: string) => METRIC_GROUP_ALIAS[metricKey] || metricKey;

const tokenize = (value: string) =>
    normalizeText(value)
        .split(/[^a-z0-9]+/g)
        .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

const extractTopicTokens = (value: string) =>
    tokenize(value).filter((token) => !GENERIC_TOPIC_TOKENS.has(token));

const buildTopicTokens = (entities?: string[] | null, topic?: string | null) => {
    if (entities?.length) {
        const tokens = entities.flatMap((value) => extractTopicTokens(value));
        const unique = Array.from(new Set(tokens));
        if (unique.length) return unique.slice(0, 4);
    }
    if (!topic) return [];
    const tokens = extractTopicTokens(topic);
    if (tokens.length >= 2 && topic.trim().length >= 12) {
        return Array.from(new Set(tokens)).slice(0, 3);
    }
    return [];
};

const extractProfileTokens = (profile?: ContextPack['user_profile'] | null) => {
    if (!profile) return [];
    const rawValues: string[] = [];
    const pushValue = (value?: string | string[] | null) => {
        if (!value) return;
        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (typeof item === 'string') rawValues.push(item);
            });
            return;
        }
        if (typeof value === 'string') rawValues.push(value);
    };

    pushValue(profile.nicho);
    pushValue(profile.objetivo_primario);
    pushValue(profile.formatos_preferidos);
    pushValue(profile.dificuldades);
    pushValue(profile.tom);
    pushValue(profile.maturidade);
    pushValue(profile.restricoes);

    const tokens = rawValues
        .flatMap((value) => tokenize(value))
        .filter((token) => !GENERIC_PROFILE_TOKENS.has(token));

    return Array.from(new Set(tokens)).slice(0, 12);
};

const collectEvidenceNumbersByMetric = (pack?: ContextPack | null) => {
    const byMetric: Record<string, number[]> = {};
    const all: number[] = [];
    const pushNumber = (metric: string, value?: number | null) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        const key = normalizeMetricKey(metric);
        if (!byMetric[key]) byMetric[key] = [];
        byMetric[key].push(value);
        all.push(value);
        if (value > 0 && value < 1) {
            const pct = value * 100;
            byMetric[key].push(pct);
            all.push(pct);
        }
    };

    if (pack?.top_posts?.length) {
        pack.top_posts.forEach((post) => {
            pushNumber('interactions', post.total_interactions);
            pushNumber('shares', post.shares || undefined);
            pushNumber('saves', post.saves || undefined);
            pushNumber('comments', post.comments || undefined);
            pushNumber('reach', post.reach || undefined);
            pushNumber('engagement', post.engagement_rate_by_reach || undefined);
        });
    }

    if (pack?.user_baselines) {
        const baselines = pack.user_baselines;
        pushNumber('interactions', baselines.totalInteractionsP50);
        pushNumber('interactions', baselines.totalInteractionsP75);
        pushNumber('interactions', baselines.totalInteractionsP90);
        pushNumber('engagement', baselines.engagementRateP50 || undefined);
        pushNumber('engagement', baselines.engagementRateP60 || undefined);
        Object.values(baselines.perFormat || {}).forEach((formatBaseline) => {
            pushNumber('interactions', formatBaseline.totalInteractionsP50);
            pushNumber('interactions', formatBaseline.totalInteractionsP75);
            pushNumber('interactions', formatBaseline.totalInteractionsP90);
            pushNumber('engagement', formatBaseline.engagementRateP50 || undefined);
            pushNumber('engagement', formatBaseline.engagementRateP60 || undefined);
        });
    }

    if (pack?.policy?.thresholds) {
        const thresholds = pack.policy.thresholds;
        pushNumber('interactions', thresholds.minAbsolute);
        pushNumber('interactions', thresholds.minRelativeInteractions);
        pushNumber('interactions', thresholds.effectiveInteractions);
        pushNumber('interactions', thresholds.baselineInteractionP50);
        pushNumber('interactions', thresholds.baselineInteractionP75);
        pushNumber('engagement', thresholds.minRelativeEr || undefined);
        pushNumber('engagement', thresholds.effectiveEr || undefined);
        pushNumber('engagement', thresholds.baselineErP50 || undefined);
        pushNumber('engagement', thresholds.baselineErP60 || undefined);
    }

    if (pack?.market_benchmark) {
        pushNumber('engagement', pack.market_benchmark.avgEngagementRate);
        pushNumber('shares', pack.market_benchmark.avgShares);
        pushNumber('likes', pack.market_benchmark.avgLikes);
    }

    return { byMetric, all };
};

const parseNumberToken = (token: string): number | null => {
    if (!token) return null;
    const cleaned = token.toLowerCase().trim();
    if (!cleaned) return null;
    const hasThousand = cleaned.includes('k') || cleaned.includes('mil');
    const hasMillion = cleaned.includes('m') && !cleaned.includes('mil');
    let multiplier = 1;
    if (hasMillion) multiplier = 1_000_000;
    else if (hasThousand) multiplier = 1_000;

    let numeric = cleaned
        .replace(/[<>~]/g, '')
        .replace(/[%km]/g, '')
        .replace(/mil/g, '')
        .replace(/[^0-9.,]/g, '');

    if (!numeric) return null;
    if (numeric.includes('.') && numeric.includes(',')) {
        numeric = numeric.replace(/\./g, '').replace(',', '.');
    } else if (numeric.includes(',')) {
        numeric = numeric.replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(numeric)) {
        numeric = numeric.replace(/\./g, '');
    }
    const value = Number.parseFloat(numeric);
    if (!Number.isFinite(value)) return null;
    return value * multiplier;
};

const isTimeframeMatch = (window: string, matchIndex: number, matchText: string) => {
    if (/[kKmM%]/.test(matchText)) return false;
    const suffix = window.slice(matchIndex + matchText.length);
    if (/^\s*(dias|semanas|meses|anos|horas|h)\b/.test(suffix)) return true;
    const prefix = window.slice(Math.max(0, matchIndex - 10), matchIndex);
    if (/(ultim|ultima|ultimo)\s*$/.test(prefix) && /^\s*(dias|semanas|meses|anos|horas|h)\b/.test(suffix)) {
        return true;
    }
    return false;
};

const isCurrencyMatch = (window: string, matchIndex: number) => {
    const prefix = window.slice(Math.max(0, matchIndex - 4), matchIndex);
    return prefix.includes('r$') || prefix.includes('$');
};

const extractMetricNumberMentions = (normalizedText: string) => {
    const mentions: Array<{ metricKey: string; value: number; raw: string }> = [];
    for (const term of METRIC_TERMS) {
        const termRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'g');
        for (const termMatch of normalizedText.matchAll(termRegex)) {
            if (termMatch.index === undefined) continue;
            const idx = termMatch.index;
            const windowStart = Math.max(0, idx - 24);
            const windowEnd = Math.min(normalizedText.length, idx + term.length + 24);
            const window = normalizedText.slice(windowStart, windowEnd);
            const numberMatches = window.matchAll(new RegExp(NUMBER_PATTERN.source, 'g'));
            for (const match of numberMatches) {
                if (match.index === undefined) continue;
                if (isTimeframeMatch(window, match.index, match[0])) continue;
                if (isCurrencyMatch(window, match.index)) continue;
                const value = parseNumberToken(match[0]);
                if (value === null) continue;
                const metricKey = METRIC_TERM_TO_KEY[term] || term;
                mentions.push({ metricKey, value, raw: match[0] });
            }
        }
    }
    return mentions;
};

const matchesEvidenceNumber = (value: number, evidence: number[]) => {
    return evidence.some((item) => {
        if (!Number.isFinite(item)) return false;
        const diff = Math.abs(value - item);
        if (diff <= 1) return true;
        if (item === 0) return diff < 1;
        const rel = diff / Math.abs(item);
        if (rel <= 0.08) return true;
        if (item >= 1000 && diff <= 100) return true;
        return false;
    });
};

const extractUrls = (text: string) => {
    const urls = text.match(/https?:\/\/[^\s)]+/gi) || [];
    return urls.map((url) => url.replace(/[),.?!]+$/g, '').trim());
};

const extractMentionedIds = (text: string) => {
    const matches = text.matchAll(/\b(id|post|postagem)\s*[:#]?\s*([a-z0-9_-]{6,})/gi);
    const ids: string[] = [];
    for (const match of matches) {
        if (match[2]) ids.push(match[2]);
    }
    return ids;
};

const NO_EVIDENCE_PHRASES = [
    'dados insuficientes',
    'sem dados',
    'nao tenho dados',
    'nao ha dados',
    'nenhum post',
    'sem evidencias',
];
const NO_DATA_EXCEPTIONS = [
    'retencao',
    'audiencia',
    'demograf',
    'benchmark',
    'nicho',
    'trafego',
    'transito',
    'conversao',
];

const findFirstContentSentence = (text: string) => {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !/^#{1,6}\s+/.test(line))
        .filter((line) => !/^\[BUTTON/i.test(line));

    const firstLine = lines[0] || '';
    const sentenceMatch = firstLine.match(/[^.!?]+[.!?]?/);
    return sentenceMatch ? sentenceMatch[0] : firstLine;
};

const hasSectionHeader = (text: string, label: string) => {
    const normalizedLabel = normalizeText(label);
    return text
        .split(/\r?\n/)
        .some((line) => normalizeText(line).startsWith(`### ${normalizedLabel}`));
};

const containsAny = (target: string, options: string[]) => {
    return options.some((item) => {
        const normalized = normalizeText(item);
        if (!normalized) return false;
        if (normalized.length <= 2) {
            const regex = new RegExp(`\\b${escapeRegExp(normalized)}\\b`);
            return regex.test(target);
        }
        return target.includes(normalized);
    });
};

export function buildAnswerSpec(
    focus: QuestionFocus,
    pack?: ContextPack | null,
    options?: { lastTopic?: string | null; lastEntities?: string[] | null; requireTopic?: boolean },
): AnswerSpec {
    const requiredMentions: string[] = [];
    const requiredAnyOf: string[][] = [];

    if (focus.required.metric) {
        const shouldRequireMetric = !focus.defaults.metric ||
            !pack?.policy?.metricsRequired?.length ||
            pack.policy.metricsRequired.includes(focus.required.metric as any);
        if (shouldRequireMetric) {
            const synonyms = METRIC_SYNONYMS[focus.required.metric] || [focus.required.metric];
            requiredAnyOf.push(synonyms);
        }
    }
    if (focus.required.format) {
        const synonyms = FORMAT_SYNONYMS[focus.required.format] || [focus.required.format];
        requiredAnyOf.push(synonyms);
    }
    if (focus.required.timeframe) {
        const timeframe = focus.required.timeframe;
        const variants = [timeframe.label, timeframe.normalized];
        const value = timeframe.tokens[0];
        const unit = timeframe.tokens[1];
        if (value && unit) {
            const compact = `${value}${unit.startsWith('dia') ? 'd' : unit.startsWith('sem') ? 'sem' : unit.startsWith('mes') ? 'm' : unit.startsWith('ano') ? 'a' : ''}`;
            if (compact.length > value.length) variants.push(compact);
        }
        requiredAnyOf.push(variants.filter(Boolean));
    }

    if (pack?.policy?.formatLocked) {
        const synonyms = FORMAT_SYNONYMS[pack.policy.formatLocked] || [pack.policy.formatLocked];
        requiredAnyOf.push(synonyms);
    }

    if (pack?.policy?.metricsRequired?.length) {
        pack.policy.metricsRequired.forEach((metric) => {
            const synonyms = METRIC_SYNONYMS[metric] || [metric];
            requiredAnyOf.push(synonyms);
        });
    }

    if (options?.requireTopic) {
        const topicTokens = buildTopicTokens(options.lastEntities || undefined, options.lastTopic || undefined);
        if (topicTokens.length) requiredAnyOf.push(topicTokens);
    }

    const evidence = pack
        ? {
            allowedUrls: pack.top_posts.map((p) => p.permalink).filter(Boolean) as string[],
            allowedIds: pack.top_posts.map((p) => p.id).filter(Boolean) as string[],
            postCount: pack.top_posts.length,
        }
        : undefined;
    const evidenceNumbers = pack ? collectEvidenceNumbersByMetric(pack) : null;
    const personalizationTokens = pack ? extractProfileTokens(pack.user_profile) : [];

    return {
        anchor: focus.anchor,
        anchorTokens: focus.anchorTokens,
        requiredMentions,
        requiredAnyOf,
        evidence,
        evidenceNumbersByMetric: evidenceNumbers?.byMetric,
        evidenceNumbersAll: evidenceNumbers?.all,
        personalizationTokens,
        requirePersonalization: personalizationTokens.length > 0,
    };
}

export function validateRelevance(answer: string, spec: AnswerSpec): RelevanceResult {
    const issues: string[] = [];
    const normalizedAnswer = normalizeText(answer);
    const firstSentence = normalizeText(findFirstContentSentence(answer));
    const metricMentions = extractMetricNumberMentions(normalizedAnswer);

    const anchorNormalized = normalizeText(spec.anchor);
    const anchorTokens = spec.anchorTokens.map((t) => normalizeText(t));
    const minTokens = Math.min(2, anchorTokens.length);
    const tokenMatches = anchorTokens.filter((t) => firstSentence.includes(t));

    const anchorOk = anchorNormalized
        ? firstSentence.includes(anchorNormalized) || tokenMatches.length >= minTokens
        : true;
    if (!anchorOk) issues.push('missing_anchor');

    const hasDiagnostico = hasSectionHeader(answer, 'diagnostico');
    const hasPlano = hasSectionHeader(answer, 'plano estrategico');
    const hasProximo = hasSectionHeader(answer, 'proximo passo');
    if (!hasDiagnostico || !hasPlano || !hasProximo) {
        issues.push('missing_sections');
    }

    for (const mention of spec.requiredMentions) {
        if (!normalizedAnswer.includes(normalizeText(mention))) {
            issues.push(`missing_required:${mention}`);
        }
    }

    for (const group of spec.requiredAnyOf) {
        if (!containsAny(normalizedAnswer, group)) {
            issues.push(`missing_any:${group[0]}`);
        }
    }

    if (spec.requirePersonalization && spec.personalizationTokens?.length) {
        const hasPersonalization = spec.personalizationTokens.some((token) => normalizedAnswer.includes(token));
        if (!hasPersonalization) issues.push('missing_personalization');
    }

    if (spec.evidence?.allowedUrls?.length) {
        const allowed = new Set(spec.evidence.allowedUrls.map((url) => normalizeText(url)));
        const urls = extractUrls(answer);
        if (urls.some((url) => !allowed.has(normalizeText(url)))) {
            issues.push('url_out_of_pack');
        }
    }

    if (spec.evidence?.allowedIds?.length) {
        const allowed = new Set(spec.evidence.allowedIds.map((id) => id.toLowerCase()));
        const ids = extractMentionedIds(answer);
        if (ids.some((id) => !allowed.has(id.toLowerCase()))) {
            issues.push('id_out_of_pack');
        }
    }

    if (spec.evidence && spec.evidence.postCount === 0) {
        const mentionsNoData = NO_EVIDENCE_PHRASES.some((phrase) => normalizedAnswer.includes(phrase));
        const hasStrongClaim = STRONG_CLAIM_TERMS.some((term) => normalizedAnswer.includes(term));
        const hasRecommendation = RECOMMENDATION_TERMS.some((term) => normalizedAnswer.includes(term));
        const hasMetricNumber = metricMentions.length > 0;
        if (hasMetricNumber && !mentionsNoData) {
            issues.push('metric_number_without_evidence');
        }
        if (hasStrongClaim && !mentionsNoData) {
            issues.push('strong_claim_without_evidence');
        }
        if (hasRecommendation && !mentionsNoData) {
            issues.push('recommendation_without_evidence');
        }
    }

    if (spec.evidence && spec.evidence.postCount > 0) {
        const mentionsNoData = NO_EVIDENCE_PHRASES.some((phrase) => normalizedAnswer.includes(phrase));
        const hasException = NO_DATA_EXCEPTIONS.some((term) => normalizedAnswer.includes(term));
        if (mentionsNoData && !hasException) issues.push('contradiction_with_pack');
        if (metricMentions.length && !mentionsNoData) {
            const evidenceByMetric = spec.evidenceNumbersByMetric || {};
            const hasUnsupportedMetricNumber = metricMentions.some(({ metricKey, value }) => {
                const normalizedKey = normalizeMetricKey(metricKey);
                const evidence = evidenceByMetric[normalizedKey] || [];
                if (!evidence.length) return true;
                return !matchesEvidenceNumber(value, evidence);
            });
            if (hasUnsupportedMetricNumber) issues.push('metric_number_without_evidence');
        }
    }

    const score = Math.max(0, 100 - (issues.length * 30));
    return {
        passed: issues.length === 0,
        score,
        issues,
    };
}

const buildMissingMessage = (missing: string[], anchor: string) => {
    const labels = buildMissingLabelList(missing);
    if (labels) {
        return `Faltam ${labels} para responder sobre "${anchor}".`;
    }
    return `Falta contexto para responder sobre "${anchor}".`;
};

const MISSING_BUTTONS: Record<string, string[]> = {
    entrega: ['Reels', 'Stories', 'Combo Reels + Stories'],
    metric: ['Compartilhamentos', 'Alcance', 'Engajamento'],
    periodo: ['Ultimos 30 dias', 'Ultimos 90 dias'],
    formato: ['Reels', 'Carrossel', 'Foto'],
    post_ref: ['Enviar link do post', 'Usar ultimo post'],
};

const buildButtonsForMissing = (missing: string[]) => {
    const buttons: string[] = [];
    missing.forEach((key) => {
        const options = MISSING_BUTTONS[key] || [];
        options.forEach((label) => {
            if (buttons.length < 4 && !buttons.includes(label)) {
                buttons.push(label);
            }
        });
    });
    if (!buttons.length) return ['Detalhar objetivo', 'Enviar mais contexto'];
    return buttons;
};

export function buildClarifyingResponse(focus: QuestionFocus): string {
    const missing = focus.missing || [];
    const message = buildMissingMessage(missing, focus.anchor || 'sua pergunta');
    const question = focus.clarificationQuestion || 'Pode detalhar o que voce quer exatamente?';
    const buttons = buildButtonsForMissing(missing);

    const buttonLines = buttons.map((label) => `[BUTTON: ${label}]`).join('\n');

    return [
        '### Diagnostico',
        message,
        '',
        '### Plano Estrategico',
        'Assim que voce responder, eu preparo um plano direto e especifico.',
        '',
        '### Proximo Passo',
        question,
        '',
        buttonLines,
    ].join('\n');
}
