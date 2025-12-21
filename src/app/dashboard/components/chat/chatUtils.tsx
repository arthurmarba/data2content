"use client";

import React from 'react';
import { PromptChip } from './PromptChip';

/* ---------- Renderização tipográfica “chat-like” ---------- */

export type RenderTheme = 'default' | 'inverse';
export type RenderDensity = 'comfortable' | 'compact';

export type RenderOptions = {
    density?: RenderDensity;
    disclosureOpen?: boolean;
    disclosureSignal?: number;
    enableDisclosure?: boolean;
    stepsStyle?: boolean;
    cacheKey?: string | null;
    normalizedText?: string;
    onToggleDisclosure?: (payload: { title: string; open: boolean }) => void;
    onCopyCode?: (payload: { code: string; language?: string | null }) => void;
    onSendPrompt?: (prompt: string) => void | Promise<void>;
};

export type NormalizationStats = {
    applied: boolean;
    fixesCount: number;
};

export type NormalizationResult = NormalizationStats & {
    text: string;
};

export function escapeHtml(s: string) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** `** bold ** `, `code` e links (sobre HTML escapado) */
export function applyInlineMarkup(escaped: string, theme: RenderTheme = 'default') {
    const codeClass =
        theme === 'inverse'
            ? 'px-1.5 py-0.5 rounded bg-white/15 text-white text-[13px] font-mono leading-tight'
            : 'px-1.5 py-0.5 rounded bg-gray-100 text-gray-900 text-[13px] font-mono leading-tight';
    const linkClass =
        theme === 'inverse'
            ? 'text-white underline decoration-white/40 hover:decoration-white/70 break-words'
            : 'text-gray-700 underline decoration-gray-300 hover:decoration-gray-500 break-words';
    const highlightClass =
        theme === 'inverse'
            ? 'inline bg-white/20 text-white px-1 py-0.5 rounded-sm align-middle'
            : 'inline bg-amber-100 text-gray-900 px-1 py-0.5 rounded-sm align-middle';
    const italicClass = theme === 'inverse' ? 'italic text-white/90' : 'italic text-gray-700';

    const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);

    let out = escaped;
    // Highlight: ==...== (somente se não há tags internas ou sinais suspeitos)
    out = out.replace(/==([^=<>\n=]{1,200})==/g, `<span class="${highlightClass}">$1</span>`);
    out = out.replace(/`([^`]+)`/g, `<code class="${codeClass}">$1</code>`);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong class="font-semibold">$1</strong>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, text, url) => {
        if (!isSafeUrl(url)) return text;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${text}</a>`;
    });
    out = out.replace(/(^|[\s(])\*([^*\n]{1,200})\*(?=[\s).,!?]|$)/g, (_match, lead, text) => {
        return `${lead}<em class="${italicClass}">${text}</em>`;
    });
    out = out.replace(/(^|[\s(])_([^_\n]{1,200})_(?=[\s).,!?]|$)/g, (_match, lead, text) => {
        return `${lead}<em class="${italicClass}">${text}</em>`;
    });
    out = out.replace(
        /(https?:\/\/[^\s)]+)(?![^<]*>)/g,
        (_match, url) => {
            if (!isSafeUrl(url)) return url;
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${url}</a>`;
        }
    );
    return out;
}

export function normalizeLooseBoldLabels(raw: string) {
    let inCodeBlock = false;
    return raw
        .split(/\r?\n/)
        .map((line) => {
            const trimmed = line.trim();
            if (/^```/.test(trimmed)) {
                inCodeBlock = !inCodeBlock;
                return line;
            }
            if (inCodeBlock) return line;
            if (line.includes('`')) return line; // skip inline code
            if (/\[[^\]]+\]\([^)]+\)/.test(line)) return line; // skip markdown links
            return line.replace(/(^|\s)([A-Za-zÀ-ÿ ]{2,40})\*\*\s*:\s*/g, (_m, sep, label) => {
                const safeLabel = label.trim();
                if (!safeLabel) return `${sep}${label}`;
                return `${sep}**${safeLabel}:** `;
            });
        })
        .join("\n");
}

