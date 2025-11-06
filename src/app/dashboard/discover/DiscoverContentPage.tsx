import React from "react";
import { headers } from "next/headers";
import NextDynamic from "next/dynamic";

const DiscoverViewTracker = NextDynamic(
  () => import("../../discover/components/DiscoverViewTracker"),
  { ssr: false }
);
const DiscoverBillingGate = NextDynamic(() => import("./DiscoverBillingGate"), { ssr: false });
const DiscoverHeaderConfigurator = NextDynamic(
  () => import("./DiscoverHeaderConfigurator"),
  { ssr: false }
);
const DiscoverActionBar = NextDynamic(() => import("./DiscoverActionBar"), { ssr: false });
const FeaturedIdeasSection = NextDynamic(() => import("./FeaturedIdeasSection"), { ssr: false });
const DiscoverExplorerSection = NextDynamic(
  () => import("./DiscoverExplorerSection"),
  { ssr: false }
);
const DiscoverInsightsSection = NextDynamic(
  () => import("./DiscoverInsightsSection"),
  { ssr: false }
);
import DiscoverHeader from "./DiscoverHeader";

export const dynamic = "force-dynamic";

type PostCard = {
  id: string;
  coverUrl?: string | null;
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
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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

  const primaryCandidateKeys = ["user_suggested", "personalized", "recommended"];
  const featuredSection =
    visibleSections.find((section) => primaryCandidateKeys.includes(section.key)) ||
    visibleSections[0] ||
    null;
  const secondarySections = featuredSection
    ? visibleSections.filter((section) => section.key !== featuredSection.key)
    : visibleSections;
  const totalIdeas = visibleSections.reduce(
    (acc, section) => acc + (section.items?.length ?? 0),
    0
  );
  const featuredIdeas = featuredSection?.items?.length ?? 0;
  const exploredLabel = totalIdeas > 0 ? Math.min(totalIdeas, 48) : 0;

  const flattenedItems = visibleSections.flatMap((section) => section.items || []);
  const viewValues = flattenedItems
    .map((item) => item.stats?.views)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value) && value > 0
    );
  const interactionValues = flattenedItems
    .map((item) => item.stats?.total_interactions)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value) && value > 0
    );

  const avgViews = viewValues.length
    ? viewValues.reduce((sum, curr) => sum + curr, 0) / viewValues.length
    : null;
  const avgInteractions = interactionValues.length
    ? interactionValues.reduce((sum, curr) => sum + curr, 0) / interactionValues.length
    : null;

  const hourBuckets = new Map<string, number>();
  for (const item of flattenedItems) {
    if (!item.postDate) continue;
    const date = new Date(item.postDate);
    if (Number.isNaN(date.getTime())) continue;
    const hour = date.getHours();
    const bucketLabel =
      hour >= 6 && hour < 12
        ? "Manhã (6h-11h)"
        : hour >= 12 && hour < 18
        ? "Tarde (12h-17h)"
        : hour >= 18 && hour < 24
        ? "Noite (18h-23h)"
        : "Madrugada (0h-5h)";
    hourBuckets.set(bucketLabel, (hourBuckets.get(bucketLabel) || 0) + 1);
  }

  let topHourLabel: string | null = null;
  for (const [label, count] of hourBuckets) {
    if (!topHourLabel || (hourBuckets.get(topHourLabel) || 0) < count) {
      topHourLabel = label;
    }
  }
  const heatmapBuckets = Array.from(hourBuckets.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <main className="w-full max-w-none pb-10">
      <DiscoverHeaderConfigurator />
      <DiscoverViewTracker />

      <div className="mx-auto max-w-[820px] space-y-8 px-3 pt-6 sm:px-4 sm:pt-6 lg:max-w-7xl lg:px-6">
        <DiscoverHeader allowedPersonalized={allowedPersonalized} featuredCount={featuredIdeas} />

        <DiscoverActionBar allowedPersonalized={allowedPersonalized} />

        {featuredSection?.items?.length ? (
          <FeaturedIdeasSection items={featuredSection.items} totalItems={featuredIdeas} />
        ) : null}

        <DiscoverExplorerSection sections={secondarySections} primaryKey={featuredSection?.key} />

        <DiscoverInsightsSection
          avgViews={avgViews}
          avgInteractions={avgInteractions}
          totalPosts={flattenedItems.length}
          topHourLabel={topHourLabel}
          heatmapBuckets={heatmapBuckets}
        />

        <section className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Próximos passos
              </p>
              <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">
                Planeje e troque ideias com quem está no mesmo ritmo
              </h3>
              <p className="text-sm text-slate-600">
                Você explorou {exploredLabel || "várias"} ideias hoje. Salve as melhores e valide com a
                comunidade.
              </p>
            </div>
            <DiscoverBillingGate />
          </div>
        </section>
      </div>
    </main>
  );
}
