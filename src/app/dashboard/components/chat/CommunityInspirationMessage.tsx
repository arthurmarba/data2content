import React from 'react';
import { applyInlineMarkup, escapeHtml, type RenderTheme } from './chatUtils';
import { track } from '@/lib/track';

type InspirationCard = {
    label?: string;
    title: string;
    description?: string;
    highlights: string[];
    metaTags?: string[];
    link?: { url: string; label?: string };
};

type ParsedCommunityInspiration = {
    intro?: string;
    cards: InspirationCard[];
    contextNote?: string;
    footer?: { heading: string; items: string[] } | null;
    schemaVersion?: number;
};

const cleanLine = (line: string) => line.trim();

const isTaskModeLine = (line: string) => {
    const trimmed = line.trim().toLowerCase();
    return /^(modo\s+tarefa|task\s+mode|tarefa\s+em\s+andamento)/i.test(trimmed);
};

const isStatusNoiseLine = (line: string) => {
    const trimmed = line.trim().toLowerCase();
    return /^(vou buscar inspira|um momento|processando|tarefa em andamento|buscando inspira)/i.test(trimmed);
};

const extractLink = (value: string): { url: string; label?: string } | null => {
    const markdownMatch = value.match(/\[([^[\]]+)\]\((https?:\/\/[^\s)]+)\)/i);
    if (markdownMatch) {
        const url = markdownMatch[2] || '';
        const label = markdownMatch[1] || undefined;
        return { url, label };
    }
    const urlMatch = value.match(/https?:\/\/\S+/i);
    if (urlMatch) {
        const url = urlMatch[0] || '';
        return { url, label: undefined };
    }
    return null;
};

const splitHighlights = (raw: string): string[] => {
    return raw
        .split(/[\n;•●.]+/)
        .map((item) => item.replace(/^\s*[-*]\s*/, '').trim())
        .filter(Boolean);
};

const formatHighlightLabel = (value: string): string => {
    const normalized = value.trim();
    if (!normalized) return '';
    const map: Record<string, string> = {
        excelente_para_gerar_salvamentos: 'Excelente para gerar salvamentos',
        viralizou_nos_compartilhamentos: 'Viralizou nos compartilhamentos',
        alto_engajamento_nos_comentarios: 'Alto engajamento nos comentários',
        alcance_superior_a_media_de_seguidores: 'Alcance acima da média de seguidores',
        excelente_retencao_em_reels: 'Excelente retenção em Reels',
        boa_receptividade_curtidas: 'Boa receptividade em curtidas',
        sem_metricas_detalhadas_para_analise: 'Sem métricas detalhadas para análise',
        baixo_volume_de_dados: 'Pouco volume de dados',
        desempenho_padrao: 'Desempenho padrão',
        outro_destaque_qualitativo: 'Destaque qualitativo',
    };
    if (map[normalized]) return map[normalized];
    if (!/[_-]/.test(normalized)) return normalized;
    const cleaned = normalized.replace(/[_-]+/g, ' ').trim();
    return cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
};

