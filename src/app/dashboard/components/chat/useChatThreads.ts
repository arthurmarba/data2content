import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatThread {
    _id: string;
    title: string;
    lastActivityAt: string;
    isFavorite: boolean;
}

type UseChatThreadsOptions = {
    autoLoad?: boolean;
    limit?: number;
};

export function useChatThreads(options: UseChatThreadsOptions = {}) {
    const { autoLoad = true, limit = 50 } = options;
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const loadingRef = useRef(false);
    const loadingMoreRef = useRef(false);

    const refresh = useCallback(async () => {
        if (loadingRef.current || loadingMoreRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/ai/chat/threads?limit=${limit}`);
            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    setError("Faça login para ver seu histórico.");
                } else {
                    setError("Não foi possível carregar o histórico agora.");
                }
                setThreads([]);
                setHasMore(false);
                return;
            }
            const data = await res.json().catch(() => ({}));
            const list = Array.isArray(data?.threads) ? data.threads : [];
            setThreads(list);
            setHasMore(list.length >= limit);
        } catch (err) {
            console.error("[useChatThreads] Failed to fetch threads", err);
            setError("Não foi possível carregar o histórico agora.");
            setThreads([]);
            setHasMore(false);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    // Depender apenas de limit para manter a identidade estável e evitar loops de refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [limit]);

    const loadMore = useCallback(async () => {
        if (loadingRef.current || loadingMoreRef.current || !hasMore) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        try {
            const offset = threads.length;
            const res = await fetch(`/api/ai/chat/threads?limit=${limit}&offset=${offset}`);
            if (!res.ok) return;
            const data = await res.json().catch(() => ({}));
            const incoming: ChatThread[] = Array.isArray(data?.threads) ? data.threads : [];
            if (!incoming.length) {
                setHasMore(false);
                return;
            }
            setThreads(prev => {
                const map = new Map<string, ChatThread>();
                [...prev, ...incoming].forEach(t => map.set(t._id, t));
                return Array.from(map.values());
            });
            setHasMore(incoming.length >= limit);
        } catch (err) {
            console.error("[useChatThreads] loadMore failed", err);
        } finally {
            loadingMoreRef.current = false;
            setLoadingMore(false);
        }
    }, [hasMore, limit, threads.length]);

    useEffect(() => {
        if (autoLoad) {
            refresh();
        }
    }, [autoLoad, refresh]);

    const toggleFavorite = useCallback(async (threadId: string, nextFavorite: boolean) => {
        setThreads(prev => prev.map(t => t._id === threadId ? { ...t, isFavorite: nextFavorite } : t));
        try {
            await fetch(`/api/ai/chat/threads/${threadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isFavorite: nextFavorite })
            });
        } catch (err) {
            console.error("[useChatThreads] toggleFavorite failed", err);
            refresh();
        }
    }, [refresh]);

    const renameThread = useCallback(async (threadId: string, newTitle: string) => {
        const trimmed = newTitle.trim();
        if (!trimmed) return;
        setThreads(prev => prev.map(t => t._id === threadId ? { ...t, title: trimmed } : t));
        try {
            await fetch(`/api/ai/chat/threads/${threadId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: trimmed })
            });
        } catch (err) {
            console.error("[useChatThreads] renameThread failed", err);
            refresh();
        }
    }, [refresh]);

    const deleteThread = useCallback(async (threadId: string) => {
        setThreads(prev => prev.filter(t => t._id !== threadId));
        try {
            await fetch(`/api/ai/chat/threads/${threadId}`, {
                method: "DELETE"
            });
        } catch (err) {
            console.error("[useChatThreads] deleteThread failed", err);
            refresh();
        }
    }, [refresh]);

    return {
        threads,
        loading,
        loadingMore,
        error,
        hasMore,
        refresh,
        loadMore,
        toggleFavorite,
        renameThread,
        deleteThread,
    };
}
