export interface Message {
    sender: 'user' | 'consultant';
    text: string;
    messageId?: string | null;
    sessionId?: string | null;
    cta?: {
        label: string;
        action: string;
    };
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
