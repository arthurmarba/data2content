"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Info, Zap, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { LightBulbIcon, BellAlertIcon } from '@heroicons/react/24/outline';
import { useGlobalTimePeriod } from '../filters/GlobalTimePeriodContext';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';

// Tipos espelhando a resposta da API
enum AlertTypeEnum {
  FOLLOWER_STAGNATION = "FollowerStagnation",
  FORGOTTEN_FORMAT = "ForgottenFormat",
  CONTENT_PERFORMANCE_DROP = "ContentPerformanceDrop",
  NO_EVENT_FOUND_TODAY_WITH_INSIGHT = "no_event_found_today_with_insight",
}

interface AlertResponseItem {
  alertId: string;
  type: AlertTypeEnum | string;
  date: string; // YYYY-MM-DD
  title: string;
  finalUserMessage: string;
  details: any;
}

interface UserAlertsResponse {
  alerts: AlertResponseItem[];
  totalAlerts: number;
  insightSummary?: string;
}

interface UserAlertsWidgetProps {
  userId: string | null;
  initialLimit?: number;
  dataOverride?: UserAlertsResponse | null;
  dataOverrideFilters?: { timePeriod: string; limit: number; userId?: string | null };
  loadingOverride?: boolean;
  errorOverride?: string | null;
  disableFetch?: boolean;
}

const getAlertStyle = (type: AlertTypeEnum | string) => {
  switch (type) {
    case AlertTypeEnum.FOLLOWER_STAGNATION:
      return {
        icon: <AlertTriangle className="text-amber-500" size={20} />,
        borderClass: "border-l-amber-500",
        bgClass: "bg-amber-50",
        textClass: "text-amber-900"
      };
    case AlertTypeEnum.FORGOTTEN_FORMAT:
      return {
        icon: <Info className="text-blue-500" size={20} />,
        borderClass: "border-l-blue-500",
        bgClass: "bg-blue-50",
        textClass: "text-blue-900"
      };
    case AlertTypeEnum.CONTENT_PERFORMANCE_DROP:
      return {
        icon: <Zap className="text-red-500" size={20} />,
        borderClass: "border-l-red-500",
        bgClass: "bg-red-50",
        textClass: "text-red-900"
      };
    default:
      return {
        icon: <CheckCircle className="text-gray-500" size={20} />,
        borderClass: "border-l-gray-400",
        bgClass: "bg-gray-50",
        textClass: "text-gray-900"
      };
  }
};

const formatDetailKey = (key: string) => {
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .replace(/_/g, ' '); // Replace underscores with spaces
};

const renderDetails = (details: any) => {
  if (!details || typeof details !== 'object') return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
      {Object.entries(details).map(([key, value]) => {
        if (value === null || value === undefined || typeof value === 'object') return null;
        return (
          <div key={key} className="flex justify-between border-b border-gray-100 pb-1 last:border-0">
            <span className="text-gray-500 font-medium">{formatDetailKey(key)}:</span>
            <span className="text-gray-800 font-semibold text-right">{String(value)}</span>
          </div>
        );
      })}
    </div>
  );
};

