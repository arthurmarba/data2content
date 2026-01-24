"use client";

import React, { useState, useEffect, useCallback } from 'react';
import PlatformKpiCard from '../PlatformKpiCard';
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';

interface MiniChartDataPoint {
    name: string;
    value: number;
}
interface KPIComparisonData {
    currentValue: number | null;
    previousValue: number | null;
    percentageChange: number | null;
    chartData?: MiniChartDataPoint[];
}

interface UserPeriodicComparisonResponse {
    followerGrowth: KPIComparisonData;
    engagementRate: KPIComparisonData;
    totalEngagement: KPIComparisonData;
    postingFrequency: KPIComparisonData;
}

const TIME_PERIOD_TO_COMPARISON: Record<string, string> = {
    last_7_days: 'last_7d_vs_previous_7d',
    last_30_days: 'last_30d_vs_previous_30d',
    last_90_days: 'last_30d_vs_previous_30d',
    last_6_months: 'month_vs_previous',
    last_12_months: 'month_vs_previous',
    all_time: 'month_vs_previous',
};

interface UserComparativeKpiSectionProps {
    userId: string;
    dataOverride?: UserPeriodicComparisonResponse | null;
    loadingOverride?: boolean;
    errorOverride?: string | null;
    disableFetch?: boolean;
}

const UserComparativeKpiSection: React.FC<UserComparativeKpiSectionProps> = ({
    userId,
    dataOverride,
    loadingOverride,
    errorOverride,
    disableFetch = false,
}) => {
    const [data, setData] = useState<UserPeriodicComparisonResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const { timePeriod } = useGlobalTimePeriod();
    const effectiveComparisonPeriod =
        TIME_PERIOD_TO_COMPARISON[timePeriod] || 'month_vs_previous';
    const hasOverride = Boolean(disableFetch)
        || typeof dataOverride !== 'undefined'
        || typeof loadingOverride !== 'undefined'
        || typeof errorOverride !== 'undefined';
    const resolvedData = hasOverride ? (dataOverride ?? null) : data;
    const resolvedLoading = hasOverride ? (loadingOverride ?? false) : loading;
    const resolvedError = hasOverride ? (errorOverride ?? null) : error;

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        setError(null);
        try {
            const apiUrl = `/api/v1/users/${userId}/kpis/periodic-comparison?comparisonPeriod=${effectiveComparisonPeriod}`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Falha ao carregar KPIs');
            const result = await response.json();
            setData(result);
        } catch (err) {
            setError('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [userId, effectiveComparisonPeriod]);

    useEffect(() => {
        if (hasOverride || disableFetch) return;
        fetchData();
    }, [fetchData, hasOverride, disableFetch]);

    const renderCard = (
        kpiKey: keyof UserPeriodicComparisonResponse,
        title: string,
        tooltip: string
    ) => {
        const kpi = resolvedData?.[kpiKey];
        let changeString: string | null = null;
        let changeType: 'positive' | 'negative' | 'neutral' = 'neutral';

        if (kpi && kpi.percentageChange !== null) {
            const pc = kpi.percentageChange * 100;
            changeString = `${pc > 0 ? '+' : ''}${pc.toFixed(1)}%`;
            if (pc > 0.01) changeType = 'positive';
            else if (pc < -0.01) changeType = 'negative';
        }

        return (
            <PlatformKpiCard
                title={title}
                value={resolvedLoading ? null : (kpi?.currentValue ?? null)}
                isLoading={resolvedLoading}
                error={resolvedError}
                tooltip={tooltip}
                change={changeString}
                changeType={changeType}
                chartData={kpi?.chartData}
            />
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderCard('followerGrowth', 'Crescimento de Seguidores', 'Variação de seguidores no período')}
            {renderCard('engagementRate', 'Taxa de Engajamento', 'Média de engajamento por post')}
            {renderCard('totalEngagement', 'Engajamento Total', 'Soma de todas as interações')}
            {renderCard('postingFrequency', 'Frequência de Postagem', 'Média de posts por dia/semana')}
        </div>
    );
};

export default UserComparativeKpiSection;
