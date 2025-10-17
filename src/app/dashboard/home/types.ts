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

export interface HomeSummaryResponse {
  nextPost?: NextPostCardData | null;
  consistency?: ConsistencyCardData | null;
  mentorship?: MentorshipCardData | null;
  mediaKit?: MediaKitCardData | null;
  communityMetrics: CommunityMetricsCardData;
}