const sanitizeCardText = (value?: string | null): string => {
    if (!value) return '';
    let out = value.replace(/\r\n/g, '\n');
    // Remove headings and bullets leaking from markdown.
    out = out.replace(/(^|\n)\s*#{1,6}\s+/g, '$1');
    out = out.replace(/#{2,}/g, '');
    out = out.replace(/(^|\n)\s*[-*]\s+/g, '$1');
    // Strip markdown bold/italic markers.
    out = out.replace(/\*\*(.*?)\*\*/g, '$1');
    out = out.replace(/__(.*?)__/g, '$1');
    out = out.replace(/(^|[\s(])\*(.*?)\*(?=[\s).,!?]|$)/g, '$1$2');
    out = out.replace(/(^|[\s(])_(.*?)_(?=[\s).,!?]|$)/g, '$1$2');
    // Remove leftover asterisks at boundaries.
    out = out.replace(/^\*+|\*+$/g, '');
    // Remove placeholder headings/questions.
    out = out.replace(/^\s*pergunta aberta[:\-\s]*/i, '');
    out = out.replace(/\bpergunta aberta\b[:\-\s]*/gi, '');
    // Collapse whitespace.
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
};

const sanitizeParsedInspiration = (data: ParsedCommunityInspiration): ParsedCommunityInspiration => {
    const cleanArray = (values?: string[]) => (values || []).map((v) => sanitizeCardText(v)).filter(Boolean);
    const cards = (data.cards || []).map((card, idx) => {
        const cleanedLabel = sanitizeCardText(card.label || '');
        const cleanedTitle = sanitizeCardText(card.title) || card.title || `Inspiração ${idx + 1}`;
        const cleanedDescription = sanitizeCardText(card.description || '');
        const cleanedHighlights = Array.from(new Set(cleanArray(card.highlights)));
        const cleanedLinkLabel = sanitizeCardText(card.link?.label || '');
        const cleanedLinkUrl = card.link?.url?.trim();
        return {
            ...card,
            label: cleanedLabel || undefined,
            title: cleanedTitle,
            description: cleanedDescription || undefined,
            highlights: cleanedHighlights,
            link: cleanedLinkUrl ? { url: cleanedLinkUrl, label: cleanedLinkLabel || undefined } : undefined,
        };
    }).filter((card) => Boolean(card.title?.trim() || card.description?.trim() || card.highlights.length || card.link));

    const cleanedFooterItems = cleanArray(data.footer?.items);
    const footer = cleanedFooterItems.length
        ? { heading: sanitizeCardText(data.footer?.heading || 'Próximo passo') || 'Próximo passo', items: cleanedFooterItems }
        : null;

    return {
        intro: sanitizeCardText(data.intro || '') || undefined,
        cards,
        contextNote: sanitizeCardText(data.contextNote || '') || undefined,
        footer,
        schemaVersion: data.schemaVersion || 1,
    };
};

const parseStructuredInspiration = (text: string): ParsedCommunityInspiration | null => {
    const trimmed = text.trim();
    if (!trimmed.startsWith('{') && !trimmed.includes('{')) return null;
    const jsonCandidate = (() => {
        const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1]) return fenced[1].trim();
        if (trimmed.startsWith('{')) return trimmed;
        const match = trimmed.match(/\{[\s\S]*\}/);
        return match?.[0] || null;
    })();
    if (!jsonCandidate) return null;
    let parsed: any;
    try {
        parsed = JSON.parse(jsonCandidate);
    } catch {
        const relaxed = jsonCandidate.replace(/,\s*([}\]])/g, '$1');
        try {
            parsed = JSON.parse(relaxed);
        } catch {
            return null;
        }
    }
    const schemaVersionRaw = parsed.schema_version ?? parsed.schemaVersion ?? 1;
    const schemaVersion = typeof schemaVersionRaw === 'number' ? schemaVersionRaw : Number(schemaVersionRaw) || 1;
    if (!parsed || parsed.type !== 'content_ideas' || !Array.isArray(parsed.items)) return null;

    const cards: InspirationCard[] = parsed.items.map((item: any, idx: number) => {
        const label = typeof item.label === 'string' ? item.label : undefined;
        const title = typeof item.title === 'string' ? item.title : '';
        const description = typeof item.description === 'string' ? item.description : '';
        const highlights = Array.isArray(item.highlights)
            ? item.highlights.filter((h: any) => typeof h === 'string')
            : [];
        const linkUrl = typeof item.link?.url === 'string'
            ? item.link.url
            : typeof item.link === 'string'
                ? item.link
                : undefined;
        const linkLabel = typeof item.link?.label === 'string' ? item.link.label : undefined;
        return {
            label,
            title: title || label || `Ideia ${idx + 1}`,
            description,
            highlights,
            link: linkUrl ? { url: linkUrl, label: linkLabel } : undefined,
        };
    });

    const nextQuestion = typeof parsed.next_step_question === 'string' ? parsed.next_step_question : '';

    return {
        intro: typeof parsed.intro === 'string' ? parsed.intro : undefined,
        cards,
        contextNote: typeof parsed.context_note === 'string' ? parsed.context_note : undefined,
        footer: nextQuestion.trim()
            ? { heading: 'Próximo passo', items: [nextQuestion] }
            : null,
        schemaVersion,
    };
};

