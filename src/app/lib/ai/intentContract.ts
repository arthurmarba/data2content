import { DEFAULT_METRICS_FETCH_DAYS } from '@/app/lib/constants';
import type { DeterminedIntent } from '@/app/lib/intentService';
import type { QuestionFocus, TimeframeFocus } from './questionFocus';
import { deriveClarificationQuestion } from './questionFocus';

export type IntentContract = {
    requireMetric?: boolean;
    requireTimeframe?: boolean;
    requireFormat?: boolean;
    requirePostRef?: boolean;
    defaultMetric?: string;
    defaultTimeframeDays?: number;
};

const INTENT_CONTRACTS: Partial<Record<DeterminedIntent, IntentContract>> = {
    ranking_request: { requireMetric: true, requireTimeframe: true, defaultMetric: 'shares', defaultTimeframeDays: DEFAULT_METRICS_FETCH_DAYS },
    ASK_BEST_PERFORMER: { requireMetric: true, requireTimeframe: true, defaultMetric: 'shares', defaultTimeframeDays: DEFAULT_METRICS_FETCH_DAYS },
    ASK_BEST_TIME: { requireMetric: true, defaultMetric: 'shares', defaultTimeframeDays: DEFAULT_METRICS_FETCH_DAYS },
    report: { requireTimeframe: true, defaultTimeframeDays: DEFAULT_METRICS_FETCH_DAYS },
    content_plan: { requireTimeframe: true, defaultTimeframeDays: DEFAULT_METRICS_FETCH_DAYS },
    REQUEST_METRIC_DETAILS_FROM_CONTEXT: { requirePostRef: true },
    ASK_CLARIFICATION_PREVIOUS_RESPONSE: { requirePostRef: false },
    CONTINUE_PREVIOUS_TOPIC: { requirePostRef: false },
};

const ensureMissing = (missing: string[], key: string) => {
    if (!missing.includes(key)) missing.push(key);
};

const buildDefaultTimeframe = (days: number): TimeframeFocus => ({
    label: `ultimos ${days} dias`,
    normalized: `${days} dias`,
    tokens: [String(days), 'dias'],
});

export function applyIntentContract(
    focus: QuestionFocus,
    intent: DeterminedIntent,
): QuestionFocus {
    const contract = INTENT_CONTRACTS[intent];
    if (!contract) return focus;

    let changed = false;
    const missing = [...focus.missing];
    const required = { ...focus.required };
    const defaults = { ...focus.defaults };

    if (contract.defaultMetric && !required.metric) {
        required.metric = contract.defaultMetric;
        defaults.metric = true;
        const idx = missing.indexOf('metric');
        if (idx >= 0) missing.splice(idx, 1);
        changed = true;
    }

    if (contract.defaultTimeframeDays && !required.timeframe) {
        required.timeframe = buildDefaultTimeframe(contract.defaultTimeframeDays);
        defaults.timeframe = true;
        const idx = missing.indexOf('periodo');
        if (idx >= 0) missing.splice(idx, 1);
        changed = true;
    }

    if (contract.requireMetric && !required.metric) {
        ensureMissing(missing, 'metric');
    }
    if (contract.requireTimeframe && !required.timeframe) {
        ensureMissing(missing, 'periodo');
    }
    if (contract.requireFormat && !required.format) {
        ensureMissing(missing, 'formato');
    }
    if (contract.requirePostRef && !focus.signals.hasPostIdentifier) {
        ensureMissing(missing, 'post_ref');
    }

    if (missing.join('|') !== focus.missing.join('|')) {
        changed = true;
    }
    if (!changed) return focus;

    return {
        ...focus,
        required,
        defaults,
        missing,
        clarificationQuestion: deriveClarificationQuestion(missing),
        needsClarification: missing.length > 0,
    };
}
