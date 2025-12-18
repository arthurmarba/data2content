import React from 'react';
import { applyInlineMarkup, escapeHtml, type RenderTheme } from './chatUtils';
import { track } from '@/lib/track';

type InspirationCard = {
    title: string;
    description?: string;
    highlights: string[];
    link?: { url: string; label?: string };
};

type ParsedCommunityInspiration = {
    intro?: string;
    cards: InspirationCard[];
    contextNote?: string;
    footer?: { heading: string; items: string[] } | null;
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
        .split(/[\n;•●]+/)
        .map((item) => item.replace(/^\s*[-*]\s*/, '').trim())
        .filter(Boolean);
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

export const parseCommunityInspirationText = (text: string): ParsedCommunityInspiration => {
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
        const line = rawLine;
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
        if (cardStartMatch) {
            commitCurrent();
            const baseTitle = cardStartMatch[1]?.trim() || '';
            const suffix = cardStartMatch[2]?.trim() || '';
            current = {
                title: suffix ? `${baseTitle} — ${suffix}` : baseTitle,
                description: '',
                highlights: [],
            };
            collecting = null;
            continue;
        }

        if (!current) {
            introLines.push(line);
            continue;
        }

        const fieldMatch = line.match(/^(?:[-*]\s*)?(descri[cç][aã]o|destaques?|tags?|link)s?\s*[:\-]?\s*(.*)$/i);
        if (fieldMatch) {
            const field = fieldMatch[1]?.toLowerCase() || '';
            const rest = fieldMatch[2]?.trim() || '';
            if (field.startsWith('descri')) {
                current.description = rest || current.description || '';
                collecting = 'description';
            } else if (field.startsWith('destaq') || field.startsWith('tag')) {
                if (rest) current.highlights.push(...splitHighlights(rest));
                collecting = 'highlights';
            } else if (field.startsWith('link')) {
                const link = extractLink(rest);
                if (link) current.link = link;
                collecting = 'link';
            }
            continue;
        }

        if (/https?:\/\//i.test(line) && !current.link) {
            const link = extractLink(line);
            if (link) {
                current.link = link;
                continue;
            }
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
        }

        if (collecting === 'description') {
            current.description = [current.description, line].filter(Boolean).join(' ').trim();
            continue;
        }

        if (!current.description) {
            current.description = line;
            collecting = 'description';
            continue;
        }

        current.highlights.push(line);
    }

    commitCurrent();

    return {
        intro: introLines.join(' ').trim() || undefined,
        cards,
        contextNote: contextNote || undefined,
        footer: footerItems.length
            ? {
                heading: footerHeading || 'Próximo passo',
                items: footerItems.slice(0, 2),
            }
            : null,
    };
};

type CommunityInspirationMessageProps = {
    text: string;
    theme?: RenderTheme;
};

export function CommunityInspirationMessage({ text, theme = 'default' }: CommunityInspirationMessageProps) {
    const parsed = React.useMemo(() => parseCommunityInspirationText(text), [text]);
    const isInverse = theme === 'inverse';
    const parseTrackedRef = React.useRef(false);
    const [expanded, setExpanded] = React.useState<Record<number, boolean>>({});

    React.useEffect(() => {
        if (parsed.cards.length === 0 && !parseTrackedRef.current) {
            parseTrackedRef.current = true;
            track('community_inspiration_render_parse_failed', { reason: 'no_cards' });
        }
    }, [parsed.cards.length]);

    if (!parsed.cards.length) return null;

    const textClass = isInverse ? 'text-white/90' : 'text-gray-800';
    const headingClass = isInverse ? 'text-white' : 'text-gray-900';
    const borderClass = isInverse ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-white';
    const badgeClass = isInverse ? 'bg-indigo-100/10 text-indigo-50 ring-1 ring-indigo-200/40' : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100';
    const contextCardClass = isInverse ? 'border-white/20 bg-white/5 text-white' : 'border-gray-200 bg-gray-50 text-gray-800';

    return (
        <div className="space-y-3" data-testid="community-inspiration">
            {parsed.intro ? (
                <p
                    className={`text-[14px] leading-[1.6] ${textClass}`}
                    dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(parsed.intro), theme) }}
                />
            ) : null}
            <div className="grid gap-3">
                {parsed.cards.map((card, idx) => {
                    const validLink = isValidUrl(card.link?.url);
                    const displayHighlights = card.highlights.slice(0, 3);
                    const extraHighlights = card.highlights.length - displayHighlights.length;
                    const description = card.description || '';
                    const shouldClamp = description.length > 320;
                    const isExpanded = expanded[idx] === true;
                    const shownDescription = shouldClamp && !isExpanded ? `${description.slice(0, 280)}…` : description;

                    return (
                        <div key={`${card.title}-${idx}`} className={`rounded-2xl border ${borderClass} p-4 shadow-sm`} data-testid="community-inspiration-card">
                            <div className="mb-2 flex items-start gap-3">
                                <div className={`text-[13px] font-semibold ${badgeClass} inline-flex items-center rounded-full px-2.5 py-1`}>
                                    Reel {idx + 1}
                                </div>
                            </div>
                            <p className={`text-[15px] font-semibold leading-[1.5] ${headingClass}`}>
                                {card.title || `Inspiração ${idx + 1}`}
                            </p>
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
                                                className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${isInverse ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-100'}`}
                                            >
                                                {highlight}
                                            </span>
                                        ))}
                                        {extraHighlights > 0 ? (
                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${isInverse ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'}`}>
                                                +{extraHighlights}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}
                            {!validLink ? null : (
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
                        </div>
                    );
                })}
            </div>
            {parsed.footer?.items?.length ? (
                <div className={`rounded-2xl border ${borderClass} p-4 shadow-sm`}>
                    <p className={`text-[13px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/70' : 'text-gray-500'}`}>
                        {parsed.footer.heading}
                    </p>
                    <ul className={`mt-2 space-y-2 text-[14px] leading-[1.6] ${textClass}`}>
                        {parsed.footer.items.map((item, idx) => (
                            <li key={`footer-${idx}`} className="flex items-start gap-2">
                                <span className={`mt-[6px] inline-block h-1.5 w-1.5 rounded-full ${isInverse ? 'bg-white/70' : 'bg-indigo-400'}`} aria-hidden />
                                <span dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(item), theme) }} />
                            </li>
                        ))}
                    </ul>
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
