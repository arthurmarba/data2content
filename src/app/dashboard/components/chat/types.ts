export interface Message {
    sender: 'user' | 'consultant';
    text: string;
    messageId?: string | null;
    sessionId?: string | null;
    messageType?: 'content_plan' | 'community_inspiration' | 'script' | 'other';
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
        deliveryType?: 'conteudo' | 'evento' | string | null;
        formatQuantities?: {
            reels?: number;
            post?: number;
            stories?: number;
        } | null;
        eventDetails?: {
            durationHours?: 2 | 4 | 8 | number;
            travelTier?: 'local' | 'nacional' | 'internacional' | string;
            hotelNights?: number;
        } | null;
        eventCoverageQuantities?: {
            reels?: number;
            post?: number;
            stories?: number;
        } | null;
        exclusivity?: string | null;
        usageRights?: string | null;
        paidMediaDuration?: string | null;
        repostTikTok?: boolean;
        instagramCollab?: boolean;
        brandSize?: 'pequena' | 'media' | 'grande' | string | null;
        imageRisk?: 'baixo' | 'medio' | 'alto' | string | null;
        strategicGain?: 'baixo' | 'medio' | 'alto' | string | null;
        contentModel?: 'publicidade_perfil' | 'ugc_whitelabel' | string | null;
        allowStrategicWaiver?: boolean;
        complexity?: string | null;
        authority?: string | null;
        seasonality?: string | null;
    };
    metrics?: {
        reach?: number;
        engagement?: number;
        profileSegment?: string;
    };
    breakdown?: {
        contentUnits?: number;
        contentJusto?: number;
        eventPresenceJusto?: number;
        coverageUnits?: number;
        coverageJusto?: number;
        travelCost?: number;
        hotelCost?: number;
        logisticsSuggested?: number;
        logisticsIncludedInCache?: boolean;
    } | null;
    avgTicket?: number | null;
    totalDeals?: number | null;
    calibration?: {
        enabled?: boolean;
        baseJusto?: number;
        factorRaw?: number;
        factorApplied?: number;
        guardrailApplied?: boolean;
        confidence?: number;
        confidenceBand?: 'alta' | 'media' | 'baixa' | string;
        segmentSampleSize?: number;
        creatorSampleSize?: number;
        windowDaysSegment?: number;
        windowDaysCreator?: number;
        lowConfidenceRangeExpanded?: boolean;
        linkQuality?: 'high' | 'mixed' | 'low' | string;
    } | null;
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
    breakdown?: ChatCalculationContext['breakdown'];
    avgTicket?: number | null;
    totalDeals?: number | null;
    calibration?: ChatCalculationContext['calibration'];
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
    intent_group?: 'inspiration' | 'diagnosis' | 'planning' | 'generic';
    asked_for_examples?: boolean;
    router_rule_hit?: string | null;
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
        source?: 'user' | 'community';
        linkVerified?: boolean;
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
    communityInspirations?: Array<{
        id: string;
        title?: string;
        description?: string;
        highlights?: string[];
        permalink?: string;
        proposal?: string;
        context?: string;
        format?: string;
        tone?: string;
        reference?: string;
        primaryObjective?: string;
        source: 'community';
        linkVerified?: boolean;
        narrativeScore?: number;
        performanceScore?: number;
        personalizationScore?: number;
        narrativeRole?: 'gancho' | 'desenvolvimento' | 'cta';
        matchReasons?: string[];
    }>;
    communityMeta?: {
      matchType?: string;
      usedFilters?: {
        proposal?: string;
        context?: string;
        format?: string;
        tone?: string;
        reference?: string;
        narrativeQuery?: string;
        primaryObjective?: string;
      };
      fallbackMessage?: string;
      rankingSignals?: {
        personalizedByUserPerformance?: boolean;
        userTopCategories?: {
          proposal?: string[];
          context?: string[];
          format?: string[];
          tone?: string[];
        };
      };
    };
    relaxApplied?: Array<{ step: string; reason?: string }>;
    filtersApplied?: { tagsLocked?: boolean; formatLocked?: boolean };
    diagnosticEvidence?: {
        lowPosts: AnswerEvidence['topPosts'];
        highPosts: AnswerEvidence['topPosts'];
    } | null;
}
