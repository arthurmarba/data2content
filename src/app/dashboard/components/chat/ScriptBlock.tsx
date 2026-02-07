import React, { useEffect, useMemo, useState } from 'react';
import { RenderTheme } from './chatUtils';
import Image from 'next/image';
import { Copy, Check } from 'lucide-react';
import { track } from '@/lib/track';

// --- Types ---

interface ScriptMetadata {
    title?: string;
    format?: string;
    duration?: string;
    audio?: string;
    inspiration?: string;
    inspirationReason?: string;
}

interface ScriptScene {
    time: string;
    visual: string;
    audio: string;
}

interface InspirationData {
    title?: string;
    coverUrl?: string;
    postLink?: string;
    supportingInspirations?: Array<{
        role: 'gancho' | 'desenvolvimento' | 'cta';
        title?: string;
        postLink?: string;
        reason?: string;
        narrativeScore?: number;
    }>;
}

interface ScriptVariation {
    id: string;
    label: string;
    metadata: ScriptMetadata;
    scenes: ScriptScene[];
    caption?: string;
    rawText: string;
}

interface ParsedScript {
    variations: ScriptVariation[];
    inspirationData?: InspirationData;
    rawBody: string;
}

export interface ScriptBlockProps {
    content: string;
    theme: RenderTheme;
    onSendPrompt?: (prompt: string) => void | Promise<void>;
}

// --- Parsing Logic ---

const stripMarkdownMarkers = (value: string) =>
    (value || '')
        .replace(/\*\*/g, '')
        .replace(/^[-*]\s+/, '')
        .replace(/^"+|"+$/g, '')
        .trim();

const extractAfterColon = (line: string) => {
    const idx = line.indexOf(':');
    if (idx < 0) return '';
    return line.slice(idx + 1).trim();
};

const extractTaggedBlock = (text: string, tag: string) => {
    const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
    const match = text.match(re);
    return match?.[1]?.trim() || null;
};

const isVariationHeading = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^#{1,4}\s*(?:v|varia(?:c|ç)[aã]o)\s*\d+\s*:?\s*$/i.test(trimmed)) return true;
    if (/^\*{0,2}(?:v|varia(?:c|ç)[aã]o)\s*\d+\*{0,2}\s*:?\s*$/i.test(trimmed)) return true;
    return false;
};

const normalizeVariationLabel = (line: string, fallbackIndex: number) => {
    const match = line.match(/(\d+)/);
    if (match?.[1]) return `V${match[1]}`;
    return `V${fallbackIndex + 1}`;
};

const splitVariationChunks = (lines: string[]) => {
    const chunks: Array<{ label: string; lines: string[] }> = [];
    let currentLabel = 'V1';
    let currentLines: string[] = [];

    for (const line of lines) {
        if (isVariationHeading(line)) {
            if (currentLines.some((entry) => entry.trim().length > 0)) {
                chunks.push({ label: currentLabel, lines: currentLines });
            }
            currentLabel = normalizeVariationLabel(line, chunks.length);
            currentLines = [];
            continue;
        }
        currentLines.push(line);
    }

    if (currentLines.some((entry) => entry.trim().length > 0)) {
        chunks.push({ label: currentLabel, lines: currentLines });
    }

    if (!chunks.length) {
        chunks.push({ label: 'V1', lines });
    }

    return chunks;
};

const parseCaptionVariants = (captionBody: string) => {
    const variantMap = new Map<string, string>();
    if (!captionBody.trim()) return variantMap;
    const lines = captionBody.split('\n');
    let currentLabel = '';
    let currentLines: string[] = [];

    const flush = () => {
        if (!currentLabel) return;
        const value = currentLines.join('\n').trim();
        if (value) variantMap.set(currentLabel, value);
    };

    for (const line of lines) {
        const match = line.trim().match(/^V\s*([123])\s*[:\-]\s*(.*)$/i);
        if (match) {
            flush();
            currentLabel = `V${match[1]}`;
            currentLines = [];
            const first = (match[2] || '').trim();
            if (first) currentLines.push(first);
            continue;
        }
        if (!currentLabel) {
            currentLabel = 'V1';
            currentLines = [];
        }
        currentLines.push(line);
    }
    flush();
    return variantMap;
};

