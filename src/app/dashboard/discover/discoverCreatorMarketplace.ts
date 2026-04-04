import type { LandingCreatorHighlight } from "@/types/landing";

export type CreatorRail = {
  key: string;
  title: string;
  creators: LandingCreatorHighlight[];
  isFallback?: boolean;
};

function normalizeTag(value?: string | null) {
  return (value ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function canonicalizeTag(raw?: string | null): { value: string; label: string } | null {
  const normalized = normalizeTag(raw);
  if (!normalized) return null;
  return { value: normalized, label: raw?.trim() || normalized };
}

function firstNonEmptyTag(values?: string[] | null) {
  if (!values || !values.length) return null;
  for (const entry of values) {
    const normalized = canonicalizeTag(entry);
    if (normalized) return normalized;
  }
  return null;
}

function pickPrimaryCategory(creator: LandingCreatorHighlight) {
  return (
    firstNonEmptyTag(creator.niches) ||
    firstNonEmptyTag(creator.brandTerritories) ||
    firstNonEmptyTag(creator.contexts) ||
    canonicalizeTag(creator.topPerformingContext)
  );
}

function sortCreatorsForCatalog(creators: LandingCreatorHighlight[]) {
  return [...creators].sort((a, b) => {
    const followerDiff = (b.followers ?? 0) - (a.followers ?? 0);
    if (followerDiff !== 0) return followerDiff;

    const interactionsDiff = (b.totalInteractions ?? 0) - (a.totalInteractions ?? 0);
    if (interactionsDiff !== 0) return interactionsDiff;

    const avgDiff = (b.avgInteractionsPerPost ?? 0) - (a.avgInteractionsPerPost ?? 0);
    if (avgDiff !== 0) return avgDiff;

    const rankDiff = (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);
    if (rankDiff !== 0) return rankDiff;

    return (a.name || a.username || "").localeCompare(b.name || b.username || "", "pt-BR");
  });
}

function buildNicheRails(creators: LandingCreatorHighlight[]): CreatorRail[] {
  const buckets = new Map<string, { label: string; creators: LandingCreatorHighlight[]; isFallback: boolean }>();

  creators.forEach((creator) => {
    const primary = pickPrimaryCategory(creator);
    const value = primary?.value ?? "outros";
    const label = primary?.label ?? "Outros";
    const isFallback = !primary;
    const bucket = buckets.get(value) ?? { label, creators: [], isFallback };
    bucket.creators.push(creator);
    buckets.set(value, bucket);
  });

  return Array.from(buckets.entries())
    .map(([value, bucket]) => {
      return {
        key: `niche_${value}`,
        title: bucket.label,
        creators: sortCreatorsForCatalog(bucket.creators),
        isFallback: bucket.isFallback,
      };
    })
    .sort((a, b) => {
      const volumeDiff = b.creators.length - a.creators.length;
      if (volumeDiff !== 0) return volumeDiff;
      if (a.isFallback && !b.isFallback) return 1;
      if (!a.isFallback && b.isFallback) return -1;
      return a.title.localeCompare(b.title, "pt-BR");
    });
}

export function buildCuratedCreatorRails(creators: LandingCreatorHighlight[]): CreatorRail[] {
  if (!creators?.length) return [];
  return buildNicheRails(creators);
}
