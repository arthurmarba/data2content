import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaBell, FaSync, FaTimes, FaInbox, FaCheckCircle, FaComments } from 'react-icons/fa';
import type { AlertItem } from './types';

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
}

const severityStyles: Record<NonNullable<AlertItem['severity']>, string> = {
    critical: 'bg-red-50 text-red-700 border border-red-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    info: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
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
}: AlertsDrawerProps) {
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
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                                    <FaBell />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Alertas</p>
                                    <p className="text-[11px] uppercase tracking-wide text-gray-400">WhatsApp + Plataforma</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                                aria-label="Fechar central de alertas"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="border-b border-gray-50 px-4 py-2 text-xs text-gray-600 flex items-start gap-2">
                            <FaComments className="mt-[2px] text-brand-primary" />
                            <div>
                                <p className="font-semibold text-gray-800">Selecione um alerta para adicioná-lo ao chat.</p>
                                <p className="text-[11px] text-gray-500">O Mobi continua a conversa a partir do alerta escolhido.</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-b border-gray-50 px-4 py-2">
                            <div className="flex gap-2">
                                {(['unread', 'all'] as AlertStatus[]).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => onStatusChange(value)}
                                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${status === value
                                            ? 'bg-brand-primary text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {value === 'unread' ? 'Não lidos' : 'Todos'}
                                        {value === 'unread' && unreadCount > 0 ? (
                                            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-white/20 px-2 text-[11px]">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={onRefresh}
                                className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                                <FaSync className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                                Atualizar
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {error ? (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error}
                                </div>
                            ) : null}

                            {loading && !alerts.length ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 4 }).map((_, idx) => (
                                        <div key={idx} className="h-16 animate-pulse rounded-xl bg-gray-100" />
                                    ))}
                                </div>
                            ) : null}

                            {!loading && alerts.length === 0 && !error ? (
                                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                                    <FaInbox className="mb-2 text-xl text-gray-400" aria-hidden />
                                    Nenhum alerta por aqui ainda.
                                </div>
                            ) : null}

                            {alerts.map((alert) => {
                                const severity = alert.severity ?? 'info';
                                const read = Boolean(alert.readAt);
                                return (
                                    <button
                                        key={alert.id}
                                        onClick={() => onSelectAlert(alert)}
                                        className={`w-full text-left rounded-2xl border px-4 py-3 transition shadow-sm ${severityStyles[severity] ?? severityStyles.info} ${read ? 'opacity-80' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                                                        {alert.channel === 'system' ? 'Plataforma' : 'WhatsApp'}
                                                    </span>
                                                    <span className="text-[11px] text-gray-400">•</span>
                                                    <span className="text-[11px] text-gray-500">{formatRelative(alert.createdAt)}</span>
                                                    {!read ? (
                                                        <span className="inline-flex items-center rounded-full bg-white text-[11px] font-semibold text-brand-primary px-2 py-0.5 border border-brand-primary/30">
                                                            Novo
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                                                <p className="text-xs text-gray-700 line-clamp-3 whitespace-pre-line">{alert.body}</p>
                                                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600">
                                                    <FaComments className="text-[10px]" />
                                                    Clique para abrir no chat
                                                </span>
                                            </div>
                                            {read ? (
                                                <span className="flex items-center gap-1 rounded-full bg-white/60 px-2 py-1 text-[11px] font-semibold text-gray-600">
                                                    <FaCheckCircle className="text-emerald-500" /> Lido
                                                </span>
                                            ) : null}
                                        </div>
                                    </button>
                                );
                            })}

                            {hasNext && (
                                <div className="flex justify-center">
                                    <button
                                        type="button"
                                        onClick={onLoadMore}
                                        className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        disabled={loading}
                                    >
                                        Carregar mais
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
