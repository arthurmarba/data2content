import { IUser } from '@/app/models/User';

export type AnswerIntent =
  | 'top_performance_inspirations'
  | 'top_reach'
  | 'top_saves'
  | 'underperformance_diagnosis'
  | 'best_formats_for_user'
  | 'content_ideas_for_goal'
  | 'why_my_content_flopped'
  | 'growth_plan'
  | 'community_examples'
  | 'pricing_suggestion'
  | 'generic_qna';

export type IntentGroup = 'inspiration' | 'diagnosis' | 'planning' | 'generic';

export interface ProfileSignals {
  nicho?: string;
  objetivo_primario?: string;
  formatos_preferidos?: string[];
  dificuldades?: string[];
  tom?: string;
  maturidade?: string;
  restricoes?: string[];
  pesquisa_bruta?: any;
}

export interface BaselineByFormat {
  totalInteractionsP50: number;
  engagementRateP50: number | null;
  sampleSize: number;
}

export interface UserBaselines {
  totalInteractionsP50: number;
  engagementRateP50: number | null;
  perFormat: Record<string, BaselineByFormat>;
  sampleSize: number;
  computedAt: number;
  windowDays: number;
}

export interface Thresholds {
  minAbsolute: number;
  minRelativeInteractions: number;
  minRelativeEr?: number | null;
  effectiveInteractions: number;
  effectiveEr?: number | null;
  baselineInteractionP50: number;
  baselineErP50: number | null;
}

export interface AnswerEnginePolicy {
  intent: AnswerIntent;
  requireHighEngagement: boolean;
  maxPosts: number;
  windowDays: number;
  formatLocked?: string | null;
  metricsRequired?: Array<'interactions' | 'er' | 'reach' | 'shares' | 'saves'>;
  relaxed?: boolean;
  thresholds?: Thresholds;
}

export interface CandidatePost {
  id: string;
  permalink?: string | null;
  postDate?: Date | string | null;
  format?: string[];
  tags?: string[];
  stats: {
    total_interactions?: number | null;
    engagement_rate_on_reach?: number | null;
    reach?: number | null;
    saves?: number | null;
    shares?: number | null;
    comments?: number | null;
    likes?: number | null;
    watch_time?: number | null;
    retention_rate?: number | null;
  };
  raw?: any;
}

export interface RankedCandidate extends CandidatePost {
  score: number;
  recencyBoost: number;
  formatBoost: number;
  objectiveBoost: number;
  passesThreshold: boolean;
  baselineDelta?: number | null;
  erDelta?: number | null;
  reachDelta?: number | null;
  filtersApplied?: { formatLocked?: string | null; tagsApplied?: string[]; relaxed?: boolean };
}

export interface ContextPack {
  user_profile: ProfileSignals;
  user_baselines: UserBaselines;
  policy: {
    intent: AnswerIntent;
    requireHighEngagement: boolean;
    thresholds: Thresholds;
    formatLocked?: string | null;
    metricsRequired?: Array<'interactions' | 'er' | 'reach' | 'shares' | 'saves'>;
  };
  top_posts: Array<{
    id: string;
    permalink?: string | null;
    formato?: string | null;
    tema?: string | null;
    total_interactions: number;
    saves?: number | null;
    shares?: number | null;
    comments?: number | null;
    reach?: number | null;
    engagement_rate_by_reach?: number | null;
    baseline_delta?: number | null;
    reach_delta?: number | null;
    post_date?: string | null;
  }>;
  generated_at: string;
  query: string;
  intent: AnswerIntent;
  notes?: string[];
  relaxApplied?: Array<{ step: string; reason: string }>;
  diagnostic?: {
    insufficient?: boolean;
    per_format: Array<{
      format: string;
      sample_size: number;
      insufficient?: boolean;
      reason?: string;
      deltas?: {
        reach_pct?: number | null;
        er_pct?: number | null;
        shares_pct?: number | null;
        saves_pct?: number | null;
      };
      low_posts: ContextPack['top_posts'];
      high_posts: ContextPack['top_posts'];
    }>;
  };
}

export interface AnswerEngineResult {
  intent: AnswerIntent;
  intentGroup: IntentGroup;
  askedForExamples: boolean;
  routerRuleHit?: string | null;
  policy: AnswerEnginePolicy & { thresholds: Thresholds };
  baselines: UserBaselines;
  ranked: RankedCandidate[];
  topPosts: RankedCandidate[];
  contextPack: ContextPack;
  telemetry: {
    candidatesConsidered: number;
    thresholdApplied: Thresholds;
    relaxApplied?: Array<{ step: string; reason: string }>;
  };
  diagnosticEvidence?: {
    insufficient?: boolean;
    perFormat: Array<{
      format: string;
      sampleSize: number;
      insufficient?: boolean;
      reason?: string;
      deltas?: {
        reachPct?: number | null;
        erPct?: number | null;
        sharesPct?: number | null;
        savesPct?: number | null;
      };
      lowPosts: RankedCandidate[];
      highPosts: RankedCandidate[];
    }>;
  };
}

export interface AnswerEngineRequest {
  user: IUser;
  query: string;
  explicitIntent?: AnswerIntent | string | null;
  surveyProfile?: any;
  preferences?: any;
  limit?: number;
  now?: Date;
  candidateOverride?: CandidatePost[];
  baselineOverride?: UserBaselines | null;
}
