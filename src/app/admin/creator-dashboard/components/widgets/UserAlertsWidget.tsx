"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Info, Zap, ChevronDown, ChevronUp } from 'lucide-react'; // Usando lucide-react para ícones

// Tipos espelhando a resposta da API
enum AlertTypeEnum {
  FOLLOWER_STAGNATION = "FollowerStagnation",
  FORGOTTEN_FORMAT = "ForgottenFormat",
  CONTENT_PERFORMANCE_DROP = "ContentPerformanceDrop",
}

interface AlertResponseItem {
  alertId: string;
  type: AlertTypeEnum | string; // string para flexibilidade se novos tipos surgirem
  date: string; // YYYY-MM-DD
  title: string;
  summary: string;
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
}

const AlertIcon: React.FC<{type: AlertTypeEnum | string}> = ({ type }) => {
    switch(type) {
        case AlertTypeEnum.FOLLOWER_STAGNATION:
            return <AlertTriangle className="text-yellow-500 mr-3 flex-shrink-0" size={20} />;
        case AlertTypeEnum.FORGOTTEN_FORMAT:
            return <Info className="text-blue-500 mr-3 flex-shrink-0" size={20} />;
        case AlertTypeEnum.CONTENT_PERFORMANCE_DROP:
            return <Zap className="text-red-500 mr-3 flex-shrink-0" size={20} />;
        default:
            return <Info className="text-gray-500 mr-3 flex-shrink-0" size={20} />;
    }
};

const UserAlertsWidget: React.FC<UserAlertsWidgetProps> = ({
  userId,
  initialLimit = 3, // Mostrar 3 alertas inicialmente
}) => {
  const [alertsResponse, setAlertsResponse] = useState<UserAlertsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(initialLimit);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    if (!userId) {
      setAlertsResponse(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/v1/users/${userId}/alerts/active?limit=${limit}`;
      // Adicionar filtros de tipo se necessário no futuro: &types=Type1&types=Type2
      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Erro HTTP: ${response.status} - ${errorData.error || response.statusText}`);
      }
      const result: UserAlertsResponse = await response.json();
      setAlertsResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.');
      setAlertsResponse(null);
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => {
    if (userId) {
      fetchData();
    } else {
      setAlertsResponse(null);
      setLoading(false);
    }
  }, [userId, fetchData]); // fetchData já tem limit como dependência

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
      setLimit(prevLimit => prevLimit + 3); // Mostrar mais 3 alertas
  }

  if (!userId) {
    // Não renderizar nada ou uma mensagem placeholder se o widget for sempre visível
    // return <div className="text-center p-4 text-gray-500">Selecione um criador para ver os alertas.</div>;
    return null; // Ou um placeholder mais discreto se estiver dentro de um modal
  }

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow-md mt-6">
      <h2 className="text-lg md:text-xl font-semibold mb-1 text-gray-700">Alertas Recentes do Criador</h2>
      {alertsResponse?.insightSummary && (
        <p className="text-xs text-gray-500 mb-4">{alertsResponse.insightSummary}</p>
      )}

      {loading && <div className="flex justify-center items-center py-4"><p className="text-gray-500">Carregando alertas...</p></div>}
      {error && <div className="flex justify-center items-center py-4"><p className="text-red-500">Erro: {error}</p></div>}

      {!loading && !error && alertsResponse && alertsResponse.alerts.length > 0 && (
        <ul className="space-y-3">
          {alertsResponse.alerts.map((alert) => (
            <li key={alert.alertId} className="border border-gray-200 rounded-md">
              <button
                onClick={() => toggleAlertExpansion(alert.alertId)}
                className="w-full p-3 text-left focus:outline-none hover:bg-gray-50 transition-colors duration-150"
              >
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <AlertIcon type={alert.type} />
                        <div>
                            <h4 className="font-medium text-sm text-gray-800">{alert.title}</h4>
                            <p className="text-xs text-gray-500">{new Date(alert.date + "T00:00:00Z").toLocaleDateString()}</p> {/* Ajusta para data local */}
                        </div>
                    </div>
                    {expandedAlerts.has(alert.alertId) ? <ChevronUp size={18} className="text-gray-500"/> : <ChevronDown size={18} className="text-gray-500"/>}
                </div>
                {!expandedAlerts.has(alert.alertId) && (
                     <p className="text-xs text-gray-600 mt-1 ml-8 truncate">{alert.summary}</p>
                )}
              </button>
              {expandedAlerts.has(alert.alertId) && (
                <div className="p-3 border-t border-gray-200 bg-gray-50">
                  <p className="text-sm text-gray-700 mb-2">{alert.summary}</p>
                  <div className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-300">
                    <pre className="whitespace-pre-wrap break-all">{JSON.stringify(alert.details, null, 2)}</pre>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && alertsResponse && alertsResponse.alerts.length === 0 && (
        <div className="flex justify-center items-center py-4"><p className="text-gray-500">Nenhum alerta recente para este criador.</p></div>
      )}

      {!loading && !error && alertsResponse && alertsResponse.totalAlerts > alertsResponse.alerts.length && (
        <div className="mt-4 text-center">
            <button
                onClick={showMoreAlerts}
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
                Mostrar Mais ({alertsResponse.totalAlerts - alertsResponse.alerts.length} restantes)
            </button>
        </div>
      )}
    </div>
  );
};

export default UserAlertsWidget;
```
