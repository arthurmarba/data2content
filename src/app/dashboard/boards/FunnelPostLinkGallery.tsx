"use client";

import React, { useState, useMemo } from "react";
import { Search, Check, Link, Play, Image as ImageIcon, LayoutGrid } from "lucide-react";
import Image from "next/image";

type ContentOption = {
  id: string;
  caption: string;
  postDate: string | null;
  postLink: string | null;
  type: string | null;
  coverUrl: string | null;
  engagement: number | null;
  totalInteractions: number | null;
};

type FunnelPostLinkGalleryProps = {
  options: ContentOption[];
  loading: boolean;
  onSelect: (option: ContentOption) => void;
  selectedId?: string | null;
  onClose: () => void;
};

export default function FunnelPostLinkGallery({
  options,
  loading,
  onSelect,
  selectedId,
  onClose,
}: FunnelPostLinkGalleryProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((opt) => opt.caption.toLowerCase().includes(q));
  }, [options, query]);

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num.toString();
  };

  return (
    <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#0f172a]/95 p-1 backdrop-blur-2xl shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5">
        <div>
          <h4 className="text-lg font-bold text-white tracking-tight">Vincular Post Real</h4>
          <p className="text-xs text-white/50">Escolha o post final para comparar performance</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white/70 hover:bg-white/20 hover:text-white transition-all"
        >
          Fechar
        </button>
      </div>

      {/* Search Input */}
      <div className="px-5 pb-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-white/30 group-focus-within:text-white/60 transition-colors" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por legenda..."
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/20 focus:border-white/20 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-white/5 transition-all"
          />
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {loading ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="text-sm text-white/40 font-medium">Carregando seus posts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center">
            <LayoutGrid className="h-10 w-10 text-white/10 mb-3" />
            <p className="text-sm text-white/30 font-medium">Nenhum post encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.slice(0, 18).map((option) => {
              const isActive = selectedId === option.id;
              const isVideo = option.type?.toLowerCase().includes("video") || option.type?.toLowerCase().includes("reel");

              return (
                <button
                  key={option.id}
                  onClick={() => onSelect(option)}
                  className={`group relative aspect-[3/4] overflow-hidden rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isActive ? "border-white ring-2 ring-white/20 shadow-xl" : "border-white/10"
                  }`}
                >
                  {/* Thumbnail */}
                  {option.coverUrl ? (
                    <Image
                      src={option.coverUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover transition-transform group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/5">
                      <ImageIcon className="h-8 w-8 text-white/10" />
                    </div>
                  )}

                  {/* Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {isVideo && (
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/40 backdrop-blur-md">
                      <Play className="h-3 w-3 text-white fill-white" />
                    </div>
                  )}

                  {/* Stats Badge */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 rounded-xl bg-black/40 px-2.5 py-1.5 backdrop-blur-md">
                    <div className="flex flex-col items-start leading-none gap-1">
                      <span className="text-[10px] font-bold text-white/80 uppercase tracking-tight">Interações</span>
                      <span className="text-xs font-black text-white">{formatNumber(option.totalInteractions)}</span>
                    </div>
                    {isActive && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-lg animate-in zoom-in">
                        <Check className="h-3 w-3 text-white stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Hover Caption */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="px-4 text-center text-[10px] font-bold text-white line-clamp-3">
                      {option.caption}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="border-t border-white/5 px-6 py-4 bg-white/[0.02]">
        <div className="flex items-center gap-2 text-[11px] font-medium text-white/30 uppercase tracking-widest">
          <Link className="h-3 w-3" />
          Selecione o post para comparar resultados
        </div>
      </div>
    </div>
  );
}
