import React from 'react';
import { PromptChip } from './PromptChip';
import { RenderTheme } from './chatUtils';
import Image from 'next/image';
import { ArrowUpRight, PlayCircle } from 'lucide-react';

// --- Types ---

interface ScriptMetadata {
    title?: string;
    format?: string;
    duration?: string;
    audio?: string;
    inspiration?: string;
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
}

interface ParsedScript {
    metadata: ScriptMetadata;
    scenes: ScriptScene[];
    caption?: string;
    inspirationData?: InspirationData;
    rawBody: string; // Fallback
}

export interface ScriptBlockProps {
    content: string;
    theme: RenderTheme;
    onSendPrompt?: (prompt: string) => void | Promise<void>;
}

// --- Parsing Logic ---

const parseScriptContent = (content: string): ParsedScript => {
    const lines = content.split('\n');
    const metadata: ScriptMetadata = {};
    const scenes: ScriptScene[] = [];
    let captionLines: string[] = [];
    let inspirationData: InspirationData | undefined;

    let isParsingCaption = false;
    let isParsingTable = false;
    let isParsingJson = false;
    let jsonLines: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // 0. JSON Parsing
        if (trimmed.includes('[INSPIRATION_JSON]')) {
            isParsingJson = true;
            continue;
        }
        if (trimmed.includes('[/INSPIRATION_JSON]')) {
            isParsingJson = false;
            try {
                inspirationData = JSON.parse(jsonLines.join('\n'));
            } catch (e) {
                console.error('Failed to parse inspiration JSON', e);
            }
            continue;
        }
        if (isParsingJson) {
            jsonLines.push(line);
            continue;
        }

        // 1. Metadata Extraction
        if (trimmed.startsWith('**Título Sugerido:**')) metadata.title = trimmed.split('**')[2]?.trim();
        if (trimmed.startsWith('**Formato Ideal:**')) {
            const parts = trimmed.split('|');
            metadata.format = parts[0]?.split('**')[2]?.trim();
            if (parts[1]) metadata.duration = parts[1].split('**')[2]?.trim();
        }
        if (trimmed.startsWith('**Áudio Sugerido:**')) metadata.audio = trimmed.split('**')[2]?.trim();
        if (trimmed.startsWith('**Inspiração Viral:**')) metadata.inspiration = trimmed.split('**')[2]?.trim();

        // 2. Caption Extraction (start/end)
        if (trimmed.includes('[LEGENDA]')) {
            isParsingCaption = true;
            continue;
        }
        if (trimmed.includes('[/LEGENDA]')) {
            isParsingCaption = false;
            continue;
        }
        if (isParsingCaption) {
            captionLines.push(line); // Keep indentation
            continue;
        }

        // 3. Table/Scene Parsing
        // Very basic markdow table parser for the specific 3-column format
        if (trimmed.startsWith('| Time') || trimmed.startsWith('| Visual')) {
            isParsingTable = true;
            continue;
        }
        if (trimmed.startsWith('|---') || trimmed.startsWith('| :---')) continue;

        if (isParsingTable && trimmed.startsWith('|')) {
            const cols = trimmed.split('|').map(c => c.trim()).filter(c => c !== '');
            if (cols.length >= 3) {
                // Ensure we don't accidentally pick up non-row lines
                // Check if col[0] looks like time or just a number
                scenes.push({
                    time: cols[0] || '?',
                    visual: cols[1] || '',
                    audio: cols[2] || ''
                });
            } else if (trimmed === '') {
                // Empty line might end table
                isParsingTable = false;
            }
        }
    }

    const caption = captionLines.length > 0 ? captionLines.join('\n').trim() : undefined;

    return {
        metadata,
        scenes,
        caption,
        inspirationData,
        rawBody: content
    };
};

// --- Components ---

