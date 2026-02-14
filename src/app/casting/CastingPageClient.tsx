"use client";

import React from "react";
import Image from "next/image";

import LandingHeader from "../landing/components/LandingHeader";
import { UserAvatar } from "../components/UserAvatar";
import ButtonPrimary from "../landing/components/ButtonPrimary";
import { useRouter, useSearchParams } from "next/navigation";
import { useUtmAttribution } from "@/hooks/useUtmAttribution";
import { track } from "@/lib/track";
import type { UtmContext } from "@/lib/analytics/utm";
import type { LandingCreatorHighlight } from "@/types/landing";
import { BRAND_CAMPAIGN_ROUTE } from "@/constants/routes";

type CastingPageClientProps = {
  initialCreators: LandingCreatorHighlight[];
};

const CASTING_API_ROUTE = "/api/landing/casting";
const interactionOptions = [
  { value: "", label: "Todas interações/post" },
  { value: "500", label: "≥ 500" },
  { value: "1000", label: "≥ 1k" },
  { value: "2500", label: "≥ 2,5k" },
  { value: "5000", label: "≥ 5k" },
  { value: "10000", label: "≥ 10k" },
  { value: "20000", label: "≥ 20k" },
];
const followerOptions = [
  { value: "", label: "Todos os seguidores" },
  { value: "5000", label: "≥ 5k seguidores" },
  { value: "10000", label: "≥ 10k seguidores" },
  { value: "25000", label: "≥ 25k seguidores" },
  { value: "50000", label: "≥ 50k seguidores" },
  { value: "100000", label: "≥ 100k seguidores" },
  { value: "250000", label: "≥ 250k seguidores" },
  { value: "500000", label: "≥ 500k seguidores" },
];

type CastingRail = {
  key: string;
  title: string;
  description?: string;
  creators: LandingCreatorHighlight[];
  isFallback?: boolean;
  avgContextInteractions?: number;
};

const MIN_RAIL_CREATORS = 1;
const MAX_RAIL_CREATORS = 12;
const FULL_RAIL_MIN_SIZE = 2;

const compactNumber = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const FALLBACK_COLORS = [
  "bg-gradient-to-br from-brand-primary to-brand-accent",
  "bg-gradient-to-br from-brand-accent to-brand-sun",
  "bg-gradient-to-br from-brand-sun to-brand-primary",
  "bg-gradient-to-br from-brand-dark/90 to-brand-primary",
  "bg-gradient-to-br from-brand-dark/80 to-brand-accent",
];

function normalizeTag(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function normalizePlainText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ");
}

const FITNESS_KEYWORDS = new Set([
  "fitness",
  "fit",
  "esporte",
  "esportes",
  "sport",
  "sports",
  "treino",
  "treinos",
  "workout",
  "gym",
  "academia",
  "corrida",
  "running",
  "musculacao",
  "bemestar",
  "bem-estar",
  "saude",
  "health",
  "crossfit",
  "atividadefisica",
  "atividade-fisica",
]);

const KEYWORD_GUESSES: Array<{ match: RegExp; value: string; label: string }> = [
  { match: /\bfitness\b|\bgym\b|\btreino\b|\besporte\b|\bworkout\b/, value: "fitness", label: "Fitness" },
  { match: /\bmoda\b|\bfashion\b|\blook\b/, value: "moda", label: "Moda" },
  { match: /\bbelez|make|skincare|skin\b/, value: "beleza", label: "Beleza" },
  { match: /\btravel|\bviagem|\btrip\b/, value: "viagem", label: "Viagem" },
  { match: /\bfood|cozinha|culin|receita|chef\b/, value: "gastronomia", label: "Gastronomia" },
  { match: /\btech|\btecnologia|\bgadget\b/, value: "tecnologia", label: "Tecnologia" },
  { match: /\bgame|\bgamer|\bgaming\b/, value: "games", label: "Games" },
  { match: /\bmae\b|\bpai\b|bebe|baby|materni/, value: "familia", label: "Família" },
];

