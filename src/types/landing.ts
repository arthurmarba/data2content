export interface LandingCommunityMetrics {
  activeCreators: number;
  combinedFollowers: number;
  totalPostsAnalyzed: number;
  postsLast30Days: number;
  newMembersLast7Days: number;
  viewsLast30Days: number;
  viewsAllTime: number;
  reachLast30Days: number;
  reachAllTime: number;
  followersGainedLast30Days: number;
  followersGainedAllTime: number;
  interactionsLast30Days: number;
  interactionsAllTime: number;
}

export interface LandingNextMentorship {
  isoDate: string;
  display: string;
}

export interface LandingCreatorHighlight {
  id: string;
  name: string;
  username?: string | null;
  followers?: number | null;
  avatarUrl?: string | null;
  totalInteractions: number;
  postCount: number;
  avgInteractionsPerPost: number;
  rank: number;
  consistencyScore?: number | null;
  mediaKitSlug?: string | null;
}

export interface LandingCoverageSegment {
  id: string;
  label: string;
  reach: number;
  share: number;
  interactions: number;
  postCount: number;
  avgInteractionsPerPost: number;
  engagementRate?: number | null;
}

export interface LandingCoverageRegion {
  code: string;
  label: string;
  region?: string | null;
  followers: number;
  share: number;
  engagedFollowers?: number | null;
  engagedShare?: number | null;
}

export interface LandingCategoryInsight {
  id: string;
  label: string;
  description?: string | null;
  postCount: number;
  totalInteractions: number;
  avgInteractionsPerPost: number;
  engagementRate?: number | null;
  avgSaves?: number | null;
  topFormats: Array<{ id: string; label: string }>;
  topProposals: Array<{ id: string; label: string }>;
}

export interface LandingCommunityStatsResponse {
  metrics: LandingCommunityMetrics;
  nextMentorship: LandingNextMentorship;
  ranking: LandingCreatorHighlight[];
  categories: LandingCategoryInsight[];
  lastUpdatedIso: string | null;
}