// Remove artefatos simples de markdown cru (asteriscos/underscores soltos)
function stripLooseMarkers(value: string) {
    return value
        .replace(/^\*+|\*+$/g, '')
        .replace(/^_+|_+$/g, '')
        .replace(/^"+|"+$/g, '')
        .replace(/\*{2,}(?=\s|$)/g, '') // remove "**" soltos no fim de palavras/linhas
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function normalizeHeading(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function slugifyHeading(value: string) {
    const normalized = normalizeHeading(value);
    const cleaned = normalized.replace(/[^a-z0-9\s-]/g, '').trim();
    return cleaned.replace(/\s+/g, '-');
}

type SectionKind = 'summary' | 'insights' | 'actions' | 'diagnosis' | 'plan';

function getSectionKind(value: string): SectionKind | null {
    const normalized = normalizeHeading(value);
    if (!normalized) return null;
    if (['resumo', 'resumo executivo'].some((label) => normalized.startsWith(label))) return 'summary';
    if (['principais insights', 'insights', 'pontos chave', 'pontos principais'].some((label) => normalized.startsWith(label))) return 'insights';
    if (['proximas acoes', 'proximos passos', 'acoes'].some((label) => normalized.startsWith(label))) return 'actions';
    if (['diagnostico', 'analise', 'diagnostico do canal'].some((label) => normalized.startsWith(label))) return 'diagnosis';
    if (['plano de acao', 'plano estrategico', 'estrategia', 'plano'].some((label) => normalized.startsWith(label))) return 'plan';
    return null;
}

function isHyphenListItemLine(line: string) {
    const trimmed = line.trimStart();
    return /^-\s+/.test(trimmed);
}

function hasBlockyEnding(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (trimmed.endsWith('```')) return true;
    if (/(?:^|\s)#{2,}\s*$/.test(trimmed)) return true;
    return /(-{3,}|_{3,}|\*{3,})$/.test(trimmed);
}

function isContentPlanItemLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    const withoutBullet = trimmed.replace(/^[-*]\s+/, '');
    const normalized = stripLooseMarkers(withoutBullet).trim();
    if (!normalized || normalized.endsWith(':')) return false;
    if (/[—–-]/.test(normalized)) return true;
    return /\b(reel|reels|carrossel|foto|story|live|video|vídeo|post)\b/i.test(normalized);
}

function fixDanglingBoldLine(line: string) {
    const listMatch = line.match(/^(\s*(?:[-*]|\d+\.)\s+)(.*)$/);
    const prefix = listMatch ? listMatch[1] : '';
    const rest = listMatch?.[2] ?? line;
    const safeRest = rest ?? '';

    if (/`[^`]*\*\*\s*:\s*[^`]*`/.test(safeRest)) return line;

    const boldMatch = safeRest.match(/^([^*]+?)\*\*\s*:\s*(.*)$/);
    if (!boldMatch) return line;

    const label = boldMatch[1]?.trim() || '';
    const tail = boldMatch[2]?.trim() || '';
    if (!label) return line;

    return `${prefix}**${label}:**${tail ? ` ${tail}` : ''}`;
}

export function normalizePlanningMarkdownWithStats(input: string): NormalizationResult {
    const lines = input.split(/\r?\n/);
    const output: string[] = [];
    let inCodeBlock = false;
    let fixesCount = 0;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i] ?? '';
        const trimmed = line.trim();

        if (/^```/.test(trimmed)) {
            inCodeBlock = !inCodeBlock;
            output.push(line);
            continue;
        }

        if (!inCodeBlock && !/^\s*>/.test(line)) {
            const fixedLine = fixDanglingBoldLine(line);
            if (fixedLine !== line) fixesCount += 1;
            line = fixedLine;
        }

        if (!inCodeBlock && !/^\s*>/.test(line)) {
            const dayMatch = line.match(/^(\s*)Dia\s*:\s*(.*)$/i);
            const indent = dayMatch?.[1] ?? '';
            if (dayMatch && indent.length === 0 && output.length > 0) {
                const prevLine = output[output.length - 1] ?? '';
                if (
                    isHyphenListItemLine(prevLine) &&
                    isContentPlanItemLine(prevLine) &&
                    !/\bDia\s*:/i.test(prevLine) &&
                    !hasBlockyEnding(prevLine)
                ) {
                    const dayValue = (dayMatch[2] ?? '').trim();
                    const suffix = dayValue ? `Dia: ${dayValue}` : 'Dia';
                    const separator = /[:—-]\s*$/.test(prevLine) ? ' ' : ' — ';
                    output[output.length - 1] = `${prevLine}${separator}${suffix}`;
                    fixesCount += 1;
                    continue;
                }
            }
        }

        output.push(line);
    }

    return {
        text: output.join("\n"),
        fixesCount,
        applied: fixesCount > 0,
    };
}

export function normalizePlanningMarkdown(input: string) {
    return normalizePlanningMarkdownWithStats(input).text;
}

function splitLongParagraph(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.includes("\n")) return [trimmed];
    if (trimmed.length < 280) return [trimmed];
    const chunks: string[] = [];
    let buffer: string[] = [];
    let start = 0;

    const pushSentence = (sentence: string) => {
        const clean = sentence.trim();
        if (!clean) return;
        buffer.push(clean);
        const joined = buffer.join(' ');
        const shouldFlush = buffer.length >= 3 || (buffer.length >= 2 && joined.length >= 240);
        if (shouldFlush) {
            chunks.push(joined);
            buffer = [];
        }
    };

    for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed[i];
        if (ch !== '.' && ch !== '!' && ch !== '?') continue;
        const next = trimmed[i + 1];
        if (i < trimmed.length - 1 && next && next !== ' ' && next !== '\n' && next !== '\r' && next !== '\t') {
            continue;
        }
        pushSentence(trimmed.slice(start, i + 1));
        let j = i + 1;
        while (j < trimmed.length) {
            const nextChar = trimmed[j];
            if (nextChar !== ' ' && nextChar !== '\n' && nextChar !== '\r' && nextChar !== '\t') break;
            j += 1;
        }
        start = j;
        i = j - 1;
    }

    if (start < trimmed.length) {
        pushSentence(trimmed.slice(start));
    }
    if (buffer.length) chunks.push(buffer.join(' '));
    return chunks.length ? chunks : [trimmed];
}

type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION' | 'INFO';

type Block =
    | { type: 'heading'; level: 1 | 2 | 3; content: string }
    | { type: 'hr' }
    | { type: 'blockquote'; content: string }
    | { type: 'alert'; alertType: AlertType; content: string }
    | { type: 'paragraph'; content: string }
    | { type: 'code'; content: string; language?: string }
    | { type: 'table'; headers: string[]; rows: string[][] }
    | { type: 'tableFromDl'; titleLabel: string; labels: string[]; rows: { title: string; values: string[] }[]; topValues?: Record<string, string> }
    | { type: 'ul'; items: { text: string; level: number }[] }
    | { type: 'ol'; items: { text: string; level: number }[] }
    | { type: 'checklist'; items: { text: string; checked: boolean }[] }
    | { type: 'dl'; items: { label: string; value: string }[] }
    | { type: 'labels'; items: string[] }
    | { type: 'suggestedActions'; items: string[] }
    | { type: 'caption'; content: string; label: string }
    | { type: 'disclosure'; title: string; level: 1 | 2 | 3; blocks: Block[] };

type ParsedBlocksCacheEntry = {
    text: string;
    normalizedBlocks: Block[];
    disclosureBlocks: Block[];
};

const PARSED_BLOCKS_CACHE_LIMIT = 300;
const PARSED_BLOCKS_CACHE = new Map<string, ParsedBlocksCacheEntry>();

const parseTextToBlocks = (text: string): Block[] => {
    const lines = text.split(/\r?\n/);
    const blocks: Block[] = [];
    let paragraphBuffer: string[] = [];

    const pushParagraph = (content: string) => {
        const chunks = splitLongParagraph(content);
        chunks.forEach((chunk) => {
            if (chunk.trim()) {
                blocks.push({ type: 'paragraph', content: chunk });
            }
        });
    };

    const flushParagraph = () => {
        if (paragraphBuffer.length === 0) return;
        const content = paragraphBuffer.join("\n");
        pushParagraph(content);
        paragraphBuffer = [];
    };

    const isTableStart = (idx: number) => {
        const first = (lines[idx] ?? "").trim();
        const second = (lines[idx + 1] ?? "").trim();
        if (!first || !second) return false;

        // Check for common table header pattern even without leading pipe
        const hasPipe = first.includes("|");
        const hasSeparator = /^[|\s]*:?-{3,}:?[|\s-]*$/.test(second);

        if (hasPipe && hasSeparator) return true;

        // Fallback for cases where the AI forgot the first pipe but the second line is clearly a separator
        if (hasSeparator && first.split('|').length >= 2) return true;

        return false;
    };

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i] ?? "";
        const line = rawLine.trim();

        if (line === "") {
            flushParagraph();
            continue;
        }

        // Code block
        if (/^```/.test(line)) {
            flushParagraph();
            const language = line.replace(/```/, '').trim() || undefined;
            const codeLines: string[] = [];
            let j = i + 1;
            while (j < lines.length) {
                const candidate = (lines[j] ?? "").trim();
                if (/^```/.test(candidate)) break;
                codeLines.push(lines[j] ?? "");
                j++;
            }
            i = j < lines.length ? j : lines.length - 1;
            blocks.push({ type: 'code', content: codeLines.join("\n"), language });
            continue;
        }

        // HR
        if (/^(-{3,}|_{3,}|\*{3,})$/.test(line)) {
            flushParagraph();
            blocks.push({ type: 'hr' });
            continue;
        }

        // Heading
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h && h[1]) {
            flushParagraph();
            const level = Math.min(h[1].length, 3);
            const headingText = h[2] ?? "";
            blocks.push({ type: 'heading', level: level as 1 | 2 | 3, content: headingText });
            continue;
        }

        // Blockquote or Alert (lines starting with '>')
        if (/^>\s?/.test(line)) {
            flushParagraph();
            const quoteLines: string[] = [];
            let j = i;
            while (j < lines.length) {
                const nextLine = (lines[j] ?? "").trim();
                if (!/^>\s?/.test(nextLine)) break;
                quoteLines.push(nextLine.replace(/^>\s?/, ""));
                j++;
            }
            i = j - 1;

            const fullContent = quoteLines.join("\n");
            const alertMatch = fullContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|WARN)\]\s*(.*)/i);

            if (alertMatch && alertMatch[1]) {
                const rawType = alertMatch[1].toUpperCase();
                const normalizedType = rawType === 'WARN' ? 'WARNING' : rawType;
                const typeKey = normalizedType as AlertType;
                const firstLine = quoteLines[0] ?? '';
                const firstLineContent = firstLine.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|WARN)\]\s*/i, '').trim();
                const otherLines = quoteLines.slice(1).join("\n");
                const finalContent = firstLineContent ? `${firstLineContent}\n${otherLines}` : otherLines;

                blocks.push({
                    type: 'alert',
                    alertType: typeKey,
                    content: finalContent.trim()
                });
            } else {
                blocks.push({ type: 'blockquote', content: quoteLines.join("\n") });
            }
            continue;
        }

        // Tabelas
        if (isTableStart(i)) {
            flushParagraph();
            const tableLines: string[] = [];
            let j = i;
            while (j < lines.length) {
                const current = (lines[j] ?? "").trim();
                if (current === "" || !current.includes("|")) break;
                tableLines.push(current);
                j++;
            }
            i = j - 1;

            if (tableLines.length >= 2) {
                let headerLine = tableLines[0] ?? "";
                if (!/^\|/.test(headerLine)) {
                    headerLine = headerLine.replace(/^[^|]*\|/, "|");
                }
                const headers = headerLine.split("|").map(c => c.trim()).filter(Boolean);
                const rows = tableLines.slice(2).map(row =>
                    row.split("|").map(c => c.trim()).filter(Boolean)
                );
                blocks.push({ type: 'table', headers, rows });
            }
            continue;
        }

        // Listas com -, *, +, •
        const ulMatch = rawLine.match(/^(\s*)([-*+•])\s+(.*)$/);
        if (ulMatch) {
            flushParagraph();
            const items: { text: string; level: number }[] = [];
            let j = i;
            while (j < lines.length) {
                const currentRaw = lines[j] ?? "";
                const match = currentRaw.match(/^(\s*)([-*+•])\s+(.*)$/);
                if (!match) break;

                const indentation = match[1]?.length ?? 0;
                const level = Math.floor(indentation / 2);
                items.push({ text: match[3] ?? "", level });
                j++;
            }
            i = j - 1;

            const checklistItems = items.map((item) => {
                const match = item.text.match(/^\[( |x|X)\]\s+(.*)$/);
                if (!match) return null;
                const checked = (match[1] ?? '').toLowerCase() === 'x';
                const text = stripLooseMarkers(match[2] ?? '');
                return { checked, text };
            });

            if (checklistItems.every((item) => item)) {
                blocks.push({ type: 'checklist', items: checklistItems.filter(Boolean) as { text: string; checked: boolean }[] });
                continue;
            }

            const parsedItems = items.map((it) => {
                const match = it.text.match(/^([^:]+):\s*(.*)$/);
                if (!match) return null;
                const rawLabel = match[1] ?? '';
                const rawValue = match[2] ?? '';
                const label = stripLooseMarkers(rawLabel.trim());
                const valueRaw = stripLooseMarkers(rawValue.trim());
                const hasValue = Boolean(valueRaw) && valueRaw !== '**';
                return { label, value: valueRaw, hasValue };
            });

            const allHaveLabel = parsedItems.every((v) => v && v.label);
            const anyHasValue = parsedItems.some((v) => v?.hasValue);
            const allLabelValue = allHaveLabel && parsedItems.length === items.length && anyHasValue;

            if (allLabelValue) {
                blocks.push({
                    type: 'dl',
                    items: parsedItems.filter((p): p is { label: string; value: string; hasValue: boolean } => Boolean(p && p.hasValue)),
                });
            } else if (allHaveLabel && parsedItems.length === items.length && !anyHasValue) {
                blocks.push({ type: 'labels', items: parsedItems.map((p) => p?.label || '').filter(Boolean) });
            } else {
                blocks.push({
                    type: 'ul',
                    items: items.map((it) => ({ text: stripLooseMarkers(it.text), level: it.level })),
                });
            }
            continue;
        }

        // Listas numeradas
        const olMatch = rawLine.match(/^(\s*)(\d+\.)\s+(.*)$/);
        if (olMatch) {
            flushParagraph();
            const items: { text: string; level: number }[] = [];
            let j = i;
            while (j < lines.length) {
                const currentRaw = lines[j] ?? "";
                const match = currentRaw.match(/^(\s*)(\d+\.)\s+(.*)$/);
                if (!match) break;

                const indentation = match[1]?.length ?? 0;
                const level = Math.floor(indentation / 2);
                items.push({ text: stripLooseMarkers(match[3] ?? ""), level });
                j++;
            }
            i = j - 1;

            blocks.push({ type: 'ol', items });
            continue;
        }

        // Blocos de label/valor com ênfase (ex.: "**Melhor Dia:** Quarta-feira")
        const boldLabel = line.match(/^\*{2}\s*([^*]+?)\s*\*{2}\s*:?\s*(.*)$/);
        if (boldLabel) {
            flushParagraph();
            const pairs: { label: string; value: string }[] = [];

            let j = i;
            while (j < lines.length) {
                const candidate = (lines[j] ?? "").trim();
                const boldMatch = candidate.match(/^\*{2}\s*([^*]+?)\s*\*{2}\s*:?\s*(.*)$/);
                if (boldMatch) {
                    const lbl = (boldMatch[1] ?? '').trim();
                    let val = (boldMatch[2] ?? '').trim();
                    // Se o valor estiver vazio, peek próxima linha
                    if (!val && lines[j + 1]?.trim().startsWith('**')) {
                        const next = (lines[j + 1] ?? '').trim().replace(/^\*{2}\s*/, '').replace(/\*{2}$/, '').trim();
                        if (next) {
                            val = next;
                            j += 1;
                        }
                    }
                    if (val && val !== '**') {
                        pairs.push({ label: lbl.replace(/\*{2}$/g, '').trim(), value: val });
                    }
                    j += 1;
                    continue;
                }
                break;
            }
            i = j - 1;

            if (pairs.length) {
                blocks.push({
                    type: 'dl',
                    items: pairs.map((p) => ({
                        label: stripLooseMarkers(p.label),
                        value: stripLooseMarkers(p.value),
                    })),
                });
                continue;
            }
        }

        // Suggested Actions (ex.: "[BUTTON: Ver mais]", "[OPÇÃO: ...]")
        const actionMatch = line.match(/^\[(BUTTON|OPÇÃO):\s*([^\]]+)\]$/i);
        if (actionMatch) {
            flushParagraph();
            const actionItems: string[] = [];
            let j = i;
            while (j < lines.length) {
                const candidate = (lines[j] ?? "").trim();
                const m = candidate.match(/^\[(BUTTON|OPÇÃO):\s*([^\]]+)\]$/i);
                if (!m) break;
                actionItems.push(m[2]?.trim() || '');
                j++;
            }
            i = j - 1;
            if (actionItems.length) {
                blocks.push({ type: 'suggestedActions', items: actionItems });
                continue;
            }
        }

        // Caption Blocks (ex.: "[LEGENDA]" ... "[/LEGENDA]" or "[ROTEIRO]" ... "[/ROTEIRO]")
        const captionStartMatch = line.match(/^\[(LEGENDA|ROTEIRO)\]$/i);
        if (captionStartMatch) {
            flushParagraph();
            const captionType = captionStartMatch[1]?.toUpperCase() || 'LEGENDA';
            const captionLabel = captionType === 'ROTEIRO' ? 'Roteiro' : 'Legenda';
            const captionLines: string[] = [];
            let j = i + 1;
            while (j < lines.length) {
                const candidate = (lines[j] ?? "").trim();
                if (candidate.match(/^\[\/(LEGENDA|ROTEIRO)\]$/i)) {
                    break;
                }
                captionLines.push(lines[j] ?? "");
                j++;
            }
            i = j; // Skip the closing tag
            const captionContent = captionLines.join('\n').trim();
            if (captionContent) {
                blocks.push({ type: 'caption', content: captionContent, label: captionLabel });
                continue;
            }
        }

        // Parágrafo (acumula até flush)
        paragraphBuffer.push(rawLine);
    }

    flushParagraph();
    return blocks;
};

