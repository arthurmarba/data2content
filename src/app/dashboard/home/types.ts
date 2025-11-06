// src/app/dashboard/home/types.ts
// Tipos compartilhados pelos cards da Home.

export interface NextPostCardData {
  slotLabel: string;
  primaryHook: string;
  secondaryHooks?: string[];
  expectedLiftPercent?: number | null;
  plannerUrl?: string;
  plannerSlotId?: string | null;
  slotDateIso?: string | null;
  isInstagramConnected: boolean;
}

export interface ConsistencyCardData {
  streakDays: number;
  weeklyGoal: number;
  postsSoFar: number;
  projectedPosts?: number;
  overpostingWarning?: boolean;
  plannerUrl?: string;
  hotSlotsUrl?: string;
}

export interface MentorshipCardData {
  nextSessionLabel: string;
  topic?: string;
  description?: string;
  joinCommunityUrl?: string;
  calendarUrl?: string;
  whatsappReminderUrl?: string;
  isMember: boolean;
}

export interface MediaKitCardData {
  shareUrl?: string;
  highlights: Array<{
    label: string;
    value: string;
  }>;
  lastUpdatedLabel?: string;
  hasMediaKit: boolean;
  viewsLast7Days?: number;
  proposalsViaMediaKit?: number;
}

export interface CommunityMetricItem {
  id: string;
  label: string;
  value: string;
  deltaPercent?: number | null;
  periodLabel: string;
}

export interface CommunityMetricsCardData {
  metrics: CommunityMetricItem[];
  period: "7d" | "30d" | "90d";
}

export interface HomePlanSummary {
  status: string | null;
  normalizedStatus: string;
  interval: "month" | "year" | null;
  cancelAtPeriodEnd: boolean;
  expiresAt?: string | null;
  priceId?: string | null;
  hasPremiumAccess: boolean;
  isPro: boolean;
  trial: {
    active: boolean;
    eligible: boolean;
    started: boolean;
    expiresAt?: string | null;
  };
}

export type DashboardChecklistStepId =
  | "connect_ig"
  | "create_media_kit"
  | "receive_proposals"
  | "respond_with_ai";

export type DashboardChecklistStepStatus = "done" | "in_progress" | "todo";

export interface DashboardChecklistStep {
  id: DashboardChecklistStepId;
  title: string;
  status: DashboardChecklistStepStatus;
  helper?: string | null;
  badgeCount?: number | null;
  actionLabel: string;
  actionHref: string;
  completedLabel?: string | null;
  completedHref?: string | null;
  trackEvent?: string | null;
}

export interface DashboardFlowChecklist {
  steps: DashboardChecklistStep[];
  firstPendingStepId: DashboardChecklistStepId | null;
  summary: {
    instagramConnected: boolean;
    hasMediaKit: boolean;
    totalProposals: number;
    newProposals: number;
    pendingProposals: number;
    respondedProposals: number;
    hasProPlan: boolean;
  };
}

export interface DashboardProposalsSummary {
  totalCount: number;
  newCount: number;
  pendingCount: number;
  respondedCount: number;
  acceptedCount: number;
  latestPendingProposalId?: string | null;
  latestPendingStatus?: string | null;
  acceptedEstimate?: {
    currency: string | null;
    totalBudget: number;
    lastClosedAt?: string | null;
  } | null;
  proposalsViaMediaKit?: number;
}

export interface HomeWhatsAppSummary {
  linked: boolean;
  phone?: string | null;
  startUrl?: string | null;
  trial: {
    active: boolean;
    eligible: boolean;
    started: boolean;
    expiresAt?: string | null;
  };
}

export interface HomeCommunitySummary {
  free: {
    isMember: boolean;
    inviteUrl?: string | null;
  };
  vip: {
    hasAccess: boolean;
    isMember: boolean;
    inviteUrl?: string | null;
  };
}

export interface HomeGoalsSummary {
  weeklyPostsTarget?: number | null;
  currentStreak?: number | null;
}

export interface HomeMicroInsight {
  id?: string;
  message: string;
  contextLabel?: string | null;
  impactLabel?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

export interface HomeSummaryResponse {
  nextPost?: NextPostCardData | null;
  consistency?: ConsistencyCardData | null;
  mentorship?: MentorshipCardData | null;
  mediaKit?: MediaKitCardData | null;
  communityMetrics: CommunityMetricsCardData;
  plan?: HomePlanSummary | null;
  whatsapp?: HomeWhatsAppSummary | null;
  community?: HomeCommunitySummary | null;
  goals?: HomeGoalsSummary | null;
  microInsight?: HomeMicroInsight | null;
  flowChecklist?: DashboardFlowChecklist | null;
  proposalsSummary?: DashboardProposalsSummary | null;
}
