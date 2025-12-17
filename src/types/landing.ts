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
  niches?: string[] | null;
  brandTerritories?: string[] | null;
  contexts?: string[] | null;
  formatsStrong?: string[] | null;
  topPerformingContext?: string | null;
  country?: string | null;
  city?: string | null;
  stage?: CreatorStage | null;
  surveyCompleted?: boolean | null;
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

export type SurveyStepId = "niche" | "about" | "goals" | "publis" | "support";

export type CreatorStage = "iniciante" | "hobby" | "renda-extra" | "full-time" | "empresa";
export type CreatorHelper = "solo" | "edicao-design" | "social-media" | "agencia";
export type MainGoal3m =
  | "crescer-seguidores"
  | "aumentar-engajamento"
  | "profissionalizar-publis"
  | "organizar-rotina"
  | "aumentar-faturamento"
  | "outro";
export type HardestStage = "planejar" | "produzir" | "postar" | "analisar" | "negociar";
export type MonetizationStatus = "varias" | "poucas" | "nunca-quero" | "nunca-sem-interesse";
export type PriceRange =
  | "permuta"
  | "0-500"
  | "500-1500"
  | "1500-3000"
  | "3000-5000"
  | "5000-8000"
  | "8000-plus"
  | "3000-plus" // legado
  | null;
export type PricingMethod = "chute" | "seguidores" | "esforco" | "agencia" | "calculadora" | null;
export type PricingFear = "caro" | "barato" | "justificar" | "amador" | "outro" | null;
export type PlatformReason =
  | "metricas"
  | "media-kit"
  | "planejar"
  | "negociar"
  | "oportunidades"
  | "mentorias"
  | "posicionamento-marcas"
  | "outro";
export type LearningStyle = "videos" | "texto" | "checklist" | "aula";
export type NotificationPref = "email" | "whatsapp" | "in-app" | null;
export type NextPlatform = "tiktok" | "youtube" | "outra" | "nenhuma" | null;

export interface CreatorProfileExtended {
  stage: CreatorStage[];
  brandTerritories: string[];
  niches: string[];
  hasHelp: CreatorHelper[];
  dreamBrands: string[];
  mainGoal3m: MainGoal3m | null;
  mainGoalOther?: string | null;
  success12m: string;
  mainPains: string[]; // already multi, keep
  otherPain?: string | null;
  hardestStage: HardestStage[];
  hasDoneSponsoredPosts: MonetizationStatus | null;
  avgPriceRange: PriceRange;
  bundlePriceRange: PriceRange;
  pricingMethod: PricingMethod;
  pricingFear: PricingFear;
  pricingFearOther?: string | null;
  mainPlatformReasons: PlatformReason[];
  reasonOther?: string | null;
  dailyExpectation: string;
  nextPlatform: NextPlatform[];
  learningStyles: LearningStyle[];
  notificationPref: NotificationPref[];
  adminNotes?: string;
  updatedAt?: string | Date | null;
}