const normalizeBlocks = (blocks: Block[]): Block[] => {
    // Agrupa headings + dls em tabela se possível (union de labels, admite faltas)
    const normalizedBlocks: Block[] = [];
    for (let i = 0; i < blocks.length;) {
        const b = blocks[i];
        const next = blocks[i + 1];
        if (b?.type === 'heading' && next?.type === 'dl') {
            const rows: { title: string; valuesByLabel: Record<string, string> }[] = [];
            const labelOrder: string[] = [];
            const valueCount: Record<string, Record<string, number>> = {};
            let j = i;
            while (blocks[j]?.type === 'heading' && blocks[j + 1]?.type === 'dl') {
                const headingBlock = blocks[j] as Extract<Block, { type: 'heading' }>;
                const dlBlock = blocks[j + 1] as Extract<Block, { type: 'dl' }>;
                dlBlock.items.forEach((it) => {
                    const lbl = stripLooseMarkers(it.label);
                    if (!labelOrder.includes(lbl)) labelOrder.push(lbl);
                    const val = stripLooseMarkers(it.value);
                    valueCount[lbl] = valueCount[lbl] || {};
                    valueCount[lbl][val] = (valueCount[lbl][val] || 0) + 1;
                });
                const valuesByLabel: Record<string, string> = {};
                dlBlock.items.forEach((it) => {
                    valuesByLabel[stripLooseMarkers(it.label)] = stripLooseMarkers(it.value);
                });
                rows.push({ title: headingBlock.content, valuesByLabel });
                j += 2;
            }
            if (rows.length >= 2 && labelOrder.length > 0) {
                // Detecta valor majoritário por label para exibir destaque no header
                const topValues: Record<string, string> = {};
                labelOrder.forEach((lbl) => {
                    const map = valueCount[lbl] || {};
                    const entries = Object.entries(map);
                    if (!entries.length) return;
                    const total = rows.length;
                    const sorted = entries.sort((a, b) => b[1] - a[1]);
                    const top = sorted[0];
                    if (!top) return;
                    const [val, count] = top;
                    if (count / total >= 0.75 && val && val !== '—') {
                        topValues[lbl] = val;
                    }
                });
                const orderedRows = rows.map((row) => ({
                    title: row.title,
                    values: labelOrder.map((lbl) => row.valuesByLabel[lbl] ?? '—'),
                }));
                normalizedBlocks.push({ type: 'tableFromDl', titleLabel: 'Item', labels: labelOrder, rows: orderedRows, topValues });
                i = j;
                continue;
            }
        }
        if (b) {
            normalizedBlocks.push(b);
        }
        i += 1;
    }
    return normalizedBlocks;
};

