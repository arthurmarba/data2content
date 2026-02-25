"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { MessageSquarePlus, X } from "lucide-react";

export type InlineAnnotation = {
    id: string;
    startIndex: number;
    endIndex: number;
    quote: string;
    comment: string;
    authorName: string;
    isOrphaned: boolean;
    resolved: boolean;
    createdAt: string;
};

interface InlineScriptEditorProps {
    content: string;
    onChangeContent: (value: string) => void;
    annotations: InlineAnnotation[];
    onAnnotationsChange: (annotations: InlineAnnotation[]) => void;
    isAdminViewer: boolean;
    viewerName?: string;
    placeholder?: string;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function InlineScriptEditor({
    content,
    onChangeContent,
    annotations,
    onAnnotationsChange,
    isAdminViewer,
    viewerName = "Admin",
    placeholder = "Escreva seu roteiro aqui...",
    onKeyDown,
}: InlineScriptEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    const [selection, setSelection] = useState<{ start: number; end: number; rect: DOMRect | null } | null>(null);
    const [isCommenting, setIsCommenting] = useState(false);
    const [commentText, setCommentText] = useState("");

    const handleScroll = () => {
        if (backdropRef.current && textareaRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
            backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>) => {
        if (!isAdminViewer) return;
        const el = textareaRef.current;
        if (!el) return;

        if (el.selectionStart !== el.selectionEnd && el.selectionStart !== undefined) {
            const selectedText = content.slice(el.selectionStart, el.selectionEnd);
            if (selectedText.trim().length > 0) {
                setSelection({
                    start: el.selectionStart,
                    end: el.selectionEnd,
                    rect: new DOMRect(e.clientX, e.clientY - 60, 0, 0),
                });
            } else {
                setSelection(null);
            }
        } else {
            if (!isCommenting) {
                setSelection(null);
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;

        let nextAnnotations = [...annotations];
        let needsUpdate = false;

        nextAnnotations = nextAnnotations.map((ann) => {
            if (ann.isOrphaned) return ann;

            const currentQuote = newContent.slice(ann.startIndex, ann.endIndex);
            if (currentQuote === ann.quote) {
                return ann;
            }

            needsUpdate = true;
            const newIndex = newContent.indexOf(ann.quote);
            if (newIndex !== -1) {
                return { ...ann, startIndex: newIndex, endIndex: newIndex + ann.quote.length };
            }

            return { ...ann, isOrphaned: true };
        });

        if (needsUpdate) {
            onAnnotationsChange(nextAnnotations);
        }

        onChangeContent(newContent);
        setSelection(null);
        setIsCommenting(false);
    };

    const renderHighlights = () => {
        const sorted = [...annotations]
            .filter((a) => !a.isOrphaned && !a.resolved)
            .sort((a, b) => a.startIndex - b.startIndex);

        if (sorted.length === 0) {
            return content;
        }

        const result: React.ReactNode[] = [];
        let lastIndex = 0;

        sorted.forEach((ann, i) => {
            if (ann.startIndex >= lastIndex) {
                result.push(content.slice(lastIndex, ann.startIndex));
                result.push(
                    <mark key={ann.id} className="bg-amber-200/60 rounded-sm text-transparent" title={ann.comment}>
                        {content.slice(ann.startIndex, ann.endIndex)}
                    </mark>
                );
                lastIndex = ann.endIndex;
            }
        });

        result.push(content.slice(lastIndex));

        if (!content.endsWith("\\n")) {
            result.push(<br key="br-end" />);
        }

        return result;
    };

    const handleCreateComment = () => {
        if (!selection) return;
        if (!commentText.trim()) return;

        const newAnn: InlineAnnotation = {
            id: Math.random().toString(36).substr(2, 9),
            startIndex: selection.start,
            endIndex: selection.end,
            quote: content.slice(selection.start, selection.end),
            comment: commentText.trim(),
            authorName: viewerName,
            isOrphaned: false,
            resolved: false,
            createdAt: new Date().toISOString(),
        };

        onAnnotationsChange([...annotations, newAnn]);
        setSelection(null);
        setIsCommenting(false);
        setCommentText("");
    };

    const handleCancelComment = () => {
        setSelection(null);
        setIsCommenting(false);
        setCommentText("");
    };

    return (
        <div className="relative h-full w-full min-h-[62vh] font-sans">
            <div
                ref={backdropRef}
                className="pointer-events-none absolute inset-0 z-0 overflow-y-auto whitespace-pre-wrap break-words py-7 text-[17px] leading-9 text-transparent"
                aria-hidden="true"
            >
                {renderHighlights()}
            </div>

            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onScroll={handleScroll}
                onMouseUp={handleMouseUp}
                onKeyDown={onKeyDown}
                onKeyUp={(e) => {
                    if (e.key.startsWith('Arrow') || e.key === 'Shift') {
                        handleMouseUp(e as any);
                    }
                }}
                placeholder={placeholder}
                className="relative z-10 h-full min-h-[62vh] w-full resize-none overflow-y-auto border-0 bg-transparent py-7 text-[17px] leading-9 text-slate-800 outline-none ring-0 ring-transparent placeholder:text-slate-300 focus:border-transparent focus:outline-none focus:ring-0 focus:ring-transparent focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
            />

            {selection && !isCommenting && (
                <div
                    className="fixed z-50 flex -translate-x-1/2 -translate-y-full items-center justify-center"
                    style={{ top: selection.rect?.top, left: selection.rect?.left }}
                >
                    <button
                        onClick={() => setIsCommenting(true)}
                        className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-xl transition-transform hover:scale-105"
                    >
                        <MessageSquarePlus size={16} /> Comentar
                    </button>
                </div>
            )}

            {selection && isCommenting && (
                <div
                    className="fixed z-50 flex w-72 -translate-x-1/2 -translate-y-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
                    style={{ top: selection.rect?.top, left: selection.rect?.left }}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Novo Comentário</span>
                        <button onClick={handleCancelComment} className="text-slate-400 hover:text-slate-600">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="max-h-20 overflow-hidden text-ellipsis whitespace-nowrap rounded bg-slate-50 px-2 py-1 text-xs italic text-slate-500">
                        &quot;{content.slice(selection.start, selection.end)}&quot;
                    </div>
                    <textarea
                        autoFocus
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Escreva seu comentário..."
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        rows={3}
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={handleCreateComment}
                            disabled={!commentText.trim()}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            Salvar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
