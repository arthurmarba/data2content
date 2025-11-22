import { useCallback, useRef, useState } from 'react';
import type { AlertItem } from '../components/chat/types';

type AlertStatus = 'unread' | 'all';

type FetchState = {
    loading: boolean;
    error: string | null;
};

const DEFAULT_LIMIT = 20;

export function useAlerts() {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const [status, setStatus] = useState<AlertStatus>('unread');
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [fetchState, setFetchState] = useState<FetchState>({ loading: false, error: null });

    const hasLoadedOnceRef = useRef(false);

    const fetchAlerts = useCallback(
        async ({
            reset = false,
            cursor,
            statusOverride,
        }: { reset?: boolean; cursor?: string | null; statusOverride?: AlertStatus } = {}) => {
            if (fetchState.loading) return;
            setFetchState((prev) => ({ ...prev, loading: true, error: null }));

            const params = new URLSearchParams();
            const statusToUse = statusOverride || status;
            params.set('status', statusToUse);
            params.set('limit', String(DEFAULT_LIMIT));
            if (cursor) params.set('cursor', cursor);

            try {
                const res = await fetch(`/api/alerts?${params.toString()}`, { credentials: 'include' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data?.error || 'Não foi possível carregar os alertas.');
                }

                const items = Array.isArray(data?.data) ? data.data as AlertItem[] : [];
                setAlerts((prev) => (reset ? items : [...prev, ...items]));
                setHasNext(Boolean(data?.pageInfo?.hasNext));
                setNextCursor(data?.pageInfo?.nextCursor ?? null);
                if (typeof data?.pageInfo?.unreadCount === 'number') {
                    setUnreadCount(data.pageInfo.unreadCount);
                }
                hasLoadedOnceRef.current = true;
            } catch (error: any) {
                setFetchState({ loading: false, error: error?.message || 'Falha ao carregar alertas.' });
                return;
            }

            setFetchState({ loading: false, error: null });
        },
        [fetchState.loading, status]
    );

    const refresh = useCallback(
        async (nextStatus?: AlertStatus) => {
            const statusToUse = nextStatus || status;
            if (nextStatus && nextStatus !== status) {
                setStatus(nextStatus);
            }
            await fetchAlerts({ reset: true, cursor: null, statusOverride: statusToUse });
        },
        [fetchAlerts, status]
    );

    const ensureLoaded = useCallback(async () => {
        if (hasLoadedOnceRef.current) return;
        await fetchAlerts({ reset: true });
    }, [fetchAlerts]);

    const loadMore = useCallback(async () => {
        if (!hasNext || !nextCursor) return;
        await fetchAlerts({ cursor: nextCursor });
    }, [fetchAlerts, hasNext, nextCursor]);

    const markAsRead = useCallback(async (id: string) => {
        let reverted = false;
        const nowIso = new Date().toISOString();
        const target = alerts.find((alert) => alert.id === id);
        const wasUnread = !target?.readAt;

        setAlerts((prev) =>
            prev.map((alert) => (alert.id === id ? { ...alert, readAt: alert.readAt ?? nowIso } : alert))
        );
        if (wasUnread) {
            setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
        }

        try {
            const res = await fetch(`/api/alerts/${id}/mark-read`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || 'Falha ao marcar alerta como lido.');
            }
        } catch (error) {
            reverted = true;
            setAlerts((prev) =>
                prev.map((alert) => {
                    if (alert.id !== id) return alert;
                    if (target?.readAt) return { ...alert, readAt: target.readAt };
                    return { ...alert, readAt: null };
                })
            );
            if (wasUnread) {
                setUnreadCount((prev) => prev + 1);
            }
            setFetchState((state) => ({ ...state, error: error instanceof Error ? error.message : 'Erro ao atualizar alerta.' }));
        }

        return !reverted;
    }, [alerts]);

    const refreshUnreadCount = useCallback(async () => {
        try {
            const res = await fetch('/api/alerts/unread-count', { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || 'Falha ao carregar contagem.');
            if (typeof data?.unreadCount === 'number') {
                setUnreadCount(data.unreadCount);
            }
        } catch (error) {
            // Mantém contagem atual; não interrompe fluxo.
        }
    }, []);

    return {
        alerts,
        status,
        setStatus,
        unreadCount,
        hasNext,
        fetchState,
        ensureLoaded,
        refresh,
        loadMore,
        markAsRead,
        refreshUnreadCount,
    };
}
