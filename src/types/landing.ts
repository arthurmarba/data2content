export interface LandingCommunityMetrics {
  activeCreators: number;
  combinedFollowers: number;
  totalPostsAnalyzed: number;
  postsLast30Days: number;
  newMembersLast7Days: number;
  viewsLast30Days: number;
  reachLast30Days: number;
  followersGainedLast30Days: number;
  interactionsLast30Days: number;
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
  lastUpdatedIso: string;
}
