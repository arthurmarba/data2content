import React from 'react';
import { useRouter } from 'next/navigation';
import { Message } from './types';
import { renderFormatted, type RenderOptions } from './chatUtils';
import { FEEDBACK_REASONS, FeedbackReasonCode } from './feedbackReasons';

interface MessageBubbleProps {
    message: Message;
    onUpsellClick?: () => void;
    onConnectInstagram: () => void;
    onFeedbackStart?: () => void;
    onFeedbackEnd?: () => void;
    onFeedbackSubmitted?: (rating: 'up' | 'down', messageId?: string | null) => void;
    initialFeedback?: 'up' | 'down' | undefined;
    renderOptions?: RenderOptions;
    virtualize?: boolean;
}

export const MessageBubble = React.memo(function MessageBubble({
    message,
    onUpsellClick,
    onConnectInstagram,
    onFeedbackStart,
    onFeedbackEnd,
    onFeedbackSubmitted,
    initialFeedback,
    renderOptions,
    virtualize,
}: MessageBubbleProps) {
    const router = useRouter();
    const isUser = message.sender === 'user';
    const isAlert = Boolean(message.alertId);
    const severity = message.alertSeverity || 'info';
    const canSendFeedback = Boolean(message.messageId && message.sessionId);
    const [feedbackState, setFeedbackState] = React.useState<'none' | 'up' | 'down'>('none');
    const [isSendingFeedback, setIsSendingFeedback] = React.useState(false);
    const [showThanks, setShowThanks] = React.useState(false);
    const [feedbackError, setFeedbackError] = React.useState<string | null>(null);
    const [showReasonSelector, setShowReasonSelector] = React.useState(false);
    const [selectedReason, setSelectedReason] = React.useState<FeedbackReasonCode | null>(null);
    const [otherReasonText, setOtherReasonText] = React.useState('');
    React.useEffect(() => {
        if (initialFeedback && (initialFeedback === 'up' || initialFeedback === 'down')) {
            setFeedbackState(initialFeedback);
        }
    }, [initialFeedback]);

    const resetReason = () => {
        setShowReasonSelector(false);
        setSelectedReason(null);
        setOtherReasonText('');
    };

    const handleFeedback = async (rating: 'up' | 'down', reasonCode?: FeedbackReasonCode | null, reasonDetail?: string) => {
        if (isSendingFeedback) return;
        if (!message.messageId || !message.sessionId) {
            setFeedbackError('Não foi possível identificar esta mensagem.');
            return;
        }
        if (rating === 'down' && !reasonCode) {
            setFeedbackError('Selecione um motivo.');
            return;
        }
        if (rating === 'down' && reasonCode === 'other' && (!reasonDetail || reasonDetail.trim().length < 5)) {
            setFeedbackError('Descreva rapidamente o motivo (mín. 5 caracteres).');
            return;
        }
        setIsSendingFeedback(true);
        setFeedbackError(null);
        const safeReason = rating === 'down' ? (reasonCode || 'other') : null;
        const previousState = feedbackState;
        if (rating === 'up') {
            setFeedbackState('up'); // optimistic
            setShowThanks(true);
            window.setTimeout(() => setShowThanks(false), 1800);
            onFeedbackStart?.();
        }
        try {
            await fetch('/api/chat/feedback/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: message.messageId || null,
                    sessionId: message.sessionId || null,
                    rating,
                    reasonCode: safeReason,
                    reason: reasonDetail || undefined,
                }),
            });
            setFeedbackState(rating === 'up' ? 'up' : 'down');
            resetReason();
            onFeedbackSubmitted?.(rating === 'up' ? 'up' : 'down', message.messageId);
            onFeedbackEnd?.();
        } catch (e) {
            console.error('Falha ao enviar feedback', e);
            setFeedbackError('Não foi possível registrar, tente de novo');
            setFeedbackState(previousState);
        } finally {
            setTimeout(() => setIsSendingFeedback(false), 600); // leve cooldown para evitar clique infinito
        }
    };

    const submitDownvote = async () => {
        if (!selectedReason && !otherReasonText.trim()) {
            setShowReasonSelector(true);
            return;
        }
        const reasonCode = selectedReason || 'other';
        const detail = reasonCode === 'other' ? otherReasonText.trim() : '';
        await handleFeedback('down', reasonCode, detail);
    };

    const severityBadgeClass = (() => {
        if (severity === 'critical') return 'bg-red-100 text-red-700';
        if (severity === 'warning') return 'bg-amber-100 text-amber-700';
        if (severity === 'success') return 'bg-emerald-100 text-emerald-700';
        return 'bg-indigo-100 text-indigo-700';
    })();

    const resolvedRenderOptions = React.useMemo<RenderOptions>(() => {
        if (!renderOptions) {
            return { cacheKey: message.messageId ?? null };
        }
        return {
            ...renderOptions,
            enableDisclosure: !isUser && renderOptions.enableDisclosure !== false,
            cacheKey: message.messageId ?? null,
        };
    }, [renderOptions, isUser, message.messageId]);

    const formattedContent = React.useMemo(() => (
        renderFormatted(message.text, isUser ? 'inverse' : 'default', resolvedRenderOptions)
    ), [message.text, isUser, resolvedRenderOptions]);

    const virtualizationStyle = virtualize
        ? ({ contentVisibility: 'auto', containIntrinsicSize: '1px 240px' } as React.CSSProperties)
        : undefined;

    return (
        <li className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`} style={virtualizationStyle}>
            <div className={`flex flex-col gap-1.5 w-full ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                    className={[
                        isUser
                            ? 'max-w-[92%] sm:max-w-[75%] rounded-2xl rounded-tr-sm bg-brand-primary text-white shadow-sm px-3.5 py-2.5'
                            : 'max-w-[92%] sm:max-w-[80%] lg:max-w-[72ch] text-gray-800 px-1',
                    ].join(' ')}
                >
                    {isAlert && (
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${severityBadgeClass}`}>
                                Alerta
                            </span>
                            {message.alertTitle ? (
                                <span className="truncate text-[12px] font-semibold text-gray-600">{message.alertTitle}</span>
                            ) : null}
                        </div>
                    )}
                    <div className={isUser ? 'text-white/95' : undefined}>
                        {formattedContent}
                    </div>
                    {message.cta && (
                        <div className={`mt-3 pt-3 ${isUser ? 'border-t border-white/25' : 'border-t border-gray-200'}`}>
                            <button
                                className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors w-full sm:w-auto ${isUser
                                    ? 'bg-white text-brand-primary hover:bg-brand-magenta-soft'
                                    : 'bg-brand-primary text-white hover:bg-brand-primary-dark'
                                }`}
                                onClick={() => {
                                    if (message.cta?.action === 'connect_instagram') return onConnectInstagram();
                                    if (message.cta?.action === 'go_to_billing') {
                                        if (onUpsellClick) return onUpsellClick();
                                        return router.push('/dashboard/billing');
                                    }
                                }}
                            >
                                {message.cta.label}
                            </button>
                        </div>
                    )}
                    {!isUser && !isAlert && canSendFeedback ? (
                        <div className="mt-3 flex flex-col gap-2 text-xs text-gray-500">
                            <div className="flex items-center gap-2">
                                <span>Essa resposta ajudou?</span>
                                <button
                                    type="button"
                                    disabled={isSendingFeedback}
                                    aria-pressed={feedbackState === 'up'}
                                    onClick={() => {
                                        if (feedbackState === 'up') return; // já ativo, evita clique infinito
                                        onFeedbackStart?.();
                                        handleFeedback('up');
                                    }}
                                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full border transition-colors ${feedbackState === 'up'
                                        ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                                        : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-700'}`}
                                    aria-label="Gostei"
                                >
                                    👍
                                </button>
                                <button
                                    type="button"
                                    disabled={isSendingFeedback}
                                    onClick={() => setShowReasonSelector((prev) => {
                                        const next = !prev;
                                        if (!next) {
                                            resetReason();
                                            onFeedbackEnd?.();
                                        } else {
                                            onFeedbackStart?.();
                                        }
                                        return next;
                                    })}
                                    className={`inline-flex items-center justify-center h-7 w-7 rounded-full border transition-colors ${feedbackState === 'down'
                                        ? 'bg-red-100 border-red-200 text-red-700'
                                        : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-700'}`}
                                    aria-label="Não gostei"
                                >
                                    👎
                                </button>
                                {showThanks && feedbackState === 'up' ? (
                                    <span className="text-[11px] font-semibold text-emerald-600">Valeu!</span>
                                ) : null}
                                {feedbackError ? (
                                    <span className="text-[11px] font-semibold text-rose-600">{feedbackError}</span>
                                ) : null}
                            </div>
                            {showReasonSelector ? (
                                <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                                    <p className="mb-2 text-[11px] font-semibold text-gray-700">Por que não ajudou?</p>
                                    <div className="flex flex-wrap gap-2">
                                        {FEEDBACK_REASONS.map((opt) => (
                                            <button
                                                key={opt.code}
                                                type="button"
                                                onClick={() => setSelectedReason(opt.code)}
                                                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${selectedReason === opt.code
                                                    ? 'border-red-200 bg-red-50 text-red-700'
                                                    : 'border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-700'}`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedReason === 'other' ? (
                                        <textarea
                                            className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1 text-[12px] text-gray-700 focus:border-red-300 focus:outline-none"
                                            placeholder="Conte rapidamente o que houve"
                                            value={otherReasonText}
                                            onChange={(e) => setOtherReasonText(e.target.value)}
                                            rows={2}
                                        />
                                    ) : null}
                                    {selectedReason && selectedReason !== 'other' ? (
                                        <textarea
                                            className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1 text-[12px] text-gray-700 focus:border-red-300 focus:outline-none"
                                            placeholder="Quer explicar rapidinho? (opcional)"
                                            value={otherReasonText}
                                            onChange={(e) => setOtherReasonText(e.target.value)}
                                            rows={2}
                                        />
                                    ) : null}
                                    <div className="mt-2 flex justify-end gap-2">
                                        <button
                                            type="button"
                                            className="text-[11px] font-semibold text-gray-500"
                                            onClick={() => {
                                                resetReason();
                                                onFeedbackEnd?.();
                                            }}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isSendingFeedback}
                                            onClick={submitDownvote}
                                            className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                                        >
                                            {isSendingFeedback ? 'Enviando...' : 'Enviar'}
                                        </button>
                                    </div>
                                    {feedbackError ? (
                                        <p className="mt-1 text-[11px] font-semibold text-rose-600">{feedbackError}</p>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
                <span className="text-[11px] text-gray-400 px-1">
                    {isUser ? 'Você' : 'Mobi IA'}
                </span>
            </div>
        </li>
    );
});
