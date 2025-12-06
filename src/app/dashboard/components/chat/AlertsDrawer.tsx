import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaBell, FaSync, FaTimes, FaInbox, FaStar, FaRegStar, FaPen, FaTrash, FaCheck } from 'react-icons/fa';
import type { AlertItem } from './types';
import type { ChatThread } from './useChatThreads';

type AlertStatus = 'unread' | 'all';

interface AlertsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    alerts: AlertItem[];
    status: AlertStatus;
    onStatusChange: (status: AlertStatus) => void;
    loading: boolean;
    error: string | null;
    unreadCount: number;
    hasNext: boolean;
    onRefresh: () => void;
    onLoadMore: () => void;
    onSelectAlert: (alert: AlertItem) => void;
    // Histórico
    threads: ChatThread[];
    threadsLoading: boolean;
    threadsLoadingMore: boolean;
    threadsError: string | null;
    threadsHasMore: boolean;
    onRefreshThreads: () => void;
    onLoadMoreThreads: () => void;
    onSelectThread: (threadId: string) => void;
    onNewChat: () => void;
    onToggleFavorite: (threadId: string, nextFavorite: boolean) => void;
    onDeleteThread: (threadId: string) => void;
    onRenameThread: (threadId: string, title: string) => void;
    selectedThreadId?: string | null;
}

const severityStyles: Record<NonNullable<AlertItem['severity']>, string> = {
    critical: 'border-l-4 border-red-400 bg-white',
    warning: 'border-l-4 border-amber-400 bg-white',
    success: 'border-l-4 border-emerald-400 bg-white',
    info: 'border-l-4 border-indigo-300 bg-white',
};

