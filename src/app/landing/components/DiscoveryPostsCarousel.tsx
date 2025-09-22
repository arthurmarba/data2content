"use client";

import React from "react";
import { UserAvatar } from "@/app/components/UserAvatar";
import { idsToLabels } from "@/app/lib/classification";

export type PostItem = {
  id: string;
  title: string;
  imageUrl: string | null | undefined;
  creator?: string | null;
  href?: string | null;
  categories?: {
    format?: string[];
    proposal?: string[];
    context?: string[];
    tone?: string[];
    references?: string[];
  };
  creatorAvatarUrl?: string | null;
  stats?: {
    total_interactions?: number;
    views?: number;
    video_duration_seconds?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
};

export type Category = {
  id: string;
  label: string;
  items: PostItem[];
};

// Conteúdo estático para representar a página de Discovery
// Substitua por conteúdo real quando disponível (imagens e rótulos)
const FALLBACK_CATEGORIES: Category[] = [
  {
    id: "educacao",
    label: "Educação",
    items: [
      { id: "edu-1", title: "Tutorial passo a passo", imageUrl: "/images/Tutorial.png" },
      { id: "edu-2", title: "Portfolio de exemplo", imageUrl: "/images/portfolio_exemplo.png" },
      { id: "edu-3", title: "Dicas rápidas", imageUrl: "/images/IMG_8633.PNG" },
      { id: "edu-4", title: "Guia visual", imageUrl: "/images/IMG_8634.PNG" },
    ],
  },
  {
    id: "beleza",
    label: "Beleza",
    items: [
      { id: "bea-1", title: "Make em 5 minutos", imageUrl: "/images/mulher_se_maquiando.png" },
      { id: "bea-2", title: "Antes e depois", imageUrl: "/images/IMG_8635.PNG" },
      { id: "bea-3", title: "Skin care diário", imageUrl: "/images/IMG_8636.PNG" },
      { id: "bea-4", title: "Look do dia", imageUrl: "/images/IMG_8634.PNG" },
    ],
  },
  {
    id: "lifestyle",
    label: "Lifestyle",
    items: [
      { id: "life-1", title: "Rotina criativa", imageUrl: "/images/IMG_8633.PNG" },
      { id: "life-2", title: "Bastidores", imageUrl: "/images/IMG_8634.PNG" },
      { id: "life-3", title: "Viagem e cultura", imageUrl: "/images/IMG_8635.PNG" },
      { id: "life-4", title: "Dia a dia", imageUrl: "/images/IMG_8636.PNG" },
    ],
  },
];

export default function DiscoveryPostsCarousel({ categories }: { categories?: Category[] }) {
  // Evita flicker: não usa mais FALLBACK_CATEGORIES quando não há dados.
  const data = Array.isArray(categories) ? categories : [];
  const [activeCat, setActiveCat] = React.useState<string>(data[0]?.id ?? '');
  const [broken, setBroken] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const firstId = data[0]?.id;
    if (!firstId) return;
    if (!activeCat || !data.some((c) => c.id === activeCat)) {
      setActiveCat(firstId);
    }
  }, [activeCat, data]);

  const current = React.useMemo(
    () => (data.find((c) => c.id === activeCat) ?? data[0] ?? { id: '', label: '', items: [] }),
    [activeCat, data]
  );

  // Loading/skeleton: não renderiza abas fictícias nem imagens indevidas
  if (data.length === 0) {
    return (
      <div className="w-full">
        <div className="flex gap-2 flex-wrap items-center mb-4">
          <span className="h-6 w-24 rounded-full bg-white/20 animate-pulse" />
          <span className="h-6 w-20 rounded-full bg-white/15 animate-pulse" />
          <span className="h-6 w-28 rounded-full bg-white/10 animate-pulse" />
        </div>
        <div className="overflow-hidden">
          <div className="flex gap-4 pr-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-64 md:w-72 lg:w-80 rounded-xl overflow-hidden ring-1 ring-white/10 bg-white/5">
                <div className="w-full aspect-[4/5] bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Abas de categoria — ocultar quando só há uma categoria */}
      {data.length > 1 && (
        <div className="flex gap-2 flex-wrap items-center mb-4">
          {data.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCat(cat.id)}
              className={
                `text-sm px-3 py-1 rounded-full transition-colors border ` +
                (activeCat === cat.id
                  ? "bg-white text-brand-purple border-white"
                  : "bg-transparent text-white/80 border-white/30 hover:bg-white/10")
              }
              aria-pressed={activeCat === cat.id}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Carrossel horizontal */}
      <div className="overflow-x-auto hide-scrollbar">
        <div className="flex gap-4 min-w-full pr-2">
          {current.items.map((item) => {
            const formatCompact = (n?: number) => {
              if (typeof n !== 'number' || !isFinite(n)) return '';
              try { return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }); } catch { return String(n); }
            };

            const chips = (() => {
              const fmt = idsToLabels(item.categories?.format, 'format');
              const prop = idsToLabels(item.categories?.proposal, 'proposal');
              const ctx = idsToLabels(item.categories?.context, 'context');
              const tone = idsToLabels(item.categories?.tone, 'tone');
              const ref = idsToLabels(item.categories?.references, 'reference');
              const arr: Array<{ text: string; cls: string }> = [];
              const pushAll = (list: string[] | undefined, cls: string) => {
                (list || []).filter(Boolean).forEach((t) => arr.push({ text: t, cls }));
              };
              pushAll(ctx, 'bg-indigo-50 text-indigo-700 border-indigo-200');
              pushAll(fmt, 'bg-blue-50 text-blue-700 border-blue-200');
              pushAll(prop, 'bg-emerald-50 text-emerald-700 border-emerald-200');
              pushAll(tone, 'bg-amber-50 text-amber-700 border-amber-200');
              pushAll(ref, 'bg-rose-50 text-rose-700 border-rose-200');
              // Remove duplicados mantendo ordem
              const seen = new Set<string>();
              return arr.filter((c) => (seen.has(c.text) ? false : (seen.add(c.text), true)));
            })();

            const views = item?.stats?.views ?? item?.stats?.total_interactions;

            const card = (
              <article
                key={item.id}
                className="flex-shrink-0 w-64 md:w-72 lg:w-80 rounded-xl overflow-hidden shadow-xl bg-white/5 backdrop-blur-sm ring-1 ring-white/15"
                aria-label={item.title}
              >
                {/* Topo: avatar + nome */}
                <div className="flex items-center gap-2 px-3 py-2 bg-black/20">
                  <UserAvatar name={item.creator || 'Criador'} src={item.creatorAvatarUrl || undefined} size={24} className="ring-1 ring-white/30" />
                  <span className="text-xs font-medium text-white/90 truncate" title={item.creator || ''}>{item.creator || ''}</span>
                </div>

                {/* Imagem */}
                <div className="relative aspect-[4/5] bg-gray-100">
                  {item.imageUrl && !broken[item.id] ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      draggable={false}
                      onError={() => setBroken((prev) => ({ ...prev, [item.id]: true }))}
                    />
                  ) : (
                    <img
                      src="/images/Colorido-Simbolo.png"
                      alt="Sem imagem"
                      className="absolute inset-0 w-full h-full object-cover opacity-70"
                      draggable={false}
                    />
                  )}
                </div>

                {/* Abaixo: views + chips */}
                <div className="px-3 py-2 flex flex-col items-start gap-2">
                  {typeof views === 'number' && (
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/50 text-white text-sm font-semibold">
                      <span>{formatCompact(views)}</span>
                      <span>views</span>
                    </div>
                  )}
                  {chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((c, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-full border text-[11px] bg-white/15 text-white border-white/20">
                          {c.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
            return item.href ? (
              <a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer" className="block">
                {card}
              </a>
            ) : card;
          })}
        </div>
      </div>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
