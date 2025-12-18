import React from 'react';
import { useRouter } from 'next/navigation';
import { Message } from './types';
import { normalizePlanningMarkdown, normalizePlanningMarkdownWithStats, renderFormatted, type RenderOptions, normalizeLooseBoldLabels } from './chatUtils';
import { CommunityInspirationMessage, parseCommunityInspirationText } from './CommunityInspirationMessage';
import { FEEDBACK_REASONS, FeedbackReasonCode } from './feedbackReasons';
import { track } from '@/lib/track';
import { chatNormalizationAppliedSchema } from '@/lib/analytics/chatSchemas';
import { AnswerEvidencePanel } from './AnswerEvidencePanel';

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
    onEvidenceAction?: (prompt: string) => void;
}

const MAX_MESSAGE_CHARS = 30000;
const NORMALIZATION_SAMPLE_RATE_OTHER = 0.25;

const hashString = (value: string) => {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash >>> 0;
};

const shouldSampleNormalization = (
    messageType: 'content_plan' | 'community_inspiration' | 'other',
    sessionId?: string | null,
    messageId?: string | null
) => {
    if (messageType === 'content_plan' || messageType === 'community_inspiration') return true;
    if (!sessionId) return Math.random() < NORMALIZATION_SAMPLE_RATE_OTHER;
    const seed = `${sessionId}:${messageId ?? ''}`;
    const bucket = hashString(seed) % 1000;
    return bucket / 1000 < NORMALIZATION_SAMPLE_RATE_OTHER;
};

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
    onEvidenceAction,
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
    const [isExpanded, setIsExpanded] = React.useState(false);
    const normalizationTrackedRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (initialFeedback && (initialFeedback === 'up' || initialFeedback === 'down')) {
            setFeedbackState(initialFeedback);
        }
    }, [initialFeedback]);

    React.useEffect(() => {
        setIsExpanded(false);
    }, [message.messageId, message.text]);

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

    const clampMessage = (value: string) => {
        const slice = value.slice(0, MAX_MESSAGE_CHARS);
        const lastBreak = slice.lastIndexOf('\n');
        if (lastBreak > MAX_MESSAGE_CHARS * 0.6) {
            return slice.slice(0, lastBreak);
        }
        return slice;
    };

    const isTooLong = message.text.length > MAX_MESSAGE_CHARS;
    const clampedText = isTooLong ? clampMessage(message.text) : message.text;
    const displayText = isTooLong && !isExpanded ? clampedText : message.text;
    const shouldRenderMarkdown = !isTooLong || isExpanded;
    const normalizationResult = React.useMemo(
        () => normalizePlanningMarkdownWithStats(message.text),
        [message.text]
    );
    const normalizedDisplayText = React.useMemo(
        () => {
            if (!shouldRenderMarkdown) return null;
            return displayText === message.text ? normalizationResult.text : normalizePlanningMarkdown(displayText);
        },
        [displayText, message.text, normalizationResult.text, shouldRenderMarkdown]
    );

    React.useEffect(() => {
        if (isUser || isAlert) return;
        const signature = message.messageId || `${message.text.length}:${message.text.slice(0, 64)}`;
        if (normalizationTrackedRef.current === signature) return;
        const payload = {
            normalization_applied: normalizationResult.applied,
            fixes_count: normalizationResult.fixesCount,
            message_type: message.messageType || 'other',
            session_id: message.sessionId || '',
        };
        const parsed = chatNormalizationAppliedSchema.safeParse(payload);
        if (!parsed.success) return;
        normalizationTrackedRef.current = signature;
        if (!shouldSampleNormalization(parsed.data.message_type, parsed.data.session_id, message.messageId)) return;
        track('chat_normalization_applied', parsed.data);
    }, [
        isAlert,
        isUser,
        message.messageId,
        message.messageType,
        message.sessionId,
        message.text,
        normalizationResult.applied,
        normalizationResult.fixesCount,
    ]);

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

    const labelSafeText = React.useMemo(() => normalizeLooseBoldLabels(displayText), [displayText]);
    const formattedContent = React.useMemo(() => {
        if (!shouldRenderMarkdown) return null;
        return renderFormatted(labelSafeText, isUser ? 'inverse' : 'default', {
            ...resolvedRenderOptions,
            normalizedText: normalizedDisplayText ?? undefined,
        });
    }, [labelSafeText, isUser, normalizedDisplayText, resolvedRenderOptions, shouldRenderMarkdown]);

    const isHttpUrl = (url?: string | null) => !!url && /^https?:\/\//i.test(url.trim());

    const communityContent = React.useMemo(() => {
        const renderComponent = () => <CommunityInspirationMessage text={labelSafeText} theme={isUser ? 'inverse' : 'default'} />;
        // Prefer evidence topPosts for inspiration cards
        if (message.answerEvidence?.topPosts?.length) {
            const cards = message.answerEvidence.topPosts.map((p, idx) => ({
                title: p.title || p.tags?.[0] || (Array.isArray(p.format) ? p.format[0] : p.format) || `Post ${idx + 1}`,
                description: p.captionSnippet || undefined,
                highlights: [],
                link: isHttpUrl(p.permalink) ? { url: p.permalink as string, label: 'Ver post' } : undefined,
            }));
            if (cards.length) {
                return (
                    <div className="mt-2 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inspirações validadas</div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {cards.map((card, idx2) => (
                                <div key={card.title + idx2} className="rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm">
                                    <div className="font-semibold text-gray-800">{card.title}</div>
                                    {card.description ? (
                                        <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                                    ) : null}
                                    {card.link?.url ? (
                                        <a
                                            href={card.link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 inline-flex items-center text-sm font-semibold text-brand-primary hover:underline"
                                        >
                                            {card.link.label || 'Ver post'}
                                        </a>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            }
        }

        if (message.messageType === 'community_inspiration') {
            return renderComponent();
        }
        const parsed = parseCommunityInspirationText(labelSafeText);
        const cardsWithContent = parsed.cards.filter((card) => {
            const hasTitleOrDescription = Boolean(card.title?.trim() || card.description?.trim());
            const hasDetail = Boolean(card.description?.trim() || (card.highlights?.length ?? 0) > 0 || isHttpUrl(card.link?.url));
            return hasTitleOrDescription && hasDetail;
        });
        const hasValidLink = cardsWithContent.some((card) => isHttpUrl(card.link?.url));
        if ((cardsWithContent.length >= 2) || (cardsWithContent.length >= 1 && hasValidLink)) {
            return renderComponent();
        }
        return null;
    }, [displayText, isUser, message.messageType, labelSafeText, message.answerEvidence?.topPosts]);

    const virtualizationStyle = virtualize
        ? ({ contentVisibility: 'auto', containIntrinsicSize: '1px 240px' } as React.CSSProperties)
        : undefined;

    const evidence = message.answerEvidence;

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
                        {communityContent || (shouldRenderMarkdown ? formattedContent : (
                            <p className="text-[15px] leading-[1.6] whitespace-pre-wrap break-words">
                                {displayText}
                            </p>
                        ))}
                        {!isUser && evidence && evidence.intent?.includes('top') && (
                            (Array.isArray(evidence.topPosts) && evidence.topPosts.length >= 0) ||
                            (evidence.relaxApplied && evidence.relaxApplied.length)
                        ) ? (
                            <AnswerEvidencePanel
                                evidence={evidence}
                                onRelax={onEvidenceAction ? () => onEvidenceAction('Relaxe o critério e me mostre os melhores possíveis.') : undefined}
                                onImproveBase={onEvidenceAction ? () => onEvidenceAction('Como posso melhorar minha base de exemplos?') : undefined}
                            />
                        ) : null}
                    </div>
                    {isTooLong ? (
                        <div className={`mt-3 flex flex-wrap items-center gap-2 text-[11px] ${isUser ? 'text-white/80' : 'text-gray-500'}`}>
                            <button
                                type="button"
                                onClick={() => setIsExpanded((prev) => !prev)}
                                aria-expanded={isExpanded}
                                data-testid="chat-show-more"
                                className={`rounded-full border px-3 py-1 font-semibold transition-colors ${isUser
                                    ? 'border-white/40 text-white hover:bg-white/15'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800'}`}
                            >
                                {isExpanded ? 'Mostrar menos' : 'Ver mais'}
                            </button>
                            {!isExpanded ? (
                                <span>
                                    Mostrando {displayText.length.toLocaleString()} de {message.text.length.toLocaleString()} caracteres
                                </span>
                            ) : null}
                        </div>
                    ) : null}
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
