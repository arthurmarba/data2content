export type CarouselCasePeriod = "7d" | "30d" | "90d";
export type CarouselCaseObjective = "engagement" | "reach" | "leads";
export type CarouselCaseConfidence = "high" | "medium" | "low";
export type CarouselCaseStoryArc =
  | "thesis_action"
  | "thesis_proof_action"
  | "timing_case"
  | "low_sample_case";
export type CarouselCaseSlideType =
  | "cover"
  | "insight"
  | "narrative"
  | "format"
  | "timing"
  | "recommendation"
  | "cta";
export type CarouselCaseVisualPreset = "signature" | "spotlight" | "editorial";

export interface CarouselCaseCreatorRef {
  id: string;
  name: string;
  handle?: string | null;
  profilePictureUrl?: string | null;
}

export interface CarouselCaseSourceInsight {
  title: string;
  reason: string;
  evidence?: string | null;
  confidence: CarouselCaseConfidence;
  kind?: "context" | "proposal" | "format";
  postsCount?: number;
  avgMetricValue?: number;
  avgMetricValueLabel?: string;
  liftVsProfileAverage?: number | null;
  aboveAverageCount?: number | null;
}

export interface CarouselCaseFeaturedPost {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  mediaType?: string | null;
  isVideo?: boolean;
  durationSeconds?: number | null;
  viewsValue?: number | null;
  viewsValueLabel?: string | null;
  metricValue: number;
  metricValueLabel?: string;
  metricLabel: string;
  formatLabel?: string | null;
  durationLabel?: string | null;
  contextLabel?: string | null;
  proposalLabel?: string | null;
  postedAtLabel?: string | null;
}

export interface CarouselCaseMiniChartPoint {
  label: string;
  value: number;
  helper?: string | null;
}

export interface CarouselCaseDirectioningCard {
  title: string;
  body: string;
}

export interface CarouselCaseStrategicAction {
  id: string;
  title: string;
  action: string;
  strategicSynopsis?: string | null;
  recommendationType?: "maintain" | "scale" | "correct" | "test" | null;
  observation?: string | null;
  meaning?: string | null;
  nextStep?: string | null;
  whatNotToDo?: string | null;
  metricLabel?: string | null;
  timeWindowLabel?: string | null;
  isProxyMetric?: boolean;
  impactEstimate?: string | null;
  confidence: CarouselCaseConfidence;
  evidence: string[];
  sampleSize?: number | null;
  expectedLiftRatio?: number | null;
  opportunityScore?: number | null;
  rankingScore?: number | null;
  signalQuality?: string | null;
  guardrailReason?: string | null;
  experimentPlan?: {
    hypothesis?: string;
    baseline?: string;
    successSignal: string;
    sampleGoal: string;
  } | null;
  feedbackStatus?: "applied" | "not_applied" | null;
  queueStage?: string | null;
  executionState?: string | null;
  feedbackUpdatedAt?: string | null;
}

export interface CarouselCaseDirectioningSummary {
  headline?: string | null;
  priorityLabel?: string | null;
  priorityState?: string | null;
  primarySignalText?: string | null;
  comparisonNarrative?: string | null;
  confidenceLabel?: string | null;
  confidenceDescription?: string | null;
  compositeConfidence?: {
    level?: CarouselCaseConfidence | null;
    label?: string | null;
    score?: number | null;
    summary?: string | null;
  } | null;
  experimentFocus?: {
    successSignal: string;
    sampleGoal: string;
  } | null;
  baseDescription?: string | null;
  proxyDisclosure?: string | null;
  noGoLine?: string | null;
  cards?: CarouselCaseDirectioningCard[];
}

export interface CarouselCaseGuardrail {
  type: "low_sample" | "proxy_metric" | "causality";
  message: string;
}

export interface CarouselCaseTimeSlot {
  dayOfWeek: number;
  hour: number;
  average: number;
  count: number;
}

export interface CarouselCaseDurationBucket {
  key?: string | null;
  label: string;
  postsCount: number;
  averageInteractions: number;
  minSeconds?: number | null;
  maxSeconds?: number | null;
}

export interface CarouselCaseFormatBar {
  name: string;
  value: number;
  postsCount?: number;
}

export interface CarouselCasePlanningSnapshot {
  metricMeta?: {
    label?: string | null;
    shortLabel?: string | null;
    isProxy?: boolean;
    description?: string | null;
  } | null;
  directioningSummary?: {
    headline?: string | null;
    priorityLabel?: string | null;
    priorityState?: string | null;
    primarySignal?: {
      text?: string | null;
      tone?: string | null;
      metricLabel?: string | null;
    } | null;
    confidence?: {
      label?: string | null;
      description?: string | null;
    } | null;
    comparison?: {
      narrative?: string | null;
      tone?: string | null;
      currentLabel?: string | null;
      previousLabel?: string | null;
    } | null;
    compositeConfidence?: {
      level?: CarouselCaseConfidence | null;
      label?: string | null;
      score?: number | null;
      summary?: string | null;
      factors?: Array<{ label?: string | null; status?: string | null; text?: string | null }>;
    } | null;
    experimentFocus?: {
      successSignal?: string | null;
      sampleGoal?: string | null;
    } | null;
    baseDescription?: string | null;
    proxyDisclosure?: string | null;
    noGoLine?: string | null;
    cards?: CarouselCaseDirectioningCard[];
  } | null;
  recommendations?: {
    actions?: CarouselCaseStrategicAction[];
  } | null;
  topActions?: CarouselCaseStrategicAction[] | null;
  timeData?: {
    buckets?: CarouselCaseTimeSlot[];
    bestSlots?: CarouselCaseTimeSlot[];
    worstSlots?: CarouselCaseTimeSlot[];
  } | null;
  durationData?: {
    buckets?: CarouselCaseDurationBucket[];
    totalVideoPosts?: number;
    totalPostsWithDuration?: number;
    totalPostsWithoutDuration?: number;
    durationCoverageRate?: number;
  } | null;
  formatData?: {
    chartData?: CarouselCaseFormatBar[];
    metricUsed?: string | null;
    aggregationMode?: string | null;
  } | null;
  timingBenchmark?: {
    cohort?: {
      canShow?: boolean;
      label?: string | null;
      creatorCount?: number;
      confidence?: CarouselCaseConfidence | null;
    } | null;
    duration?: {
      topBucketByPostsKey?: string | null;
      topBucketByAverageKey?: string | null;
    } | null;
    format?: {
      topFormatByPosts?: string | null;
      topFormatByAverage?: string | null;
    } | null;
  } | null;
}

