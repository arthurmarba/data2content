import React, { useEffect, useMemo, useState } from 'react';
import { RenderTheme } from './chatUtils';
import Image from 'next/image';
import { Copy, Check } from 'lucide-react';
import { track } from '@/lib/track';

// --- Types ---

const SCRIPT_UI_CAPTION_TABS_ENABLED = process.env.NEXT_PUBLIC_SCRIPT_UI_CAPTION_TABS !== 'false';
const SCRIPT_LAYOUT_V2_ENABLED = process.env.NEXT_PUBLIC_SCRIPT_LAYOUT_V2 !== 'false';

type ScriptLayoutVersion = 'v1' | 'v2';

interface ScriptMetadata {
    title?: string;
    strategicTheme?: string;
    engagementBase?: string;
    evidenceConfidence?: string;
    inspirationSource?: string;
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

type SceneExpandedMap = Record<string, { visual: boolean; audio: boolean }>;

interface InspirationData {
    source?: 'community' | 'user_top_posts' | 'none';
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
    captionVariants?: Array<{ label: string; text: string }>;
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

type SceneCardProps = {
    scene: ScriptScene;
    index: number;
    totalScenes: number;
    isFirstScene: boolean;
    theme: RenderTheme;
    isExpandedMap: SceneExpandedMap;
    onToggleExpand: (sceneKey: string, field: 'visual' | 'audio') => void;
};

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

const cleanSceneCell = (value: string) => stripMarkdownMarkers(value || '').replace(/\s+/g, ' ').trim();

const isTableSeparatorRow = (raw: string) => {
    const cols = raw
        .split('|')
        .map((col) => col.trim())
        .filter(Boolean);
    if (!cols.length) return false;
    return cols.every((col) => /^:?-{2,}:?$/.test(col.replace(/\s+/g, '')));
};

const isPlaceholderValue = (value?: string | null) => {
    if (!value) return true;
    const normalized = value.replace(/\s+/g, '');
    if (!normalized) return true;
    return /^[:\-_–—.=|]+$/.test(normalized);
};

const isMeaningfulScene = (scene: ScriptScene) => {
    const time = cleanSceneCell(scene.time || '');
    const visual = cleanSceneCell(scene.visual || '');
    const audio = cleanSceneCell(scene.audio || '');
    if (isPlaceholderValue(time) && isPlaceholderValue(visual) && isPlaceholderValue(audio)) return false;
    if (isPlaceholderValue(visual) && isPlaceholderValue(audio)) return false;
    return Boolean(visual || audio);
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
        if (/^:?-{2,}:?$/.test(trimmed)) continue;
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

        if (/^pauta estrat[ée]gica\s*:/i.test(normalized)) {
            metadata.strategicTheme = extractAfterColon(normalized);
            continue;
        }

        if (/^base de engajamento\s*:/i.test(normalized)) {
            metadata.engagementBase = extractAfterColon(normalized);
            continue;
        }

        if (/^confian(?:ç|c)a da base\s*:/i.test(normalized)) {
            metadata.evidenceConfidence = extractAfterColon(normalized);
            continue;
        }

        if (/^fonte da inspira(?:ç|c)[aã]o\s*:/i.test(normalized)) {
            metadata.inspirationSource = extractAfterColon(normalized);
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
            if (isTableSeparatorRow(trimmed)) {
                continue;
            }
            const cols = trimmed.split('|').map((col) => col.trim()).filter(Boolean);
            if (cols.length >= 2) {
                const scene: ScriptScene = {
                    time: cleanSceneCell(cols.length >= 3 ? (cols[0] || 'Auto') : 'Auto'),
                    visual: cleanSceneCell(cols.length >= 3 ? (cols[1] || '') : (cols[0] || '')),
                    audio: cleanSceneCell(cols.length >= 3 ? cols.slice(2).join(' | ') : (cols[1] || '')),
                };
                if (!isMeaningfulScene(scene)) continue;
                scenes.push(scene);
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
                    source: parsed?.source === 'community' || parsed?.source === 'user_top_posts' || parsed?.source === 'none'
                        ? parsed.source
                        : undefined,
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
    const captionVariantsList = (['V1', 'V2', 'V3'] as const)
        .map((label) => {
            const text = captionVariants.get(label);
            return text ? { label, text } : null;
        })
        .filter(Boolean) as Array<{ label: string; text: string }>;
    const variations = parsedVariations.map((variation, idx) => {
        const byLabel = captionVariants.get(variation.label.toUpperCase());
        const byIndex = captionVariants.get(`V${idx + 1}`);
        const mergedCaption = byLabel || byIndex || variation.caption || fallbackCaption || undefined;
        const variationCaptionVariants = SCRIPT_UI_CAPTION_TABS_ENABLED
            ? (
                captionVariantsList.length
                    ? captionVariantsList
                    : (mergedCaption ? [{ label: 'V1', text: mergedCaption }] : [])
            )
            : [];
        return {
            ...variation,
            metadata: {
                ...variation.metadata,
                inspirationSource: variation.metadata.inspirationSource
                    || (inspirationData?.source === 'community'
                        ? 'Comunidade (narrativas similares)'
                        : inspirationData?.source === 'user_top_posts'
                            ? 'Top posts do criador'
                            : variation.metadata.inspirationSource),
            },
            caption: mergedCaption,
            captionVariants: variationCaptionVariants,
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

const SCRIPT_CONTEXT_REQUIRED_PATTERNS = [
    /falta um detalhe/i,
    /tema espec[íi]fico/i,
    /use meu nicho/i,
    /preciso de contexto/i,
];

const isScriptContextRequiredMessage = (value: string) => {
    const normalized = (value || '').trim();
    if (!normalized) return false;
    return SCRIPT_CONTEXT_REQUIRED_PATTERNS.some((pattern) => pattern.test(normalized));
};

const HeroInspirationCard: React.FC<{ data: InspirationData; theme: RenderTheme }> = ({ data, theme }) => {
    if (!data.title && !data.postLink) return null;
    const isInverse = theme === 'inverse';

    return (
        <div className={`py-2 ${isInverse ? 'text-white' : 'text-gray-900'}`}>
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
        <details className="py-1">
            <summary className={`cursor-pointer list-none py-1 text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/70' : 'text-gray-600'} [&::-webkit-details-marker]:hidden`}>
                Inspirações por etapa narrativa
            </summary>
            <div className="space-y-2 pt-1">
                {items.map((item, idx) => (
                    <div
                        key={`${item.role}-${item.title || idx}`}
                        className={`border-l-2 pl-2.5 py-0.5 ${isInverse ? 'border-white/20' : 'border-gray-200'}`}
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

const normalizeEvidenceConfidence = (value?: string) => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (/alt/.test(normalized)) return 'Alta';
    if (/m[eé]d/.test(normalized)) return 'Média';
    if (/baix/.test(normalized)) return 'Baixa';
    return null;
};

const CountedEvidenceSummary: React.FC<{ total: number; theme: RenderTheme }> = ({ total, theme }) => {
    const isInverse = theme === 'inverse';
    return (
        <summary className={`cursor-pointer list-none px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/75' : 'text-gray-600'} [&::-webkit-details-marker]:hidden`}>
            Evidências ({total})
        </summary>
    );
};

const MetadataHeader: React.FC<{
    metadata: ScriptMetadata;
    theme: RenderTheme;
    label?: string;
    onCopyAll?: () => void;
    copied?: boolean;
}> = ({ metadata, theme, label, onCopyAll, copied = false }) => {
    const isInverse = theme === 'inverse';
    const displayTitle = metadata.title || 'Roteiro sugerido';
    const confidenceLabel = normalizeEvidenceConfidence(metadata.evidenceConfidence);
    const metaItems = [
        metadata.format ? `Formato: ${metadata.format}` : null,
        metadata.duration ? `Duração: ${metadata.duration}` : null,
        confidenceLabel ? `Confiança: ${confidenceLabel}` : null,
    ].filter(Boolean) as string[];

    const evidenceItems = [
        metadata.engagementBase ? { label: 'Base de engajamento', value: metadata.engagementBase } : null,
        metadata.evidenceConfidence ? { label: 'Confiança da base', value: metadata.evidenceConfidence } : null,
        metadata.inspirationSource ? { label: 'Fonte da inspiração', value: metadata.inspirationSource } : null,
        metadata.inspirationReason ? { label: 'Por que essa inspiração', value: metadata.inspirationReason } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    const strategicThemeStyle: React.CSSProperties = {
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
    };

    return (
        <div className={`px-4 py-4 sm:px-5 sm:py-[18px] ${isInverse ? 'text-white' : 'text-gray-900'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-[20px] font-semibold leading-tight ${isInverse ? 'text-white' : 'text-gray-900'}`}>
                            {displayTitle}
                        </h3>
                        {label ? (
                            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[12px] font-semibold ${isInverse ? 'border-white/20 text-white/80' : 'border-gray-200 text-gray-600'}`}>
                                {label}
                            </span>
                        ) : null}
                    </div>
                </div>
                {onCopyAll ? (
                    <button
                        type="button"
                        onClick={onCopyAll}
                        disabled={copied}
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${copied
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : (isInverse ? 'border-white/20 text-white/80 hover:text-white' : 'border-gray-200 text-gray-600 hover:text-gray-900')
                            }`}
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied ? 'Copiado' : 'Copiar roteiro'}
                    </button>
                ) : null}
            </div>

            {metaItems.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {metaItems.map((item) => (
                        <span
                            key={item}
                            className={`inline-flex rounded-md border px-2.5 py-1 text-[12px] font-semibold ${isInverse ? 'border-white/20 text-white/80' : 'border-gray-200 text-gray-700'}`}
                        >
                            {item}
                        </span>
                    ))}
                </div>
            ) : null}

            {metadata.strategicTheme ? (
                <p className={`mt-3 text-[14px] leading-relaxed ${isInverse ? 'text-white/80' : 'text-gray-700'}`} style={strategicThemeStyle}>
                    <span className="font-semibold">Pauta estratégica:</span> {metadata.strategicTheme}
                </p>
            ) : null}

            {evidenceItems.length > 0 ? (
                <details className={`mt-3 ${isInverse ? 'text-white/80' : 'text-gray-700'}`}>
                    <CountedEvidenceSummary total={evidenceItems.length} theme={theme} />
                    <div className={`space-y-1.5 border-l-2 pl-3 pb-1 ${isInverse ? 'border-white/15' : 'border-gray-200'}`}>
                        {evidenceItems.map((item) => (
                            <p key={item.label} className={`text-[13px] leading-relaxed ${isInverse ? 'text-white/75' : 'text-gray-600'}`}>
                                <span className="font-semibold">{item.label}:</span> {item.value}
                            </p>
                        ))}
                    </div>
                </details>
            ) : null}
        </div>
    );
};

const SceneField: React.FC<{
    label: 'Visual' | 'Fala';
    text: string;
    maxLines: number;
    sceneKey: string;
    field: 'visual' | 'audio';
    theme: RenderTheme;
    isExpandedMap: SceneExpandedMap;
    onToggleExpand: (sceneKey: string, field: 'visual' | 'audio') => void;
}> = ({ label, text, maxLines, sceneKey, field, theme, isExpandedMap, onToggleExpand }) => {
    const isInverse = theme === 'inverse';
    const cleanValue = cleanText(text).replace(/"/g, '');
    if (!cleanValue || cleanValue === '...') return null;
    const isExpanded = Boolean(isExpandedMap[sceneKey]?.[field]);
    const shouldCollapse = cleanValue.length > (field === 'visual' ? 140 : 180);
    const clampStyle: React.CSSProperties = isExpanded || !shouldCollapse
        ? {}
        : {
            display: '-webkit-box',
            WebkitLineClamp: maxLines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
        };

    return (
        <div className={label === 'Fala' ? 'mt-3.5' : ''}>
            <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                {label}
            </p>
            <p
                className={`${label === 'Visual' ? 'text-[15px] leading-[1.55] font-medium' : 'text-[14px] leading-[1.6] font-semibold'} ${isInverse ? (label === 'Visual' ? 'text-white/92' : 'text-white/88') : (label === 'Visual' ? 'text-gray-800' : 'text-gray-900')}`}
                style={clampStyle}
            >
                {cleanValue}
            </p>
            {shouldCollapse ? (
                <button
                    type="button"
                    onClick={() => onToggleExpand(sceneKey, field)}
                    className={`mt-1 text-[12px] font-semibold ${isInverse ? 'text-white/75 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
                >
                    {isExpanded ? 'Ver menos' : 'Ver mais'}
                </button>
            ) : null}
        </div>
    );
};

const SceneCard: React.FC<SceneCardProps> = ({
    scene,
    index,
    totalScenes,
    isFirstScene,
    theme,
    isExpandedMap,
    onToggleExpand,
}) => {
    const isInverse = theme === 'inverse';
    const sceneKey = `${index}`;
    const isLastScene = index === totalScenes - 1;

    return (
        <article
            data-testid={`script-scene-card-${index + 1}`}
            className={`px-1 py-4 sm:py-[18px] ${!isFirstScene
                ? (isInverse ? 'mt-2 border-t border-white/12 pt-6' : 'mt-2 border-t border-gray-200/90 pt-6')
                : ''
                } ${isLastScene
                ? (isInverse ? 'border-l-2 border-emerald-300/50 pl-3' : 'border-l-2 border-emerald-300 pl-3')
                : ''
                }`}
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`text-[12px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/70' : 'text-gray-500'}`}>
                    Cena {index + 1}
                </span>
                <span className={`text-[12px] font-semibold ${isInverse ? 'text-white/70' : 'text-gray-600'}`}>
                    {formatSceneTime(scene.time)}
                </span>
            </div>
            <div className="pt-1">
                <SceneField
                    label="Visual"
                    text={scene.visual}
                    maxLines={3}
                    sceneKey={sceneKey}
                    field="visual"
                    theme={theme}
                    isExpandedMap={isExpandedMap}
                    onToggleExpand={onToggleExpand}
                />
                <SceneField
                    label="Fala"
                    text={scene.audio}
                    maxLines={4}
                    sceneKey={sceneKey}
                    field="audio"
                    theme={theme}
                    isExpandedMap={isExpandedMap}
                    onToggleExpand={onToggleExpand}
                />
            </div>
        </article>
    );
};

const CaptionBox: React.FC<{
    text: string;
    theme: RenderTheme;
    variants?: Array<{ label: string; text: string }>;
}> = ({ text, theme, variants = [] }) => {
    const isInverse = theme === 'inverse';
    const [copied, setCopied] = useState(false);
    const [activeCaptionIndex, setActiveCaptionIndex] = useState(0);
    const hasCaptionTabs = SCRIPT_UI_CAPTION_TABS_ENABLED && variants.length > 1;
    const captionVariantsSignature = useMemo(
        () => variants.map((variant) => `${variant.label}:${variant.text}`).join('|'),
        [variants]
    );
    const activeCaption =
        (hasCaptionTabs ? (variants[activeCaptionIndex] || variants[0]) : { label: 'V1', text }) ||
        { label: 'V1', text };

    useEffect(() => {
        setActiveCaptionIndex(0);
    }, [text, captionVariantsSignature]);

    const handleCopy = () => {
        navigator.clipboard.writeText(activeCaption.text);
        track('chat_script_caption_copied', { caption_length: activeCaption.text.length, caption_variant: activeCaption.label });
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <div className={`relative mx-4 my-2 border-t pt-4 sm:mx-5 sm:pt-[18px] ${isInverse ? 'border-white/10' : 'border-gray-100'}`}>
            <button
                onClick={handleCopy}
                className={`absolute right-4 top-4 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${copied
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : (isInverse ? 'border-white/20 text-white/80 hover:text-white' : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900')
                    }`}
            >
                {copied ? <><Check size={12} /> Copiada</> : <><Copy size={12} /> Copiar legenda</>}
            </button>
            <div className="pr-[120px]">
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                    Legenda pronta
                </span>
            </div>
            {hasCaptionTabs ? (
                <div className={`mt-3 grid w-full grid-cols-3 gap-1 rounded-lg p-0.5 sm:inline-flex sm:w-auto ${isInverse ? 'bg-white/5' : 'bg-gray-100'}`}>
                    {variants.map((variant, idx) => (
                        <button
                            key={variant.label}
                            type="button"
                            onClick={() => setActiveCaptionIndex(idx)}
                            className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${idx === activeCaptionIndex
                                ? (isInverse ? 'bg-white/30 text-white' : 'bg-gray-900 text-white')
                                : (isInverse ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900')
                                }`}
                        >
                            {variant.label}
                        </button>
                    ))}
                </div>
            ) : null}
            <p className={`mt-3 whitespace-pre-wrap text-[14px] leading-[1.62] ${isInverse ? 'text-white/88' : 'text-gray-700'}`}>
                {activeCaption.text}
            </p>
            <p className={`mt-2 text-right text-[11px] font-medium ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                {activeCaption.text.length} caracteres
            </p>
        </div>
    );
};

// --- Main Component ---

export const ScriptBlock: React.FC<ScriptBlockProps> = ({ content, theme, onSendPrompt }) => {
    const data = useMemo(() => parseScriptContent(content), [content]);
    const isInverse = theme === 'inverse';
    const layoutVersion: ScriptLayoutVersion = SCRIPT_LAYOUT_V2_ENABLED ? 'v2' : 'v1';
    const [copied, setCopied] = useState(false);
    const [showActionOptions, setShowActionOptions] = useState(false);
    const [activeVariationIndex, setActiveVariationIndex] = useState(0);
    const [sceneExpandedMap, setSceneExpandedMap] = useState<SceneExpandedMap>({});

    useEffect(() => {
        setActiveVariationIndex(0);
        setShowActionOptions(false);
        setSceneExpandedMap({});
    }, [content]);

    const activeVariation = data.variations[activeVariationIndex] || data.variations[0];
    const isLowEvidenceConfidence = normalizeEvidenceConfidence(activeVariation?.metadata?.evidenceConfidence) === 'Baixa';
    const variationLabel = activeVariation?.label || 'V1';

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
                variation: variationLabel,
                has_caption: Boolean(activeVariation?.caption),
                layout_version: layoutVersion,
            });
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (error) {
            console.error('[chat] falha ao copiar roteiro', error);
        }
    };

    const handleToggleSceneExpand = (sceneKey: string, field: 'visual' | 'audio') => {
        setSceneExpandedMap((prev) => ({
            ...prev,
            [sceneKey]: {
                visual: field === 'visual' ? !prev[sceneKey]?.visual : Boolean(prev[sceneKey]?.visual),
                audio: field === 'audio' ? !prev[sceneKey]?.audio : Boolean(prev[sceneKey]?.audio),
            },
        }));
    };

    const trackAction = (action: string) => {
        track('chat_script_action_clicked', {
            action,
            variation: variationLabel,
            layout_version: layoutVersion,
        });
    };

    const handleToggleMoreActions = () => {
        setShowActionOptions((prev) => {
            const next = !prev;
            track('chat_script_more_actions_toggled', {
                expanded: next,
                variation: variationLabel,
                layout_version: layoutVersion,
            });
            return next;
        });
    };

    const contentToneClass = isInverse ? 'text-white' : 'text-gray-900';

    const moreSpecificPrompt = 'Reescreva o roteiro com exemplos mais específicos e aplicáveis ao meu tema.';

    const quickActions = [
        { label: 'Manter narrativa', prompt: 'Curti essa linha narrativa. Para os próximos roteiros, mantenha um estilo parecido de gancho, desenvolvimento e CTA.' },
        { label: 'Trocar narrativa', prompt: 'Essa narrativa não combinou comigo. Para os próximos roteiros, mude a linha narrativa e traga outra abordagem de gancho e CTA.' },
        { label: 'Mais direto (15s)', prompt: 'Reescreva este roteiro para ter no máximo 15 segundos, focado em retenção rápida.' },
        { label: 'Mais prático', prompt: 'Adapte o roteiro para ficar mais prático, com execução clara em passos objetivos.' },
        { label: 'Gancho mais forte', prompt: 'Torne o gancho deste roteiro mais direto e chamativo sem perder clareza.' },
        { label: 'Variação totalmente nova', prompt: 'Gere uma opção totalmente diferente para o mesmo tema.' },
    ];

    if (!activeVariation || (!activeVariation.scenes.length && !activeVariation.caption)) {
        if (isScriptContextRequiredMessage(content)) {
            return (
                <div className={`rounded-xl border p-4 sm:p-5 ${isInverse ? 'border-white/15 bg-white/5 text-white' : 'border-gray-200 bg-gray-50/60 text-gray-900'}`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/65' : 'text-gray-500'}`}>
                        Roteirista IA
                    </div>
                    <h3 className={`mt-1 text-[17px] font-semibold leading-tight ${isInverse ? 'text-white' : 'text-gray-900'}`}>
                        Falta um detalhe para fechar seu roteiro
                    </h3>
                    <p className={`mt-2 text-[14px] leading-[1.6] ${isInverse ? 'text-white/80' : 'text-gray-700'}`}>
                        Qual tema específico você quer abordar neste roteiro?
                    </p>

                    {onSendPrompt ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onSendPrompt('Tema específico: [descreva aqui]. Gere o roteiro com esse tema, mantendo CTA claro.')}
                                className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${isInverse
                                    ? 'bg-white/10 text-white hover:bg-white/15'
                                    : 'bg-gray-900 text-white hover:bg-black'
                                    }`}
                            >
                                Informar tema específico
                            </button>
                            <button
                                type="button"
                                onClick={() => onSendPrompt('Pode usar meu nicho atual e gerar um roteiro inicial com foco em retenção e CTA claro.')}
                                className={`rounded-md border px-3 py-2 text-[13px] font-medium transition-colors ${isInverse
                                    ? 'border-white/20 text-white/80 hover:text-white'
                                    : 'border-gray-200 text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                Pode usar meu nicho atual
                            </button>
                        </div>
                    ) : null}
                </div>
            );
        }

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
        <div className={`my-3 ${contentToneClass}`}>
            <div className="flex items-center gap-2 px-4 py-2 sm:px-5">
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${isInverse ? 'text-white/80' : 'text-gray-700'}`}>
                    Roteiro
                </span>
            </div>

            {data.variations.length > 1 && (
                <div className="px-4 pb-1 pt-2 sm:px-5">
                    <div className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-lg p-0.5 [-webkit-overflow-scrolling:touch] ${isInverse ? 'bg-white/5' : 'bg-gray-100'}`}>
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
                onCopyAll={handleCopyAll}
                copied={copied}
            />
            <div className="px-4 pb-2 sm:px-5 sm:pb-3">
                {activeVariation.scenes.map((scene, idx) => (
                    <SceneCard
                        key={`${activeVariation.id}-${idx}`}
                        scene={scene}
                        index={idx}
                        totalScenes={activeVariation.scenes.length}
                        isFirstScene={idx === 0}
                        theme={theme}
                        isExpandedMap={sceneExpandedMap}
                        onToggleExpand={handleToggleSceneExpand}
                    />
                ))}
            </div>

            {activeVariation.caption && (
                <CaptionBox
                    text={activeVariation.caption}
                    variants={activeVariation.captionVariants}
                    theme={theme}
                />
            )}

            {onSendPrompt && (
                <div className={`border-t px-4 py-3 sm:px-5 sm:py-[14px] ${isInverse ? 'border-white/10' : 'border-gray-100'}`}>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => {
                                trackAction('refinar_roteiro');
                                onSendPrompt('Ajuste este roteiro para o meu nicho, mantendo a ideia principal, com gancho mais específico e CTA mais claro.');
                            }}
                            className={`w-full rounded-md px-3 py-2.5 text-[13px] font-semibold transition-colors sm:w-auto ${isInverse
                                ? 'bg-white/10 text-white hover:bg-white/15'
                                : 'bg-gray-900 text-white hover:bg-black'
                                }`}
                        >
                            Ajustar para meu nicho
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                trackAction('mais_especifico');
                                onSendPrompt(moreSpecificPrompt);
                            }}
                            className={`w-full rounded-md border px-3 py-2.5 text-[13px] font-medium transition-colors sm:w-auto ${isInverse
                                ? 'border-white/20 text-white/80 hover:text-white'
                                : 'border-gray-200 text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Mais específico
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleMoreActions}
                            className={`w-full rounded-md border px-3 py-2.5 text-[13px] font-medium transition-colors sm:w-auto ${isInverse
                                ? 'border-white/20 text-white/80 hover:text-white'
                                : 'border-gray-200 text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            {showActionOptions ? 'Ocultar melhorias' : 'Outras melhorias'}
                        </button>
                    </div>
                    {showActionOptions && (
                        <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                            {isLowEvidenceConfidence ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        trackAction('refinar_tema_especifico');
                                        onSendPrompt('Refine este roteiro com um tema específico e exemplo concreto do meu nicho, mantendo o objetivo principal.');
                                    }}
                                    className={`rounded-md border px-2.5 py-2 text-[12px] font-medium transition-colors ${isInverse
                                        ? 'border-amber-300/50 bg-amber-300/10 text-amber-100 hover:bg-amber-300/15'
                                        : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                        }`}
                                >
                                    Refinar com tema específico
                                </button>
                            ) : null}
                            {quickActions.map((action) => (
                                <button
                                    key={action.label}
                                    type="button"
                                    onClick={() => {
                                        trackAction(action.label);
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
                <details className={`border-t px-4 py-3 sm:px-5 sm:py-[14px] ${isInverse ? 'border-white/10' : 'border-gray-100'}`}>
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