const buildDisclosureBlocks = (normalizedBlocks: Block[]): Block[] => {
    const withDisclosure: Block[] = [];
    for (let i = 0; i < normalizedBlocks.length; i++) {
        const block = normalizedBlocks[i];
        if (!block) continue;
        if (block.type === 'heading') {
            const normalized = normalizeHeading(block.content);
            if (normalized.startsWith('detalhes') || normalized.startsWith('metodologia')) {
                const collected: Block[] = [];
                let j = i + 1;
                while (j < normalizedBlocks.length) {
                    const nextBlock = normalizedBlocks[j];
                    if (!nextBlock) {
                        j += 1;
                        continue;
                    }
                    if (nextBlock.type === 'heading' && nextBlock.level <= block.level) break;
                    collected.push(nextBlock);
                    j += 1;
                }
                withDisclosure.push({
                    type: 'disclosure',
                    title: block.content,
                    level: block.level,
                    blocks: collected,
                });
                i = j - 1;
                continue;
            }
        }
        withDisclosure.push(block);
    }
    return withDisclosure;
};

const getCachedBlocks = (text: string, cacheKey?: string | null) => {
    if (!cacheKey) {
        const normalizedBlocks = normalizeBlocks(parseTextToBlocks(text));
        return { normalizedBlocks, disclosureBlocks: buildDisclosureBlocks(normalizedBlocks) };
    }

    const cached = PARSED_BLOCKS_CACHE.get(cacheKey);
    if (cached && cached.text === text) {
        PARSED_BLOCKS_CACHE.delete(cacheKey);
        PARSED_BLOCKS_CACHE.set(cacheKey, cached);
        return { normalizedBlocks: cached.normalizedBlocks, disclosureBlocks: cached.disclosureBlocks };
    }

    const normalizedBlocks = normalizeBlocks(parseTextToBlocks(text));
    const disclosureBlocks = buildDisclosureBlocks(normalizedBlocks);
    PARSED_BLOCKS_CACHE.set(cacheKey, { text, normalizedBlocks, disclosureBlocks });

    if (PARSED_BLOCKS_CACHE.size > PARSED_BLOCKS_CACHE_LIMIT) {
        const firstKey = PARSED_BLOCKS_CACHE.keys().next().value;
        if (firstKey) PARSED_BLOCKS_CACHE.delete(firstKey);
    }

    return { normalizedBlocks, disclosureBlocks };
};

type CodeBlockProps = {
    code: string;
    language?: string | null;
    theme: RenderTheme;
    onCopy?: (payload: { code: string; language?: string | null }) => void;
};

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, theme, onCopy }) => {
    const [copied, setCopied] = React.useState(false);
    const timeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            onCopy?.({ code, language: language || null });
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
        } catch (error) {
            console.error('[chat] falha ao copiar codigo', error);
        }
    };

    const wrapperClass =
        theme === 'inverse'
            ? 'border-white/15 bg-white/10 text-white'
            : 'border-gray-200 bg-gray-50 text-gray-900';
    const headerClass =
        theme === 'inverse'
            ? 'border-b border-white/10 text-white/80'
            : 'border-b border-gray-200 text-gray-600';
    const codeClass = theme === 'inverse' ? 'text-white/90' : 'text-gray-800';
    const label = language?.trim() ? language.trim() : 'Código';
    const copyLabel = copied ? 'Copiado!' : 'Copiar código';
    const copyAriaLabel = copied ? 'Código copiado' : 'Copiar código';

    return (
        <div className={`my-4 overflow-hidden rounded-xl border ${wrapperClass}`}>
            <div className={`flex items-center justify-between gap-2 px-3 py-2 text-[11px] uppercase tracking-wide ${headerClass}`}>
                <span className="font-semibold">{label}</span>
                <button
                    type="button"
                    onClick={handleCopy}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${theme === 'inverse'
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                    aria-label={copyAriaLabel}
                    title={copyAriaLabel}
                    data-testid="chat-copy-code"
                >
                    {copyLabel}
                </button>
                <span className="sr-only" role="status" aria-live="polite">
                    {copied ? 'Código copiado' : ''}
                </span>
            </div>
            <pre className="max-h-[360px] overflow-x-auto overflow-y-auto px-4 py-3">
                <code className={`block text-[13px] leading-6 font-mono ${codeClass}`}>
                    {code}
                </code>
            </pre>
        </div>
    );
}

type CaptionBlockProps = {
    content: string;
    label: string;
    theme: RenderTheme;
};

const CaptionBlock: React.FC<CaptionBlockProps> = ({ content, label, theme }) => {
    const [copied, setCopied] = React.useState(false);
    const timeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        };
    }, []);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
            timeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
        } catch (error) {
            console.error('[chat] falha ao copiar legenda', error);
        }
    };

    const wrapperClass =
        theme === 'inverse'
            ? 'border-white/15 bg-white/10 text-white'
            : 'border-brand-primary/20 bg-brand-primary/5 text-gray-900 shadow-sm shadow-brand-primary/5';

    const headerClass =
        theme === 'inverse'
            ? 'border-b border-white/10 text-white/80'
            : 'border-b border-brand-primary/10 text-brand-primary font-bold';

    const contentClass = theme === 'inverse' ? 'text-white/90' : 'text-gray-800';
    const copyLabel = copied ? 'Copiado!' : 'Copiar';

    return (
        <div className={`my-4 overflow-hidden rounded-2xl border ${wrapperClass}`}>
            <div className={`flex items-center justify-between gap-2 px-4 py-2 text-[11px] uppercase tracking-wider ${headerClass}`}>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                    <span>{label} Sugerida</span>
                </div>
                <button
                    type="button"
                    onClick={handleCopy}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all active:scale-95 ${theme === 'inverse'
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-brand-primary text-white hover:bg-brand-primary-dark shadow-sm'}`}
                >
                    {copyLabel}
                </button>
            </div>
            <div className="px-4 py-4 whitespace-pre-wrap italic">
                <p className={`text-[15px] leading-relaxed font-medium ${contentClass}`}>
                    {content}
                </p>
            </div>
        </div>
    );
};

type DisclosureProps = {
    title: string;
    theme: RenderTheme;
    forceOpen?: boolean;
    forceSignal?: number;
    titleSuffix?: string;
    anchorId?: string;
    onToggle?: (payload: { title: string; open: boolean }) => void;
    children: React.ReactNode;
};

const Disclosure: React.FC<DisclosureProps> = ({
    title,
    theme,
    forceOpen,
    forceSignal,
    titleSuffix,
    anchorId,
    onToggle,
    children,
}) => {
    const contentId = React.useId();
    const [open, setOpen] = React.useState(Boolean(forceOpen));

    React.useEffect(() => {
        if (typeof forceOpen === 'boolean') {
            setOpen(forceOpen);
        }
    }, [forceOpen, forceSignal]);

    const containerClass =
        theme === 'inverse'
            ? 'border-white/15 bg-white/5 text-white'
            : 'border-gray-200 bg-white text-gray-800';
    const summaryClass =
        theme === 'inverse'
            ? 'text-white/90 hover:text-white'
            : 'text-gray-800 hover:text-gray-900';
    const badgeClass =
        theme === 'inverse'
            ? 'bg-white/10 text-white/80'
            : 'bg-gray-100 text-gray-600';

    return (
        <details
            id={anchorId}
            open={open}
            onToggle={(event) => {
                const next = (event.currentTarget as HTMLDetailsElement).open;
                setOpen(next);
                onToggle?.({ title, open: next });
            }}
            className={`group my-4 rounded-xl border ${containerClass}`}
        >
            <summary
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold ${summaryClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-magenta focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
                aria-expanded={open}
                aria-controls={contentId}
                data-testid="chat-disclosure-toggle"
            >
                <span className="flex items-center gap-2">
                    <span>{title}</span>
                    {titleSuffix ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>
                            {titleSuffix}
                        </span>
                    ) : null}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>
                    {open ? 'Recolher' : 'Ver mais'}
                </span>
            </summary>
            <div id={contentId} className="px-4 pb-4 pt-1">
                {children}
            </div>
        </details>
    );
};