export interface CarouselCasePlannerIdea {
  dayOfWeek: number;
  blockStartHour: number;
  format?: string | null;
  categories?: {
    context?: string[];
    tone?: string;
    proposal?: string[];
    reference?: string[];
  } | null;
  themes?: string[];
  themeKeyword?: string | null;
  title?: string | null;
  scriptShort?: string | null;
  rationale?: string[] | string | null;
  expectedMetrics?: {
    viewsP50?: number | null;
    viewsP90?: number | null;
    sharesP50?: number | null;
  } | null;
}

export interface CarouselCasePlannerSnapshot {
  recommendations?: CarouselCasePlannerIdea[];
  heatmap?: Array<{
    dayOfWeek: number;
    blockStartHour: number;
    score: number;
  }>;
}

export interface CarouselCasePlannerPlanSlot {
  slotId?: string;
  dayOfWeek: number;
  blockStartHour: number;
  format?: string | null;
  categories?: {
    context?: string[];
    proposal?: string[];
    reference?: string[];
    tone?: string;
  } | null;
  title?: string | null;
  scriptShort?: string | null;
  themeKeyword?: string | null;
}

export interface CarouselCaseDurationInsight {
  label: string;
  reason: string;
  postsCount: number;
  averageMetricValue?: number | null;
  averageMetricValueLabel?: string | null;
  metricLabel?: string | null;
}

export interface CarouselCaseFormatInsight {
  label: string;
  whyItWorks: string;
  evidence?: string | null;
  postsCount?: number | null;
  avgMetricValue?: number | null;
  avgMetricValueLabel?: string | null;
  metricLabel?: string | null;
}

export interface CarouselCaseExecutionSummary {
  comboLabel: string;
  formatLeaderLabel?: string | null;
  formatUsageLeaderLabel?: string | null;
  formatLeadVsRunnerUpPct?: number | null;
  formatUsageSharePct?: number | null;
  durationLeaderLabel?: string | null;
  durationUsageLeaderLabel?: string | null;
  durationLeadVsRunnerUpPct?: number | null;
  durationUsageSharePct?: number | null;
  durationCoverageRate?: number | null;
  lowSampleDurationBuckets?: number | null;
  benchmark?: {
    canShow: boolean;
    label?: string | null;
    creatorCount?: number | null;
    confidence?: CarouselCaseConfidence | null;
    formatLeaderByPosts?: string | null;
    formatLeaderByAverage?: string | null;
    durationLeaderByPosts?: string | null;
    durationLeaderByAverage?: string | null;
  } | null;
}

export interface CarouselCaseContentIdea {
  title: string;
  timingLabel: string;
  formatLabel?: string | null;
  note?: string | null;
}

export interface CarouselCaseSource {
  mode: "bootstrap" | "analysis";
  creator: CarouselCaseCreatorRef;
  analysisMeta: {
    postsAnalyzed: number;
    metricLabel: string;
    metricShortLabel: string;
  };
  period: {
    value: CarouselCasePeriod;
    label: string;
  };
  objective: {
    value: CarouselCaseObjective;
    label: string;
  };
  insightSummary: {
    strongestPattern: string;
    strongestPatternReason: string;
  };
  topNarratives: CarouselCaseSourceInsight[];
  topFormats: CarouselCaseFormatInsight[];
  winningWindows: Array<{
    label: string;
    reason?: string | null;
  }>;
  recommendations: string[];
  caveats: string[];
  directioning?: CarouselCaseDirectioningSummary | null;
  strategicAction?: CarouselCaseStrategicAction | null;
  guardrails: CarouselCaseGuardrail[];
  storyArc: CarouselCaseStoryArc;
  topDuration?: CarouselCaseDurationInsight | null;
  executionSummary?: CarouselCaseExecutionSummary | null;
  contentIdeas: CarouselCaseContentIdea[];
  featuredPosts: CarouselCaseFeaturedPost[];
  evidence: {
    narrativePosts: CarouselCaseFeaturedPost[];
    formatPosts: CarouselCaseFeaturedPost[];
    timingPosts: CarouselCaseFeaturedPost[];
    timingChart: CarouselCaseMiniChartPoint[];
    formatChart?: CarouselCaseFormatBar[];
    durationChart?: CarouselCaseDurationBucket[];
  };
}

export interface CarouselCaseSlide {
  id: string;
  type: CarouselCaseSlideType;
  eyebrow?: string;
  headline: string;
  body?: string;
  chips?: string[];
  note?: string;
}

export interface CarouselCaseDeck {
  deckTitle: string;
  creatorId: string;
  aspectRatio: "3:4";
  slides: CarouselCaseSlide[];
}

export interface CarouselCaseDraftSummary {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  periodLabel: string;
  objectiveLabel: string;
  visualPreset: CarouselCaseVisualPreset;
  createdAt: string;
  updatedAt: string;
}
