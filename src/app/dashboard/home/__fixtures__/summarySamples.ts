import type { HomeSummaryResponse } from "../types";

const baseCommunityMetrics: HomeSummaryResponse["communityMetrics"] = {
  period: "30d",
  metrics: [],
};

export const summaryNewUser: HomeSummaryResponse = {
  communityMetrics: baseCommunityMetrics,
  nextPost: {
    isInstagramConnected: false,
    slotLabel: "",
    primaryHook: "",
  },
  consistency: null,
  mentorship: null,
  mediaKit: null,
  plan: {
    status: null,
    normalizedStatus: "inactive",
    interval: null,
    cancelAtPeriodEnd: false,
    expiresAt: null,
    priceId: null,
    hasPremiumAccess: false,
    isPro: false,
    trial: {
      active: false,
      eligible: true,
      started: false,
      expiresAt: null,
    },
  },
  whatsapp: {
    linked: false,
    startUrl: "/planning/whatsapp",
    trial: {
      active: false,
      eligible: true,
      started: false,
      expiresAt: null,
    },
  },
  community: {
    free: {
      isMember: false,
      inviteUrl: "/planning/discover",
    },
    vip: {
      hasAccess: false,
      isMember: false,
      inviteUrl: null,
    },
  },
  goals: null,
};

export const summaryTrialActive: HomeSummaryResponse = {
  ...summaryNewUser,
  plan: {
    status: "trial",
    normalizedStatus: "trial",
    interval: "month",
    cancelAtPeriodEnd: false,
    expiresAt: new Date().toISOString(),
    priceId: null,
    hasPremiumAccess: false,
    isPro: false,
    trial: {
      active: true,
      eligible: false,
      started: true,
      expiresAt: new Date().toISOString(),
    },
  },
  nextPost: {
    isInstagramConnected: true,
    slotLabel: "Seg • 10h",
    primaryHook: "Ideias quentes para o seu próximo post",
  },
  whatsapp: {
    linked: true,
    startUrl: "/planning/whatsapp",
    trial: {
      active: true,
      eligible: false,
      started: true,
      expiresAt: new Date().toISOString(),
    },
  },
  community: {
    free: {
      isMember: true,
      inviteUrl: "/planning/discover",
    },
    vip: {
      hasAccess: false,
      isMember: false,
      inviteUrl: null,
    },
  },
};

export const summaryProMember: HomeSummaryResponse = {
  ...summaryNewUser,
  plan: {
    status: "active",
    normalizedStatus: "active",
    interval: "month",
    cancelAtPeriodEnd: false,
    expiresAt: null,
    priceId: "price_123",
    hasPremiumAccess: true,
    isPro: true,
    trial: {
      active: false,
      eligible: false,
      started: true,
      expiresAt: null,
    },
  },
  nextPost: {
    isInstagramConnected: true,
    slotLabel: "Ter • 14h",
    primaryHook: "Roteiro alinhado com o planner Plano Agência",
  },
  whatsapp: {
    linked: true,
    startUrl: "/planning/whatsapp",
    trial: {
      active: false,
      eligible: false,
      started: true,
      expiresAt: null,
    },
  },
  community: {
    free: {
      isMember: true,
      inviteUrl: "/planning/discover",
    },
    vip: {
      hasAccess: true,
      isMember: true,
      inviteUrl: "/planning/whatsapp",
    },
  },
};
