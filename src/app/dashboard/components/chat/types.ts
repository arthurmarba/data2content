export interface Message {
    sender: 'user' | 'consultant';
    text: string;
    messageId?: string | null;
    sessionId?: string | null;
    messageType?: 'content_plan' | 'community_inspiration' | 'other';
    cta?: {
        label: string;
        action: string;
    };
    intent?: string | null;
    answerEvidence?: AnswerEvidence | null;
    contextCalcId?: string;
    alertId?: string;
    alertTitle?: string;
    alertSeverity?: 'info' | 'warning' | 'success' | 'critical';
}

export interface CurrentTaskState {
    name?: string;
    objective?: string;
}

export interface ChatCalculationContext {
    calcId: string;
    context?: string | null;
    justo: number;
    estrategico: number;
    premium: number;
    cpm: number;
    cpmSource?: 'seed' | 'dynamic';
    params?: {
        format?: string | null;
        exclusivity?: string | null;
        usageRights?: string | null;
        complexity?: string | null;
    };
    metrics?: {
        reach?: number;
        engagement?: number;
        profileSegment?: string;
    };
    avgTicket?: number | null;
    totalDeals?: number | null;
    explanation?: string | null;
    createdAt?: string | null;
}

export type PricingAnalysisContext = {
    calcId: string;
    segment: string;
    justo: number;
    estrategico: number;
    premium: number;
    cpm: number;
    cpmSource?: 'seed' | 'dynamic';
    params?: ChatCalculationContext['params'];
    metrics?: ChatCalculationContext['metrics'];
    avgTicket?: number | null;
    totalDeals?: number | null;
    explanation?: string | null;
    createdAt?: string | null;
    recentDeal?: {
        value: number;
        reach: number | null;
        brandSegment: string | null;
        createdAt: string | null;
    };
    diff: number | null;
};

export type PreloadedMessage = {
    role: 'system' | 'assistant';
    content: string;
};

export type AlertItem = {
    id: string;
    title: string;
    body: string;
    channel?: 'whatsapp' | 'system' | 'email' | 'other';
    severity?: 'info' | 'warning' | 'success' | 'critical';
    metadata?: Record<string, unknown> | null;
    sourceMessageId?: string | null;
    readAt?: string | null;
    createdAt: string;
};

export interface AnswerEvidence {
    version?: string;
    intent: string;
    thresholds: {
        minAbs?: number;
        minRel?: number;
        formatLocked?: string | null;
        metricsRequired?: string[];
        effectiveEr?: number | null;
    };
    baselines: {
        windowDays: number;
        p50Interactions?: number;
        p50ER?: number;
        perFormat?: Record<string, { p50Interactions?: number; p50ER?: number | null }>;
    };
    topPosts: Array<{
        id: string;
        permalink?: string;
        format?: string | string[] | null;
        tags?: string[];
        stats: {
            total_interactions?: number;
            reach?: number;
            saves?: number;
            shares?: number;
            comments?: number;
            likes?: number;
            er_by_reach?: number;
            engagement_rate_on_reach?: number;
        };
        vsBaseline?: {
            interactionsPct?: number;
            reachPct?: number;
            savesPct?: number;
            sharesPct?: number;
            erPct?: number;
        };
        title?: string;
        captionSnippet?: string;
        thumbUrl?: string;
        score?: number;
    }>;
    relaxApplied?: Array<{ step: string; reason?: string }>;
    filtersApplied?: { tagsLocked?: boolean; formatLocked?: boolean };
}
