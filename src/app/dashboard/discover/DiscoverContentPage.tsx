import React from "react";
import { headers } from "next/headers";
import NextDynamic from "next/dynamic";

const DiscoverViewTracker = NextDynamic(
  () => import("../../discover/components/DiscoverViewTracker"),
  { ssr: false }
);
const DiscoverHeaderConfigurator = NextDynamic(
  () => import("./DiscoverHeaderConfigurator"),
  { ssr: false }
);
const DiscoverActionBar = NextDynamic(() => import("./DiscoverActionBar"), { ssr: false });
const DiscoverExplorerSection = NextDynamic(
  () => import("./DiscoverExplorerSection"),
  { ssr: false }
);

export const dynamic = "force-dynamic";

const MAX_POST_AGE_DAYS = 80;
const MAX_POST_AGE_MS = MAX_POST_AGE_DAYS * 24 * 60 * 60 * 1000;
const LIST_SAMPLE_SIZE = 24;

type PostCard = {
  id: string;
  coverUrl?: string | null;
  videoUrl?: string;
  mediaType?: string;
  isVideo?: boolean;
  caption?: string;
  postDate?: string;
  creatorName?: string;
  postLink?: string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
  categories?: {
    format?: string[];
    proposal?: string[];
    context?: string[];
    tone?: string[];
    references?: string[];
  };
};

type Section = { key: string; title: string; items: PostCard[] };
type FeedOk = {
  ok: true;
  sections: Section[];
  allowedPersonalized: boolean;
  capabilities?: { hasReels?: boolean; hasDuration?: boolean; hasSaved?: boolean };
};
type FeedErr = { ok: false; status: number };

function buildBaseUrl() {
  const hdrs = headers();
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

async function fetchFeed(qs?: string): Promise<FeedOk | FeedErr> {
  try {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()
        ? process.env.NEXT_PUBLIC_BASE_URL
        : buildBaseUrl();
    const url = `${base}/api/discover/feed${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        cookie: headers().get("cookie") || "",
      },
    });
    if (!res.ok) return { ok: false as const, status: res.status } as FeedErr;
    const data = await res.json();
    if (!data?.ok) return { ok: false as const, status: 500 } as FeedErr;
    return {
      ok: true as const,
      sections: (data.sections || []) as Section[],
      allowedPersonalized: Boolean(data.allowedPersonalized),
    } as FeedOk;
  } catch {
    return { ok: false as const, status: 500 } as FeedErr;
  }
}

export default async function DiscoverContentPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  const keys = ["format", "proposal", "context", "tone", "references"] as const;
  for (const k of keys) {
    const v = searchParams?.[k];
    if (!v) continue;
    if (Array.isArray(v)) params.set(k, v.join(","));
    else params.set(k, String(v));
  }
  const videoOnlyParam = searchParams?.videoOnly;
  if (videoOnlyParam && (Array.isArray(videoOnlyParam) ? videoOnlyParam[0] : videoOnlyParam)) {
    params.set("videoOnly", "1");
  }
  params.set("limitPerRow", String(LIST_SAMPLE_SIZE));
  params.set("days", String(MAX_POST_AGE_DAYS));
  const qs = params.toString();

  const result = await fetchFeed(qs).catch(
    () => ({ ok: false as const, status: 500 } as FeedErr)
  );

  if (!result.ok) {
    const status = result.status;
    let title = "Não foi possível carregar o feed de descoberta.";
    let hint: React.ReactNode = null;
    if (status === 401) {
      title = "Faça login para ver a Comunidade.";
      hint = (
        <a href="/login" className="text-brand-pink underline">
          Entrar
        </a>
      );
    } else if (status === 403) {
      title = "Ative seu plano para acessar a Comunidade.";
      hint = (
        <a href="/settings/billing" className="text-brand-pink underline">
          Gerir Assinatura
        </a>
      );
    }
    return (
      <main className="dashboard-page-shell py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Comunidade</h1>
        <p className="mt-2 text-gray-600">
          {title} {hint}
        </p>
      </main>
    );
  }

  const { sections, allowedPersonalized } = result as FeedOk;

  const blockedTitles = new Set<string>([
    "Tendências: Humor e Cena",
    "Tendências: Dicas e Tutoriais",
    "Tendências: Moda e Beleza",
    "Horários quentes",
    "Recomendados para você",
  ]);
  const visibleSections = (sections || []).filter(
    (s) => !blockedTitles.has((s.title || "").trim())
  );

  const cutoffTimestamp = Date.now() - MAX_POST_AGE_MS;
  const recencyFilteredSections = visibleSections.map((section) => {
    const filteredItems = (section.items || []).filter((item) => {
      if (!item.postDate) return false;
      const timestamp = new Date(item.postDate).getTime();
      if (Number.isNaN(timestamp)) return false;
      return timestamp >= cutoffTimestamp;
    });
    return { ...section, items: filteredItems };
  });

  const primaryCandidateKeys = ["user_suggested", "personalized", "recommended"];
  const featuredSection =
    recencyFilteredSections.find((section) => primaryCandidateKeys.includes(section.key)) ||
    recencyFilteredSections[0] ||
    null;
  const secondarySections = featuredSection
    ? recencyFilteredSections.filter((section) => section.key !== featuredSection.key)
    : recencyFilteredSections;
  const totalIdeas = recencyFilteredSections.reduce(
    (acc, section) => acc + (section.items?.length ?? 0),
    0
  );
  const exploredLabel = totalIdeas > 0 ? Math.min(totalIdeas, 48) : 0;

  return (
    <main className="w-full pb-24">
      <DiscoverHeaderConfigurator />
      <DiscoverViewTracker />

      <div className="dashboard-page-shell space-y-8 py-6 sm:py-8">
        <DiscoverActionBar allowedPersonalized={allowedPersonalized} />

        <DiscoverExplorerSection sections={secondarySections} primaryKey={featuredSection?.key} />

      </div>
    </main>
  );
}