const InspirationCard: React.FC<{ data: InspirationData; theme: RenderTheme }> = ({ data, theme }) => {
    if (!data.title && !data.postLink) return null;
    const isInverse = theme === 'inverse';

    return (
        <div className={`mt-4 mx-5 p-3 rounded-xl border flex items-start gap-3 ${isInverse ? 'bg-white/5 border-white/10' : 'bg-amber-50/50 border-amber-100'}`}>
            <div className="relative w-16 h-24 flex-none rounded-lg overflow-hidden bg-gray-200">
                {data.coverUrl ? (
                    <Image
                        src={data.coverUrl}
                        alt="Inspiration Cover"
                        fill
                        className="object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-amber-300">
                        <PlayCircle size={24} />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0 py-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 rounded">
                        Inspiração Viral
                    </span>
                </div>
                <h4 className={`text-sm font-semibold truncate mb-1 ${isInverse ? 'text-white' : 'text-gray-900'}`}>
                    {data.title || "Referência Viral"}
                </h4>
                <p className={`text-xs mb-2 line-clamp-2 ${isInverse ? 'text-white/60' : 'text-gray-500'}`}>
                    Use este vídeo como referência visual e de ritmo para sua gravação.
                </p>
                {data.postLink && (
                    <a
                        href={data.postLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline"
                    >
                        Ver original <ArrowUpRight size={12} />
                    </a>
                )}
            </div>
        </div>
    );
}

const MetadataHeader: React.FC<{ metadata: ScriptMetadata; theme: RenderTheme }> = ({ metadata, theme }) => {
    const isInverse = theme === 'inverse';
    return (
        <div className={`px-5 py-4 border-b ${isInverse ? 'border-white/10 bg-white/5' : 'border-violet-100 bg-violet-50/30'}`}>
            <div className="flex flex-col gap-2">
                {/* Title */}
                {metadata.title && (
                    <h3 className={`text-lg font-bold leading-tight ${isInverse ? 'text-white' : 'text-gray-900'}`}>
                        {metadata.title}
                    </h3>
                )}
                {/* Badges */}
                <div className="flex flex-wrap gap-2 text-xs mt-1">
                    {metadata.inspiration && !metadata.inspiration.includes('{') && (
                        // Fallback badge if no JSON card
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${isInverse
                                ? 'bg-amber-500/10 text-amber-200 border-amber-500/20'
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                            }`}>
                            🔥 Ref: {metadata.inspiration}
                        </span>
                    )}
                    {metadata.format && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium text-gray-500 border border-gray-200 bg-white`}>
                            📱 {metadata.format}
                        </span>
                    )}
                    {metadata.duration && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium text-gray-500 border border-gray-200 bg-white`}>
                            ⏱️ {metadata.duration}
                        </span>
                    )}
                </div>
            </div>

            {/* Old inspiration badge removed as it's now handled by InspirationCard or the fallback above */}
            {/* Old format/duration/audio badges removed as they are now handled by the new badge block */}
        </div>
    );
};

const SceneRow: React.FC<{ scene: ScriptScene; index: number; theme: RenderTheme }> = ({ scene, index, theme }) => {
    const isInverse = theme === 'inverse';

    // Helper to bold text inside visual/audio if needed (simple heuristic)
    const formatText = (text: string) => {
        // Remove markdown bold chars for cleaner look since we style via CSS or keep consistent
        // Or keep them. Let's strip standard md bold for custom styling if we want
        return text;
    };

    return (
        <div className={`relative flex gap-4 p-4 ${index !== 0 ? (isInverse ? 'border-t border-white/5' : 'border-t border-gray-100') : ''}`}>
            {/* Timeline Connector */}
            <div className="absolute left-[3.2rem] top-0 bottom-0 w-px bg-gray-200/50 dark:bg-white/10 -z-10" />

            {/* Time Column */}
            <div className="flex-none w-20 pt-0.5">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold tracking-tight ${isInverse ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-600'}`}>
                    {scene.time}
                </span>
            </div>

            {/* Content Columns (Visual + Audio) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visual */}
                <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isInverse ? 'text-white/40' : 'text-gray-400'}`}>
                        Visual (👁️)
                    </span>
                    <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isInverse ? 'text-white/90' : 'text-gray-700'}`}>
                        {formatText(scene.visual)}
                    </p>
                </div>

                {/* Audio */}
                <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isInverse ? 'text-white/40' : 'text-gray-400'}`}>
                        Áudio (🎙️)
                    </span>
                    <div className={`p-2.5 rounded-lg rounded-tl-sm text-[13px] leading-relaxed italic ${isInverse ? 'bg-white/5 text-white/80' : 'bg-violet-50/50 text-gray-700'}`}>
                        {formatText(scene.audio)}
                    </div>
                </div>
            </div>
        </div>
    );
};

const CaptionBox: React.FC<{ text: string; theme: RenderTheme }> = ({ text, theme }) => {
    const isInverse = theme === 'inverse';
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={`mx-5 my-4 p-3 rounded-xl border border-dashed ${isInverse ? 'border-white/20 bg-white/5' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isInverse ? 'text-white/50' : 'text-gray-500'}`}>
                    Legenda para postar
                </span>
                <button
                    onClick={handleCopy}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${copied
                        ? 'bg-green-100 text-green-700'
                        : (isInverse ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100')}`}
                >
                    {copied ? 'Copiada!' : 'Copiar Legenda'}
                </button>
            </div>
            <p className={`text-[12px] font-mono leading-relaxed whitespace-pre-wrap ${isInverse ? 'text-white/80' : 'text-gray-600'}`}>
                {text}
            </p>
        </div>
    );
};