const parseVariationChunk = (label: string, lines: string[]): ScriptVariation => {
    const metadata: ScriptMetadata = {};
    const scenes: ScriptScene[] = [];
    const captionLines: string[] = [];

    let isParsingCaption = false;
    let isParsingTable = false;

    const listSceneRegex = /^[-*]\s*\*\*(.*?):\*\*\s*(.*)$/;

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed) continue;
        const normalized = stripMarkdownMarkers(trimmed);

        if (/^\[LEGENDA\]$/i.test(trimmed)) {
            isParsingCaption = true;
            continue;
        }
        if (/^\[\/LEGENDA\]$/i.test(trimmed)) {
            isParsingCaption = false;
            continue;
        }
        if (isParsingCaption) {
            captionLines.push(rawLine);
            continue;
        }

        if (/^t[íi]tulo sugerido\s*:/i.test(normalized)) {
            metadata.title = extractAfterColon(normalized);
            continue;
        }

        if (/^formato ideal\s*:/i.test(normalized) || /^formato\s*:/i.test(normalized)) {
            const parts = normalized.split('|').map((part) => part.trim()).filter(Boolean);
            const formatPart = parts[0] || normalized;
            metadata.format = extractAfterColon(formatPart);
            const durationPart = parts.find((part) => /dura(?:ç|c)[aã]o|duracao/i.test(part));
            if (durationPart) metadata.duration = extractAfterColon(durationPart);
            continue;
        }

        if (/^a[úu]dio sugerido\s*:/i.test(normalized) || /^audio sugerido\s*:/i.test(normalized)) {
            metadata.audio = extractAfterColon(normalized);
            continue;
        }

        if (/^inspira(?:ç|c)[aã]o viral\s*:/i.test(normalized)) {
            metadata.inspiration = extractAfterColon(normalized);
            continue;
        }

        if (/^por que essa inspira(?:ç|c)[aã]o\s*:/i.test(normalized) || /^racional da inspira(?:ç|c)[aã]o\s*:/i.test(normalized)) {
            metadata.inspirationReason = extractAfterColon(normalized);
            continue;
        }

        if (
            (trimmed.startsWith('|') && /tempo|time/i.test(trimmed) && /visual|cena/i.test(trimmed) && /a[úu]dio|fala|narra/i.test(trimmed))
        ) {
            isParsingTable = true;
            continue;
        }

        if (isParsingTable && /^\|\s*:?[-\s|]+:?\|?$/.test(trimmed)) {
            continue;
        }

        if (isParsingTable && trimmed.startsWith('|')) {
            const cols = trimmed.split('|').map((col) => col.trim()).filter(Boolean);
            if (cols.length >= 2) {
                scenes.push({
                    time: cols.length >= 3 ? (cols[0] || 'Auto') : 'Auto',
                    visual: cols.length >= 3 ? (cols[1] || '') : (cols[0] || ''),
                    audio: cols.length >= 3 ? cols.slice(2).join(' | ') : (cols[1] || ''),
                });
                continue;
            }
        }

        if (isParsingTable && !trimmed.startsWith('|')) {
            isParsingTable = false;
        }

        const listMatch = trimmed.match(listSceneRegex);
        if (listMatch && listMatch[1] && listMatch[2]) {
            const tag = stripMarkdownMarkers(listMatch[1]).toLowerCase();
            const value = stripMarkdownMarkers(listMatch[2]);
            if (!value) continue;
            if (/gancho|hook/.test(tag)) {
                scenes.push({ time: '00-03s', visual: value, audio: value });
            } else if (/desenvolvimento|corpo|conte[úu]do/.test(tag)) {
                scenes.push({ time: '03-20s', visual: value, audio: value });
            } else if (/cta|call to action|chamada/.test(tag)) {
                scenes.push({ time: '20-30s', visual: value, audio: value });
            } else if (/visual|take|cena/.test(tag)) {
                scenes.push({ time: 'Auto', visual: value, audio: '...' });
            }
        }
    }

    return {
        id: label,
        label,
        metadata,
        scenes,
        caption: captionLines.length ? captionLines.join('\n').trim() : undefined,
        rawText: lines.join('\n').trim(),
    };
};

