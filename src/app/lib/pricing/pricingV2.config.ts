export const PRICING_V2_VERSION = 'v2.0.0' as const;

export const PRICING_V2_CONFIG = {
  productionFloors: {
    publicidade_perfil: {
      reels: 350,
      post: 250,
      stories: 180,
    },
    ugc_whitelabel: {
      reels: 450,
      post: 300,
      stories: 220,
    },
  },
  eventPresenceFloors: {
    2: 600,
    4: 900,
    8: 1500,
  },
  formatDistributionWeights: {
    reels: 1.4,
    post: 1,
    // Uma unidade representa uma sequência de 3 Stories.
    stories: 2.4,
  },
  complexity: {
    simples: 1,
    roteiro: 1.25,
    profissional: 1.6,
  },
  brandSize: {
    pequena: 1,
    media: 1.05,
    grande: 1.1,
  },
  imageRisk: {
    baixo: 1,
    medio: 1.12,
    alto: 1.3,
  },
  authority: {
    padrao: 1,
    ascensao: 1.12,
    autoridade: 1.3,
    celebridade: 1.6,
  },
  seasonality: {
    normal: 1,
    alta: 1.2,
    baixa: 1,
  },
  paidMediaRates: {
    '7d': 0.15,
    '15d': 0.22,
    '30d': 0.35,
    '90d': 0.55,
    '180d': 0.75,
    '365d': 1,
  },
  globalUsageExtraRate: 0.35,
  repostTikTokRate: 0.15,
  exclusivityRates: {
    nenhuma: 0,
    '7d': 0.1,
    '15d': 0.15,
    '30d': 0.25,
    '90d': 0.4,
    '180d': 0.6,
    '365d': 1,
  },
  coverageFactor: 0.9,
  travelCosts: {
    local: 0,
    nacional: 1200,
    internacional: 4500,
  },
  hotelCostPerNight: 450,
  historyBridgeProgress: 0.35,
  historyUpsideCap: 1.25,
  calibrationFactorMin: 0.85,
  calibrationFactorMax: 1.15,
} as const;

export type PricingV2Config = typeof PRICING_V2_CONFIG;