// --- Main Component ---

export const ScriptBlock: React.FC<ScriptBlockProps> = ({ content, theme, onSendPrompt }) => {
    const data = React.useMemo(() => parseScriptContent(content), [content]);
    const isInverse = theme === 'inverse';

    const [copied, setCopied] = React.useState(false);

    const handleCopyAll = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch (error) {
            console.error('[chat] falha ao copiar roteiro', error);
        }
    };

    const wrapperClass = isInverse
        ? 'border-white/15 bg-white/5 text-white'
        : 'border-violet-200 bg-white text-gray-900 shadow-sm';

    // Quick Actions Def
    const quickActions = [
        { label: '⚡ Encurtar (15s)', prompt: 'Reescreva este roteiro para ter no máximo 15 segundos, focado em retenção rápida.' },
        { label: '🔥 Polêmica', prompt: 'Torne o gancho deste roteiro mais polêmico e direto para chamar atenção.' },
        { label: '🎓 Didático', prompt: 'Adapte o roteiro para ser mais educativo e passo-a-passo.' },
        { label: '🪝 +3 Hooks', prompt: 'Gere mais 3 opções de gancho visual e falado para este mesmo roteiro.' },
    ];

    if (!data.scenes.length) {
        // Fallback if parsing fails (shouldn't happen with strict prompt, but safe)
        return (
            <div className="p-4 rounded border border-red-200 bg-red-50 text-red-700">
                Fallback Render (Parsing Error)
                <pre>{content}</pre>
            </div>
        );
    }

    return (
        <div className={`my-6 overflow-hidden rounded-2xl border ${wrapperClass} ring-1 ring-black/5`}>
            {/* Top Toolbar */}
            <div className={`flex items-center justify-between gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wider border-b ${isInverse ? 'border-white/10' : 'border-violet-100 bg-violet-50/50'}`}>
                <div className="flex items-center gap-2 font-bold text-violet-600 dark:text-violet-300">
                    <span className="flex items-center justify-center w-5 h-5 rounded bg-violet-100 text-violet-700 text-[12px]">🎬</span>
                    <span>Roteiro Premium</span>
                </div>
                <button
                    type="button"
                    onClick={handleCopyAll}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all active:scale-95 ${isInverse
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-white text-violet-700 border border-violet-200 hover:bg-violet-50 shadow-sm'}`}
                >
                    {copied ? 'Copiado!' : 'Copiar Tudo'}
                </button>
            </div>

            {/* Semantic Content */}
            <MetadataHeader metadata={data.metadata} theme={theme} />

            {/* Visual Inspiration Card (New) */}
            {data.inspirationData && (
                <InspirationCard data={data.inspirationData} theme={theme} />
            )}

            <div className="flex flex-col">
                {data.scenes.map((scene, idx) => (
                    <SceneRow key={idx} scene={scene} index={idx} theme={theme} />
                ))}
            </div>

            {data.caption && <CaptionBox text={data.caption} theme={theme} />}

            {/* Quick Actions Footer */}
            {onSendPrompt && (
                <div className={`px-4 py-3 border-t flex flex-wrap gap-2 ${isInverse ? 'border-white/10' : 'border-violet-100/50 bg-violet-50/20'}`}>
                    {quickActions.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            onClick={() => onSendPrompt(action.prompt)}
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${isInverse
                                ? 'bg-white/10 text-white hover:bg-white/20'
                                : 'bg-white text-violet-600 border border-violet-200 hover:bg-violet-100 hover:text-violet-800'
                                }`}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