const parseScriptContent = (content: string): ParsedScript => {
    const roteiroBody = extractTaggedBlock(content, 'ROTEIRO') || content;
    const legendaBody = extractTaggedBlock(content, 'LEGENDA') || '';
    const lines = roteiroBody.split('\n');
    let inspirationData: InspirationData | undefined;
    let isParsingJson = false;
    const jsonLines: string[] = [];
    const contentLines: string[] = [];

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (trimmed.includes('[INSPIRATION_JSON]')) {
            isParsingJson = true;
            continue;
        }
        if (trimmed.includes('[/INSPIRATION_JSON]')) {
            isParsingJson = false;
            try {
                const parsed = JSON.parse(jsonLines.join('\n'));
                type SupportingInspirationItem = NonNullable<InspirationData['supportingInspirations']>[number];
                const supportingInspirations = Array.isArray(parsed?.supportingInspirations)
                    ? parsed.supportingInspirations
                        .map((item: any) => {
                            const roleRaw = typeof item?.role === 'string' ? item.role.toLowerCase().trim() : '';
                            const role: 'gancho' | 'desenvolvimento' | 'cta' | null =
                                roleRaw === 'gancho' || roleRaw === 'desenvolvimento' || roleRaw === 'cta'
                                    ? (roleRaw as 'gancho' | 'desenvolvimento' | 'cta')
                                    : null;
                            if (!role) return null;
                            const title = typeof item?.title === 'string' ? item.title.trim() : '';
                            const postLink = typeof item?.postLink === 'string' ? item.postLink.trim() : '';
                            const reason = typeof item?.reason === 'string' ? item.reason.trim() : '';
                            const narrativeScore = typeof item?.narrativeScore === 'number' ? item.narrativeScore : undefined;
                            return {
                                role,
                                title: title || undefined,
                                postLink: postLink || undefined,
                                reason: reason || undefined,
                                narrativeScore,
                            };
                        })
                        .filter(Boolean) as SupportingInspirationItem[]
                    : ([] as SupportingInspirationItem[]);
                inspirationData = {
                    title: typeof parsed?.title === 'string' ? parsed.title : undefined,
                    coverUrl: typeof parsed?.coverUrl === 'string' ? parsed.coverUrl : undefined,
                    postLink: typeof parsed?.postLink === 'string' ? parsed.postLink : undefined,
                    supportingInspirations: supportingInspirations.length ? supportingInspirations : undefined,
                };
            } catch (error) {
                console.error('Failed to parse inspiration JSON', error);
            }
            jsonLines.length = 0;
            continue;
        }
        if (isParsingJson) {
            jsonLines.push(rawLine);
            continue;
        }
        contentLines.push(rawLine);
    }

    const chunks = splitVariationChunks(contentLines);
    const parsedVariations = chunks
        .map((chunk, idx) => parseVariationChunk(chunk.label || `V${idx + 1}`, chunk.lines))
        .filter((variation) => (
            variation.scenes.length > 0 ||
            Boolean(variation.metadata.title || variation.metadata.format || variation.metadata.duration || variation.metadata.audio) ||
            Boolean(variation.caption)
        ));

    const captionVariants = parseCaptionVariants(legendaBody);
    const fallbackCaption = captionVariants.get('V1')
        || captionVariants.get('V2')
        || captionVariants.get('V3')
        || '';
    const variations = parsedVariations.map((variation, idx) => {
        const byLabel = captionVariants.get(variation.label.toUpperCase());
        const byIndex = captionVariants.get(`V${idx + 1}`);
        const mergedCaption = byLabel || byIndex || variation.caption || fallbackCaption || undefined;
        return {
            ...variation,
            caption: mergedCaption,
        };
    });

    return {
        variations,
        inspirationData,
        rawBody: content,
    };
};

// --- Components ---

const cleanText = (value: string) => stripMarkdownMarkers(value);

const formatSceneTime = (value: string) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return 'Auto';
    if (/^\d+(-\d+)?s?$/i.test(trimmed)) {
        return trimmed.toLowerCase().endsWith('s') ? trimmed : `${trimmed}s`;
    }
    return trimmed;
};

