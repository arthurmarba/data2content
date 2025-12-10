"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { XMarkIcon } from "@heroicons/react/24/solid";

type PostsBySliceModalProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  posts: any[];
  onClose: () => void;
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatDate(value?: string | Date) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export default function PostsBySliceModal({ isOpen, title, subtitle, posts, onClose }: PostsBySliceModalProps) {
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
                <li key={post._id || idx} className="flex gap-4 px-5 py-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    {post.thumbnailUrl || post.coverUrl || post.thumbnail ? (
                      <Image
                        src={post.thumbnailUrl || post.coverUrl || post.thumbnail}
                        alt={post.caption || "Post"}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">Sem imagem</div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{post.caption || "Post"}</p>
                        <p className="text-[11px] text-slate-500">{post.metaLabel || ""}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs font-medium text-slate-600">{formatDate(post.postDate)}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 text-[10px] font-medium text-slate-600">
                      {post.format?.map((f: string) => (
                        <span key={f} className="rounded-md bg-orange-50 px-2 py-1 text-orange-700 ring-1 ring-inset ring-orange-600/10">
                          {f}
                        </span>
                      ))}
                      {post.proposal?.map((p: string) => (
                        <span key={p} className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-700 ring-1 ring-inset ring-indigo-600/10">
                          {p}
                        </span>
                      ))}
                      {post.context?.map((c: string) => (
                        <span key={c} className="rounded-md bg-slate-100 px-2 py-1 text-slate-700 ring-1 ring-inset ring-slate-500/10">
                          {c}
                        </span>
                      ))}
                      {post.tone?.map((t: string) => (
                        <span key={t} className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                          {t}
                        </span>
                      ))}
                      {post.references?.map((r: string) => (
                        <span key={r} className="rounded-md bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-inset ring-amber-600/10">
                          {r}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-800">
                        Alcance: {post.stats?.reach !== undefined && post.stats?.reach !== null ? numberFormatter.format(post.stats.reach) : "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-800">
                        Interações:{" "}
                        {post.stats?.total_interactions !== undefined && post.stats?.total_interactions !== null
                          ? numberFormatter.format(post.stats.total_interactions)
                          : "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                        Likes: {numberFormatter.format(post.stats?.likes ?? 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                        Com.: {numberFormatter.format(post.stats?.comments ?? 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                        Shares: {numberFormatter.format(post.stats?.shares ?? 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1">
                        Salvos: {numberFormatter.format(post.stats?.saved ?? post.stats?.saves ?? 0)}
                      </span>
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
