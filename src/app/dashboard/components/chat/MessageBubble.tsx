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
    onSendPrompt?: (prompt: string) => Promise<void> | void;
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

const isHttpUrl = (url?: string | null): url is string =>
    typeof url === 'string' && /^https?:\/\//i.test(url.trim());

const isInstagramPostUrl = (url?: string | null) => {
    if (!isHttpUrl(url)) return false;
    try {
        const parsed = new URL(url.trim());
        const host = parsed.hostname.replace(/^www\./, '');
        if (!(host.endsWith('instagram.com') || host === 'instagr.am')) return false;
        return /\/(p|reel|tv)\/[^/]+/i.test(parsed.pathname);
    } catch {
        return false;
    }
};

const humanizeToken = (value?: string | null) => {
    if (!value) return '';
    const cleaned = value.replace(/[_-]+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
};

const toneLabel = (value?: string | null) => {
    const tone = value?.toLowerCase();
    if (!tone) return '';
    const map: Record<string, string> = {
        humorous: 'Humor',
        inspirational: 'Inspiracional',
        educational: 'Educativo',
        critical: 'Crítico',
        promotional: 'Promocional',
        neutral: 'Neutro',
    };
    return map[tone] || humanizeToken(value);
};

const matchTypeLabel = (value?: string | null) => {
    const match = value?.toLowerCase();
    if (!match) return '';
    const map: Record<string, string> = {
        exact: 'Exato',
        broad_context: 'Contexto semelhante',
        proposal_only: 'Proposta semelhante',
        context_only: 'Contexto semelhante',
        unknown: 'Semelhante',
    };
    return map[match] || humanizeToken(value);
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
    onSendPrompt,
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
            return { cacheKey: message.messageId ?? null, allowSuggestedActions: !isUser };
        }
        return {
            ...renderOptions,
            enableDisclosure: !isUser && renderOptions.enableDisclosure !== false,
            allowSuggestedActions: !isUser && renderOptions.allowSuggestedActions !== false,
            cacheKey: message.messageId ?? null,
        };
    }, [renderOptions, isUser, message.messageId]);

    const labelSafeText = React.useMemo(() => normalizeLooseBoldLabels(displayText), [displayText]);
    const formattedContent = React.useMemo(() => {
        if (!shouldRenderMarkdown) return null;
        return renderFormatted(labelSafeText, isUser ? 'inverse' : 'default', {
            ...resolvedRenderOptions,
            normalizedText: normalizedDisplayText ?? undefined,
            onSendPrompt: onSendPrompt,
        });
    }, [labelSafeText, isUser, normalizedDisplayText, onSendPrompt, resolvedRenderOptions, shouldRenderMarkdown]);

    const linkAllowList = React.useMemo(() => {
        const links = new Set<string>();
        const evidence = message.answerEvidence;
        if (!evidence) return [];
        const pushLink = (url?: string | null, verified?: boolean) => {
            if (!isInstagramPostUrl(url)) return;
            if (verified === false) return;
            links.add(url!.trim());
        };
        evidence.topPosts?.forEach((post) => {
            if (post?.source && post.source !== 'user') return;
            pushLink(post.permalink, post.linkVerified);
        });
        evidence.communityInspirations?.forEach((insp) => {
            pushLink(insp.permalink, insp.linkVerified);
        });
        return Array.from(links);
    }, [message.answerEvidence]);

    const communityOverrideCards = React.useMemo(() => {
        const inspirations = (message.answerEvidence?.communityInspirations || []).filter((insp) => insp.source === 'community');
        if (!inspirations.length) return [];
        return inspirations.map((insp, idx) => {
            const hasLink = isInstagramPostUrl(insp.permalink) && (insp.linkVerified ?? true);
            const metaTags = [
                insp.proposal,
                insp.context,
                insp.tone ? `Tom: ${toneLabel(insp.tone)}` : null,
                insp.reference ? `Ref: ${humanizeToken(insp.reference)}` : null,
                insp.primaryObjective ? `Objetivo: ${humanizeToken(insp.primaryObjective)}` : null,
            ].filter(Boolean) as string[];
            return {
                label: insp.format || undefined,
                title: insp.title || `Inspiração ${idx + 1}`,
                description: insp.description || undefined,
                highlights: Array.isArray(insp.highlights) ? insp.highlights : [],
                metaTags,
                link: hasLink && insp.permalink ? { url: insp.permalink, label: 'Ver post' } : undefined,
            };
        });
    }, [message.answerEvidence]);

    const communityHeader = React.useMemo(() => {
        const evidence = message.answerEvidence;
        if (!evidence?.communityInspirations?.length) return null;
        const filters = evidence.communityMeta?.usedFilters || {};
        const fallback = evidence.communityInspirations?.[0] || null;
        const proposal = filters.proposal || fallback?.proposal;
        const context = filters.context || fallback?.context;
        const format = filters.format || fallback?.format;
        const tone = filters.tone || fallback?.tone;
        const reference = filters.reference || fallback?.reference;
        const primaryObjective = filters.primaryObjective || fallback?.primaryObjective;
        const metaChips = [
            proposal ? `Proposta: ${proposal}` : null,
            context ? `Contexto: ${context}` : null,
            format ? `Formato: ${format}` : null,
            tone ? `Tom: ${toneLabel(tone)}` : null,
            reference ? `Referência: ${humanizeToken(reference)}` : null,
            primaryObjective ? `Objetivo: ${humanizeToken(primaryObjective)}` : null,
        ].filter(Boolean) as string[];
        const matchLabel = matchTypeLabel(evidence.communityMeta?.matchType || '');
        const count = evidence.communityInspirations.length;
        const introOverride = (() => {
            if (!count) return undefined;
            const matchType = evidence.communityMeta?.matchType;
            if (matchType === 'exact') {
                return `Separei ${count} inspirações reais da comunidade alinhadas ao seu pedido.`;
            }
            if (matchType === 'proposal_only') {
                return `Não encontrei match exato; trouxe ${count} inspirações com a mesma proposta.`;
            }
            if (matchType === 'context_only' || matchType === 'broad_context') {
                return `Não encontrei match exato; trouxe ${count} inspirações com contexto semelhante.`;
            }
            return `Separei ${count} inspirações reais da comunidade para você.`;
        })();
        const quickActions = [
            format ? { label: `Mais ${format}`, prompt: `Me traga mais inspirações em formato ${format}.` } : null,
            context ? { label: `Mais ${context}`, prompt: `Me traga mais inspirações no contexto ${context}.` } : null,
            proposal ? { label: `Mais ${proposal}`, prompt: `Me traga mais inspirações com proposta ${proposal}.` } : null,
        ].filter(Boolean) as Array<{ label: string; prompt: string }>;
        return {
            header: 'Inspirações da comunidade',
            subheader: matchLabel ? `Match: ${matchLabel}` : undefined,
            metaChips: metaChips.slice(0, 4),
            introOverride,
            quickActions: quickActions.slice(0, 3),
        };
    }, [message.answerEvidence]);

    const communityContent = React.useMemo(() => {
        const renderComponent = () => (
            <CommunityInspirationMessage
                text={labelSafeText}
                theme={isUser ? 'inverse' : 'default'}
                messageId={message.messageId || null}
                sessionId={message.sessionId || null}
                intent={message.intent || message.messageType || null}
                onSendPrompt={onSendPrompt}
                linkAllowList={linkAllowList}
                cardsOverride={communityOverrideCards.length ? communityOverrideCards : undefined}
                header={communityHeader?.header}
                subheader={communityHeader?.subheader}
                metaChips={communityHeader?.metaChips}
                introOverride={communityHeader?.introOverride}
                hideRawIntro={communityOverrideCards.length > 0}
                quickActions={communityHeader?.quickActions}
            />
        );
        const parsed = parseCommunityInspirationText(labelSafeText);
        if (message.messageType === 'community_inspiration') {
            if (parsed.cards.length || communityOverrideCards.length) return renderComponent();
            return null;
        }
        const cardsWithContent = parsed.cards.filter((card) => {
            const hasTitleOrDescription = Boolean(card.title?.trim() || card.description?.trim());
            const hasDetail = Boolean(card.description?.trim() || (card.highlights?.length ?? 0) > 0 || isHttpUrl(card.link?.url));
            return hasTitleOrDescription && hasDetail;
        });
        const hasValidLink = cardsWithContent.some((card) => isHttpUrl(card.link?.url));
        if ((cardsWithContent.length >= 2) || (cardsWithContent.length >= 1 && hasValidLink)) {
            return renderComponent();
        }

        const evidence = message.answerEvidence;
        const evidenceAllowsInspiration = evidence && evidence.intent_group === 'inspiration' && evidence.asked_for_examples;
        const evidenceIntent = evidence?.intent || '';
        const isCommunityEvidence = evidenceIntent === 'community_examples';
        const isTopPostEvidence = evidenceIntent === 'top_performance_inspirations' || evidenceIntent.startsWith('top_');
        const shouldRenderEvidenceCards = evidenceAllowsInspiration && (isCommunityEvidence || isTopPostEvidence);
        if (shouldRenderEvidenceCards && evidence?.topPosts?.length) {
            const cards = evidence.topPosts
                .filter((p) => !p.source || p.source === 'user')
                .map((p, idx) => {
                    const isIgLink = isInstagramPostUrl(p.permalink);
                    const isVerified = typeof p.linkVerified === 'boolean' ? p.linkVerified : isIgLink;
                    return {
                        title: p.title || p.tags?.[0] || (Array.isArray(p.format) ? p.format[0] : p.format) || `Post ${idx + 1}`,
                        description: p.captionSnippet || undefined,
                        highlights: [],
                        link: isVerified && isIgLink && p.permalink ? { url: p.permalink as string, label: 'Ver post' } : undefined,
                    };
                });
            if (cards.length) {
                const headerLabel = isCommunityEvidence ? 'Inspirações da comunidade' : 'Posts do seu perfil';
                return (
                    <div className="mt-2 space-y-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{headerLabel}</div>
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
        return null;
    }, [
        isUser,
        message.messageType,
        message.messageId,
        message.sessionId,
        message.intent,
        labelSafeText,
        message.answerEvidence,
        linkAllowList,
        communityOverrideCards,
        communityHeader,
        onSendPrompt,
    ]);

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
                        {!isUser && evidence && (
                            (evidence.intent_group === 'inspiration' && evidence.topPosts && evidence.topPosts.length > 0) ||
                            (evidence.intent_group === 'diagnosis' && evidence.diagnosticEvidence)
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
