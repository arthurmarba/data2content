export type DiscoverPostCard = {
  id: string;
  postDate?: string;
  coverUrl?: string | null;
  videoUrl?: string;
  mediaType?: string;
  isVideo?: boolean;
  caption?: string;
  creatorName?: string;
  creatorAvatarUrl?: string | null;
  postLink?: string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    video_duration_seconds?: number;
    saved?: number;
  };
  categories?: {
    format?: string[];
    proposal?: string[];
    context?: string[];
    tone?: string[];
    references?: string[];
    contentIntent?: string[];
    narrativeForm?: string[];
    contentSignals?: string[];
    stance?: string[];
    proofStyle?: string[];
    commercialMode?: string[];
  };
};

export type DiscoverSection = {
  key: string;
  title: string;
  items: DiscoverPostCard[];
};

export const DISCOVER_MAX_POST_AGE_DAYS = 80;
const MAX_POST_AGE_MS = DISCOVER_MAX_POST_AGE_DAYS * 24 * 60 * 60 * 1000;

const BLOCKED_TITLES = new Set<string>([
  "Tendências: Humor e Cena",
  "Tendências: Dicas e Tutoriais",
  "Tendências: Moda e Beleza",
  "Horários quentes",
  "Recomendados para você",
]);

const PRIMARY_CANDIDATE_KEYS = ["user_suggested", "personalized", "recommended"];

export function prepareDiscoverSections(sections: DiscoverSection[]) {
  const visibleSections = (sections || []).filter(
    (section) => !BLOCKED_TITLES.has((section.title || "").trim()),
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

  const featuredSection =
    recencyFilteredSections.find((section) => PRIMARY_CANDIDATE_KEYS.includes(section.key)) ||
    recencyFilteredSections[0] ||
    null;

  const secondarySections = featuredSection
    ? recencyFilteredSections.filter((section) => section.key !== featuredSection.key)
    : recencyFilteredSections;

  return {
    featuredSection,
    secondarySections,
  };
}