const isValidUrl = (url?: string | null) => {
    if (!url) return false;
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

const normalizeUrlForMatch = (url?: string | null) => {
    if (!url) return null;
    try {
        const parsed = new URL(url.trim());
        const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
        const path = parsed.pathname.replace(/\/+$/, '');
        return `${host}${path}`;
    } catch {
        return null;
    }
};

export const parseCommunityInspirationText = (text: string): ParsedCommunityInspiration => {
    const structured = parseStructuredInspiration(text);
    if (structured) {
        return sanitizeParsedInspiration(structured);
    }

    const normalizedText = text.replace(/([^\n])(\s*###)/g, (_m, before, hashes) => `${before}\n${hashes.trimStart()}`);
    const lines = normalizedText
        .split(/\r?\n/)
        .map(cleanLine)
        .filter(Boolean)
        .filter((line) => !isTaskModeLine(line))
        .filter((line) => !isStatusNoiseLine(line));
    const cards: InspirationCard[] = [];
    const introLines: string[] = [];
    const footerItems: string[] = [];
    let current: InspirationCard | null = null;
    let collecting: 'description' | 'highlights' | 'link' | null = null;
    let contextNote: string | null = null;
    let inFooter = false;
    let footerHeading: string | null = null;

    const tryCaptureContextNote = (line: string) => {
        if (contextNote) return false;
        const normalized = line.replace(/^>\s*/, '');
        if (/contexto aplicado/i.test(normalized) || /contexto.*pesquisa/i.test(normalized)) {
            const value = normalized.replace(/contexto aplicado.*?:\s*/i, '').trim();
            if (value) {
                contextNote = value;
            }
            return true;
        }
        return false;
    };

    const tryStartFooter = (line: string) => {
        const normalized = line.replace(/^>\s*/, '');
        const footerMatch = normalized.match(/^(?:#+\s*)?(pr[oó]ximo passo|a[cç][aã]o recomend[aá]vel)/i);
        if (footerMatch) {
            inFooter = true;
            footerHeading = footerMatch[1]?.toLowerCase().includes('aç') ? 'Ação recomendável' : 'Próximo passo';
            return true;
        }
        return false;
    };

    const pushFooterItem = (value: string) => {
        const trimmed = value.replace(/^\s*[-*•●]\s*/, '').trim();
        if (!trimmed) return;
        footerItems.push(trimmed);
    };

    const commitCurrent = () => {
        if (!current) return;
        current.description = current.description?.trim();
        current.highlights = Array.from(new Set(current.highlights.map((h) => h.trim()).filter(Boolean)));
        cards.push(current);
        current = null;
    };

    for (const rawLine of lines) {
        const rawTrimmed = rawLine.trim();
        const line = sanitizeCardText(rawLine);
        const isBulletLine = /^[-*•●]\s*/.test(rawTrimmed);
        if (!line) continue;
        if (/^\s*>?\s*\[!?note\]/i.test(line)) continue;
        if (tryCaptureContextNote(line)) continue;
        if (tryStartFooter(line)) continue;

        if (inFooter) {
            pushFooterItem(line);
            continue;
        }

        if (/^diagn[oó]stico/i.test(line) || /^plano em passos acion[aá]veis/i.test(line) || /^pr[oó]ximo passo/i.test(line)) {
            // Ignore generic plan/diagnostic headings within inspiration flow
            continue;
        }

        const cardStartMatch = line.match(/^(?:[-*]\s*)?(?:\d+[.)]\s*)?(?:#{1,3}\s*)?((?:Reel|Vídeo|Video|Post|Carrossel|Inspira(?:ç|c)ao|Inspira(?:ç|c)[aã]o|Inspiration|Idea|Ideia)\s*\d*)(?:\s*[—\-–:]\s*(.*))?$/i);
        const numberedFallback = !cardStartMatch ? line.match(/^(?:\d+[.)]\s*)(.+)$/) : null;
        if (cardStartMatch || numberedFallback) {
            commitCurrent();
            const baseTitle = cardStartMatch ? (cardStartMatch[1]?.trim() || '') : (numberedFallback?.[1]?.trim() || '');
            const suffix = cardStartMatch ? (cardStartMatch[2]?.trim() || '') : '';
            current = {
                title: suffix ? `${baseTitle} — ${suffix}` : baseTitle,
                description: '',
                highlights: [],
            };
            collecting = null;
            continue;
        }

        if (/https?:\/\//i.test(line) && current && !current.link) {
            const link = extractLink(line);
            if (link) {
                current.link = link;
                collecting = 'link';
                continue;
            }
        }

        if (!current) {
            introLines.push(line);
            continue;
        }

        const fieldMatch = line.match(/^(?:[-*]\s*)?(?:\*\*)?(descri[cç][aã]o|resumo|performance|highlights?|destaques(?: de performance)?|tags?|link)s?(?:\*\*)?\s*[:\-]?\s*(.*)$/i);
        if (fieldMatch) {
            const field = fieldMatch[1]?.toLowerCase() || '';
            const rest = fieldMatch[2]?.trim() || '';
            if (field.startsWith('descri') || field === 'resumo') {
                current.description = rest || current.description || '';
                collecting = 'description';
            } else if (field.startsWith('destaq') || field.includes('performance') || field.startsWith('tag') || field.startsWith('highlight')) {
                if (rest) current.highlights.push(...splitHighlights(rest));
                collecting = 'highlights';
            } else if (field.startsWith('link')) {
                const link = extractLink(rest);
                if (link) current.link = link;
                collecting = 'link';
            }
            continue;
        }

        if (collecting === 'highlights') {
            const highlightCandidate = line.replace(/^(?:[-*•●]\s*)/, '').trim();
            if (highlightCandidate) {
                current.highlights.push(highlightCandidate);
            }
            continue;
        }

        if (collecting === 'link') {
            const link = extractLink(line);
            if (link) {
                current.link = link;
                continue;
            }
            // ignore invalid placeholder links
            continue;
        }

        if (collecting === 'description') {
            if (isBulletLine) {
                const highlightCandidate = rawTrimmed.replace(/^[-*•●]\s*/, '').trim();
                if (highlightCandidate) {
                    current.highlights.push(highlightCandidate);
                    collecting = 'highlights';
                    continue;
                }
            }
            current.description = [current.description, line].filter(Boolean).join(' ').trim();
            continue;
        }

        if (/https?:\/\//i.test(line) && !current.link) {
            const link = extractLink(line);
            if (link) {
                current.link = link;
                continue;
            }
        }

        if (!current.description) {
            current.description = line;
            collecting = 'description';
            continue;
        }

        current.highlights.push(line);
    }

    commitCurrent();

    return sanitizeParsedInspiration({
        intro: introLines.join(' ').trim() || undefined,
        cards,
        contextNote: contextNote || undefined,
        footer: footerItems.length
            ? {
                heading: footerHeading || 'Próximo passo',
                items: footerItems.slice(0, 2),
            }
            : null,
    });
};

type CommunityInspirationMessageProps = {
    text: string;
    theme?: RenderTheme;
    messageId?: string | null;
    sessionId?: string | null;
    intent?: string | null;
    onSendPrompt?: (prompt: string) => Promise<void> | void;
    linkAllowList?: string[];
    cardsOverride?: InspirationCard[];
    header?: string;
    subheader?: string;
    metaChips?: string[];
    introOverride?: string;
    hideRawIntro?: boolean;
    quickActions?: Array<{ label: string; prompt: string }>;
};

const impressionCache = new Set<string>();

export function CommunityInspirationMessage({
    text,
    theme = 'default',
    messageId = null,
    sessionId = null,
    intent = null,
    onSendPrompt,
    linkAllowList,
    cardsOverride,
    header,
    subheader,
    metaChips,
    introOverride,
    hideRawIntro = false,
    quickActions,
}: CommunityInspirationMessageProps) {
    const parsed = React.useMemo(() => parseCommunityInspirationText(text), [text]);
    const isInverse = theme === 'inverse';
    const parseTrackedRef = React.useRef(false);
    const impressionTrackedRef = React.useRef(false);
    const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});
    const [expandedHighlights, setExpandedHighlights] = React.useState<Record<number, boolean>>({});
    const [ctaCopied, setCtaCopied] = React.useState<Record<number, boolean>>({});
    const [footerCopied, setFooterCopied] = React.useState<Record<number, boolean>>({});
    const [manualCopyCard, setManualCopyCard] = React.useState<Record<number, string>>({});
    const [manualCopyFooter, setManualCopyFooter] = React.useState<Record<number, string>>({});
    const [quickActionSent, setQuickActionSent] = React.useState<Record<number, boolean>>({});

    React.useEffect(() => {
        setCtaCopied({});
        setFooterCopied({});
        setManualCopyCard({});
        setManualCopyFooter({});
        setQuickActionSent({});
        setExpanded({});
        setExpandedHighlights({});
    }, [text, messageId]);

    const normalizedAllowList = React.useMemo(() => {
        if (!linkAllowList) return null;
        const normalized = new Set<string>();
        linkAllowList.forEach((link) => {
            const safe = normalizeUrlForMatch(link);
            if (safe) normalized.add(safe);
        });
        return normalized;
    }, [linkAllowList]);

    const resolvedCards = React.useMemo(() => {
        const baseCards = cardsOverride && cardsOverride.length ? cardsOverride : parsed.cards;
        const sanitizedCards = baseCards.map((card, idx) => {
            const cleanedLabel = sanitizeCardText(card.label || '');
            const cleanedTitle = sanitizeCardText(card.title) || card.title || `Inspiração ${idx + 1}`;
            const cleanedDescription = sanitizeCardText(card.description || '');
            const rawHighlights = Array.isArray(card.highlights) ? card.highlights : [];
            const cleanedHighlights = Array.from(new Set(rawHighlights.map((h) => sanitizeCardText(h)).filter(Boolean)));
            const cleanedLinkLabel = sanitizeCardText(card.link?.label || '');
            const cleanedLinkUrl = card.link?.url?.trim();
            return {
                ...card,
                label: cleanedLabel || undefined,
                title: cleanedTitle,
                description: cleanedDescription || undefined,
                highlights: cleanedHighlights,
                link: cleanedLinkUrl ? { url: cleanedLinkUrl, label: cleanedLinkLabel || undefined } : undefined,
            };
        });
        if (!normalizedAllowList) return sanitizedCards;
        return sanitizedCards.map((card) => {
            if (!card.link?.url) return card;
            const normalized = normalizeUrlForMatch(card.link.url);
            if (!normalized || !normalizedAllowList.has(normalized)) {
                return { ...card, link: undefined };
            }
            return card;
        });
    }, [cardsOverride, normalizedAllowList, parsed.cards]);

    React.useEffect(() => {
        if (resolvedCards.length === 0 && !parseTrackedRef.current) {
            parseTrackedRef.current = true;
            track('community_inspiration_render_parse_failed', { reason: 'no_cards' });
        }
    }, [resolvedCards.length]);

    React.useEffect(() => {
        if (!resolvedCards.length) return;
        const key = `${sessionId || 'no-session'}:${messageId || text.length}:${intent || 'unknown'}`;
        if (impressionCache.has(key)) return;
        if (impressionTrackedRef.current) return;
        impressionTrackedRef.current = true;
        impressionCache.add(key);
        track('community_inspiration_card_impression', {
            cards: resolvedCards.length,
            session_id: sessionId || null,
            message_id: messageId || null,
            intent: intent || null,
        });
    }, [intent, messageId, resolvedCards.length, sessionId, text.length]);

    if (!resolvedCards.length) return null;

    const textClass = isInverse ? 'text-white/90' : 'text-gray-800';
    const headingClass = isInverse ? 'text-white' : 'text-gray-900';
    const borderClass = isInverse ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-white';
    const badgeClass = isInverse ? 'bg-indigo-100/10 text-indigo-50 ring-1 ring-indigo-200/40' : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100';
    const contextCardClass = isInverse ? 'border-white/20 bg-white/5 text-white' : 'border-gray-200 bg-gray-50 text-gray-800';
    const headerChipClass = isInverse ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700';
    const introText = introOverride || (!hideRawIntro ? parsed.intro : null);

    const copyPrompt = async (value: string) => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(value);
                return true;
            }
        } catch {
            // ignore copy failures
        }
        return false;
    };

    const showManualCopy = (type: 'card' | 'footer', idx: number, value: string) => {
        if (type === 'card') {
            setManualCopyCard((prev) => ({ ...prev, [idx]: value }));
        } else {
            setManualCopyFooter((prev) => ({ ...prev, [idx]: value }));
        }
    };

    return (
        <div className="space-y-3" data-testid="community-inspiration-wrapper">
            {header || subheader || (metaChips && metaChips.length) ? (
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {header ? (
                            <span className={`text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/70' : 'text-gray-500'}`}>
                                {header}
                            </span>
                        ) : null}
                        {subheader ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${headerChipClass}`}>
                                {subheader}
                            </span>
                        ) : null}
                    </div>
                    {metaChips && metaChips.length ? (
                        <div className="flex flex-wrap gap-2">
                            {metaChips.map((chip, idx) => (
                                <span
                                    key={`meta-${idx}`}
                                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${isInverse ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100'}`}
                                >
                                    {chip}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
            {introText ? (
                <p
                    className={`text-[14px] leading-[1.6] ${textClass}`}
                    dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(introText), theme) }}
                />
            ) : null}
            <div className="grid gap-3">
                {resolvedCards.map((card, idx) => {
                    const validLink = isValidUrl(card.link?.url);
                    const safeHighlights = card.highlights.map((h) => formatHighlightLabel(h)).filter(Boolean);
                    const highlightsExpanded = expandedHighlights[idx] === true;
                    const displayHighlights = highlightsExpanded ? safeHighlights : safeHighlights.slice(0, 3);
                    const extraHighlights = highlightsExpanded ? 0 : safeHighlights.length - displayHighlights.length;
                    const description = card.description || '';
                    const shouldClamp = description.length > 220;
                    const isExpanded = expanded[idx] === true;
                    const shownDescription = shouldClamp && !isExpanded ? `${description.slice(0, 180)}…` : description;
                    const badgeLabel = card.label && card.label.trim().length ? card.label : `Inspiração ${idx + 1}`;
                    const ideaPrompt = `Quero roteirizar a ideia "${card.title || `Inspiração ${idx + 1}`}".`;
                    const metaTags = Array.isArray(card.metaTags)
                        ? Array.from(new Set(card.metaTags.filter(Boolean)))
                        : [];
                    const metaPreview = metaTags.slice(0, 3);
                    const metaOverflow = metaTags.length - metaPreview.length;

                    return (
                        <div key={`${card.title}-${idx}`} className={`rounded-2xl border ${borderClass} p-4 shadow-sm`} data-testid="community-inspiration-card">
                            <div className="mb-2 flex items-start gap-3">
                                <div className={`text-[13px] font-semibold ${badgeClass} inline-flex items-center rounded-full px-2.5 py-1`}>
                                    {badgeLabel}
                                </div>
                            </div>
                            <p className={`text-[15px] font-semibold leading-[1.5] ${headingClass}`}>
                                {card.title || `Inspiração ${idx + 1}`}
                            </p>
                            {metaPreview.length ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {metaPreview.map((tag, tagIdx) => (
                                        <span
                                            key={`${card.title}-meta-${tagIdx}`}
                                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${isInverse ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                    {metaOverflow > 0 ? (
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${isInverse ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}>
                                            +{metaOverflow}
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                            {card.description ? (
                                <div className="mt-2 space-y-1">
                                    <p
                                        className={`text-[14px] leading-[1.6] ${textClass}`}
                                        dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(shownDescription), theme) }}
                                    />
                                    {shouldClamp ? (
                                        <button
                                            type="button"
                                            className={`text-[12px] font-semibold underline ${isInverse ? 'text-white hover:text-white/80' : 'text-indigo-700 hover:text-indigo-500'}`}
                                            onClick={() => {
                                                setExpanded((prev) => ({ ...prev, [idx]: !isExpanded }));
                                                track('community_inspiration_expand_card', { card_index: idx, expanded: !isExpanded });
                                            }}
                                        >
                                            {isExpanded ? 'Mostrar menos' : 'Ver mais'}
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                            {displayHighlights.length ? (
                                <div className="mt-3 space-y-1.5">
                                    <p className={`text-[12px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/70' : 'text-gray-500'}`}>
                                        Destaques
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {displayHighlights.map((highlight, hIdx) => (
                                            <span
                                                key={`${card.title}-highlight-${hIdx}`}
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold whitespace-normal break-words ${isInverse ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100'}`}
                                            >
                                                {highlight}
                                            </span>
                                        ))}
                                        {extraHighlights > 0 ? (
                                            <button
                                                type="button"
                                                aria-expanded={highlightsExpanded}
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${isInverse ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-200'}`}
                                                onClick={() => {
                                                    setExpandedHighlights((prev) => ({ ...prev, [idx]: true }));
                                                    track('community_inspiration_expand_highlights', { card_index: idx, expanded: true });
                                                }}
                                            >
                                                +{extraHighlights}
                                            </button>
                                        ) : null}
                                        {highlightsExpanded && safeHighlights.length > 3 ? (
                                            <button
                                                type="button"
                                                aria-expanded={highlightsExpanded}
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${isInverse ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-200'}`}
                                                onClick={() => {
                                                    setExpandedHighlights((prev) => ({ ...prev, [idx]: false }));
                                                    track('community_inspiration_expand_highlights', { card_index: idx, expanded: false });
                                                }}
                                            >
                                                Mostrar menos
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                            {!validLink ? (
                                card.link?.url ? (
                                    <p className={`mt-3 text-[12px] ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                                        Sem link — exemplo não disponível
                                    </p>
                                ) : null
                            ) : (
                                <div className="mt-3 flex">
                                    <a
                                        href={card.link?.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${isInverse
                                            ? 'bg-white text-slate-900 hover:bg-white/90'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                        onClick={() => track('community_inspiration_card_click_link', { card_index: idx, url: card.link?.url })}
                                    >
                                        {card.link?.label || 'Ver post'}
                                    </a>
                                </div>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${isInverse
                                        ? 'bg-white/10 text-white hover:bg-white/20'
                                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                                    onClick={async () => {
                                        track('community_inspiration_card_choose_for_script', { card_index: idx });
                                        if (onSendPrompt) {
                                            try {
                                                await onSendPrompt(ideaPrompt);
                                                setCtaCopied((prev) => ({ ...prev, [idx]: true }));
                                                window.setTimeout(() => setCtaCopied((prev) => ({ ...prev, [idx]: false })), 1600);
                                                return;
                                            } catch {
                                                // fall back to copy
                                            }
                                        }
                                        const ok = await copyPrompt(ideaPrompt);
                                        if (ok) {
                                            setCtaCopied((prev) => ({ ...prev, [idx]: true }));
                                            window.setTimeout(() => setCtaCopied((prev) => ({ ...prev, [idx]: false })), 1600);
                                        } else {
                                            showManualCopy('card', idx, ideaPrompt);
                                        }
                                    }}
                                >
                                    {ctaCopied[idx] ? 'Enviado!' : 'Roteirizar agora'}
                                </button>
                                <button
                                    type="button"
                                    className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${isInverse
                                        ? 'bg-white/10 text-white hover:bg-white/20'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                                    onClick={async () => {
                                        const ok = await copyPrompt(ideaPrompt);
                                        if (ok) {
                                            setCtaCopied((prev) => ({ ...prev, [idx]: true }));
                                            window.setTimeout(() => setCtaCopied((prev) => ({ ...prev, [idx]: false })), 1600);
                                        } else {
                                            showManualCopy('card', idx, ideaPrompt);
                                        }
                                    }}
                                >
                                    Copiar prompt
                                </button>
                            </div>
                            {manualCopyCard[idx] ? (
                                <div className={`mt-2 rounded-lg border ${isInverse ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-gray-50'} p-2`}>
                                    <p className={`text-[11px] font-semibold ${isInverse ? 'text-white/70' : 'text-gray-600'}`}>Copie manualmente:</p>
                                    <div className="mt-1 flex items-center gap-2">
                                        <input
                                            readOnly
                                            value={manualCopyCard[idx]}
                                            onFocus={(e) => e.target.select()}
                                            onClick={(e) => e.currentTarget.select()}
                                            className={`flex-1 rounded-md border px-2 py-1 text-[12px] ${isInverse ? 'bg-transparent text-white border-white/30' : 'bg-white text-gray-800 border-gray-200'}`}
                                        />
                                        <button
                                            type="button"
                                            className={`rounded-md px-2 py-1 text-[11px] font-semibold ${isInverse ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}
                                            onClick={async () => {
                                                const ok = await copyPrompt(manualCopyCard[idx] || '');
                                                if (ok) {
                                                    setCtaCopied((prev) => ({ ...prev, [idx]: true }));
                                                    window.setTimeout(() => setCtaCopied((prev) => ({ ...prev, [idx]: false })), 1600);
                                                }
                                            }}
                                        >
                                            Copiar
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            {parsed.footer?.items?.length ? (
                <div className={`rounded-2xl border ${borderClass} p-4 shadow-sm`}>
                    <p className={`text-[13px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/70' : 'text-gray-500'}`}>
                        {parsed.footer.heading}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {parsed.footer.items.map((item, idx) => {
                            const prompt = `Quero avançar com: "${item}"`;
                            const copied = footerCopied[idx] === true;
                            return (
                                <div key={`footer-${idx}`} className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${isInverse
                                            ? 'bg-white/10 text-white hover:bg-white/20'
                                            : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'}`}
                                        onClick={async () => {
                                            track('community_inspiration_next_step_action', { item_index: idx });
                                            if (onSendPrompt) {
                                                try {
                                                    await onSendPrompt(prompt);
                                                    setFooterCopied((prev) => ({ ...prev, [idx]: true }));
                                                    window.setTimeout(() => setFooterCopied((prev) => ({ ...prev, [idx]: false })), 1600);
                                                    return;
                                                } catch {
                                                    // fallback to copy
                                                }
                                            }
                                            const ok = await copyPrompt(prompt);
                                            if (ok) {
                                                setFooterCopied((prev) => ({ ...prev, [idx]: true }));
                                                window.setTimeout(() => setFooterCopied((prev) => ({ ...prev, [idx]: false })), 1600);
                                            } else {
                                                showManualCopy('footer', idx, prompt);
                                            }
                                        }}
                                    >
                                        {copied ? 'Enviado!' : item}
                                    </button>
                                    <button
                                        type="button"
                                        className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${isInverse
                                            ? 'bg-white/10 text-white hover:bg-white/20'
                                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                                        onClick={async () => {
                                            const ok = await copyPrompt(prompt);
                                            if (ok) {
                                                setFooterCopied((prev) => ({ ...prev, [idx]: true }));
                                                window.setTimeout(() => setFooterCopied((prev) => ({ ...prev, [idx]: false })), 1600);
                                            } else {
                                                showManualCopy('footer', idx, prompt);
                                            }
                                        }}
                                    >
                                        Copiar
                                    </button>
                                    {manualCopyFooter[idx] ? (
                                        <div className={`w-full rounded-lg border ${isInverse ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-gray-50'} px-2 py-1`}>
                                            <p className={`text-[11px] font-semibold ${isInverse ? 'text-white/70' : 'text-gray-600'}`}>Copie manualmente:</p>
                                            <div className="mt-1 flex items-center gap-2">
                                                <input
                                                    readOnly
                                                    value={manualCopyFooter[idx]}
                                                    onFocus={(e) => e.target.select()}
                                                    onClick={(e) => e.currentTarget.select()}
                                                    className={`flex-1 rounded-md border px-2 py-1 text-[12px] ${isInverse ? 'bg-transparent text-white border-white/30' : 'bg-white text-gray-800 border-gray-200'}`}
                                                />
                                                <button
                                                    type="button"
                                                    className={`rounded-md px-2 py-1 text-[11px] font-semibold ${isInverse ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700'}`}
                                                    onClick={async () => {
                                                        const ok = await copyPrompt(manualCopyFooter[idx] || '');
                                                        if (ok) {
                                                            setFooterCopied((prev) => ({ ...prev, [idx]: true }));
                                                            window.setTimeout(() => setFooterCopied((prev) => ({ ...prev, [idx]: false })), 1600);
                                                        }
                                                    }}
                                                >
                                                    Copiar
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : null}
            {quickActions && quickActions.length ? (
                <div className="flex flex-wrap gap-2">
                    {quickActions.map((action, idx) => {
                        const sent = quickActionSent[idx] === true;
                        return (
                            <button
                                key={`quick-${idx}`}
                                type="button"
                                className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${isInverse
                                    ? 'bg-white/10 text-white hover:bg-white/20'
                                    : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'}`}
                                onClick={async () => {
                                    if (onSendPrompt) {
                                        try {
                                            await onSendPrompt(action.prompt);
                                            setQuickActionSent((prev) => ({ ...prev, [idx]: true }));
                                            window.setTimeout(() => setQuickActionSent((prev) => ({ ...prev, [idx]: false })), 1400);
                                            return;
                                        } catch {
                                            // fallback to copy
                                        }
                                    }
                                    const ok = await copyPrompt(action.prompt);
                                    if (ok) {
                                        setQuickActionSent((prev) => ({ ...prev, [idx]: true }));
                                        window.setTimeout(() => setQuickActionSent((prev) => ({ ...prev, [idx]: false })), 1400);
                                    }
                                }}
                            >
                                {sent ? 'Enviado!' : action.label}
                            </button>
                        );
                    })}
                </div>
            ) : null}
            {parsed.contextNote ? (
                <div className={`rounded-2xl border ${contextCardClass} p-4`}>
                    <p className={`text-[13px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white' : 'text-gray-700'}`}>
                        Contexto aplicado
                    </p>
                    <p
                        className={`mt-1 text-[14px] leading-[1.6] ${textClass}`}
                        dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(parsed.contextNote), theme) }}
                    />
                </div>
            ) : null}
        </div>
    );
}