function canonicalizeTag(raw?: string | null): { value: string; label: string } | null {
  const normalized = normalizeTag(raw);
  if (!normalized) return null;
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const isFitness = FITNESS_KEYWORDS.has(normalized) || FITNESS_KEYWORDS.has(compact) || normalized.includes("fitness");
  if (isFitness) {
    return { value: "fitness", label: "Fitness" };
  }
  const label = raw?.trim() || normalized;
  return { value: normalized, label };
}

function collectCreatorTags(creator: LandingCreatorHighlight) {
  const tags = [
    ...(creator.niches ?? []),
    ...(creator.brandTerritories ?? []),
    ...(creator.contexts ?? []),
  ];
  const unique = new Set<string>();
  tags.forEach((tag) => {
    const normalized = normalizeTag(tag);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique);
}

function collectNormalized(values?: string[] | null) {
  return (values ?? []).map(normalizeTag).filter(Boolean);
}

function getNormalizedMeta(creator: LandingCreatorHighlight) {
  const niches = collectNormalized([...(creator.niches ?? []), ...(creator.brandTerritories ?? [])]);
  const contexts = collectNormalized(creator.contexts);
  return { niches, contexts };
}

function matchesKeywords(creator: LandingCreatorHighlight, keywords: string[]) {
  const tags = collectCreatorTags(creator);
  return tags.some((tag) => keywords.some((kw) => tag.includes(kw)));
}

function extractMatchingTag(creator: LandingCreatorHighlight, keywords: string[]) {
  const rawTags = [
    ...(creator.contexts ?? []),
    ...(creator.niches ?? []),
    ...(creator.brandTerritories ?? []),
  ];
  for (const tag of rawTags) {
    const normalized = normalizeTag(tag);
    if (keywords.some((kw) => normalized.includes(kw))) {
      return { value: normalized, label: tag.trim() };
    }
  }
  return null;
}

function deriveNicheOptions(creators: LandingCreatorHighlight[]) {
  const labelByValue = new Map<string, string>();
  const counts = new Map<string, number>();

  creators.forEach((creator) => {
    const tags = [
      ...(creator.niches ?? []),
      ...(creator.brandTerritories ?? []),
      ...(creator.contexts ?? []),
    ];
    tags.forEach((tag) => {
      const normalized = normalizeTag(tag);
      if (!normalized) return;
      labelByValue.set(normalized, tag.trim());
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
  });

  return Array.from(labelByValue.entries())
    .sort((a, b) => {
      const diff = (counts.get(b[0]) ?? 0) - (counts.get(a[0]) ?? 0);
      if (diff !== 0) return diff;
      return a[1].localeCompare(b[1]);
    })
    .map(([value, label]) => ({ value, label }));
}

function pickPrimaryNiche(creator: LandingCreatorHighlight) {
  const firstNonEmpty = (values?: string[] | null) => {
    if (!values || !values.length) return null;
    for (const entry of values) {
      const normalized = canonicalizeTag(entry);
      if (normalized) return normalized;
    }
    return null;
  };

  // Ordem de prioridade: nichos > territórios de marca > contextos
  // (ignoramos formatos para não criar trilhos como "Reels").
  const topContext = canonicalizeTag(creator.topPerformingContext);
  return (
    topContext ||
    firstNonEmpty(creator.niches) ||
    firstNonEmpty(creator.brandTerritories) ||
    firstNonEmpty(creator.contexts)
  );
}

function inferAnyTag(creator: LandingCreatorHighlight) {
  const pool = [
    creator.topPerformingContext,
    ...(creator.contexts ?? []),
    ...(creator.niches ?? []),
    ...(creator.brandTerritories ?? []),
  ];
  for (const entry of pool) {
    const normalized = canonicalizeTag(entry);
    if (normalized) return normalized;
  }
  return null;
}

function guessTagFromText(creator: LandingCreatorHighlight) {
  const bag = [creator.name, creator.username].map(normalizePlainText).filter(Boolean).join(" ");
  if (!bag) return null;
  for (const guess of KEYWORD_GUESSES) {
    if (guess.match.test(bag)) {
      return { value: guess.value, label: guess.label };
    }
  }
  return null;
}

function getContextAverageInteractions(creator: LandingCreatorHighlight): number {
  if (
    typeof creator.topPerformingContextAvgInteractions === "number" &&
    Number.isFinite(creator.topPerformingContextAvgInteractions)
  ) {
    return creator.topPerformingContextAvgInteractions;
  }
  return creator.avgInteractionsPerPost ?? 0;
}

function buildNicheRails(sortedByContextAvg: LandingCreatorHighlight[]): CastingRail[] {
  const buckets = new Map<string, { label: string; creators: LandingCreatorHighlight[]; isFallback: boolean }>();

  sortedByContextAvg.forEach((creator) => {
    const primary = pickPrimaryNiche(creator);
    const inferred = primary ?? inferAnyTag(creator) ?? guessTagFromText(creator);
    const value = inferred?.value ?? "sem_nicho_contexto";
    const label = inferred?.label ?? "Sem nicho ou contexto";
    const isFallback = !inferred;
    const bucket = buckets.get(value) ?? { label, creators: [], isFallback };
    bucket.creators.push(creator);
    bucket.isFallback = bucket.isFallback && isFallback;
    buckets.set(value, bucket);
  });

  return Array.from(buckets.entries())
    .map(([value, bucket]) => {
      const sortedCreators = [...bucket.creators].sort((a, b) => {
        const contextAvgDiff = getContextAverageInteractions(b) - getContextAverageInteractions(a);
        if (contextAvgDiff !== 0) return contextAvgDiff;
        const avgDiff = (b.avgInteractionsPerPost ?? 0) - (a.avgInteractionsPerPost ?? 0);
        if (avgDiff !== 0) return avgDiff;
        return (b.followers ?? 0) - (a.followers ?? 0);
      });
      const avgContextInteractions =
        sortedCreators.reduce((acc, creator) => acc + getContextAverageInteractions(creator), 0) /
        Math.max(sortedCreators.length, 1);

      const description = bucket.isFallback
        ? "Criadores sem tag definida ou com dados incompletos."
        : `Criadores com foco em ${bucket.label}.`;
      return {
        key: `niche_${value}`,
        title: bucket.isFallback ? "Contexto diverso" : bucket.label,
        description,
        creators: sortedCreators,
        isFallback: bucket.isFallback,
        avgContextInteractions,
      };
    })
    .sort((a, b) => {
      const contextAvgDiff = (b.avgContextInteractions ?? 0) - (a.avgContextInteractions ?? 0);
      if (contextAvgDiff !== 0) return contextAvgDiff;
      const volumeDiff = b.creators.length - a.creators.length;
      if (volumeDiff !== 0) return volumeDiff;
      return a.title.localeCompare(b.title);
    });
}

function buildCuratedRails(creators: LandingCreatorHighlight[]): CastingRail[] {
  if (!creators?.length) return [];

  const sortedByContextAvg = [...creators].sort((a, b) => {
    const contextAvgDiff = getContextAverageInteractions(b) - getContextAverageInteractions(a);
    if (contextAvgDiff !== 0) return contextAvgDiff;
    const avgA = a.avgInteractionsPerPost ?? 0;
    const avgB = b.avgInteractionsPerPost ?? 0;
    if (avgB !== avgA) return avgB - avgA;
    const followersDiff = (b.followers ?? 0) - (a.followers ?? 0);
    if (followersDiff !== 0) return followersDiff;
    return a.rank - b.rank;
  });

  const rails: CastingRail[] = [];
  const usedRailKeys = new Set<string>();
  const usedIds = new Set<string>();

  const getStableId = (creator: LandingCreatorHighlight) => creator.id || creator.username || creator.name || null;

  const addWithDedup = (
    rail: CastingRail | null | undefined,
    minCount = MIN_RAIL_CREATORS,
    _maxCount = MAX_RAIL_CREATORS,
  ) => {
    if (!rail || usedRailKeys.has(rail.key)) return;
    const available = (rail.creators ?? []).filter((creator) => {
      const stableId = getStableId(creator);
      return stableId && !usedIds.has(stableId);
    });
    if (!available.length) return;
    if (available.length < minCount) return;

    available.forEach((creator) => {
      const stableId = getStableId(creator);
      if (stableId) usedIds.add(stableId);
    });

    usedRailKeys.add(rail.key);
    rails.push({ ...rail, creators: available });
  };

  buildNicheRails(sortedByContextAvg).forEach((rail) => addWithDedup(rail));

  return rails;
}

function partitionRails(rails: CastingRail[]) {
  const fullRails: CastingRail[] = [];
  const microRails: CastingRail[] = [];

  rails.forEach((rail) => {
    const count = rail.creators?.length ?? 0;
    if (!count) return;
    if (rail.isFallback) {
      microRails.push(rail);
      return;
    }
    if (count >= FULL_RAIL_MIN_SIZE) {
      fullRails.push(rail);
    } else if (count > 0) {
      microRails.push(rail);
    }
  });

  return { fullRails, microRails };
}

function resolvePrimaryTag(creator: LandingCreatorHighlight) {
  return creator.contexts?.[0] || creator.niches?.[0] || creator.brandTerritories?.[0] || null;
}

function computeEngagementRate(creator: LandingCreatorHighlight): number | null {
  if (typeof creator.engagementRate === "number" && Number.isFinite(creator.engagementRate)) {
    return creator.engagementRate;
  }

  const totalReach = creator.totalReach ?? 0;
  const totalInteractions = creator.totalInteractions ?? 0;
  if (totalReach > 0) {
    const rate = (totalInteractions / totalReach) * 100;
    return Number.isFinite(rate) ? Number(rate) : null;
  }

  const avgReach = creator.avgReachPerPost ?? 0;
  const avg = creator.avgInteractionsPerPost ?? 0;
  if (!avgReach || avgReach <= 0) return null;
  const rate = (avg / avgReach) * 100;
  return Number.isFinite(rate) ? Number(rate) : null;
}



function withStrictProxy(src?: string | null) {
  if (!src) return null;
  if (src.startsWith("/api/proxy/thumbnail/")) {
    return src.includes("?") ? `${src}&strict=1` : `${src}?strict=1`;
  }
  return src;
}
export default function CastingPageClient({ initialCreators }: CastingPageClientProps) {
  const [creators, setCreators] = React.useState(initialCreators ?? []);
  const [loading, setLoading] = React.useState(!initialCreators || initialCreators.length === 0);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [minFollowers, setMinFollowers] = React.useState<string>("");
  const [minAvgInteractions, setMinAvgInteractions] = React.useState<string>("");
  const headerWrapRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [showStickyBar, setShowStickyBar] = React.useState(false);
  const { appendUtm, utm } = useUtmAttribution();
  const searchParams = useSearchParams();
  const router = useRouter();

  React.useEffect(() => {
    const root = document.documentElement;
    const header = headerWrapRef.current?.querySelector("header");
    if (!header) return;

    const apply = () => {
      const h = header.getBoundingClientRect().height;
      root.style.setProperty("--landing-header-h", `${h}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 280);
    return () => window.clearTimeout(handle);
  }, [search]);

  React.useEffect(() => {
    const q = searchParams.get("search");
    const followers = searchParams.get("minFollowers");
    const interactions = searchParams.get("minAvgInteractions");
    if (q) setSearch(q);
    if (followers) setMinFollowers(followers);
    if (interactions) setMinAvgInteractions(interactions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const MIN_SCROLL = 280;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setShowStickyBar(window.scrollY > MIN_SCROLL);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fetchCreators = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const minFollowersNumber = Number(minFollowers);
      if (Number.isFinite(minFollowersNumber) && minFollowersNumber > 0) {
        params.set("minFollowers", String(Math.floor(minFollowersNumber)));
      }
      const minAvgNumber = Number(minAvgInteractions);
      if (Number.isFinite(minAvgNumber) && minAvgNumber > 0) {
        params.set("minAvgInteractions", String(Math.floor(minAvgNumber)));
      }

      try {
        const res = await fetch(`${CASTING_API_ROUTE}?${params.toString()}`, {
          cache: "no-store",
          signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch casting creators (${res.status})`);
        const data = (await res.json()) as { creators?: LandingCreatorHighlight[]; total?: number };
        setCreators(data.creators ?? []);
      } catch (err) {
        if (signal?.aborted) return;
        setError("Não foi possível carregar o casting agora. Tente novamente em instantes.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [debouncedSearch, minAvgInteractions, minFollowers],
  );

  React.useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchCreators(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchCreators]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (minFollowers) params.set("minFollowers", minFollowers);
    if (minAvgInteractions) params.set("minAvgInteractions", minAvgInteractions);
    const qs = params.toString();
    const url = qs ? `?${qs}` : "";
    router.replace(url);
  }, [debouncedSearch, minFollowers, minAvgInteractions, router]);

  const handleBrandForm = React.useCallback(() => {
    try {
      track("casting_brand_request_click");
    } catch {
      // non-blocking telemetry
    }
    const overrides: Partial<UtmContext> = { utm_content: "casting_brand_button" };
    if (!utm.utm_source) overrides.utm_source = "casting";
    if (!utm.utm_medium) overrides.utm_medium = "casting_page";
    if (!utm.utm_campaign) overrides.utm_campaign = "casting_overview";
    const destination = appendUtm(BRAND_CAMPAIGN_ROUTE, overrides) ?? BRAND_CAMPAIGN_ROUTE;
    window.location.assign(destination);
  }, [appendUtm, utm]);

  const resetFilters = React.useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setMinFollowers("");
    setMinAvgInteractions("");
  }, []);

  const curatedRails = React.useMemo(() => buildCuratedRails(creators), [creators]);
  const { fullRails, microRails } = React.useMemo(() => partitionRails(curatedRails), [curatedRails]);
  const microCreatorCount = React.useMemo(
    () => microRails.reduce((total, rail) => total + (rail.creators?.length ?? 0), 0),
    [microRails],
  );

  React.useEffect(() => {
    if (loading || !fullRails.length) return;
    try {
      fullRails.forEach((rail, index) => {
        track("casting_rail_impression", { key: rail.key, idx: index, total: rail.creators.length });
      });
    } catch {
      // non-blocking
    }
  }, [fullRails, loading]);

  React.useEffect(() => {
    if (loading || !microRails.length) return;
    try {
      microRails.forEach((rail, index) => {
        track("casting_micro_rail_impression", { key: rail.key, idx: index, total: rail.creators.length });
      });
    } catch {
      // non-blocking
    }
  }, [microRails, loading]);

  return (
    <div className="bg-white font-sans">
      <div ref={headerWrapRef}>
        <LandingHeader showLoginButton hideBrandCta />
      </div>

      <main
        className="md:[--landing-header-extra:0px]"
        style={{
          scrollPaddingTop: "calc(var(--landing-header-h, 4.5rem) + 12px)",
        }}
      >
        <section
          className="sticky top-[calc(var(--landing-header-h,4.5rem))] z-30 border-b border-brand-glass/80 bg-white/90 backdrop-blur-lg"
          style={{ "--sat": "0px" } as React.CSSProperties}
        >
          <div className="landing-section__inner landing-section__inner--wide py-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nome ou @"
                aria-label="Buscar criador por nome ou usuário"
                className="w-full rounded-lg border border-brand-glass bg-white px-3 py-2.5 text-sm text-brand-dark shadow-sm outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15"
              />
              <select
                value={minFollowers}
                onChange={(event) => setMinFollowers(event.target.value)}
                aria-label="Filtrar por seguidores totais"
                className="w-full rounded-lg border border-brand-glass bg-white px-3 py-2.5 text-sm text-brand-dark shadow-sm outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15"
              >
                {followerOptions.map((option) => (
                  <option key={option.value || "all-followers"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={minAvgInteractions}
                onChange={(event) => setMinAvgInteractions(event.target.value)}
                aria-label="Filtrar por interações por post"
                className="w-full rounded-lg border border-brand-glass bg-white px-3 py-2.5 text-sm text-brand-dark shadow-sm outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15"
              >
                {interactionOptions.map((option) => (
                  <option key={option.value || "all-interactions"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--compact-top mt-4 sm:mt-6">
          <div className="landing-section__inner landing-section__inner--wide space-y-4">
            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={`rail-skeleton-${item}`}
                    className="rounded-2xl border border-brand-glass bg-white p-4 shadow-sm"
                  >
                    <div className="h-4 w-1/3 rounded bg-brand-glass" />
                    <div className="mt-2 h-3 w-2/3 rounded bg-brand-glass/80" />
                    <div className="mt-3 flex gap-3 overflow-hidden">
                      {[0, 1, 2].map((card) => (
                        <div key={card} className="h-28 w-24 flex-shrink-0 rounded-xl bg-brand-glass/70" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : fullRails.length || microRails.length ? (
              <div className="space-y-3">
                {fullRails.map((rail) => (
                  <section
                    key={rail.key}
                    className="rounded-2xl border border-brand-glass bg-white/90 p-3 shadow-sm sm:p-4"
                    aria-label={rail.title}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-brand-dark">{rail.title}</h3>
                        {rail.description ? (
                          <p className="text-sm text-brand-text-secondary">{rail.description}</p>
                        ) : null}
                      </div>
                      <span className="text-xs font-semibold text-brand-text-secondary">
                        {rail.creators.length} criad{rail.creators.length === 1 ? "or" : "ores"}
                      </span>
                    </div>
                    <div className="group relative -mx-2 mt-3 overflow-x-auto pb-1 hide-scrollbar">
                      <div className="flex flex-nowrap gap-3 px-2 py-2 snap-x snap-mandatory">
                        {rail.creators.map((creator) => (
                          <CastingRankCard
                            key={`${rail.key}-${creator.id}`}
                            creator={creator}
                            onRequestMediaKit={handleBrandForm}
                            variant="rail"
                          />
                        ))}
                      </div>
                    </div>
                  </section>
                ))}

                {microRails.length ? (
                  <section
                    className="rounded-2xl border border-brand-glass bg-white/90 p-3 shadow-sm sm:p-4"
                    aria-label="Criadores avulsos"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-brand-dark">Criadores avulsos</h3>
                        <p className="text-sm text-brand-text-secondary">
                          Contextos com apenas 1 criador ganham espaço fora dos trilhos para a tela não ficar vazia.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-brand-text-secondary">
                        {microCreatorCount} criad{microCreatorCount === 1 ? "or" : "ores"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {microRails.map((rail) =>
                        rail.creators.map((creator) => (
                          <div
                            key={`${rail.key}-${creator.id ?? creator.username ?? creator.name}`}
                            className="flex flex-col gap-2 rounded-2xl p-1"
                          >
                            <span className="inline-flex w-fit items-center rounded-full bg-brand-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-primary">
                              {rail.title}
                            </span>
                            <CastingRankCard
                              creator={creator}
                              onRequestMediaKit={handleBrandForm}
                              variant="grid"
                            />
                          </div>
                        )),
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {error ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
                    {error}
                  </div>
                ) : null}
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
                  Ainda não temos trilhos suficientes para mostrar aqui. Adicione mais criadores ou use a busca.
                </div>
              </div>
            )}
          </div>
        </section>

        <style jsx global>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

        <div
          className={[
            "pointer-events-none fixed inset-x-0 bottom-3 z-40 transition-all duration-300 ease-out md:bottom-5",
            showStickyBar ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
          ].join(" ")}
          aria-hidden={!showStickyBar}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 rounded-2xl border border-brand-glass/80 bg-white/95 px-4 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.18)] backdrop-blur-md md:rounded-full md:px-6">
            <div className="hidden text-sm font-semibold text-brand-dark md:block">
              Pronto para selecionar criadores?
            </div>
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              <ButtonPrimary
                href="/login"
                size="sm"
                variant="outline"
                className="pointer-events-auto border-brand-primary/40 bg-white text-sm"
              >
                Entrar no casting da D2C
              </ButtonPrimary>
              <ButtonPrimary
                onClick={handleBrandForm}
                size="sm"
                variant="brand"
                className="pointer-events-auto text-sm shadow-md shadow-brand-primary/25"
              >
                Solicitar campanha
              </ButtonPrimary>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function CastingRankCard({
  creator,
  onRequestMediaKit,
  className = "",
  variant = "rail",
}: {
  creator: LandingCreatorHighlight;
  onRequestMediaKit?: () => void;
  className?: string;
  variant?: "rail" | "grid";
}) {
  const primaryTag = resolvePrimaryTag(creator);
  const followersText = compactNumber.format(Math.max(creator.followers ?? 0, 0));
  const avgText =
    creator.avgInteractionsPerPost && creator.avgInteractionsPerPost > 0
      ? compactNumber.format(creator.avgInteractionsPerPost)
      : "–";
  const engagementRate = computeEngagementRate(creator);
  const mediaKitHref = creator.mediaKitSlug ? `/mediakit/${creator.mediaKitSlug}` : null;
  const cardClasses = [
    "rounded-3xl border border-[#E8ECF5] bg-white shadow-[0_8px_18px_rgba(20,33,61,0.08)] transition duration-200 hover:-translate-y-0.5",
    variant === "rail" ? "min-w-[210px] max-w-[260px]" : "w-full",
    className,
  ]
    .filter(Boolean)
    .join(" ");


  return (
    <article className={cardClasses}>
      <div className="flex items-start justify-between px-3 pt-3 sm:px-4">
        <div className="text-sm font-bold text-[#FF4080]">#{creator.rank}</div>
        {creator.username ? <div className="truncate text-[11px] font-semibold text-[#727C8F] sm:text-xs">@{creator.username}</div> : null}
      </div>
      <div className="mt-1 h-1 w-10 rounded-full bg-[#FF9FC4] px-3 sm:px-4" />
      <div className="px-3 sm:px-4">
        <div className="mt-3 overflow-hidden rounded-2xl bg-[#F7F8FB]">
          <div className="relative w-full pb-[100%]">
            <UserAvatar
              name={creator.name || creator.username || 'Criador'}
              src={creator.avatarUrl}
              size={260}
              className="absolute inset-0 h-full w-full rounded-none"
            />
          </div>
        </div>
        <div className="mt-4 space-y-0.5">
          <p className="text-sm font-semibold text-[#141C2F] leading-tight sm:text-base">{creator.name}</p>
          <p className="text-xs font-semibold text-[#8A93A6] sm:text-[13px]">
            Mídia kit {creator.mediaKitSlug ? "ativo" : "disponível mediante solicitação"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-[#6E778C]">
          <span className="text-[11px] uppercase tracking-wide text-[#A3A9B6]">Seguidores</span>
          <span className="text-right text-sm font-semibold text-[#141C2F]">{followersText}</span>
          <span className="text-[11px] uppercase tracking-wide text-[#A3A9B6]">Engajamento</span>
          <span className="text-right text-sm font-semibold text-[#141C2F]">
            {engagementRate != null ? `${engagementRate.toFixed(1)}%` : "–"}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-[#A3A9B6]">Interações/post</span>
          <span className="text-right text-sm font-semibold text-[#141C2F]">{avgText}</span>
        </div>
      </div>
      <div className="px-4 pb-4 pt-3">
        {mediaKitHref ? (
          <a
            href={mediaKitHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF4080] underline-offset-4 hover:underline"
          >
            Ver mídia kit →
          </a>
        ) : (
          <button
            type="button"
            onClick={onRequestMediaKit}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#FF4080] underline-offset-4 hover:underline"
          >
            Solicitar mídia kit →
          </button>
        )}
      </div>
    </article>
  );
}
