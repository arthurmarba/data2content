import React from 'react';

/* ---------- Renderização tipográfica “chat-like” ---------- */

export function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** `** bold ** `, `code` e links (sobre HTML escapado) */
export type RenderTheme = 'default' | 'inverse';

export function applyInlineMarkup(escaped: string, theme: RenderTheme = 'default') {
    const codeClass =
        theme === 'inverse'
            ? 'px-1 py-0.5 rounded bg-white/10 text-white text-[13px] font-mono leading-tight'
            : 'px-1 py-0.5 rounded bg-gray-100 text-gray-800 text-[13px] font-mono leading-tight';
    const linkClass =
        theme === 'inverse'
            ? 'text-white underline decoration-white/40 hover:decoration-white/70 break-words'
            : 'text-gray-700 underline decoration-gray-300 hover:decoration-gray-500 break-words';
    const highlightClass =
        theme === 'inverse'
            ? 'inline bg-white/20 text-white px-1 py-0.5 rounded-sm align-middle'
            : 'inline bg-amber-100 text-gray-900 px-1 py-0.5 rounded-sm align-middle';

    let out = escaped;
    // Highlight: ==...== (somente se não há tags internas ou sinais suspeitos)
    out = out.replace(/==([^=<>\n=]{1,200})==/g, `<span class="${highlightClass}">$1</span>`);
    out = out.replace(/`([^`]+)`/g, `<code class="${codeClass}">$1</code>`);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
    out = out.replace(
        /(https?:\/\/[^\s)]+)(?![^<]*>)/g,
        `<a href="$1" target="_blank" rel="noopener noreferrer" class="${linkClass}">$1</a>`
    );
    return out;
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

/** Tipografia compacta (14px / lh-6) com respiro reduzido */
export function renderFormatted(text: string, theme: RenderTheme = 'default') {
    const isInverse = theme === 'inverse';
    const hrClass = isInverse ? 'my-6 border-t border-white/30' : 'my-6 border-t border-gray-200/80';
    const blockquoteClass = isInverse
        ? 'border-l border-white/40 pl-3 italic text-[14px] leading-6 opacity-90 my-4 text-white'
        : 'border-l border-current/25 pl-3 italic text-[14px] leading-6 opacity-90 my-4';
    const h1Class = `text-2xl leading-tight font-bold mt-8 mb-4 tracking-tight ${isInverse ? 'text-white' : 'text-gray-900'}`;
    const h2Class = `text-xl leading-snug font-bold mt-6 mb-2 tracking-tight ${isInverse ? 'text-white' : 'text-gray-800'}`;
    const h3Class = `text-lg leading-snug font-bold mt-5 mb-2 tracking-tight ${isInverse ? 'text-white' : 'text-gray-800'}`;
    const paragraphClass = `text-[15px] leading-7 my-3 ${isInverse ? 'text-white' : 'text-gray-800'}`;
    const listClass = `text-[15px] leading-6 my-2 ${isInverse ? 'text-white' : 'text-gray-800'}`;
    const tableTextClass = `min-w-full text-left text-xs leading-5 ${isInverse ? 'text-white' : 'text-gray-800'}`;
    const tableHeaderClass = `px-3 py-2 border-b ${isInverse ? 'border-white/25 bg-white/10' : 'border-current/20 bg-gray-50'} font-semibold`;
    const tableCellClass = `px-3 py-2 border-b ${isInverse ? 'border-white/20' : 'border-current/10'} align-top break-words`;
    const tableStripeClass = isInverse ? 'bg-white/5' : 'bg-gray-50/70';
    const labelClass = isInverse ? 'font-semibold text-white' : 'font-semibold text-gray-900';
    const valueClass = isInverse ? 'text-white/90' : 'text-gray-800';

    type Block =
        | { type: 'heading'; level: 1 | 2 | 3; content: string }
        | { type: 'hr' }
        | { type: 'blockquote'; content: string }
        | { type: 'paragraph'; content: string }
        | { type: 'table'; headers: string[]; rows: string[][] }
        | { type: 'tableFromDl'; titleLabel: string; labels: string[]; rows: { title: string; values: string[] }[]; topValues?: Record<string, string> }
        | { type: 'ul'; items: string[] }
        | { type: 'ol'; items: string[] }
        | { type: 'dl'; items: { label: string; value: string }[] }
        | { type: 'labels'; items: string[] };

    const lines = text.split(/\r?\n/);
    const blocks: Block[] = [];
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
        if (paragraphBuffer.length === 0) return;
        blocks.push({ type: 'paragraph', content: paragraphBuffer.join("\n") });
        paragraphBuffer = [];
    };

    const isTableStart = (idx: number) => {
        const first = (lines[idx] ?? "").trim();
        const second = (lines[idx + 1] ?? "").trim();
        if (!first || !second) return false;
        if (!first.includes("|") || !second.includes("|")) return false;
        if (/---/.test(second)) return true;
        const normFirst = first.replace(/^[^|]*\|/, "|");
        return normFirst.includes("|") && /---/.test(second);
    };

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i] ?? "";
        const line = rawLine.trim();

        if (line === "") {
            flushParagraph();
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
            const content = applyInlineMarkup(escapeHtml(headingText), theme);

            blocks.push({ type: 'heading', level: level as 1 | 2 | 3, content: headingText });
            continue;
        }

        // Blockquote (linhas que começam com '>')
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
            blocks.push({ type: 'blockquote', content: quoteLines.join(" ") });
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

        // Listas com - ou *
        if (/^[-*]\s+/.test(line)) {
            flushParagraph();
            const items: string[] = [];
            let j = i;
            while (j < lines.length) {
                const candidate = (lines[j] ?? "").trim();
                if (!/^[-*]\s+/.test(candidate)) break;
                items.push(candidate.replace(/^[-*]\s+/, ""));
                j++;
            }
            i = j - 1;

            const parsedItems = items.map((it) => {
                const match = it.match(/^([^:]+):\s*(.*)$/);
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
                    items: items.map((it) => stripLooseMarkers(it)),
                });
            }
            continue;
        }

        // Listas numeradas
        if (/^\d+\.\s+/.test(line)) {
            flushParagraph();
            const items: string[] = [];
            let j = i;
            while (j < lines.length) {
                const candidate = (lines[j] ?? "").trim();
                if (!/^\d+\.\s+/.test(candidate)) break;
                const cleaned = stripLooseMarkers(candidate.replace(/^\d+\.\s+/, ""));
                items.push(cleaned);
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

        // Parágrafo (acumula até flush)
        paragraphBuffer.push(rawLine);
    }

    flushParagraph();

    // Agrupa headings + dls em tabela se possível (union de labels, admite faltas)
    const normalizedBlocks: Block[] = [];
    for (let i = 0; i < blocks.length; ) {
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

    const elements: JSX.Element[] = [];

    const renderValueChipsOrText = (val: string, labelHint?: string) => {
        const cleanValue = stripLooseMarkers(val);
        const isPriority = labelHint && /prioridade/i.test(labelHint) && /alta|m[eé]dia|baixa/i.test(cleanValue);
        if (cleanValue.includes(',')) {
            const chips = cleanValue.split(',').map((p) => p.trim()).filter(Boolean);
            return (
                <span className="flex flex-wrap gap-1">
                    {chips.map((chip, idx) => (
                        <span
                            key={idx}
                            className={
                                isInverse
                                    ? 'inline-flex items-center rounded bg-white/10 px-2 py-0.5 text-[13px] font-normal text-white'
                                    : 'inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[13px] font-normal text-gray-800'
                            }
                        >
                            {chip}
                        </span>
                    ))}
                </span>
            );
        }
        if (isPriority) {
            const tone =
                /alta/i.test(cleanValue) ? (isInverse ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-900') :
                /m[eé]dia/i.test(cleanValue) ? (isInverse ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-800') :
                isInverse ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-800';
            return (
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-[13px] font-semibold ${tone}`}>
                    {cleanValue}
                </span>
            );
        }
        const html = applyInlineMarkup(escapeHtml(cleanValue), theme);
        return <span dangerouslySetInnerHTML={{ __html: html }} />;
    };

    const inlineMarkup = (raw: string) => (
        <span dangerouslySetInnerHTML={{ __html: applyInlineMarkup(raw, theme) }} />
    );

    const tableWrapper = (key: string, node: JSX.Element, hasBadge?: boolean) => (
        <div key={key} className="relative overflow-x-auto my-3 max-w-full">
            {node}
            <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 right-0 ${hasBadge ? 'w-8' : 'w-10'} ${isInverse ? 'bg-gradient-to-l from-slate-900 via-slate-900/60 to-transparent' : 'bg-gradient-to-l from-white via-white/70 to-transparent'}`}
            />
        </div>
    );

    normalizedBlocks.forEach((block, idx) => {
        const next = normalizedBlocks[idx + 1];
        if (block.type === 'hr') {
            elements.push(<hr key={`hr-${idx}`} className={hrClass} />);
        } else if (block.type === 'heading') {
            const mbTight = next && (next.type === 'ul' || next.type === 'ol' || next.type === 'dl' || next.type === 'tableFromDl' || next.type === 'labels');
            if (block.level === 1) {
                elements.push(
                    <h2
                        key={`h1-${idx}`}
                        className={`${h1Class} ${mbTight ? 'mb-2' : ''}`}
                        dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(block.content), theme) }}
                    />
                );
            } else if (block.level === 2) {
                elements.push(
                    <h3
                        key={`h2-${idx}`}
                        className={`${h2Class} ${mbTight ? 'mb-1.5' : ''}`}
                        dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(block.content), theme) }}
                    />
                );
            } else {
                elements.push(
                    <h4
                        key={`h3-${idx}`}
                        className={`${h3Class} ${mbTight ? 'mb-1.5' : ''}`}
                        dangerouslySetInnerHTML={{ __html: applyInlineMarkup(escapeHtml(block.content), theme) }}
                    />
                );
            }
        } else if (block.type === 'blockquote') {
            const html = applyInlineMarkup(escapeHtml(block.content), theme);
            elements.push(<blockquote key={`bq-${idx}`} className={blockquoteClass} dangerouslySetInnerHTML={{ __html: html }} />);
        } else if (block.type === 'paragraph') {
            const html = applyInlineMarkup(escapeHtml(block.content), theme).replace(/\n/g, "<br/>");
            elements.push(<p key={`p-${idx}`} className={paragraphClass} dangerouslySetInnerHTML={{ __html: html }} />);
        } else if (block.type === 'ul') {
            elements.push(
                <ul key={`ul-${idx}`} className={`list-disc ml-6 pl-1 space-y-1 ${listClass}`}>
                    {block.items.map((it, jdx) => {
                        const html = applyInlineMarkup(escapeHtml(it), theme);
                        return <li key={jdx} dangerouslySetInnerHTML={{ __html: html }} />;
                    })}
                </ul>
            );
        } else if (block.type === 'ol') {
            elements.push(
                <ol key={`ol-${idx}`} className={`list-decimal ml-6 pl-1 space-y-0.5 ${listClass}`}>
                    {block.items.map((it, jdx) => {
                        const html = applyInlineMarkup(escapeHtml(it), theme);
                        return <li key={jdx} dangerouslySetInnerHTML={{ __html: html }} />;
                    })}
                </ol>
            );
        } else if (block.type === 'dl') {
            elements.push(
                <dl
                    key={`dl-${idx}`}
                    className={`my-1.5 grid grid-cols-[minmax(88px,auto),1fr] gap-x-2 gap-y-1 text-[15px] leading-6 ${isInverse ? 'text-white' : 'text-gray-800'}`}
                >
                    {block.items.map((pair, jdx) => (
                        <React.Fragment key={jdx}>
                            <dt className={labelClass}>{escapeHtml(pair.label)}:</dt>
                            <dd className={`${valueClass} pl-0.5`}>{renderValueChipsOrText(pair.value, pair.label)}</dd>
                        </React.Fragment>
                    ))}
                </dl>
            );
        } else if (block.type === 'labels') {
            elements.push(
                <div key={`labels-${idx}`} className="space-y-1 my-2">
                    {block.items.map((p, jdx) => (
                        <div key={jdx} className={`text-[15px] font-semibold ${isInverse ? 'text-white' : 'text-gray-900'}`}>
                            {p}
                        </div>
                    ))}
                </div>
            );
        } else if (block.type === 'table') {
            elements.push(
                tableWrapper(
                    `tbl-${idx}`,
                    <table className={`${tableTextClass} min-w-[480px]`}>
                        <thead>
                            <tr>
                                {block.headers.map((hCell, cIdx) => {
                                    const html = applyInlineMarkup(escapeHtml(hCell), theme);
                                    return (
                                        <th key={cIdx} className={`${tableHeaderClass} text-left px-2 py-1.5`} dangerouslySetInnerHTML={{ __html: html }} />
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, rIdx) => (
                                <tr key={rIdx} className={rIdx % 2 === 1 ? tableStripeClass : undefined}>
                                    {row.map((cell, cIdx) => {
                                        if (cell.includes(",")) {
                                            const parts = cell.split(",").map((p) => p.trim()).filter(Boolean);
                                            return (
                                                <td key={cIdx} className={`${tableCellClass} ${cIdx > 0 ? 'border-l border-current/10' : ''}`}>
                                                    {parts.map((part, pIdx) => {
                                                        const htmlPart = applyInlineMarkup(escapeHtml(part), theme);
                                                        return <div key={pIdx} dangerouslySetInnerHTML={{ __html: htmlPart }} />;
                                                    })}
                                                </td>
                                            );
                                        }
                                        const numeric = /^-?\d[\d.,]*\s*%?$/.test(stripLooseMarkers(cell));
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
                )
            );
        } else if (block.type === 'tableFromDl') {
            elements.push(
                tableWrapper(
                    `tbl-dl-${idx}`,
                    <table className={`${tableTextClass} min-w-[480px]`}>
                        <caption className="sr-only">{inlineMarkup(escapeHtml(block.titleLabel))}</caption>
                        <thead>
                            <tr>
                                <th className={`${tableHeaderClass} text-left`}>{inlineMarkup(escapeHtml(block.titleLabel))}</th>
                                {block.labels.map((lbl, cIdx) => (
                                    <th key={cIdx} className={`${tableHeaderClass} text-left`}>
                                        <div className="flex flex-col items-start gap-1">
                                            <span>{inlineMarkup(escapeHtml(lbl))}</span>
                                            {block.topValues && block.topValues[lbl] ? (
                                                <span className="inline-flex items-center rounded bg-amber-50 text-amber-800 px-1.5 py-0.5 text-[10px] font-semibold leading-tight">
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
                                    <td className={tableCellClass}>{inlineMarkup(escapeHtml(row.title))}</td>
                                    {row.values.map((val, cIdx) => {
                                        const labelHint = block.labels[cIdx] ?? '';
                                        const numeric = /^-?\d[\d.,]*\s*%?$/.test(stripLooseMarkers(val));
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
                )
            );
        }
    });

    // Wrapper enxuto (sem prose)
    return <div className="max-w-none break-words">{elements}</div>;
}
