import { useState, useEffect, useRef } from 'react';
import { ChatCalculationContext, PricingAnalysisContext, PreloadedMessage } from '../components/chat/types';

const FORMAT_LABELS: Record<string, string> = {
    reels: 'Reels',
    post: 'Post no feed',
    stories: 'Stories',
    pacote: 'Pacote multiformato',
    evento: 'Presença em evento',
};
const DELIVERY_TYPE_LABELS: Record<string, string> = {
    conteudo: 'Conteúdo',
    evento: 'Evento',
};
const EXCLUSIVITY_LABELS: Record<string, string> = {
    nenhuma: 'Sem exclusividade',
    '7d': '7 dias',
    '15d': '15 dias',
    '30d': '30 dias',
};
const USAGE_LABELS: Record<string, string> = {
    organico: 'Uso orgânico',
    midiapaga: 'Mídia paga',
    global: 'Uso global/perpétuo',
};
const COMPLEXITY_LABELS: Record<string, string> = {
    simples: 'Produção simples',
    roteiro: 'Com roteiro aprovado',
    profissional: 'Produção profissional',
};

const MOBI_PRICING_PROMPT =
    'Você é o Mobi, consultor de precificação da Data2Content. Analise o cálculo acima e sugira recomendações.';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat('pt-BR');
const percentFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const formatSegmentLabel = (segment?: string | null) => {
    if (!segment) return 'Geral';
    return segment
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

export function usePricingAnalysis(calculationContext?: ChatCalculationContext | null) {
    const [pricingAnalysisContext, setPricingAnalysisContext] = useState<PricingAnalysisContext | null>(null);
    const [preloadedMessages, setPreloadedMessages] = useState<PreloadedMessage[]>([]);
    const lastPricingCalcIdRef = useRef<string | null>(null);
    const isAutoPricingRunningRef = useRef(false);

    useEffect(() => {
        if (!calculationContext) {
            setPricingAnalysisContext(null);
            setPreloadedMessages([]);
            return;
        }

        let cancelled = false;

        async function prepareContext() {
            const base = calculationContext;
            if (!base) return;
            let calcData = {
                justo: base.justo,
                estrategico: base.estrategico,
                premium: base.premium,
                cpm: base.cpm,
                cpmSource: base.cpmSource ?? 'dynamic',
                params: base.params,
                metrics: base.metrics,
                breakdown: base.breakdown ?? null,
                avgTicket: base.avgTicket ?? null,
                totalDeals: base.totalDeals ?? null,
                explanation: base.explanation ?? null,
                createdAt: base.createdAt ?? null,
            };

            if (base.calcId) {
                try {
                    const response = await fetch(`/api/calculator/${base.calcId}`, { cache: 'no-store' });
                    if (response.ok) {
                        const payload = await response.json();
                        calcData = {
                            justo: typeof payload?.justo === 'number' ? payload.justo : calcData.justo,
                            estrategico: typeof payload?.estrategico === 'number' ? payload.estrategico : calcData.estrategico,
                            premium: typeof payload?.premium === 'number' ? payload.premium : calcData.premium,
                            cpm: typeof payload?.cpm === 'number' ? payload.cpm : calcData.cpm,
                            cpmSource: (payload as any)?.cpmSource ?? calcData.cpmSource,
                            params: payload?.params ?? calcData.params,
                            metrics: payload?.metrics ?? calcData.metrics,
                            breakdown: (payload as any)?.breakdown ?? calcData.breakdown,
                            avgTicket: typeof payload?.avgTicket === 'number' ? payload.avgTicket : calcData.avgTicket,
                            totalDeals: typeof payload?.totalDeals === 'number' ? payload.totalDeals : calcData.totalDeals,
                            explanation: payload?.explanation ?? calcData.explanation,
                            createdAt: payload?.createdAt ?? calcData.createdAt,
                        };
                    }
                } catch (error) {
                    console.error('[ChatPanel] Falha ao atualizar cálculo para contexto do chat.', error);
                }
            }

            const segmentRaw = (calcData.metrics?.profileSegment ?? base.metrics?.profileSegment ?? 'default') || 'default';
            const normalizedSegment = typeof segmentRaw === 'string' && segmentRaw.trim()
                ? segmentRaw.trim().toLowerCase()
                : 'default';

            let recentDeal: PricingAnalysisContext['recentDeal'] | undefined;
            if (normalizedSegment) {
                try {
                    const response = await fetch(`/api/deals/recent?segment=${encodeURIComponent(normalizedSegment)}`, {
                        cache: 'no-store',
                    });
                    if (response.status === 200) {
                        const dealPayload = await response.json();
                        if (typeof dealPayload?.value === 'number') {
                            recentDeal = {
                                value: dealPayload.value,
                                reach: typeof dealPayload?.reach === 'number' ? dealPayload.reach : null,
                                brandSegment: dealPayload?.brandSegment ?? normalizedSegment,
                                createdAt: typeof dealPayload?.createdAt === 'string' ? dealPayload.createdAt : null,
                            };
                        }
                    }
                } catch (error) {
                    console.error('[ChatPanel] Falha ao buscar deal recente para comparação.', error);
                }
            }

            if (cancelled) return;

            const justo = calcData.justo;
            const estrategico = calcData.estrategico;
            const premium = calcData.premium;
            const cpm = calcData.cpm;

            let diff: number | null = null;
            if (recentDeal && typeof justo === 'number' && Number.isFinite(justo) && justo > 0) {
                diff = ((recentDeal.value - justo) / justo) * 100;
            }

            const segmentLabel = formatSegmentLabel(segmentRaw);
            const diffText = diff !== null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%` : 'n/d';

            const comparisonLine = recentDeal
                ? `Cálculo: ${currencyFormatter.format(justo)} no nicho ${segmentLabel} — Deal mais recente: ${currencyFormatter.format(recentDeal.value)} (diferença ${diffText}).`
                : `Cálculo: ${currencyFormatter.format(justo)} no nicho ${segmentLabel}. Ainda não encontramos deals recentes para comparar.`;

            const seedWarningLine =
                calcData.cpmSource === 'seed'
                    ? '⚠️ Este valor é baseado em um CPM médio inicial de mercado. Ele será refinado com dados reais de publis.'
                    : null;
            const explanationLine = (calcData.explanation ?? '').trim() || null;

            const summaryParts: string[] = [];
            if (calcData.params?.format) {
                const label = FORMAT_LABELS[calcData.params.format] ?? calcData.params.format;
                summaryParts.push(`Formato: ${label}`);
            }
            if (calcData.params?.deliveryType) {
                const label = DELIVERY_TYPE_LABELS[calcData.params.deliveryType] ?? calcData.params.deliveryType;
                summaryParts.push(`Modo: ${label}`);
            }
            const fq = calcData.params?.formatQuantities;
            if (fq && (fq.reels || fq.post || fq.stories)) {
                const quantityLabels: string[] = [];
                if (fq.reels) quantityLabels.push(`${fq.reels} Reels`);
                if (fq.post) quantityLabels.push(`${fq.post} Posts`);
                if (fq.stories) quantityLabels.push(`${fq.stories} Stories`);
                if (quantityLabels.length) summaryParts.push(`Entregas: ${quantityLabels.join(' + ')}`);
            }
            const eventDetails = calcData.params?.eventDetails;
            if (eventDetails && calcData.params?.deliveryType === 'evento') {
                summaryParts.push(
                    `Evento: ${eventDetails.durationHours || 4}h, ${eventDetails.travelTier || 'local'}, ${(eventDetails.hotelNights || 0)} noite(s)`
                );
            }
            const coverage = calcData.params?.eventCoverageQuantities;
            if (coverage && (coverage.reels || coverage.post || coverage.stories)) {
                const coverageLabels: string[] = [];
                if (coverage.reels) coverageLabels.push(`${coverage.reels} Reels`);
                if (coverage.post) coverageLabels.push(`${coverage.post} Posts`);
                if (coverage.stories) coverageLabels.push(`${coverage.stories} Stories`);
                if (coverageLabels.length) summaryParts.push(`Cobertura opcional: ${coverageLabels.join(' + ')}`);
            }
            if (calcData.params?.exclusivity) {
                const label = EXCLUSIVITY_LABELS[calcData.params.exclusivity] ?? calcData.params.exclusivity;
                summaryParts.push(`Exclusividade: ${label}`);
            }
            if (calcData.params?.usageRights) {
                const label = USAGE_LABELS[calcData.params.usageRights] ?? calcData.params.usageRights;
                summaryParts.push(`Uso de imagem: ${label}`);
            }
            if (calcData.params?.complexity) {
                const label = COMPLEXITY_LABELS[calcData.params.complexity] ?? calcData.params.complexity;
                summaryParts.push(`Complexidade: ${label}`);
            }
            if (typeof calcData.avgTicket === 'number' && Number.isFinite(calcData.avgTicket) && calcData.avgTicket > 0) {
                summaryParts.push(`Ticket médio recente: ${currencyFormatter.format(calcData.avgTicket)}`);
            }
            if (typeof calcData.totalDeals === 'number' && calcData.totalDeals > 0) {
                summaryParts.push(`Publis analisadas: ${calcData.totalDeals}`);
            }
            if (typeof calcData.breakdown?.logisticsSuggested === 'number' && calcData.breakdown.logisticsSuggested > 0) {
                summaryParts.push(`Logística sugerida (extra): ${currencyFormatter.format(calcData.breakdown.logisticsSuggested)}`);
            }
            const summaryLine = summaryParts.length ? summaryParts.join(' • ') : null;

            const metricsParts: string[] = [];
            const reachValue = calcData.metrics?.reach;
            if (typeof reachValue === 'number' && Number.isFinite(reachValue) && reachValue > 0) {
                metricsParts.push(`Alcance ${integerFormatter.format(Math.round(reachValue))}`);
            }
            const engagementValue = calcData.metrics?.engagement;
            if (typeof engagementValue === 'number' && Number.isFinite(engagementValue)) {
                metricsParts.push(`Engajamento ${percentFormatter.format(engagementValue)}%`);
            }
            if (recentDeal?.reach && recentDeal.reach > 0) {
                metricsParts.push(`Deal recente: alcance ${integerFormatter.format(Math.round(recentDeal.reach))}`);
            }
            const metricsLine = metricsParts.length ? `Métricas consideradas: ${metricsParts.join(' • ')}` : null;

            let createdAtLine: string | null = null;
            if (calcData.createdAt) {
                const parsed = new Date(calcData.createdAt);
                if (!Number.isNaN(parsed.getTime())) {
                    createdAtLine = `Cálculo gerado em ${parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`;
                }
            }
            const dealLine =
                recentDeal?.createdAt && recentDeal.value
                    ? `Deal fechado em ${new Date(recentDeal.createdAt).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                    })}.`
                    : null;

            const closingLine = base.context === 'publi-calculator'
                ? 'Vou preparar uma análise comparativa automática para você.'
                : 'Posso comparar com publis similares ou ajustar a proposta, é só me dizer!';

            const lines = seedWarningLine ? [seedWarningLine, comparisonLine] : [comparisonLine];
            if (explanationLine) lines.push(explanationLine);
            if (summaryLine) lines.push(summaryLine);
            if (metricsLine) lines.push(metricsLine);
            if (createdAtLine) lines.push(createdAtLine);
            if (dealLine) lines.push(dealLine);
            lines.push(closingLine);

            const text = lines.join('\n\n');

            setPricingAnalysisContext({
                calcId: base.calcId,
                segment: normalizedSegment,
                justo,
                estrategico,
                premium,
                cpm,
                cpmSource: calcData.cpmSource,
                params: calcData.params,
                metrics: calcData.metrics,
                breakdown: calcData.breakdown,
                avgTicket: calcData.avgTicket,
                totalDeals: calcData.totalDeals,
                explanation: calcData.explanation,
                createdAt: calcData.createdAt,
                recentDeal,
                diff,
            });

            setPreloadedMessages([
                { role: 'system', content: MOBI_PRICING_PROMPT },
                { role: 'assistant', content: text },
            ]);

            if (base.context === 'publi-calculator' && recentDeal) {
                const logLine = `[PRICING_DIFF] ${normalizedSegment}: ${justo} vs ${recentDeal.value} (${diffText})`;
                console.info(logLine);
            }
        }

        prepareContext();
        return () => {
            cancelled = true;
        };
    }, [calculationContext]);

    return {
        pricingAnalysisContext,
        preloadedMessages,
        lastPricingCalcIdRef,
        isAutoPricingRunningRef
    };
}