function formatRelative(dateString: string) {
    const date = new Date(dateString);
    if (Number.isNaN(date.valueOf())) return '';
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function AlertsDrawer({
    isOpen,
    onClose,
    alerts,
    status,
    onStatusChange,
    loading,
    error,
    unreadCount,
    hasNext,
    onRefresh,
    onLoadMore,
    onSelectAlert,
    threads,
    threadsLoading,
    threadsLoadingMore,
    threadsError,
    threadsHasMore,
    onRefreshThreads,
    onLoadMoreThreads,
    onSelectThread,
    onNewChat,
    onToggleFavorite,
    onDeleteThread,
    onRenameThread,
    selectedThreadId,
}: AlertsDrawerProps) {
    const [filter, setFilter] = useState<'all' | 'alerts' | 'history'>('all');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            setFilter('all');
        } else {
            setEditingId(null);
            setDeleteConfirmId(null);
        }
    }, [isOpen]);

    const filteredAlerts = useMemo(() => {
        if (status === 'all') return alerts;
        return alerts.filter((a) => !a.readAt);
    }, [alerts, status]);

    const combinedItems = useMemo(() => {
        const alertItems = filteredAlerts.map((alert) => ({
            kind: 'alert' as const,
            id: alert.id,
            title: alert.title,
            body: alert.body,
            date: alert.createdAt,
            unread: !alert.readAt,
            severity: alert.severity ?? 'info',
            alert,
        }));
        const threadItems = threads.map((thread) => ({
            kind: 'thread' as const,
            id: thread._id,
            title: thread.title,
            date: thread.lastActivityAt,
            isFavorite: thread.isFavorite,
            thread,
        }));

        let items: typeof alertItems | typeof threadItems | any[] = [];
        if (filter === 'alerts') {
            items = alertItems;
        } else if (filter === 'history') {
            items = threadItems;
        } else {
            items = [...alertItems, ...threadItems];
        }

        return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [filteredAlerts, threads, filter]);

    const startEditing = (thread: ChatThread) => {
        setEditingId(thread._id);
        setEditTitle(thread.title);
        setDeleteConfirmId(null);
    };

    const saveTitle = () => {
        if (!editingId) return;
        onRenameThread(editingId, editTitle);
        setEditingId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditTitle('');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-transparent"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                        className="fixed right-0 top-0 bottom-0 z-[130] w-full max-w-md bg-white shadow-2xl border-l border-gray-100 flex flex-col"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Central de alertas"
                    >
                        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                                    <FaBell size={14} />
                                </span>
                                <p className="text-sm font-semibold text-gray-900">Conversas</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                                aria-label="Fechar"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="border-b border-gray-50 px-4 py-2 flex flex-col gap-2">
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setFilter('all')}
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${filter === 'all'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Todos
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilter('history')}
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${filter === 'history'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Histórico
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilter('alerts')}
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${filter === 'alerts'
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Alertas
                                    {unreadCount > 0 ? (
                                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-gray-800 px-2 text-[11px] font-bold text-white">
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </span>
                                    ) : null}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap justify-between">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onRefreshThreads();
                                        onRefresh();
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-100"
                                >
                                    <FaSync className={`h-3 w-3 ${(loading || threadsLoading || threadsLoadingMore) ? 'animate-spin' : ''}`} />
                                    Atualizar
                                </button>
                                <button
                                    type="button"
                                    onClick={onNewChat}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                                >
                                    Nova conversa
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                            {(error || threadsError) ? (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error || threadsError}
                                </div>
                            ) : null}

                            {(loading || threadsLoading) && !combinedItems.length ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={idx} className="h-16 animate-pulse rounded-xl bg-gray-100" />
                                    ))}
                                </div>
                            ) : null}

                            {!loading && !threadsLoading && combinedItems.length === 0 && !(error || threadsError) ? (
                                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                                    <FaInbox className="mb-2 text-xl text-gray-400" aria-hidden />
                                    Nada por aqui ainda. Envie uma mensagem ou veja alertas.
                                </div>
                            ) : null}

                            {combinedItems.map((item) => {
                                if (item.kind === 'thread') {
                                    const thread = item.thread as ChatThread;
                                    return (
                                        <div
                                            key={thread._id}
                                            className={`group relative w-full rounded-xl border border-gray-200 px-3 py-3 transition ${selectedThreadId === thread._id
                                                ? 'bg-gray-50'
                                                : 'bg-white hover:bg-gray-50'
                                                }`}
                                        >
                                            {editingId === thread._id ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                                                        value={editTitle}
                                                        onChange={(e) => setEditTitle(e.target.value)}
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveTitle();
                                                            if (e.key === 'Escape') cancelEdit();
                                                        }}
                                                    />
                                                    <button onClick={saveTitle} className="p-1 text-green-600 hover:bg-green-100 rounded"><FaCheck size={12} /></button>
                                                    <button onClick={cancelEdit} className="p-1 text-red-500 hover:bg-red-100 rounded"><FaTimes size={12} /></button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        onSelectThread(thread._id);
                                                        onClose();
                                                    }}
                                                    className="flex w-full flex-col items-start text-left"
                                                >
                                                    <div className="flex items-center gap-2 w-full">
                                                        <span className="text-[11px] uppercase tracking-wide text-gray-500">Histórico</span>
                                                        <span className="flex-1 truncate text-sm font-semibold text-gray-900">{thread.title}</span>
                                                        <span className="text-[11px] text-gray-500">{formatRelative(thread.lastActivityAt)}</span>
                                                    </div>
                                                    <p className="mt-1 text-[12px] text-gray-500">Clique para retomar a conversa</p>
                                                </button>
                                            )}

                                            {!editingId && (
                                                <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full px-1 shadow-sm ring-1 ring-gray-200">
                                                    <button
                                                        onClick={() => onToggleFavorite(thread._id, !thread.isFavorite)}
                                                        className={`p-1.5 rounded hover:bg-black/5 ${thread.isFavorite ? 'text-amber-400' : 'text-gray-400 hover:text-amber-400'}`}
                                                        title="Favoritar"
                                                    >
                                                        {thread.isFavorite ? <FaStar size={12} /> : <FaRegStar size={12} />}
                                                    </button>
                                                    <button
                                                        onClick={() => startEditing(thread)}
                                                        className="p-1.5 rounded hover:bg-black/5 text-gray-400 hover:text-blue-600"
                                                        title="Renomear"
                                                    >
                                                        <FaPen size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (deleteConfirmId !== thread._id) {
                                                                setDeleteConfirmId(thread._id);
                                                                setTimeout(() => setDeleteConfirmId(null), 3000);
                                                                return;
                                                            }
                                                            onDeleteThread(thread._id);
                                                            if (selectedThreadId === thread._id) {
                                                                onNewChat();
                                                            }
                                                            setDeleteConfirmId(null);
                                                        }}
                                                        className={`p-1.5 rounded hover:bg-black/5 ${deleteConfirmId === thread._id ? 'text-red-600 bg-red-50' : 'text-gray-400 hover:text-red-600'}`}
                                                        title="Excluir"
                                                    >
                                                        {deleteConfirmId === thread._id ? <span className="text-[10px] font-bold">Confirmar?</span> : <FaTrash size={12} />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                const alert = (item as any).alert as AlertItem;
                                const severity = alert.severity ?? 'info';
                                const read = Boolean(alert.readAt);
                                return (
                                    <button
                                        key={alert.id}
                                        onClick={() => onSelectAlert(alert)}
                                        className={`w-full text-left rounded-xl border px-3 py-3 transition ${severityStyles[severity] ?? severityStyles.info} ${read ? 'opacity-80' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] uppercase tracking-wide text-gray-500">Alerta</span>
                                                    <span className="text-[11px] text-gray-500">{formatRelative(alert.createdAt)}</span>
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                                                <p className="text-xs text-gray-700 line-clamp-3 whitespace-pre-line">{alert.body}</p>
                                                <span className="mt-1 text-[11px] font-medium text-gray-500">
                                                    Clique para abrir no chat
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {(hasNext && (filter === 'alerts' || filter === 'all')) || (threadsHasMore && (filter === 'history' || filter === 'all')) ? (
                                <div className="flex justify-center gap-2">
                                    {(filter === 'alerts' || filter === 'all') && hasNext ? (
                                        <button
                                            type="button"
                                            onClick={onLoadMore}
                                            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                            disabled={loading}
                                        >
                                            Carregar mais alertas
                                        </button>
                                    ) : null}
                                    {(filter === 'history' || filter === 'all') && threadsHasMore ? (
                                        <button
                                            type="button"
                                            onClick={onLoadMoreThreads}
                                            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                            disabled={threadsLoadingMore}
                                        >
                                            Carregar mais conversas
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
