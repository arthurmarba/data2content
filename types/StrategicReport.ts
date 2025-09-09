// Strategic Report Type Contracts (Phase 0)

export type StrategicDataSufficiency = 'low' | 'medium' | 'high';

export type StrategicMetricKey =
  | 'shares'
  | 'saved'
  | 'likes'
  | 'comments'
  | 'reach'
  | 'impressions'
  | 'views'
  | 'video_views'
  | 'profile_visits'
  | 'follows'
  | 'retention_rate'
  | 'engagement_rate'
  | 'total_interactions';

export interface StrategicReportMeta {
  userId: string;
  periodDays: number;
  generatedAt: string; // ISO
  expiresAt: string; // ISO
  version: string;
  confidenceOverall: number; // 0..1
  dataSufficiency: StrategicDataSufficiency;
}

export interface EvidenceRef {
  key: string; // unique key of the computation/evidence
  description?: string;
  metric?: StrategicMetricKey | string;
  n?: number; // sample size
  deltaPct?: number; // percentage delta vs baseline
  value?: number; // raw value if relevant
}

export interface KeyInsight {
  id: string;
  statement: string; // human-friendly statement (must be backed by evidenceRefs)
  metric: StrategicMetricKey | string;
  upliftPct?: number;
  sampleSize?: number;
  confidence?: number; // 0..1
  evidenceRefs: EvidenceRef[];
}

export interface ScriptStep {
  order: number;
  text: string;
}

export interface ScriptSuggestion {
  id: string;
  format: string; // e.g., Reel, Carrossel
  theme: string; // short theme/title
  why: string; // rationale tied to evidence
  cta?: string;
  bestSlots?: Array<{ day: string; hour: number; deltaPct?: number }>; // optional best posting slots
  steps: ScriptStep[];
  evidenceRefs: EvidenceRef[];
}

export interface CorrelationInsight {
  id: string;
  dimension: 'time' | 'dayOfWeek' | 'tone' | 'format' | 'proposal' | 'context' | 'caption_pattern' | string;
  metric: StrategicMetricKey | string;
  method: 'delta_vs_median' | 'spearman' | 'kendall' | 'bootstrap' | string;
  coeffOrDelta: number; // correlation coefficient or percentage delta
  significance?: number; // p-value or confidence level
  sampleSize?: number;
  insightText: string; // human-friendly summary
  evidenceRefs: EvidenceRef[];
}

export interface CommunityInspiration {
  id: string;
  handleOrAnon: string; // e.g., @creator or anonymized label
  format: string;
  proposal: string;
  context: string;
  whyItWorks: string;
  link?: string; // if public/safe
  caution?: string; // caveat
}

export interface CommercialOpportunity {
  id: string;
  category: string; // e.g., Beleza, Moda
  score: number; // 0..1, derived from uplift × confidence × ease
  upliftPct?: number;
  ease?: number; // 0..1 heuristic difficulty
  rationale: string;
}

export interface WeeklyPlanAction {
  order: number;
  type: 'reel' | 'carousel' | 'story' | 'photo' | 'live' | string;
  title: string;
  slot?: { day: string; hour: number };
  notes?: string;
}

export interface WeeklyPlan {
  cadence: string; // short text, e.g., "2 posts + 3 stories"
  bestSlots?: Array<{ day: string; hour: number; deltaPct?: number }>;
  actions: WeeklyPlanAction[];
  reminders?: string[]; // WhatsApp nudges or tips
}

export interface StrategicReportSummary {
  title: string;
  intro: string;
  highlightsCount: number;
  dataSufficiencyNote?: string;
}

export interface StrategicReportEvidenceBundle {
  // raw computations and selections used to support the narrative
  durationBuckets?: Array<{ range: string; avgRetentionRate?: number; avgSaved?: number; totalPosts: number }>; 
  timeBuckets?: Array<{ dayOfWeek: number; hour: number; avg: number; count: number }>; 
  groupingAverages?: Array<{ dimension: 'format' | 'proposal' | 'context' | string; name: string; value: number; postsCount: number }>;
  notes?: string[]; // any calculation notes
}

export interface StrategicNarrative {
  intro: string;
  body: string[]; // paragraphs
  conclusion: string;
}

export interface StrategicReport {
  meta: StrategicReportMeta;
  summary: StrategicReportSummary;
  keyInsights: KeyInsight[];
  scriptSuggestions: ScriptSuggestion[];
  correlations: CorrelationInsight[];
  communityInspirations: CommunityInspiration[];
  commercialOpportunities: CommercialOpportunity[];
  weeklyPlan: WeeklyPlan;
  evidence: StrategicReportEvidenceBundle;
  narrative?: StrategicNarrative;
}