const HeroInspirationCard: React.FC<{ data: InspirationData; theme: RenderTheme }> = ({ data, theme }) => {
    if (!data.title && !data.postLink) return null;
    const isInverse = theme === 'inverse';

    return (
        <div className={`mx-4 my-3 rounded-xl border p-3 sm:mx-5 ${isInverse ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50/60'}`}>
            <div className="flex items-start gap-3">
                <div className={`relative h-14 w-14 flex-none overflow-hidden rounded-lg ${isInverse ? 'bg-white/10' : 'bg-gray-200'}`}>
                    {data.coverUrl ? (
                        <Image
                            src={data.coverUrl}
                            alt="Inspiration Cover"
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className={`h-full w-full ${isInverse ? 'bg-white/10' : 'bg-gray-200'}`} />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                        Referência
                    </p>
                    <h4 className={`mt-1 text-sm font-semibold leading-tight ${isInverse ? 'text-white' : 'text-gray-900'}`}>
                        {data.title || 'Conteúdo de referência'}
                    </h4>

                    {data.postLink && (
                        <a
                            href={data.postLink}
                            target="_blank"
                            rel="noreferrer"
                            className={`mt-2 inline-flex items-center text-xs font-medium underline underline-offset-2 ${isInverse ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
                        >
                            Ver original
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
};

const SupportingInspirations: React.FC<{ data: InspirationData; theme: RenderTheme }> = ({ data, theme }) => {
    const items = Array.isArray(data.supportingInspirations) ? data.supportingInspirations.slice(0, 3) : [];
    if (!items.length) return null;
    const isInverse = theme === 'inverse';
    const roleLabel = (role: 'gancho' | 'desenvolvimento' | 'cta') =>
        role === 'gancho' ? 'Gancho' : role === 'desenvolvimento' ? 'Desenvolvimento' : 'CTA';

    return (
        <details className={`mx-4 mb-3 overflow-hidden rounded-xl border sm:mx-5 ${isInverse ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-white'}`}>
            <summary className={`cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/70' : 'text-gray-600'} [&::-webkit-details-marker]:hidden`}>
                Inspirações por etapa narrativa
            </summary>
            <div className="space-y-2 px-3 pb-3">
                {items.map((item, idx) => (
                    <div
                        key={`${item.role}-${item.title || idx}`}
                        className={`rounded-lg border px-2.5 py-2 ${isInverse ? 'border-white/15 bg-black/10' : 'border-gray-200 bg-gray-50/40'}`}
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${isInverse ? 'border-white/20 text-white/80' : 'border-gray-200 text-gray-600'}`}>
                                {roleLabel(item.role)}
                            </span>
                            {typeof item.narrativeScore === 'number' ? (
                                <span className={`text-[11px] font-semibold ${isInverse ? 'text-white/70' : 'text-gray-500'}`}>
                                    Narrativa {(item.narrativeScore * 100).toFixed(0)}%
                                </span>
                            ) : null}
                        </div>
                        <p className={`mt-1 text-[13px] font-semibold ${isInverse ? 'text-white' : 'text-gray-800'}`}>
                            {item.title || 'Referência da comunidade'}
                        </p>
                        {item.reason ? (
                            <p className={`mt-0.5 text-[12px] ${isInverse ? 'text-white/70' : 'text-gray-600'}`}>
                                {item.reason}
                            </p>
                        ) : null}
                        {item.postLink ? (
                            <a
                                href={item.postLink}
                                target="_blank"
                                rel="noreferrer"
                                className={`mt-1 inline-flex text-[12px] font-medium underline underline-offset-2 ${isInverse ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
                            >
                                Ver original
                            </a>
                        ) : null}
                    </div>
                ))}
            </div>
        </details>
    );
};

const MetadataHeader: React.FC<{ metadata: ScriptMetadata; theme: RenderTheme; label?: string }> = ({ metadata, theme, label }) => {
    const isInverse = theme === 'inverse';
    const displayTitle = metadata.title || 'Roteiro sugerido';
    const metaItems = [
        metadata.format ? `Formato: ${metadata.format}` : null,
        metadata.duration ? `Duração: ${metadata.duration}` : null,
        metadata.audio ? `Áudio: ${metadata.audio}` : null,
        metadata.inspiration ? `Base: ${metadata.inspiration}` : null,
    ].filter(Boolean) as string[];

    return (
        <div className={`px-4 py-3 sm:px-5 sm:py-4 ${isInverse ? 'text-white' : 'text-gray-900'}`}>
            <div className="flex items-center justify-between gap-2">
                <h3 className={`text-lg font-semibold leading-tight ${isInverse ? 'text-white' : 'text-gray-900'}`}>
                    {displayTitle}
                </h3>
                {label ? (
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[12px] font-semibold ${isInverse ? 'border-white/20 text-white/80' : 'border-gray-200 text-gray-600'}`}>
                        {label}
                    </span>
                ) : null}
            </div>
            {metaItems.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {metaItems.map((item) => (
                        <span
                            key={item}
                            className={`inline-flex rounded-md border px-2 py-0.5 text-[12px] font-medium ${isInverse ? 'border-white/20 text-white/75' : 'border-gray-200 text-gray-600'}`}
                        >
                            {item}
                        </span>
                    ))}
                </div>
            )}
            {metadata.inspirationReason ? (
                <p className={`mt-2 text-[13px] leading-relaxed ${isInverse ? 'text-white/75' : 'text-gray-600'}`}>
                    <span className="font-semibold">Por que essa inspiração:</span> {metadata.inspirationReason}
                </p>
            ) : null}
        </div>
    );
};

const TimelineScene: React.FC<{ scene: ScriptScene; theme: RenderTheme; isFirst: boolean }> = ({ scene, theme, isFirst }) => {
    const isInverse = theme === 'inverse';

    return (
        <div className={`py-2.5 sm:py-3 ${!isFirst ? (isInverse ? 'border-t border-white/10' : 'border-t border-gray-100') : ''}`}>
            <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                {formatSceneTime(scene.time)}
            </p>
            <p className={`text-[14px] leading-[1.55] ${isInverse ? 'text-white/90' : 'text-gray-800'}`}>
                {cleanText(scene.visual)}
            </p>
            {scene.audio && scene.audio !== '...' && (
                <p className={`mt-1.5 text-[13px] leading-[1.5] ${isInverse ? 'text-white/75' : 'text-gray-600'}`}>
                    <span className="font-semibold">Fala:</span> {cleanText(scene.audio).replace(/"/g, '')}
                </p>
            )}
        </div>
    );
};

const CaptionBox: React.FC<{ text: string; theme: RenderTheme }> = ({ text, theme }) => {
    const isInverse = theme === 'inverse';
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        track('chat_script_caption_copied', { caption_length: text.length });
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <div className={`mx-4 my-3 rounded-xl border p-3.5 sm:mx-5 sm:p-4 ${isInverse ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50/60'}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                    Legenda
                </span>
                <button
                    onClick={handleCopy}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${copied
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : (isInverse ? 'border-white/20 text-white/80 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900')
                        }`}
                >
                    {copied ? <><Check size={12} /> Copiada</> : <><Copy size={12} /> Copiar</>}
                </button>
            </div>
            <p className={`whitespace-pre-wrap text-[14px] leading-[1.6] ${isInverse ? 'text-white/85' : 'text-gray-700'}`}>
                {text}
            </p>
        </div>
    );
};

// --- Main Component ---

export const ScriptBlock: React.FC<ScriptBlockProps> = ({ content, theme, onSendPrompt }) => {
    const data = useMemo(() => parseScriptContent(content), [content]);
    const isInverse = theme === 'inverse';
    const [copied, setCopied] = useState(false);
    const [showActionOptions, setShowActionOptions] = useState(false);
    const [activeVariationIndex, setActiveVariationIndex] = useState(0);

    useEffect(() => {
        setActiveVariationIndex(0);
    }, [content]);

    const activeVariation = data.variations[activeVariationIndex] || data.variations[0];

    const handleCopyAll = async () => {
        try {
            const source = activeVariation
                ? [
                    '[ROTEIRO]',
                    activeVariation.rawText,
                    '[/ROTEIRO]',
                    activeVariation.caption ? ['', '[LEGENDA]', activeVariation.caption, '[/LEGENDA]'].join('\n') : '',
                ].filter(Boolean).join('\n')
                : content;
            await navigator.clipboard.writeText(source);
            track('chat_script_copied', {
                variation: activeVariation?.label || 'V1',
                has_caption: Boolean(activeVariation?.caption),
            });
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (error) {
            console.error('[chat] falha ao copiar roteiro', error);
        }
    };

    const wrapperClass = isInverse
        ? 'border-white/15 bg-gray-900 text-white'
        : 'border-gray-200 bg-white text-gray-900';

    const quickActions = [
        { label: 'Narrativa alinhada', prompt: 'Curti essa linha narrativa. Para os próximos roteiros, mantenha um estilo parecido de gancho, desenvolvimento e CTA.' },
        { label: 'Quero outra linha', prompt: 'Essa narrativa não combinou comigo. Para os próximos roteiros, mude a linha narrativa e traga outra abordagem de gancho e CTA.' },
        { label: 'Encurtar para 15s', prompt: 'Reescreva este roteiro para ter no máximo 15 segundos, focado em retenção rápida.' },
        { label: 'Gancho mais forte', prompt: 'Torne o gancho deste roteiro mais direto e chamativo sem perder clareza.' },
        { label: 'Versão didática', prompt: 'Adapte o roteiro para um formato mais didático e passo a passo.' },
        { label: 'Gerar alternativa', prompt: 'Gere uma opção totalmente diferente para o mesmo tema.' },
    ];

    if (!activeVariation || (!activeVariation.scenes.length && !activeVariation.caption)) {
        return (
            <div className={`rounded-lg border p-4 text-sm whitespace-pre-wrap ${isInverse ? 'border-white/15 bg-white/5 text-white/80' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                <div className={`mb-2 text-xs font-semibold uppercase tracking-wide ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                    Conteúdo bruto
                </div>
                {content}
            </div>
        );
    }

    return (
        <div className={`my-4 overflow-hidden rounded-2xl border ${wrapperClass}`}>
            <div className={`flex items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5 sm:py-3 ${isInverse ? 'border-white/10' : 'border-gray-100'}`}>
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/80' : 'text-gray-700'}`}>
                    Roteiro
                </span>
                <button
                    onClick={handleCopyAll}
                    disabled={copied}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${copied
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : (isInverse ? 'border-white/20 text-white/80 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900')
                        }`}
                >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copiado' : 'Copiar'}
                </button>
            </div>

            {data.variations.length > 1 && (
                <div className={`px-4 pt-3 sm:px-5 ${isInverse ? 'bg-white/5' : 'bg-gray-50/60'}`}>
                    <div className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border p-0.5 [-webkit-overflow-scrolling:touch] ${isInverse ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-white'}`}>
                        {data.variations.map((variation, idx) => (
                            <button
                                key={variation.id}
                                type="button"
                                onClick={() => {
                                    setActiveVariationIndex(idx);
                                    track('chat_script_variation_selected', { variation: variation.label });
                                }}
                                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${idx === activeVariationIndex
                                    ? (isInverse ? 'bg-white/20 text-white' : 'bg-gray-900 text-white')
                                    : (isInverse ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                                    }`}
                            >
                                {variation.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <MetadataHeader
                metadata={activeVariation.metadata}
                theme={theme}
                label={data.variations.length > 1 ? activeVariation.label : undefined}
            />
            <div className="px-4 pb-1 sm:px-5 sm:pb-2">
                {activeVariation.scenes.map((scene, idx) => (
                    <TimelineScene
                        key={`${activeVariation.id}-${idx}`}
                        scene={scene}
                        theme={theme}
                        isFirst={idx === 0}
                    />
                ))}
            </div>

            {activeVariation.caption && <CaptionBox text={activeVariation.caption} theme={theme} />}

            {onSendPrompt && (
                <div className={`border-t px-4 py-2.5 sm:px-5 sm:py-3 ${isInverse ? 'border-white/10' : 'border-gray-100'}`}>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => {
                                track('chat_script_action_clicked', { action: 'refinar_roteiro', variation: activeVariation?.label || 'V1' });
                                onSendPrompt('Refine este roteiro mantendo a ideia principal, com linguagem mais clara e direta.');
                            }}
                            className={`w-full rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors sm:w-auto ${isInverse
                                ? 'bg-white/10 text-white hover:bg-white/15'
                                : 'bg-gray-900 text-white hover:bg-black'
                                }`}
                        >
                            Refinar roteiro
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowActionOptions((prev) => !prev)}
                            className={`w-full rounded-md border px-3 py-2.5 text-[13px] font-medium transition-colors sm:w-auto ${isInverse
                                ? 'border-white/20 text-white/80 hover:text-white'
                                : 'border-gray-200 text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            {showActionOptions ? 'Ocultar opções' : 'Mais opções'}
                        </button>
                    </div>
                    {showActionOptions && (
                        <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                            {quickActions.map((action) => (
                                <button
                                    key={action.label}
                                    type="button"
                                    onClick={() => {
                                        track('chat_script_action_clicked', {
                                            action: action.label,
                                            variation: activeVariation?.label || 'V1',
                                        });
                                        onSendPrompt(action.prompt);
                                    }}
                                    className={`rounded-md border px-2.5 py-2 text-[12px] font-medium transition-colors ${isInverse
                                        ? 'border-white/20 text-white/80 hover:text-white'
                                        : 'border-gray-200 text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {data.inspirationData ? (
                <details className={`border-t px-4 py-2.5 sm:px-5 sm:py-3 ${isInverse ? 'border-white/10' : 'border-gray-100'}`}>
                    <summary className={`cursor-pointer list-none text-[13px] font-semibold tracking-[0.01em] ${isInverse ? 'text-white/80' : 'text-gray-600'} [&::-webkit-details-marker]:hidden`}>
                        Inspirações usadas neste roteiro
                    </summary>
                    <div className="mt-2">
                        <HeroInspirationCard data={data.inspirationData} theme={theme} />
                        <SupportingInspirations data={data.inspirationData} theme={theme} />
                    </div>
                </details>
            ) : null}
        </div>
    );
};