const UserAlertsWidget: React.FC<UserAlertsWidgetProps> = ({
  userId,
  initialLimit = 3,
  dataOverride,
  dataOverrideFilters,
  loadingOverride,
  errorOverride,
  disableFetch = false,
}) => {
  const [alertsResponse, setAlertsResponse] = useState<UserAlertsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [hideNoEventAlerts, setHideNoEventAlerts] = useState<boolean>(false);
  const { timePeriod: globalTimePeriod } = useGlobalTimePeriod();
  const overrideMatches = Boolean(
    dataOverride
    && (!dataOverrideFilters
      || ((dataOverrideFilters.timePeriod || '') === globalTimePeriod
        && (dataOverrideFilters.limit ?? initialLimit) === limit
        && (dataOverrideFilters.userId || null) === (userId || null)))
  );
  const shouldBlockFetch = Boolean(loadingOverride) && !overrideMatches;
  const shouldFetch = !disableFetch && !overrideMatches && !shouldBlockFetch;

  const filterAlerts = useCallback((response: UserAlertsResponse | null) => {
    if (!response) return null;
    const today = new Date();
    const startDate = getStartDateFromTimePeriod(today, globalTimePeriod);
    const filteredAlerts = response.alerts.filter(a => {
      const dt = new Date(a.date + 'T00:00:00Z');
      return dt >= startDate && dt <= today;
    });
    return { ...response, alerts: filteredAlerts };
  }, [globalTimePeriod]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setAlertsResponse(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/alerts/active?limit=${limit}&dedupeNoEventAlerts=true&timePeriod=${globalTimePeriod}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserAlertsResponse = await response.json();
      const filtered = filterAlerts(result);
      setAlertsResponse(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setAlertsResponse(null);
    } finally {
      setLoading(false);
    }
  }, [userId, limit, globalTimePeriod, filterAlerts]);

  useEffect(() => {
    if (!userId) {
      setAlertsResponse(null);
      setLoading(false);
      return;
    }
    if (shouldFetch) {
      fetchData();
    }
  }, [userId, fetchData, shouldFetch]);

  const toggleAlertExpansion = (alertId: string) => {
    setExpandedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const showMoreAlerts = () => {
    setLimit(prevLimit => prevLimit + 3);
  }

  const resolvedAlertsResponse = overrideMatches ? filterAlerts(dataOverride ?? null) : alertsResponse;
  const resolvedLoading = shouldBlockFetch ? true : (overrideMatches ? (loadingOverride ?? false) : loading);
  const resolvedError = shouldBlockFetch ? (errorOverride ?? null) : (overrideMatches ? (errorOverride ?? null) : error);

  if (!userId) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BellAlertIcon className="h-5 w-5 text-slate-500" />
          <h3 className="text-base font-semibold text-slate-900">
            Alertas Recentes
          </h3>
        </div>{resolvedAlertsResponse && resolvedAlertsResponse.alerts.length > 0 && (
          <label className="text-xs text-gray-500 flex items-center space-x-1 cursor-pointer hover:text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={hideNoEventAlerts}
              onChange={(e) => setHideNoEventAlerts(e.target.checked)}
            />
            <span>Ocultar vazios</span>
          </label>
        )}
      </div>

      {resolvedAlertsResponse?.insightSummary && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-md p-3 mb-4 flex items-start gap-2">
          <LightBulbIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800">{resolvedAlertsResponse.insightSummary}</p>
        </div>
      )}

      {resolvedLoading && <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}
      {resolvedError && <div className="text-center py-4 text-red-500 text-sm">Erro: {resolvedError}</div>}

      {!resolvedLoading && !resolvedError && resolvedAlertsResponse && resolvedAlertsResponse.alerts.length > 0 && (
        <div className="space-y-3">
          {resolvedAlertsResponse.alerts
            .filter(alert => !hideNoEventAlerts || alert.type !== AlertTypeEnum.NO_EVENT_FOUND_TODAY_WITH_INSIGHT)
            .map((alert) => {
              const style = getAlertStyle(alert.type);
              const isExpanded = expandedAlerts.has(alert.alertId);

              return (
                <div
                  key={alert.alertId}
                  className={`border border-gray-200 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${style.borderClass} border-l-4`}
                >
                  <button
                    onClick={() => toggleAlertExpansion(alert.alertId)}
                    className="w-full p-4 text-left focus:outline-none bg-white flex items-start gap-3"
                  >
                    <div className="mt-0.5">{style.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold text-gray-900 text-sm">{alert.title}</h4>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                          {new Date(alert.date + "T00:00:00Z").toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className={`text-sm text-gray-600 mt-1 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                        {alert.finalUserMessage}
                      </p>
                    </div>
                    <div className="ml-2 text-gray-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 bg-white">
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <h5 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Detalhes Técnicos</h5>
                        <div className="bg-gray-50 rounded-md p-3">
                          {renderDetails(alert.details)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      )}

      {!resolvedLoading && !resolvedError && resolvedAlertsResponse && resolvedAlertsResponse.alerts.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p className="text-sm text-gray-500">Nenhum alerta recente encontrado.</p>
        </div>
      )}

      {!resolvedLoading && !resolvedError && resolvedAlertsResponse && resolvedAlertsResponse.totalAlerts > resolvedAlertsResponse.alerts.length && (
        <div className="mt-4 text-center">
          <button
            onClick={showMoreAlerts}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
          >
            Carregar mais alertas ({resolvedAlertsResponse.totalAlerts - resolvedAlertsResponse.alerts.length} restantes)
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(UserAlertsWidget);