/** Tipografia com respiro legível */
export function renderFormatted(text: string, theme: RenderTheme = 'default', options: RenderOptions = {}) {
    const isInverse = theme === 'inverse';
    const density = options.density ?? 'comfortable';
    const stepsStyle = options.stepsStyle ?? true;
    const allowDisclosure = options.enableDisclosure !== false;

    const hrClass = isInverse ? 'my-6 border-t border-white/30' : 'my-6 border-t border-gray-200/80';
    const blockquoteClass = isInverse
        ? 'border-l-4 border-white/40 pl-4 italic text-[14px] leading-[1.6] opacity-90 my-4 text-white'
        : 'border-l-4 border-gray-300 pl-4 italic text-[14px] leading-[1.6] text-gray-600 my-4';
    const h1Class = `text-2xl font-bold tracking-tight ${isInverse ? 'text-white' : 'text-gray-900'} ${density === 'compact' ? 'mt-5 mb-2' : 'mt-6 mb-3'}`;
    const h2Class = `text-xl font-bold tracking-tight ${isInverse ? 'text-white' : 'text-gray-800'} ${density === 'compact' ? 'mt-4 mb-2' : 'mt-6 mb-2.5'}`;
    const h3Class = `text-lg font-bold tracking-tight ${isInverse ? 'text-white' : 'text-gray-800'} ${density === 'compact' ? 'mt-3 mb-1.5' : 'mt-5 mb-2'}`;
    const paragraphClass = `${density === 'compact' ? 'text-[14px] my-2' : 'text-[15px] my-3'} leading-[1.6] ${isInverse ? 'text-white' : 'text-gray-800'}`;
    const listClass = `${density === 'compact' ? 'text-[14px] my-2' : 'text-[15px] my-3'} leading-[1.55] ${isInverse ? 'text-white' : 'text-gray-800'}`;
    const tableTextClass = `min-w-full text-left text-[13px] leading-5 ${isInverse ? 'text-white' : 'text-gray-800'}`;
    const tableHeaderClass = `px-3 py-2 border-b ${isInverse ? 'border-white/25 bg-white/10 text-white/90' : 'border-gray-200 bg-gray-50 text-gray-700'} font-semibold`;
    const tableCellClass = `px-3 py-2 border-b ${isInverse ? 'border-white/15' : 'border-gray-100'} align-top break-words`;
    const tableStripeClass = isInverse ? 'bg-white/5' : 'bg-gray-50/70';
    const labelClass = isInverse ? 'font-semibold text-white' : 'font-semibold text-gray-900';
    const valueClass = isInverse ? 'text-white/90' : 'text-gray-800';
    const tocContainerClass = isInverse ? 'border-white/15 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-800';
    const tocSummaryClass = isInverse ? 'text-white/90 hover:text-white' : 'text-gray-800 hover:text-gray-900';
    const tocBadgeClass = isInverse ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-600';
    const tocLinkClass = isInverse ? 'text-white/80 hover:text-white underline decoration-white/30' : 'text-gray-700 hover:text-gray-900 underline decoration-gray-200';
    const summaryCardClass = 'my-4 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-4 text-gray-800 shadow-sm';
    const insightsCardClass = 'my-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-4 text-gray-800 shadow-sm';
    const actionsCardClass = 'my-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-4 text-gray-800 shadow-sm';
    const diagnosisCardClass = 'my-4 rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-4 text-gray-800 shadow-sm';
    const planCardClass = 'my-4 rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-4 text-gray-800 shadow-sm';

    const alertBaseClass = "my-4 rounded-xl p-4 text-sm border-l-4";
    const alertStyles: Record<AlertType, string> = {
        INFO: isInverse
            ? 'bg-blue-900/30 border-blue-400 text-blue-100'
            : 'bg-blue-50 border-blue-500 text-blue-800',
        NOTE: isInverse
            ? 'bg-slate-900/30 border-slate-300 text-slate-100'
            : 'bg-slate-50 border-slate-300 text-slate-800',
        TIP: isInverse
            ? 'bg-emerald-900/30 border-emerald-400 text-emerald-100'
            : 'bg-emerald-50 border-emerald-500 text-emerald-800',
        IMPORTANT: isInverse
            ? 'bg-violet-900/30 border-violet-400 text-violet-100'
            : 'bg-violet-50 border-violet-500 text-violet-800',
        WARNING: isInverse
            ? 'bg-amber-900/30 border-amber-400 text-amber-100'
            : 'bg-amber-50 border-amber-500 text-amber-800',
        CAUTION: isInverse
            ? 'bg-red-900/30 border-red-400 text-red-100'
            : 'bg-red-50 border-red-500 text-red-800',
    };

    const alertTitleMap: Record<AlertType, string> = {
        INFO: 'Info',
        NOTE: 'Nota',
        TIP: 'Dica',
        IMPORTANT: 'Importante',
        WARNING: 'Atenção',
        CAUTION: 'Cuidado',
    };
    const alertIconMap: Record<AlertType, string> = {
        INFO: 'i',
        NOTE: 'i',
        TIP: 'T',
        IMPORTANT: '*',
        WARNING: '!',
        CAUTION: '!',
    };
    const normalizedText = options.normalizedText ?? normalizePlanningMarkdown(text);
    const { normalizedBlocks, disclosureBlocks } = getCachedBlocks(normalizedText, options.cacheKey);
    const blocksToRender = allowDisclosure ? disclosureBlocks : normalizedBlocks;
    const allowSectionCards = !isInverse;

    const headingMeta: Array<{ id: string; title: string; level: number; index: number }> = [];
    const headingIdMap = new Map<number, string>();
    const headingSlugCounts = new Map<string, number>();
    blocksToRender.forEach((block, index) => {
        if (block.type !== 'heading' && block.type !== 'disclosure') return;
        const title = block.type === 'heading' ? block.content : block.title;
        const baseSlug = slugifyHeading(title) || `section-${headingMeta.length + 1}`;
        const count = headingSlugCounts.get(baseSlug) ?? 0;
        headingSlugCounts.set(baseSlug, count + 1);
        const id = count ? `${baseSlug}-${count + 1}` : baseSlug;
        headingMeta.push({ id, title, level: block.level, index });
        headingIdMap.set(index, id);
    });
    const tocHeadings = headingMeta.filter((heading) => heading.level === 2);
    const showToc = allowSectionCards && tocHeadings.length >= 3;

    const renderValueChipsOrText = (val: string, labelHint?: string) => {
        const cleanValue = stripLooseMarkers(val);
        const isPriority = labelHint && /prioridade/i.test(labelHint) && /alta|m[eé]dia|baixa/i.test(cleanValue);

        // Refined chip logic: only split if there are at least 2 commas AND chips are short.
        // This avoids turning full sentences into fragments.
        const commasCount = (cleanValue.match(/,/g) || []).length;
        if (commasCount >= 2) {
            const chips = cleanValue.split(',').map((p) => p.trim()).filter(Boolean);
            const allShort = chips.every(c => c.length <= 35);
            if (allShort) {
                return (
                    <span className="flex flex-wrap gap-1.5">
                        {chips.map((chip, idx) => (
                            <span
                                key={idx}
                                className={
                                    isInverse
                                        ? 'inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[12px] font-medium text-white'
                                        : 'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[12px] font-medium text-gray-700'
                                }
                            >
                                {chip}
                            </span>
                        ))}
                    </span>
                );
            }
        }
        if (isPriority) {
            const tone =
                /alta/i.test(cleanValue) ? (isInverse ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-900') :
                    /m[eé]dia/i.test(cleanValue) ? (isInverse ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-800') :
                        isInverse ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-800';
            return (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tone}`}>
                    {cleanValue}
                </span>
            );
        }
        const html = applyInlineMarkup(escapeHtml(cleanValue), theme);
        return <span dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const inlineMarkup = (raw: string) => (
        <span dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(raw), theme) }} />
    );

    const inlineHtml = (raw: string) => applyInlineMarkup(escapeHtml(raw), theme).replace(/\n/g, "<br/>");

    const collectSectionBlocks = (list: Block[], startIndex: number, level: 1 | 2 | 3) => {
        const collected: Block[] = [];
        let j = startIndex + 1;
        while (j < list.length) {
            const candidate = list[j];
            if (!candidate) {
                j += 1;
                continue;
            }
            if ((candidate.type === 'heading' || candidate.type === 'disclosure') && candidate.level <= level) break;
            collected.push(candidate);
            j += 1;
        }
        return { collected, endIndex: j - 1 };
    };

    const extractSectionItems = (blocks: Block[]) => {
        const items: string[] = [];
        for (const block of blocks) {
            switch (block.type) {
                case 'paragraph':
                    items.push(block.content);
                    break;
                case 'ul':
                case 'ol':
                    items.push(...block.items.map(it => it.text));
                    break;
                case 'checklist':
                    items.push(...block.items.map((item) => item.text));
                    break;
                case 'dl':
                    items.push(...block.items.map((item) => `${item.label}: ${item.value}`));
                    break;
                case 'labels':
                    items.push(...block.items);
                    break;
                default:
                    return null;
            }
        }
        const cleaned = items.map((item) => stripLooseMarkers(item).trim()).filter(Boolean);
        return cleaned.length ? cleaned : null;
    };

    const extractActionItems = (blocks: Block[]) => {
        const items: Array<{ text: string; checked: boolean }> = [];
        for (const block of blocks) {
            switch (block.type) {
                case 'checklist':
                    items.push(...block.items.map((item) => ({ text: item.text, checked: item.checked })));
                    break;
                case 'ul':
                case 'ol':
                    items.push(...block.items.map((it) => ({ text: it.text, checked: false })));
                    break;
                case 'paragraph':
                    items.push({ text: block.content, checked: false });
                    break;
                case 'dl':
                    items.push(...block.items.map((item) => ({ text: `${item.label}: ${item.value}`, checked: false })));
                    break;
                case 'labels':
                    items.push(...block.items.map((text) => ({ text, checked: false })));
                    break;
                default:
                    return null;
            }
        }
        const cleaned = items
            .map((item) => ({ ...item, text: stripLooseMarkers(item.text).trim() }))
            .filter((item) => item.text);
        return cleaned.length ? cleaned : null;
    };

    const renderInsightItem = (item: string) => {
        const parts = item.split(/:\s+/);
        if (parts.length > 1) {
            const lead = parts.shift() || '';
            const rest = parts.join(': ');
            return (
                <span>
                    <span className="font-semibold" dangerouslySetInnerHTML={{ __html: inlineHtml(lead) }} />{' '}
                    <span dangerouslySetInnerHTML={{ __html: inlineHtml(rest) }} />
                </span>
            );
        }
        return <span dangerouslySetInnerHTML={{ __html: inlineHtml(item) }} />;
    };

    const tableWrapper = (key: string, node: JSX.Element) => (
        <div
            key={key}
            className={`overflow-x-auto my-3 max-w-full rounded-xl border ${isInverse ? 'border-white/10' : 'border-gray-100'}`}
        >
            {node}
        </div>
    );

    const renderTableCellValue = (value: string, labelHint?: string) => {
        return renderValueChipsOrText(value, labelHint);
    };

    const TableBlock: React.FC<{ block: Extract<Block, { type: 'table' | 'tableFromDl' }>; keyBase: string }> = ({
        block,
        keyBase,
    }) => {
        const [mode, setMode] = React.useState<'table' | 'cards'>('table');
        const [isSmall, setIsSmall] = React.useState(false);
        const columnCount = block.type === 'table' ? block.headers.length : block.labels.length + 1;
        const shouldToggle = columnCount > 3;
        const hasWideCells = React.useMemo(() => {
            if (block.type === 'table') {
                return block.rows.some((row) => row.some((cell) => (cell ?? '').length > 48));
            }
            return block.rows.some((row) => row.values.some((cell) => (cell ?? '').length > 48));
        }, [block]);

        React.useEffect(() => {
            if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
            const media = window.matchMedia('(max-width: 640px)');
            const update = () => setIsSmall(media.matches);
            update();
            media.addEventListener('change', update);
            return () => media.removeEventListener('change', update);
        }, []);

        React.useEffect(() => {
            if (isSmall || (shouldToggle && hasWideCells)) {
                setMode('cards');
            }
        }, [isSmall, shouldToggle, hasWideCells]);

        const showToggle = shouldToggle || isSmall || hasWideCells;
        const toggleClass = isInverse
            ? 'border-white/20 bg-white/5 text-white/80 hover:text-white'
            : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900';

        const renderTable = () => {
            if (block.type === 'table') {
                return tableWrapper(
                    `tbl-${keyBase}`,
                    <table className={`${tableTextClass} min-w-[480px]`}>
                        <thead>
                            <tr>
                                {block.headers.map((hCell, cIdx) => {
                                    const html = applyInlineMarkup(escapeHtml(hCell), theme);
                                    return (
                                        <th key={cIdx} className={`${tableHeaderClass} text-left sticky top-0 z-10`} dangerouslySetInnerHTML={{ __html: html }} />
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, rIdx) => (
                                <tr key={rIdx} className={rIdx % 2 === 1 ? tableStripeClass : undefined}>
                                    {row.map((cell, cIdx) => {
                                        const numeric = /^[<>~]?\s*[-+]?(?:\d[\d.,]*|R\$)\s*[%kM]?\s*$/i.test(stripLooseMarkers(cell));
                                        const html = applyInlineMarkup(escapeHtml(cell), theme);
                                        return (
                                            <td
                                                key={cIdx}
                                                className={`${tableCellClass} ${numeric ? 'text-right border-l border-current/10 min-w-[72px]' : cIdx > 0 ? 'border-l border-current/10' : ''}`}
                                                dangerouslySetInnerHTML={{ __html: html }}
                                            />
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                );
            }

            return tableWrapper(
                `tbl-dl-${keyBase}`,
                <table className={`${tableTextClass} min-w-[480px]`}>
                    <caption className="sr-only">{inlineMarkup(block.titleLabel)}</caption>
                    <thead>
                        <tr>
                            <th className={`${tableHeaderClass} text-left sticky top-0 z-10`}>{inlineMarkup(block.titleLabel)}</th>
                            {block.labels.map((lbl, cIdx) => (
                                <th key={cIdx} className={`${tableHeaderClass} text-left sticky top-0 z-10`}>
                                    <div className="flex flex-col items-start gap-1">
                                        <span>{inlineMarkup(lbl)}</span>
                                        {block.topValues && block.topValues[lbl] ? (
                                            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-[10px] font-semibold leading-tight">
                                                Mais comum: {block.topValues[lbl]}
                                            </span>
                                        ) : null}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row, rIdx) => (
                            <tr key={rIdx} className={rIdx % 2 === 1 ? tableStripeClass : undefined}>
                                <td className={tableCellClass}>{inlineMarkup(row.title)}</td>
                                {row.values.map((val, cIdx) => {
                                    const labelHint = block.labels[cIdx] ?? '';
                                    const numeric = /^[<>~]?\s*[-+]?(?:\d[\d.,]*|R\$)\s*[%kM]?\s*$/i.test(stripLooseMarkers(val));
                                    return (
                                        <td key={cIdx} className={`${tableCellClass} ${numeric ? 'text-right border-l border-current/10 min-w-[72px]' : cIdx > 0 ? 'border-l border-current/10' : ''}`}>
                                            {renderValueChipsOrText(val, labelHint)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        };

        const renderCards = () => {
            if (block.type === 'table') {
                return (
                    <div className="grid gap-3">
                        {block.rows.map((row, rIdx) => (
                            <div
                                key={rIdx}
                                className={`rounded-xl border p-3 ${isInverse ? 'border-white/15 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-800'}`}
                            >
                                <div className="space-y-2">
                                    {block.headers.map((header, cIdx) => {
                                        const value = row[cIdx] ?? '—';
                                        return (
                                            <div key={cIdx} className="flex items-start justify-between gap-4">
                                                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{inlineMarkup(header)}</span>
                                                <span className="text-[13px] text-right">{renderTableCellValue(value)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                );
            }

            return (
                <div className="grid gap-3">
                    {block.rows.map((row, rIdx) => (
                        <div
                            key={rIdx}
                            className={`rounded-xl border p-3 ${isInverse ? 'border-white/15 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-800'}`}
                        >
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-4">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{inlineMarkup(block.titleLabel)}</span>
                                    <span className="text-[13px] text-right">{inlineMarkup(row.title)}</span>
                                </div>
                                {block.labels.map((label, cIdx) => {
                                    const value = row.values[cIdx] ?? '—';
                                    return (
                                        <div key={cIdx} className="flex items-start justify-between gap-4">
                                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{inlineMarkup(label)}</span>
                                            <span className="text-[13px] text-right">{renderTableCellValue(value, label)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            );
        };

        return (
            <div className="my-3" data-testid="chat-table-container">
                {showToggle ? (
                    <div className="mb-2 flex items-center justify-between text-[11px]" data-testid="chat-table-toggle">
                        <span className={isInverse ? 'text-white/60' : 'text-gray-500'}>
                            Visualização da tabela
                        </span>
                        <div className="flex items-center rounded-full border p-0.5">
                            <button
                                type="button"
                                onClick={() => setMode('table')}
                                className={`rounded-full px-2.5 py-1 font-semibold ${toggleClass} ${mode === 'table' ? (isInverse ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-800') : ''}`}
                                aria-pressed={mode === 'table'}
                            >
                                Tabela
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('cards')}
                                className={`rounded-full px-2.5 py-1 font-semibold ${toggleClass} ${mode === 'cards' ? (isInverse ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-800') : ''}`}
                                aria-pressed={mode === 'cards'}
                            >
                                Cards
                            </button>
                        </div>
                    </div>
                ) : null}
                {mode === 'table' ? renderTable() : renderCards()}
            </div>
        );
    };

    const renderBlocks = (list: Block[], keyPrefix: string, allowSections = true) => {
        const elements: JSX.Element[] = [];
        for (let idx = 0; idx < list.length; idx++) {
            const block = list[idx];
            if (!block) continue;
            const next = list[idx + 1];
            const keyBase = `${keyPrefix}-${idx}`;
            const headingId = headingIdMap.get(idx);

            if (
                allowSectionCards &&
                !isInverse &&
                block.type === 'heading' &&
                block.level === 2
            ) {
                const sectionKind = getSectionKind(block.content);
                if (sectionKind) {
                    const { collected, endIndex } = collectSectionBlocks(list, idx, block.level);
                    const sectionItems = sectionKind === 'actions' ? null : extractSectionItems(collected);
                    const actionItems = sectionKind === 'actions' ? extractActionItems(collected) : null;

                    if ((sectionKind === 'summary' || sectionKind === 'diagnosis' || sectionKind === 'plan') && sectionItems?.length) {
                        const isDiagnosis = sectionKind === 'diagnosis';
                        const isPlan = sectionKind === 'plan';
                        const cardClass = isDiagnosis ? diagnosisCardClass : (isPlan ? planCardClass : summaryCardClass);
                        const label = isDiagnosis ? 'Diagnóstico' : (isPlan ? 'Plano Estratégico' : 'Resumo');
                        const iconChar = isDiagnosis ? 'D' : (isPlan ? 'P' : 'R');
                        const iconBg = isDiagnosis ? 'bg-sky-100 text-sky-800' : (isPlan ? 'bg-violet-100 text-violet-800' : 'bg-amber-100 text-amber-800');

                        elements.push(
                            <section key={`section-${sectionKind}-${keyBase}`} id={headingId} className={cardClass} data-testid={`chat-section-${sectionKind}`}>
                                <div className="mb-2 flex items-center gap-2">
                                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${iconBg}`}>{iconChar}</span>
                                    <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
                                </div>
                                <div className="space-y-2 text-[15px] leading-[1.6] text-gray-800">
                                    {sectionItems.slice(0, 6).map((item, i) => (
                                        <p key={i} dangerouslySetInnerHTML={{ __html: inlineHtml(item) }} />
                                    ))}
                                </div>
                            </section>
                        );
                        idx = endIndex;
                        continue;
                    }

                    if (sectionKind === 'insights' && sectionItems?.length) {
                        elements.push(
                            <section key={`section-insights-${keyBase}`} id={headingId} className={insightsCardClass} data-testid="chat-section-insights">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-800 text-[12px] font-bold">I</span>
                                    <h3 className="text-lg font-semibold text-gray-900">Principais insights</h3>
                                </div>
                                <ul className="space-y-2 pl-1 text-[15px] leading-[1.6] text-gray-800">
                                    {sectionItems.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" aria-hidden />
                                            <span>{renderInsightItem(item)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                        idx = endIndex;
                        continue;
                    }

                    if (sectionKind === 'actions' && actionItems?.length) {
                        elements.push(
                            <section key={`section-actions-${keyBase}`} id={headingId} className={actionsCardClass} data-testid="chat-section-actions">
                                <div className="mb-2 flex items-center gap-2">
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[12px] font-bold">A</span>
                                    <h3 className="text-lg font-semibold text-gray-900">Próximas ações</h3>
                                </div>
                                <ul className="space-y-2 text-[15px] leading-[1.55] text-gray-800">
                                    {actionItems.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span
                                                aria-hidden
                                                className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${item.checked ? 'border-emerald-300 bg-emerald-500 text-white' : 'border-gray-300 bg-white'}`}
                                            >
                                                {item.checked ? 'x' : ''}
                                            </span>
                                            <span dangerouslySetInnerHTML={{ __html: inlineHtml(item.text) }} />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                        idx = endIndex;
                        continue;
                    }
                }
            }

            if (block.type === 'caption') {
                elements.push(
                    <CaptionBlock
                        key={`caption-${keyBase}`}
                        content={block.content}
                        label={block.label}
                        theme={theme}
                    />
                );
                continue;
            }

            if (block.type === 'suggestedActions') {
                elements.push(
                    <div key={`actions-${keyBase}`} className="my-6 flex flex-wrap justify-center gap-3">
                        {block.items.map((label, idx) => (
                            <PromptChip
                                key={idx}
                                label={label}
                                onClick={() => options.onSendPrompt?.(label)}
                            />
                        ))}
                    </div>
                );
                continue;
            }

            if (block.type === 'hr') {
                elements.push(<hr key={`hr-${keyBase}`} className={hrClass} />);
                continue;
            }
            if (block.type === 'heading') {
                const mbTight = next && (next.type === 'ul' || next.type === 'ol' || next.type === 'dl' || next.type === 'tableFromDl' || next.type === 'labels' || next.type === 'checklist');
                if (block.level === 1) {
                    elements.push(
                        <h2
                            key={`h1-${keyBase}`}
                            id={headingId}
                            className={`${h1Class} ${mbTight ? 'mb-2' : ''}`}
                            dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(block.content), theme) }}
                        />
                    );
                } else if (block.level === 2) {
                    elements.push(
                        <h3
                            key={`h2-${keyBase}`}
                            id={headingId}
                            className={`${h2Class} ${mbTight ? 'mb-1.5' : ''}`}
                            dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(block.content), theme) }}
                        />
                    );
                } else {
                    elements.push(
                        <h4
                            key={`h3-${keyBase}`}
                            id={headingId}
                            className={`${h3Class} ${mbTight ? 'mb-1.5' : ''}`}
                            dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(block.content), theme) }}
                        />
                    );
                }
                continue;
            }
            if (block.type === 'blockquote') {
                const html = applyInlineMarkup(escapeHtml(block.content), theme).replace(/\n/g, "<br/>");
                elements.push(<blockquote key={`bq-${keyBase}`} className={blockquoteClass} dangerouslySetInnerHTML={{ __html: html }} />);
                continue;
            }
            if (block.type === 'alert') {
                const style = alertStyles[block.alertType] || alertStyles.NOTE;
                const title = alertTitleMap[block.alertType] || 'Nota';
                const icon = alertIconMap[block.alertType] || 'i';
                const html = applyInlineMarkup(escapeHtml(block.content), theme).replace(/\n/g, "<br/>");

                elements.push(
                    <div key={`alert-${keyBase}`} className={`${alertBaseClass} ${style}`}>
                        <div className="font-bold mb-1 flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px] font-semibold">
                                {icon}
                            </span>
                            {title}
                        </div>
                        <div dangerouslySetInnerHTML={{ __html: html }} />
                    </div>
                );
                continue;
            }
            if (block.type === 'paragraph') {
                const html = applyInlineMarkup(escapeHtml(block.content), theme).replace(/\n/g, "<br/>");
                elements.push(<p key={`p-${keyBase}`} className={paragraphClass} dangerouslySetInnerHTML={{ __html: html }} />);
                continue;
            }
            if (block.type === 'code') {
                elements.push(
                    <CodeBlock
                        key={`code-${keyBase}`}
                        code={block.content}
                        language={block.language}
                        theme={theme}
                        onCopy={options.onCopyCode}
                    />
                );
                continue;
            }
            if (block.type === 'ul') {
                const hasNestedItems = block.items.some((item) => item.level > 0);
                const itemTexts = block.items.map((item) => item.text ?? '');
                const firstText = itemTexts[0] ?? '';
                const hasTitleBullet = !hasNestedItems && itemTexts.length > 1 && firstText.trim().endsWith(':');
                const allLongSentences = !hasNestedItems && itemTexts.length >= 2 && itemTexts.every((text) => text.length > 80);
                const allShortLabels =
                    !hasNestedItems &&
                    itemTexts.length > 0 &&
                    itemTexts.length <= 8 &&
                    itemTexts.every((text) => {
                        const trimmed = text.trim();
                        return trimmed.length > 0 && trimmed.length <= 24 && !/[.!?]$/.test(trimmed);
                    });

                if (allShortLabels) {
                    elements.push(
                        <div key={`ul-chips-${keyBase}`} className="flex flex-wrap gap-2 my-2">
                            {block.items.map((item, jdx) => (
                                <span
                                    key={jdx}
                                    className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold ${isInverse
                                        ? 'border-white/20 bg-white/10 text-white'
                                        : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                                    dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(item.text), theme) }}
                                />
                            ))}
                        </div>
                    );
                } else if (hasTitleBullet || allLongSentences) {
                    if (hasTitleBullet) {
                        const title = firstText.trim().replace(/:\s*$/, '');
                        elements.push(
                            <p
                                key={`ul-title-${keyBase}`}
                                className={`${paragraphClass} font-semibold`}
                                dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(title), theme) }}
                            />
                        );
                        block.items.slice(1).forEach((it, jdx) => {
                            const html = applyInlineMarkup(escapeHtml(it.text), theme);
                            elements.push(<p key={`ul-title-item-${keyBase}-${jdx}`} className={paragraphClass} dangerouslySetInnerHTML={{ __html: html }} />);
                        });
                    } else {
                        block.items.forEach((it, jdx) => {
                            const html = applyInlineMarkup(escapeHtml(it.text), theme);
                            elements.push(<p key={`ul-paragraph-${keyBase}-${jdx}`} className={paragraphClass} dangerouslySetInnerHTML={{ __html: html }} />);
                        });
                    }
                } else {
                    elements.push(
                        <ul key={`ul-${keyBase}`} className={`list-disc space-y-1.5 ${listClass}`}>
                            {block.items.map((it, jdx) => {
                                const html = applyInlineMarkup(escapeHtml(it.text), theme);
                                return (
                                    <li
                                        key={jdx}
                                        className="ml-5"
                                        style={{ marginLeft: `${20 + (it.level * 20)}px` }}
                                        dangerouslySetInnerHTML={{ __html: html }}
                                    />
                                );
                            })}
                        </ul>
                    );
                }
                continue;
            }
            if (block.type === 'checklist') {
                const boxClass = isInverse
                    ? 'border-white/40 bg-white/10'
                    : 'border-gray-300 bg-white';
                elements.push(
                    <ul key={`checklist-${keyBase}`} className={`space-y-2 ${listClass}`}>
                        {block.items.map((item, jdx) => {
                            const html = applyInlineMarkup(escapeHtml(item.text), theme);
                            return (
                                <li key={jdx} className="flex items-start gap-2">
                                    <span
                                        aria-hidden
                                        className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${boxClass} ${item.checked ? (isInverse ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-500 text-white') : ''}`}
                                    >
                                        {item.checked ? 'x' : ''}
                                    </span>
                                    <span className="sr-only">
                                        {item.checked ? 'Concluído: ' : 'Pendente: '}
                                    </span>
                                    <span dangerouslySetInnerHTML={{ __html: html }} />
                                </li>
                            );
                        })}
                    </ul>
                );
                continue;
            }
            if (block.type === 'ol') {
                if (stepsStyle) {
                    const stepCircleClass = isInverse ? 'border-white/40 text-white' : 'border-gray-300 text-gray-700';
                    const stepSizeClass = density === 'compact' ? 'h-5 w-5 text-[11px]' : 'h-6 w-6 text-[12px]';
                    elements.push(
                        <ol key={`ol-steps-${keyBase}`} className={`space-y-2 ${listClass}`}>
                            {block.items.map((it, jdx) => {
                                const html = applyInlineMarkup(escapeHtml(it.text), theme);
                                return (
                                    <li
                                        key={jdx}
                                        className="flex items-start gap-3"
                                        style={{ marginLeft: `${it.level * 20}px` }}
                                    >
                                        {it.level === 0 ? (
                                            <span
                                                aria-hidden
                                                className={`mt-0.5 flex items-center justify-center rounded-full border font-semibold ${stepSizeClass} ${stepCircleClass}`}
                                            >
                                                {jdx + 1}
                                            </span>
                                        ) : (
                                            <span className="mt-0.5 w-6 text-right font-medium text-[13px] text-gray-400">
                                                {jdx + 1}.
                                            </span>
                                        )}
                                        <span className="flex-1" dangerouslySetInnerHTML={{ __html: html }} />
                                    </li>
                                );
                            })}
                        </ol>
                    );
                } else {
                    elements.push(
                        <ol key={`ol-${keyBase}`} className={`list-decimal space-y-1.5 ${listClass}`}>
                            {block.items.map((it, jdx) => {
                                const html = applyInlineMarkup(escapeHtml(it.text), theme);
                                return (
                                    <li
                                        key={jdx}
                                        className="ml-5"
                                        style={{ marginLeft: `${20 + (it.level * 20)}px` }}
                                        dangerouslySetInnerHTML={{ __html: html }}
                                    />
                                );
                            })}
                        </ol>
                    );
                }
                continue;
            }
            if (block.type === 'dl') {
                elements.push(
                    <dl
                        key={`dl-${keyBase}`}
                        className={`my-2 grid grid-cols-[minmax(96px,auto),1fr] gap-x-3 gap-y-2 ${density === 'compact' ? 'text-[14px]' : 'text-[15px]'} leading-6 ${isInverse ? 'text-white' : 'text-gray-800'}`}
                    >
                        {block.items.map((pair, jdx) => (
                            <React.Fragment key={jdx}>
                                <dt className={labelClass}>{pair.label}:</dt>
                                <dd className={`${valueClass} pl-0.5`}>{renderValueChipsOrText(pair.value, pair.label)}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                );
                continue;
            }
            if (block.type === 'labels') {
                elements.push(
                    <div key={`labels-${keyBase}`} className="flex flex-wrap gap-2 my-2">
                        {block.items.map((p, jdx) => (
                            <span
                                key={jdx}
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-semibold ${isInverse
                                    ? 'border-white/20 bg-white/10 text-white'
                                    : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                                dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(p), theme) }}
                            />
                        ))}
                    </div>
                );
                continue;
            }
            if (block.type === 'table') {
                elements.push(<TableBlock key={`tbl-${keyBase}`} block={block} keyBase={keyBase} />);
                continue;
            }
            if (block.type === 'tableFromDl') {
                elements.push(<TableBlock key={`tbl-${keyBase}`} block={block} keyBase={keyBase} />);
                continue;
            }
            if (block.type === 'disclosure') {
                elements.push(
                    <Disclosure
                        key={`disclosure-${keyBase}`}
                        title={block.title}
                        theme={theme}
                        forceOpen={options.disclosureOpen}
                        forceSignal={options.disclosureSignal}
                        onToggle={options.onToggleDisclosure}
                        titleSuffix={`${block.blocks.length} tópicos`}
                        anchorId={headingId}
                    >
                        {renderBlocks(block.blocks, `${keyBase}-inside`, false)}
                    </Disclosure>
                );
            }
        }
        return elements;
    };

    const toc = showToc ? (
        <div className={`mb-4 rounded-xl border ${tocContainerClass}`}>
            <details>
                <summary
                    className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold ${tocSummaryClass}`}
                    data-testid="chat-toc-toggle"
                >
                    <span>Sumário</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${tocBadgeClass}`}>
                        {tocHeadings.length} seções
                    </span>
                </summary>
                <div className="px-4 pb-3 pt-1">
                    <ul className="space-y-1.5 text-[14px]">
                        {tocHeadings.map((heading) => (
                            <li key={heading.id}>
                                <a
                                    href={`#${heading.id}`}
                                    className={tocLinkClass}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const target = document.getElementById(heading.id);
                                        if (target) {
                                            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                    }}
                                >
                                    {heading.title}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </details>
        </div>
    ) : null;

    return (
        <div className="max-w-[72ch] w-full break-words">
            {toc}
            {renderBlocks(blocksToRender, 'root')}
        </div>
    );
}
