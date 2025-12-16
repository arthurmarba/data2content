import React from 'react';
import { AdminCreatorSurveyAnalytics } from '@/types/admin/creatorSurvey';

interface QuickInsightsProps {
    analytics: AdminCreatorSurveyAnalytics | null;
    isLoading: boolean;
}

const SkeletonBlock = ({ height = 'h-4', width = 'w-full' }: { height?: string; width?: string }) => (
    <div className={`bg-gray-100 animate-pulse rounded ${height} ${width}`} />
);

export default function QuickInsights({ analytics, isLoading }: QuickInsightsProps) {
    if (isLoading) {
        return <SkeletonBlock height="h-20" />;
    }
    if (!analytics) return null;

    const insights: string[] = [];
    if (analytics.monetizationComparison?.nonMonetizing?.count && analytics.monetizationComparison.monetizing?.avgEngagement != null) {
        insights.push(`${analytics.monetizationComparison.nonMonetizing.count} criadores com monetização baixa → priorizar orientação comercial`);
    }
    if (analytics.metrics?.avgGrowth != null) {
        insights.push(`Crescimento médio ${analytics.metrics.avgGrowth.toFixed(2)}% → ativar estratégia de descoberta`);
    }
    if (analytics.topPain?.value) {
        insights.push(`Dor nº1 = ${analytics.topPain.value} → iniciar rotina semanal de leitura de dados`);
    }
    if (insights.length === 0 && analytics.metrics?.avgEngagement != null) {
        insights.push(`Engajamento médio ${analytics.metrics.avgEngagement.toFixed(2)}% → revisar consistência de conteúdo`);
    }

    if (!insights.length) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">Insights rápidos</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                {insights.map((insight, idx) => (
                    <li key={idx}>{insight}</li>
                ))}
            </ul>
        </div>
    );
}
