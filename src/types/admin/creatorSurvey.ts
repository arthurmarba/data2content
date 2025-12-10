import {
  CreatorStage,
  HardestStage,
  MonetizationStatus,
  NextPlatform,
  PriceRange,
} from '@/types/landing';

export interface AdminCreatorSurveyFilters {
  search?: string;
  userId?: string;
  username?: string;
  stage?: CreatorStage[];
  pains?: string[];
  hardestStage?: HardestStage[];
  monetizationStatus?: MonetizationStatus[];
  nextPlatform?: NextPlatform[];
  niches?: string[];
  brandTerritories?: string[];
  accountReasons?: string[];
  followersMin?: number;
  followersMax?: number;
  mediaMin?: number;
  mediaMax?: number;
  country?: string[];
  city?: string[];
  gender?: string[];
  engagementMin?: number;
  engagementMax?: number;
  reachMin?: number;
  reachMax?: number;
  growthMin?: number;
  growthMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminCreatorSurveyListParams extends AdminCreatorSurveyFilters {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'monetization';
  sortOrder?: 'asc' | 'desc';
  columns?: string[];
}

export interface AdminCreatorSurveyListItem {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  niches: string[];
  brandTerritories: string[];
  stage: CreatorStage[];
  mainPains: string[];
  hardestStage: HardestStage[];
  hasDoneSponsoredPosts: MonetizationStatus | null;
  avgPriceRange: PriceRange;
  updatedAt?: string;
  createdAt?: string;
  monetizationLabel: string;
  mainPainLabel: string;
  followersCount?: number | null;
  mediaCount?: number | null;
  gender?: string | null;
  country?: string | null;
  city?: string | null;
  reach?: number | null;
  engaged?: number | null;
  engagementRate?: number | null;
  followersGrowthPct?: number | null;
}

export interface AdminCreatorSurveyDetail {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  createdAt?: string;
  updatedAt?: string;
  followersCount?: number | null;
  mediaCount?: number | null;
  gender?: string | null;
  country?: string | null;
  city?: string | null;
  reach?: number | null;
  engaged?: number | null;
  engagementRate?: number | null;
  followersGrowthPct?: number | null;
  profile: {
    stage: CreatorStage[];
    brandTerritories: string[];
    niches: string[];
    hasHelp: string[];
    dreamBrands: string[];
    mainGoal3m: string | null;
    mainGoalOther?: string | null;
    success12m: string;
    mainPains: string[];
    otherPain?: string | null;
    hardestStage: HardestStage[];
    hasDoneSponsoredPosts: MonetizationStatus | null;
    avgPriceRange: PriceRange;
    bundlePriceRange: PriceRange;
    pricingMethod: string | null;
    pricingFear: string | null;
    pricingFearOther?: string | null;
    mainPlatformReasons: string[];
    reasonOther?: string | null;
    dailyExpectation: string;
    nextPlatform: NextPlatform[];
    learningStyles: string[];
    notificationPref: string[];
    adminNotes?: string;
  };
}

export interface DistributionEntry {
  value: string;
  count: number;
}

export interface AdminCreatorSurveyAnalytics {
  totalRespondents: number;
  monetizationYesPct: number;
  monetizationNoPct: number;
  topPain?: DistributionEntry;
  topNextPlatform?: DistributionEntry;
  metrics?: {
    avgEngagement?: number | null;
    avgReach?: number | null;
    avgGrowth?: number | null;
    avgFollowers?: number | null;
    monetizationRate?: number | null;
    avgTicket?: number | null;
  };
  distributions: {
    pains: DistributionEntry[];
    hardestStage: DistributionEntry[];
    hasDoneSponsoredPosts: DistributionEntry[];
    avgPriceRange: DistributionEntry[];
    mainPlatformReasons: DistributionEntry[];
    nextPlatform: DistributionEntry[];
    pricingMethod: DistributionEntry[];
    learningStyles: DistributionEntry[];
    followers: DistributionEntry[];
    gender: DistributionEntry[];
    country: DistributionEntry[];
    city: DistributionEntry[];
    engagement: DistributionEntry[];
    reach: DistributionEntry[];
    growth: DistributionEntry[];
    stageEngagement?: Array<{ value: string; count: number; avgEngagement: number | null }>;
  };
  timeSeries: { date: string; count: number }[];
  topSuccessStories: DistributionEntry[];
  monetizationByCountry?: Array<{ value: string; total: number; monetizing: number; pct: number }>;
}

export interface AdminCreatorSurveyExportParams extends AdminCreatorSurveyFilters {
  format?: 'csv' | 'json';
  scope?: 'all' | 'filtered';
  columns?: string[];
}
