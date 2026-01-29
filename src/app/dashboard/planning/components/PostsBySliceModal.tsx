"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { XMarkIcon, PencilSquareIcon, ChartBarIcon, HeartIcon, ChatBubbleLeftIcon, ShareIcon, BookmarkIcon } from "@heroicons/react/24/solid";
import { EyeIcon } from "@heroicons/react/24/outline";



type PostsBySliceModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  posts: any[];
  onClose: () => void;
  onReviewClick?: (post: any) => void;
  onPlayClick?: (post: any) => void;
  onDetailClick?: (postId: string) => void;
};



const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatDate(value?: string | Date) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function resolveImageSrc(value?: string) {
  if (!value) return "";
  if (value.startsWith("/api/proxy/thumbnail/")) return value;
  if (/^https?:\/\//i.test(value)) return `/api/proxy/thumbnail/${encodeURIComponent(value)}`;
  return value;
}

export default function PostsBySliceModal({ isOpen, title, subtitle, posts, onClose, onReviewClick, onPlayClick, onDetailClick }: PostsBySliceModalProps) {


  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (!isOpen) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex w-screen items-start justify-center bg-slate-900/70 px-4 py-8 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{subtitle || "Seleção"}</p>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">{posts.length} {posts.length === 1 ? "post" : "posts"} encontrados</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Fechar"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-slate-500">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">–</div>
              <p className="text-sm font-medium">Nenhum post para esta seleção</p>
              <p className="text-xs text-slate-500">Tente outro intervalo ou categoria.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {posts.map((post, idx) => (
                <li
                  key={post._id || idx}
                  className="flex gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => onPlayClick ? onPlayClick(post) : (onDetailClick && onDetailClick(post._id))}
                >

                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {post.thumbnailUrl || post.coverUrl || post.thumbnail ? (
                      <Image
                        src={resolveImageSrc(post.thumbnailUrl || post.coverUrl || post.thumbnail)}
                        alt={post.caption || "Post"}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="96px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
                    )}
                  </div>


                  <div className="min-w-0 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-base font-bold text-slate-900 leading-tight mb-1">{post.caption || "Sem legenda"}</p>
                        <p className="text-xs font-medium text-slate-500">{formatDate(post.postDate)}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {(onDetailClick || !onPlayClick) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDetailClick ? onDetailClick(post._id) : null;
                            }}
                            className="flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-4 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
                          >
                            <ChartBarIcon className="h-3.5 w-3.5 text-slate-400" />
                            Analisar
                          </button>
                        )}
                        {onReviewClick && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReviewClick(post);
                            }}
                            className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
                          >
                            <PencilSquareIcon className="h-3.5 w-3.5" />
                            Review
                          </button>
                        )}
                      </div>
                    </div>


                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {post.format?.map((f: string) => (
                        <span key={f} className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                          {f}
                        </span>
                      ))}
                      {post.proposal?.map((p: string) => (
                        <span key={p} className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {p}
                        </span>
                      ))}
                      {post.context?.map((c: string) => (
                        <span key={c} className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                          {c}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Alcance</span>
                        <span className="text-sm font-black text-slate-900">{post.stats?.reach ? numberFormatter.format(post.stats.reach) : "—"}</span>
                      </div>
                      <div className="flex flex-col p-2 rounded-lg bg-indigo-50/50 border border-indigo-100">
                        <span className="text-[10px] text-indigo-600 uppercase font-bold tracking-tight mb-0.5">Interações</span>
                        <span className="text-sm font-black text-indigo-900">{post.stats?.total_interactions ? numberFormatter.format(post.stats.total_interactions) : "—"}</span>
                      </div>
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50/50 border border-slate-100">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Likes</span>
                        <span className="text-sm font-bold text-slate-800">{numberFormatter.format(post.stats?.likes ?? 0)}</span>
                      </div>
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50/50 border border-slate-100">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Comentários</span>
                        <span className="text-sm font-bold text-slate-800">{numberFormatter.format(post.stats?.comments ?? 0)}</span>
                      </div>
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50/50 border border-slate-100">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Shares</span>
                        <span className="text-sm font-bold text-slate-800">{numberFormatter.format(post.stats?.shares ?? 0)}</span>
                      </div>
                      <div className="flex flex-col p-2 rounded-lg bg-slate-50/50 border border-slate-100">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight mb-0.5">Salvos</span>
                        <span className="text-sm font-bold text-slate-800">{numberFormatter.format(post.stats?.saved ?? post.stats?.saves ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                </li>


              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return modalContent;

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  return portalTarget ? createPortal(modalContent, portalTarget) : modalContent;
}
