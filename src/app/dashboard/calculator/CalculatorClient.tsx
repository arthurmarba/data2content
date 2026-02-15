"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { isPlanActiveLike } from "@/utils/planStatus";
import { FaSpinner, FaLock, FaArrowRight, FaChartLine, FaChartPie, FaInstagram, FaVideo, FaImage, FaLayerGroup, FaCalendarCheck, FaCalendarAlt, FaCalendarTimes, FaGlobeAmericas, FaBullhorn, FaUser, FaUserCheck, FaUserTie, FaStar, FaSnowflake, FaSun, FaCloudSun, FaPlus, FaTrash, FaChevronDown } from "react-icons/fa";
import { track } from "@/lib/track";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

type DeliveryType = "conteudo" | "evento";
type CalculatorFormat = "post" | "reels" | "stories" | "pacote" | "evento";
type FormatQuantities = {
  reels: number;
  post: number;
  stories: number;
};
type EventDetails = {
  durationHours: 2 | 4 | 8;
  travelTier: "local" | "nacional" | "internacional";
  hotelNights: number;
};
type CalculatorParams = {
  format: CalculatorFormat;
  deliveryType: DeliveryType;
  formatQuantities: FormatQuantities;
  eventDetails: EventDetails;
  eventCoverageQuantities: FormatQuantities;
  exclusivity: "nenhuma" | "7d" | "15d" | "30d" | "90d" | "180d" | "365d";
  usageRights: "organico" | "midiapaga" | "global";
  paidMediaDuration: "7d" | "15d" | "30d" | "90d" | "180d" | "365d" | null;
  repostTikTok: boolean;
  instagramCollab: boolean;
  brandSize: "pequena" | "media" | "grande";
  imageRisk: "baixo" | "medio" | "alto";
  strategicGain: "baixo" | "medio" | "alto";
  contentModel: "publicidade_perfil" | "ugc_whitelabel";
  allowStrategicWaiver: boolean;
  complexity: "simples" | "roteiro" | "profissional";
  authority: "padrao" | "ascensao" | "autoridade" | "celebridade";
  seasonality: "normal" | "alta" | "baixa";
};

type CalculationBreakdown = {
  contentUnits: number;
  contentJusto: number;
  eventPresenceJusto: number;
  coverageUnits: number;
  coverageJusto: number;
  travelCost: number;
  hotelCost: number;
  logisticsSuggested: number;
  logisticsIncludedInCache: false;
};

type CalculationCalibration = {
  enabled: boolean;
  baseJusto: number;
  factorRaw: number;
  factorApplied: number;
  guardrailApplied: boolean;
  confidence: number;
  confidenceBand: "alta" | "media" | "baixa";
  segmentSampleSize: number;
  creatorSampleSize: number;
  windowDaysSegment: number;
  windowDaysCreator: number;
  lowConfidenceRangeExpanded: boolean;
  linkQuality: "high" | "mixed" | "low";
};

type CalculationResult = {
  estrategico: number;
  justo: number;
  premium: number;
  cpm: number;
  breakdown: CalculationBreakdown;
  calibration: CalculationCalibration;
  params: CalculatorParams;
  metrics: {
    reach: number;
    engagement: number;
    profileSegment: string;
  };
  avgTicket: number | null;
  totalDeals: number;
  calculationId: string;
  explanation: string | null;
  createdAt: string | null;
};

type MediaKitPackage = {
  name: string;
  price: number;
  currency: string;
  deliverables: string[];
  description?: string;
  type: 'manual' | 'ai_generated';
  id?: string; // For internal UI keying
};

type PackageInsertSource = "manual" | "suggested_card";
type SubmitSource = "form_submit";
type SaveSource = "result_cta";
type PackageResponseItem = Omit<MediaKitPackage, "id"> & { _id?: string };

let localPackageIdCounter = 0;
type CollapsibleSectionKey = "delivery" | "rights" | "brand" | "packages" | "insights";

const FORMAT_VALUES: CalculatorFormat[] = ["reels", "post", "stories", "pacote", "evento"];
const DELIVERY_TYPE_VALUES: DeliveryType[] = ["conteudo", "evento"];
const EXCLUSIVITY_VALUES: CalculatorParams["exclusivity"][] = ["nenhuma", "7d", "15d", "30d", "90d", "180d", "365d"];
const USAGE_VALUES: CalculatorParams["usageRights"][] = ["organico", "midiapaga", "global"];
const PAID_MEDIA_DURATION_VALUES: Exclude<CalculatorParams["paidMediaDuration"], null>[] = ["7d", "15d", "30d", "90d", "180d", "365d"];
const BRAND_SIZE_VALUES: CalculatorParams["brandSize"][] = ["pequena", "media", "grande"];
const IMAGE_RISK_VALUES: CalculatorParams["imageRisk"][] = ["baixo", "medio", "alto"];
const STRATEGIC_GAIN_VALUES: CalculatorParams["strategicGain"][] = ["baixo", "medio", "alto"];
const CONTENT_MODEL_VALUES: CalculatorParams["contentModel"][] = ["publicidade_perfil", "ugc_whitelabel"];
const COMPLEXITY_VALUES: CalculatorParams["complexity"][] = ["simples", "roteiro", "profissional"];
const AUTHORITY_VALUES: CalculatorParams["authority"][] = ["padrao", "ascensao", "autoridade", "celebridade"];
const SEASONALITY_VALUES: CalculatorParams["seasonality"][] = ["normal", "alta", "baixa"];
const EVENT_DURATION_VALUES: EventDetails["durationHours"][] = [2, 4, 8];
const TRAVEL_TIER_VALUES: EventDetails["travelTier"][] = ["local", "nacional", "internacional"];

const FORMAT_OPTIONS = [
  { value: "reels", label: "Reels", icon: FaVideo, helper: "Vídeo curto (até 90s)" },
  { value: "post", label: "Post no Feed", icon: FaImage, helper: "Foto única ou carrossel" },
  { value: "stories", label: "Stories", icon: FaInstagram, helper: "Sequência de 3 stories" },
];

const EXCLUSIVITY_OPTIONS = [
  { value: "nenhuma", label: "Sem Exclusividade", icon: FaCalendarTimes },
  { value: "7d", label: "7 Dias", icon: FaCalendarCheck },
  { value: "15d", label: "15 Dias", icon: FaCalendarCheck },
  { value: "30d", label: "30 Dias", icon: FaCalendarAlt },
  { value: "90d", label: "90 Dias", icon: FaCalendarAlt },
  { value: "180d", label: "180 Dias", icon: FaCalendarAlt },
  { value: "365d", label: "365 Dias", icon: FaCalendarAlt },
];

const USAGE_OPTIONS = [
  { value: "organico", label: "Orgânico", icon: FaUser, helper: "Apenas no seu perfil" },
  { value: "midiapaga", label: "Mídia Paga", icon: FaBullhorn, helper: "Impulsionamento em todas as plataformas envolvidas" },
  { value: "global", label: "Global", icon: FaGlobeAmericas, helper: "Uso amplo + impulsionamento cross-plataforma" },
];

const PAID_MEDIA_DURATION_OPTIONS = [
  { value: "7d", label: "7 Dias", icon: FaCalendarCheck },
  { value: "15d", label: "15 Dias", icon: FaCalendarCheck },
  { value: "30d", label: "30 Dias", icon: FaCalendarAlt },
  { value: "90d", label: "90 Dias", icon: FaCalendarAlt },
  { value: "180d", label: "180 Dias", icon: FaCalendarAlt },
  { value: "365d", label: "365 Dias", icon: FaCalendarAlt },
];
const BRAND_SIZE_OPTIONS = [
  { value: "pequena", label: "Pequena", icon: FaUser, helper: "Menor caixa e risco comercial maior" },
  { value: "media", label: "Média", icon: FaUserCheck, helper: "Cenário intermediário" },
  { value: "grande", label: "Grande", icon: FaUserTie, helper: "Mais previsível e potencial estratégico" },
];
const IMAGE_RISK_OPTIONS = [
  { value: "baixo", label: "Baixo", icon: FaCloudSun, helper: "Baixo risco reputacional" },
  { value: "medio", label: "Médio", icon: FaCalendarAlt, helper: "Risco moderado para imagem" },
  { value: "alto", label: "Alto", icon: FaSun, helper: "Risco alto, exige prêmio" },
];
const STRATEGIC_GAIN_OPTIONS = [
  { value: "baixo", label: "Baixo", icon: FaCalendarTimes, helper: "Pouco ganho de posicionamento" },
  { value: "medio", label: "Médio", icon: FaChartLine, helper: "Ajuda parcialmente no posicionamento" },
  { value: "alto", label: "Alto", icon: FaStar, helper: "Parceria muito estratégica para imagem" },
];
const CONTENT_MODEL_OPTIONS = [
  { value: "publicidade_perfil", label: "Publicidade no perfil", icon: FaInstagram, helper: "Publicado no perfil do creator" },
  { value: "ugc_whitelabel", label: "UGC (whitelabel)", icon: FaVideo, helper: "Conteúdo de uso da marca, mais barato" },
];

const COMPLEXITY_OPTIONS = [
  { value: "simples", label: "Simples", icon: FaUser, helper: "Sem roteiro prévio" },
  { value: "roteiro", label: "Com Roteiro", icon: FaUserCheck, helper: "Roteiro aprovado" },
  { value: "profissional", label: "Pro", icon: FaUserTie, helper: "Edição avançada" },
];

const AUTHORITY_OPTIONS = [
  { value: "padrao", label: "Padrão", icon: FaUser, helper: "Iniciante" },
  { value: "ascensao", label: "Em Ascensão", icon: FaChartLine, helper: "Crescendo" },
  { value: "autoridade", label: "Autoridade", icon: FaStar, helper: "Referência" },
  { value: "celebridade", label: "Celebridade", icon: FaStar, helper: "Famoso" },
];

const SEASONALITY_OPTIONS = [
  { value: "normal", label: "Normal", icon: FaCloudSun, helper: "Dias comuns" },
  { value: "alta", label: "Alta Demanda", icon: FaSun, helper: "Black Friday, Natal" },
  { value: "baixa", label: "Baixa", icon: FaSnowflake, helper: "Pós-datas festivas" },
];

const EXCLUSIVITY_LABELS: Record<CalculatorParams["exclusivity"], string> = {
  nenhuma: "Sem Exclusividade",
  "7d": "7 Dias",
  "15d": "15 Dias",
  "30d": "30 Dias",
  "90d": "90 Dias",
  "180d": "180 Dias",
  "365d": "365 Dias",
};
const USAGE_LABELS: Record<CalculatorParams["usageRights"], string> = {
  organico: "Orgânico",
  midiapaga: "Mídia Paga",
  global: "Global",
};
const PAID_MEDIA_DURATION_LABELS: Record<Exclude<CalculatorParams["paidMediaDuration"], null>, string> = {
  "7d": "7 Dias",
  "15d": "15 Dias",
  "30d": "30 Dias",
  "90d": "90 Dias",
  "180d": "180 Dias",
  "365d": "365 Dias",
};
const BRAND_SIZE_LABELS: Record<CalculatorParams["brandSize"], string> = {
  pequena: "Pequena",
  media: "Média",
  grande: "Grande",
};
const IMAGE_RISK_LABELS: Record<CalculatorParams["imageRisk"], string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};
const STRATEGIC_GAIN_LABELS: Record<CalculatorParams["strategicGain"], string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
};
const CONTENT_MODEL_LABELS: Record<CalculatorParams["contentModel"], string> = {
  publicidade_perfil: "Publicidade no perfil",
  ugc_whitelabel: "UGC (whitelabel)",
};
const COMPLEXITY_LABELS: Record<CalculatorParams["complexity"], string> = {
  simples: "Simples",
  roteiro: "Com Roteiro",
  profissional: "Pro",
};
const AUTHORITY_LABELS: Record<CalculatorParams["authority"], string> = {
  padrao: "Padrão",
  ascensao: "Em Ascensão",
  autoridade: "Autoridade",
  celebridade: "Celebridade",
};
const CALIBRATION_BAND_LABELS: Record<CalculationCalibration["confidenceBand"], string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function buildLocalPackageId(): string {
  localPackageIdCounter += 1;
  return `local-package-${Date.now()}-${localPackageIdCounter}`;
}

function sanitizePackagePrice(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return 0;
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return 0;
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }
  return 0;
}

export default function CalculatorClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const billingStatus = useBillingStatus();
  const brandRiskV1Enabled = true;

  const planStatusSession = (session?.user as any)?.planStatus;
  const resolvedPlanAccess = Boolean(
    billingStatus.hasPremiumAccess ||
    billingStatus.isTrialActive ||
    isPlanActiveLike(planStatusSession)
  );
  const canAccessFeatures = !billingStatus.isLoading && resolvedPlanAccess;
  const showLockedMessage = !billingStatus.isLoading && !resolvedPlanAccess;
  const lockTrackedRef = useRef(false);
  const resumeHandledRef = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const upgradeMessage = "Descubra seu preço ideal com base nas suas métricas reais.";

  const [calcParams, setCalcParams] = useState<CalculatorParams>({
    format: "reels",
    deliveryType: "conteudo",
    formatQuantities: { reels: 1, post: 0, stories: 0 },
    eventDetails: { durationHours: 4, travelTier: "local", hotelNights: 0 },
    eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
    exclusivity: "nenhuma",
    usageRights: "organico",
    paidMediaDuration: null,
    repostTikTok: false,
    instagramCollab: false,
    brandSize: "media",
    imageRisk: "medio",
    strategicGain: "baixo",
    contentModel: "publicidade_perfil",
    allowStrategicWaiver: false,
    complexity: "simples",
    authority: "padrao",
    seasonality: "normal",
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<CollapsibleSectionKey, boolean>>({
    delivery: false,
    rights: false,
    brand: false,
    packages: false,
    insights: false,
  });

  // Package Management State
  const [packages, setPackages] = useState<MediaKitPackage[]>([]);
  const [isSavingPackages, setIsSavingPackages] = useState(false);

  useEffect(() => {
    // Fetch existing packages on mount or when access is confirmed
    if (canAccessFeatures) {
      fetch('/api/mediakit/self/packages')
        .then((res) => res.json())
        .then((data: { packages?: PackageResponseItem[] }) => {
          if (Array.isArray(data.packages)) {
            setPackages(
              data.packages.map((pkg) => ({
                ...pkg,
                id: pkg._id || buildLocalPackageId(),
                price: sanitizePackagePrice(pkg.price),
                deliverables: Array.isArray(pkg.deliverables) ? pkg.deliverables : [],
              })),
            );
          }
        })
        .catch((err) => console.error('Failed to load packages', err));
    }
  }, [canAccessFeatures]);

  useEffect(() => {
    if (showLockedMessage) {
      if (!lockTrackedRef.current) {
        track("pro_feature_locked_viewed", { feature: "calculator" });
        lockTrackedRef.current = true;
      }
    } else {
      lockTrackedRef.current = false;
    }
  }, [showLockedMessage]);

  useEffect(() => {
    if (resumeHandledRef.current) return;
    if (billingStatus.isLoading) return;
    if (!canAccessFeatures) return;
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
      if (!stored) return;
      const data = JSON.parse(stored);
      if (data?.context !== "calculator") return;
      window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
      resumeHandledRef.current = true;
      submitButtonRef.current?.focus({ preventScroll: false });
    } catch {
      try {
        window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [billingStatus.isLoading, canAccessFeatures]);

  useEffect(() => {
    if (!calculation) return;
    if (!resultsSectionRef.current) return;
    resultsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [calculation]);

  const handleLockedAccess = (source: string = "cta") => {
    toast({
      variant: "info",
      title: "Recurso exclusivo do Plano Pro",
      description: upgradeMessage,
    });
    track("pro_feature_upgrade_clicked", {
      feature: "calculator",
      source,
    });
    if (typeof window !== "undefined") {
      track("paywall_viewed", {
        creator_id: null,
        context: "calculator",
        plan: billingStatus.normalizedStatus ?? (billingStatus.planStatus as string | null),
      });
      window.dispatchEvent(
        new CustomEvent("open-subscribe-modal", {
          detail: { context: "calculator", source, returnTo: "/dashboard/calculator" },
        })
      );
    }
  };

  const handleChange = <K extends keyof CalculatorParams>(key: K, value: CalculatorParams[K]) => {
    setCalcParams((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const setContentModel = (nextModel: CalculatorParams["contentModel"]) => {
    const shouldAutoSimplify =
      nextModel === "ugc_whitelabel" &&
      calcParams.contentModel !== "ugc_whitelabel" &&
      calcParams.complexity !== "simples";

    setCalcParams((prev) => {
      return {
        ...prev,
        contentModel: nextModel,
        complexity: shouldAutoSimplify ? "simples" : prev.complexity,
      };
    });

    if (shouldAutoSimplify) {
      toast({
        variant: "info",
        title: "Complexidade ajustada para UGC",
        description: "Aplicamos 'Simples' como padrão de UGC. Você pode alterar manualmente se quiser.",
      });
    }

    setError(null);
  };

  const toggleSectionCollapse = (section: CollapsibleSectionKey) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const clampQuantity = (value: number) => Math.min(20, Math.max(0, Math.trunc(value)));
  const quantityTotal = (quantities: FormatQuantities) => quantities.reels + quantities.post + quantities.stories;
  const hasAnyQuantity = (quantities: FormatQuantities) => quantityTotal(quantities) > 0;
  const buildCalculatorTelemetry = (params: CalculatorParams, source: SubmitSource | PackageInsertSource | SaveSource) => ({
    deliveryType: params.deliveryType,
    format: params.format,
    hasCoverage: hasAnyQuantity(params.eventCoverageQuantities),
    brandRiskV1Enabled,
    brandSize: params.brandSize,
    imageRisk: params.imageRisk,
    strategicGain: params.strategicGain,
    contentModel: params.contentModel,
    allowStrategicWaiver: params.allowStrategicWaiver,
    source,
  });

  const deriveLegacyFormat = (params: CalculatorParams): CalculatorFormat => {
    if (params.deliveryType === "evento") return "evento";

    const positiveEntries = Object.entries(params.formatQuantities).filter(([, qty]) => qty > 0) as Array<
      [keyof FormatQuantities, number]
    >;

    const singleEntry = positiveEntries[0];
    if (positiveEntries.length === 1 && singleEntry && singleEntry[1] === 1) {
      return singleEntry[0];
    }

    return "pacote";
  };

  const normalizeParamsForSubmit = (params: CalculatorParams): CalculatorParams => {
    const formatQuantities = {
      reels: clampQuantity(params.formatQuantities.reels),
      post: clampQuantity(params.formatQuantities.post),
      stories: clampQuantity(params.formatQuantities.stories),
    };

    const eventCoverageQuantities = {
      reels: clampQuantity(params.eventCoverageQuantities.reels),
      post: clampQuantity(params.eventCoverageQuantities.post),
      stories: clampQuantity(params.eventCoverageQuantities.stories),
    };

    const eventDetails: EventDetails = {
      durationHours: EVENT_DURATION_VALUES.includes(params.eventDetails.durationHours)
        ? params.eventDetails.durationHours
        : 4,
      travelTier: TRAVEL_TIER_VALUES.includes(params.eventDetails.travelTier)
        ? params.eventDetails.travelTier
        : "local",
      hotelNights: clampQuantity(params.eventDetails.hotelNights),
    };

    const usageRights: CalculatorParams["usageRights"] = USAGE_VALUES.includes(params.usageRights)
      ? params.usageRights
      : "organico";

    const rawPaidMediaDuration =
      params.paidMediaDuration && PAID_MEDIA_DURATION_VALUES.includes(params.paidMediaDuration)
        ? params.paidMediaDuration
        : null;

    const paidMediaDuration: CalculatorParams["paidMediaDuration"] =
      usageRights === "organico" ? null : (rawPaidMediaDuration ?? "30d");
    const brandSize: CalculatorParams["brandSize"] =
      brandRiskV1Enabled && BRAND_SIZE_VALUES.includes(params.brandSize) ? params.brandSize : "media";
    const imageRisk: CalculatorParams["imageRisk"] =
      brandRiskV1Enabled && IMAGE_RISK_VALUES.includes(params.imageRisk) ? params.imageRisk : "medio";
    const strategicGain: CalculatorParams["strategicGain"] =
      brandRiskV1Enabled && STRATEGIC_GAIN_VALUES.includes(params.strategicGain) ? params.strategicGain : "baixo";
    const contentModel: CalculatorParams["contentModel"] =
      brandRiskV1Enabled && CONTENT_MODEL_VALUES.includes(params.contentModel)
        ? params.contentModel
        : "publicidade_perfil";
    const allowStrategicWaiver = brandRiskV1Enabled ? Boolean(params.allowStrategicWaiver) : false;

    const normalized: CalculatorParams = {
      ...params,
      deliveryType: DELIVERY_TYPE_VALUES.includes(params.deliveryType) ? params.deliveryType : "conteudo",
      formatQuantities,
      eventCoverageQuantities,
      eventDetails,
      usageRights,
      paidMediaDuration,
      repostTikTok: Boolean(params.repostTikTok),
      instagramCollab: Boolean(params.instagramCollab),
      brandSize,
      imageRisk,
      strategicGain,
      contentModel,
      allowStrategicWaiver,
      format: params.format,
    };

    return {
      ...normalized,
      format: deriveLegacyFormat(normalized),
    };
  };

  const sanitizeCalculationParams = (raw: Partial<CalculatorParams> | undefined, fallback: CalculatorParams): CalculatorParams => {
    const deliveryType: DeliveryType = raw?.deliveryType === "evento" ? "evento" : raw?.deliveryType === "conteudo" ? "conteudo" : (raw?.format === "evento" ? "evento" : fallback.deliveryType);

    const fallbackQuantities = deliveryType === "conteudo"
      ? fallback.formatQuantities
      : { reels: 0, post: 0, stories: 0 };

    const formatQuantities: FormatQuantities = {
      reels: clampQuantity(raw?.formatQuantities?.reels ?? fallbackQuantities.reels),
      post: clampQuantity(raw?.formatQuantities?.post ?? fallbackQuantities.post),
      stories: clampQuantity(raw?.formatQuantities?.stories ?? fallbackQuantities.stories),
    };

    const eventCoverageQuantities: FormatQuantities = {
      reels: clampQuantity(raw?.eventCoverageQuantities?.reels ?? fallback.eventCoverageQuantities.reels),
      post: clampQuantity(raw?.eventCoverageQuantities?.post ?? fallback.eventCoverageQuantities.post),
      stories: clampQuantity(raw?.eventCoverageQuantities?.stories ?? fallback.eventCoverageQuantities.stories),
    };

    const eventDetails: EventDetails = {
      durationHours: EVENT_DURATION_VALUES.includes(raw?.eventDetails?.durationHours as EventDetails["durationHours"])
        ? (raw?.eventDetails?.durationHours as EventDetails["durationHours"])
        : fallback.eventDetails.durationHours,
      travelTier: TRAVEL_TIER_VALUES.includes(raw?.eventDetails?.travelTier as EventDetails["travelTier"])
        ? (raw?.eventDetails?.travelTier as EventDetails["travelTier"])
        : fallback.eventDetails.travelTier,
      hotelNights: clampQuantity(raw?.eventDetails?.hotelNights ?? fallback.eventDetails.hotelNights),
    };

    const candidate: CalculatorParams = {
      format: FORMAT_VALUES.includes(raw?.format as CalculatorFormat) ? (raw?.format as CalculatorFormat) : fallback.format,
      deliveryType,
      formatQuantities,
      eventDetails,
      eventCoverageQuantities,
      exclusivity: EXCLUSIVITY_VALUES.includes(raw?.exclusivity as CalculatorParams["exclusivity"])
        ? (raw?.exclusivity as CalculatorParams["exclusivity"])
        : fallback.exclusivity,
      usageRights: USAGE_VALUES.includes(raw?.usageRights as CalculatorParams["usageRights"])
        ? (raw?.usageRights as CalculatorParams["usageRights"])
        : fallback.usageRights,
      paidMediaDuration:
        raw?.paidMediaDuration && PAID_MEDIA_DURATION_VALUES.includes(raw.paidMediaDuration as Exclude<CalculatorParams["paidMediaDuration"], null>)
          ? (raw.paidMediaDuration as Exclude<CalculatorParams["paidMediaDuration"], null>)
          : fallback.paidMediaDuration,
      repostTikTok: typeof raw?.repostTikTok === "boolean" ? raw.repostTikTok : fallback.repostTikTok,
      instagramCollab: typeof raw?.instagramCollab === "boolean" ? raw.instagramCollab : fallback.instagramCollab,
      brandSize: BRAND_SIZE_VALUES.includes(raw?.brandSize as CalculatorParams["brandSize"])
        ? (raw?.brandSize as CalculatorParams["brandSize"])
        : fallback.brandSize,
      imageRisk: IMAGE_RISK_VALUES.includes(raw?.imageRisk as CalculatorParams["imageRisk"])
        ? (raw?.imageRisk as CalculatorParams["imageRisk"])
        : fallback.imageRisk,
      strategicGain: STRATEGIC_GAIN_VALUES.includes(raw?.strategicGain as CalculatorParams["strategicGain"])
        ? (raw?.strategicGain as CalculatorParams["strategicGain"])
        : fallback.strategicGain,
      contentModel: CONTENT_MODEL_VALUES.includes(raw?.contentModel as CalculatorParams["contentModel"])
        ? (raw?.contentModel as CalculatorParams["contentModel"])
        : fallback.contentModel,
      allowStrategicWaiver:
        typeof raw?.allowStrategicWaiver === "boolean"
          ? raw.allowStrategicWaiver
          : fallback.allowStrategicWaiver,
      complexity: COMPLEXITY_VALUES.includes(raw?.complexity as CalculatorParams["complexity"])
        ? (raw?.complexity as CalculatorParams["complexity"])
        : fallback.complexity,
      authority: AUTHORITY_VALUES.includes(raw?.authority as CalculatorParams["authority"])
        ? (raw?.authority as CalculatorParams["authority"])
        : fallback.authority,
      seasonality: SEASONALITY_VALUES.includes(raw?.seasonality as CalculatorParams["seasonality"])
        ? (raw?.seasonality as CalculatorParams["seasonality"])
        : fallback.seasonality,
    };

    const usageRights = candidate.usageRights;
    const paidMediaDuration =
      usageRights === "organico"
        ? null
        : candidate.paidMediaDuration && PAID_MEDIA_DURATION_VALUES.includes(candidate.paidMediaDuration)
          ? candidate.paidMediaDuration
          : "30d";

    const normalizedCandidate: CalculatorParams = {
      ...candidate,
      paidMediaDuration,
      brandSize: brandRiskV1Enabled ? candidate.brandSize : "media",
      imageRisk: brandRiskV1Enabled ? candidate.imageRisk : "medio",
      strategicGain: brandRiskV1Enabled ? candidate.strategicGain : "baixo",
      contentModel: brandRiskV1Enabled ? candidate.contentModel : "publicidade_perfil",
      allowStrategicWaiver: brandRiskV1Enabled ? candidate.allowStrategicWaiver : false,
    };

    return {
      ...normalizedCandidate,
      format: deriveLegacyFormat(normalizedCandidate),
    };
  };

  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const formatPercent = (value: number) => `${percentFormatter.format(value)}%`;
  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const callCalculator = async () => {
    setIsCalculating(true);
    setError(null);
    try {
      const normalizedParams = normalizeParamsForSubmit(calcParams);
      track("calculator_submit_started", buildCalculatorTelemetry(normalizedParams, "form_submit"));
      if (normalizedParams.deliveryType === "conteudo" && !hasAnyQuantity(normalizedParams.formatQuantities)) {
        const message = "Selecione pelo menos uma entrega (Reels, Post ou Stories) para calcular.";
        track("calculator_submit_failed", {
          ...buildCalculatorTelemetry(normalizedParams, "form_submit"),
          errorCode: "missing_deliverables",
        });
        setError(message);
        toast({
          variant: "error",
          title: "Entregas obrigatórias",
          description: message,
        });
        return;
      }

      if (normalizedParams.usageRights !== "organico" && !normalizedParams.paidMediaDuration) {
        const message = "Informe o prazo de uso em mídia paga para continuar.";
        track("calculator_submit_failed", {
          ...buildCalculatorTelemetry(normalizedParams, "form_submit"),
          errorCode: "missing_paid_media_duration",
        });
        setError(message);
        toast({
          variant: "error",
          title: "Prazo obrigatório",
          description: message,
        });
        return;
      }

      const response = await fetch("/api/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedParams),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 402) {
          track("calculator_submit_failed", {
            ...buildCalculatorTelemetry(normalizedParams, "form_submit"),
            errorCode: String(response.status),
          });
          handleLockedAccess("api_call");
          return;
        }
        const errorCode = (payload as { code?: string } | null)?.code || String(response.status);
        track("calculator_submit_failed", {
          ...buildCalculatorTelemetry(normalizedParams, "form_submit"),
          errorCode,
        });
        const message = (payload as any)?.error || "Não foi possível calcular no momento.";
        setError(message);
        toast({
          variant: "error",
          title: "Falha ao calcular",
          description: message,
        });
        return;
      }

      const parsed = payload as Partial<CalculationResult>;
      if (typeof parsed?.justo !== "number" || typeof parsed?.estrategico !== "number" || typeof parsed?.premium !== "number") {
        const invalidResponseError = new Error("Resposta inválida do servidor.");
        (invalidResponseError as Error & { code?: string }).code = "invalid_response_shape";
        throw invalidResponseError;
      }

      const sanitizedParams = sanitizeCalculationParams(parsed.params as Partial<CalculatorParams> | undefined, normalizedParams);

      const sanitized: CalculationResult = {
        estrategico: parsed.estrategico,
        justo: parsed.justo,
        premium: parsed.premium,
        breakdown: {
          contentUnits: typeof (parsed as any)?.breakdown?.contentUnits === "number" ? (parsed as any).breakdown.contentUnits : 0,
          contentJusto: typeof (parsed as any)?.breakdown?.contentJusto === "number" ? (parsed as any).breakdown.contentJusto : 0,
          eventPresenceJusto: typeof (parsed as any)?.breakdown?.eventPresenceJusto === "number" ? (parsed as any).breakdown.eventPresenceJusto : 0,
          coverageUnits: typeof (parsed as any)?.breakdown?.coverageUnits === "number" ? (parsed as any).breakdown.coverageUnits : 0,
          coverageJusto: typeof (parsed as any)?.breakdown?.coverageJusto === "number" ? (parsed as any).breakdown.coverageJusto : 0,
          travelCost: typeof (parsed as any)?.breakdown?.travelCost === "number" ? (parsed as any).breakdown.travelCost : 0,
          hotelCost: typeof (parsed as any)?.breakdown?.hotelCost === "number" ? (parsed as any).breakdown.hotelCost : 0,
          logisticsSuggested: typeof (parsed as any)?.breakdown?.logisticsSuggested === "number" ? (parsed as any).breakdown.logisticsSuggested : 0,
          logisticsIncludedInCache: false,
        },
        cpm: typeof parsed.cpm === "number" ? parsed.cpm : 0,
        calibration: {
          enabled: typeof (parsed as any)?.calibration?.enabled === "boolean" ? (parsed as any).calibration.enabled : false,
          baseJusto: typeof (parsed as any)?.calibration?.baseJusto === "number" ? (parsed as any).calibration.baseJusto : parsed.justo,
          factorRaw: typeof (parsed as any)?.calibration?.factorRaw === "number" ? (parsed as any).calibration.factorRaw : 1,
          factorApplied:
            typeof (parsed as any)?.calibration?.factorApplied === "number"
              ? (parsed as any).calibration.factorApplied
              : 1,
          guardrailApplied:
            typeof (parsed as any)?.calibration?.guardrailApplied === "boolean"
              ? (parsed as any).calibration.guardrailApplied
              : false,
          confidence:
            typeof (parsed as any)?.calibration?.confidence === "number"
              ? (parsed as any).calibration.confidence
              : 0,
          confidenceBand:
            (parsed as any)?.calibration?.confidenceBand === "alta" ||
            (parsed as any)?.calibration?.confidenceBand === "media" ||
            (parsed as any)?.calibration?.confidenceBand === "baixa"
              ? (parsed as any).calibration.confidenceBand
              : "baixa",
          segmentSampleSize:
            typeof (parsed as any)?.calibration?.segmentSampleSize === "number"
              ? (parsed as any).calibration.segmentSampleSize
              : 0,
          creatorSampleSize:
            typeof (parsed as any)?.calibration?.creatorSampleSize === "number"
              ? (parsed as any).calibration.creatorSampleSize
              : 0,
          windowDaysSegment:
            typeof (parsed as any)?.calibration?.windowDaysSegment === "number"
              ? (parsed as any).calibration.windowDaysSegment
              : 180,
          windowDaysCreator:
            typeof (parsed as any)?.calibration?.windowDaysCreator === "number"
              ? (parsed as any).calibration.windowDaysCreator
              : 365,
          lowConfidenceRangeExpanded:
            typeof (parsed as any)?.calibration?.lowConfidenceRangeExpanded === "boolean"
              ? (parsed as any).calibration.lowConfidenceRangeExpanded
              : false,
          linkQuality:
            (parsed as any)?.calibration?.linkQuality === "high" ||
            (parsed as any)?.calibration?.linkQuality === "mixed" ||
            (parsed as any)?.calibration?.linkQuality === "low"
              ? (parsed as any).calibration.linkQuality
              : "low",
        },
        params: sanitizedParams,
        metrics: {
          reach: parsed.metrics?.reach ?? 0,
          engagement: parsed.metrics?.engagement ?? 0,
          profileSegment: parsed.metrics?.profileSegment ?? "default",
        },
        avgTicket: typeof parsed.avgTicket === "number" ? parsed.avgTicket : null,
        totalDeals: typeof parsed.totalDeals === "number" ? parsed.totalDeals : 0,
        calculationId: parsed.calculationId || "",
        explanation: parsed.explanation ?? null,
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      };
      setCalcParams(sanitizedParams);
      setCalculation(sanitized);
      if (sanitized.calibration.enabled) {
        track("calculator_calibration_applied", {
          ...buildCalculatorTelemetry(sanitizedParams, "form_submit"),
          factorRaw: sanitized.calibration.factorRaw,
          factorApplied: sanitized.calibration.factorApplied,
          confidence: sanitized.calibration.confidence,
          band: sanitized.calibration.confidenceBand,
          guardrailApplied: sanitized.calibration.guardrailApplied,
        });
      }
      track("calculator_submit_succeeded", buildCalculatorTelemetry(sanitizedParams, "form_submit"));
    } catch (err: any) {
      const message = err?.message || "Erro inesperado ao calcular.";
      const normalizedParams = normalizeParamsForSubmit(calcParams);
      track("calculator_submit_failed", {
        ...buildCalculatorTelemetry(normalizedParams, "form_submit"),
        errorCode: err?.code || "unexpected_error",
      });
      setError(message);
      toast({
        variant: "error",
        title: "Erro inesperado",
        description: message,
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAccessFeatures) {
      handleLockedAccess("form_submit");
      return;
    }
    await callCalculator();
  };

  const handleAddPackage = (pkg?: Partial<MediaKitPackage>, source: PackageInsertSource = "manual") => {
    const paramsForTelemetry = calculation?.params ?? calcParams;
    const newPackage: MediaKitPackage = {
      id: buildLocalPackageId(),
      name: pkg?.name || "Novo Pacote",
      price: sanitizePackagePrice(pkg?.price),
      currency: "BRL",
      deliverables: pkg?.deliverables || ["1x Reels"],
      description: pkg?.description || "",
      type: "manual",
    };
    setPackages((prev) => [...prev, newPackage]);
    track("calculator_package_added", buildCalculatorTelemetry(paramsForTelemetry, source));
    toast({
      variant: "success",
      title: "Pacote adicionado",
      description: "Edite os detalhes abaixo.",
    });
  };

  const handleUpdatePackage = (id: string, updates: Partial<MediaKitPackage>) => {
    setPackages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nextPrice =
          Object.prototype.hasOwnProperty.call(updates, "price")
            ? sanitizePackagePrice(updates.price)
            : p.price;
        const nextDeliverables =
          Object.prototype.hasOwnProperty.call(updates, "deliverables") && Array.isArray(updates.deliverables)
            ? updates.deliverables
            : p.deliverables;
        return {
          ...p,
          ...updates,
          price: nextPrice,
          deliverables: nextDeliverables,
        };
      })
    );
  };

  const handleDeletePackage = (id: string) => {
    if (confirm("Tem certeza que deseja remover este pacote?")) {
      setPackages((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleAddToMediaKit = async () => {
    if (isSavingPackages) return;
    setIsSavingPackages(true);

    try {
      const sanitizedPackages = packages.map((p) => ({
        ...p,
        name: (p.name || "").trim() || "Pacote sem nome",
        price: sanitizePackagePrice(p.price),
        deliverables: p.deliverables.map((d) => d.trim()).filter(Boolean),
      }));

      const res = await fetch('/api/mediakit/self/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: sanitizedPackages }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const errorCode = (payload as { code?: string } | null)?.code || `HTTP_${res.status}`;
        track("calculator_mediakit_save_failed", {
          ...buildCalculatorTelemetry(calculation?.params ?? calcParams, "result_cta"),
          errorCode,
        });
        throw new Error((payload as { error?: string } | null)?.error || 'Falha ao salvar pacotes');
      }

      track("calculator_mediakit_save_succeeded", buildCalculatorTelemetry(calculation?.params ?? calcParams, "result_cta"));
      if (calculation) {
        router.push(`/media-kit?fromCalc=${encodeURIComponent(calculation.calculationId)}`);
      } else {
        router.push('/media-kit');
      }

      toast({
        variant: "success",
        title: "Sucesso!",
        description: "Pacotes atualizados no seu Media Kit.",
      });

    } catch (err) {
      if (!(err instanceof Error)) {
        track("calculator_mediakit_save_failed", {
          ...buildCalculatorTelemetry(calculation?.params ?? calcParams, "result_cta"),
          errorCode: "unknown_error",
        });
      }
      toast({
        variant: "error",
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o Media Kit.",
      });
    } finally {
      setIsSavingPackages(false);
    }
  };

  const disableInputs = isCalculating || !canAccessFeatures;

  const calculateEffectiveCpm = (totalValue: number, reach: number) => {
    if (reach <= 0) return 0;
    return (totalValue / reach) * 1000;
  };

  const statsCards = calculation
    ? [
      {
        label: "Estratégico (Mínimo)",
        amount: calculation.estrategico,
        value: formatCurrency(calculation.estrategico),
        cpm: formatCurrency(calculateEffectiveCpm(calculation.estrategico, calculation.metrics.reach)),
        description: "Para abrir portas e fechar pacotes.",
        headerClass: "bg-slate-50 text-slate-700",
      },
      {
        label: "Valor Justo (Sugerido)",
        amount: calculation.justo,
        value: formatCurrency(calculation.justo),
        cpm: formatCurrency(calculateEffectiveCpm(calculation.justo, calculation.metrics.reach)),
        description: "Equilíbrio ideal entre esforço e retorno.",
        headerClass: "bg-slate-50 text-slate-700",
      },
      {
        label: "Premium (Alto Valor)",
        amount: calculation.premium,
        value: formatCurrency(calculation.premium),
        cpm: formatCurrency(calculateEffectiveCpm(calculation.premium, calculation.metrics.reach)),
        description: "Para alta demanda e entregas complexas.",
        headerClass: "bg-slate-50 text-slate-700",
      },
    ]
    : null;
  const strategicWaiverApplied = Boolean(
    calculation?.params.allowStrategicWaiver &&
    calculation?.estrategico === 0
  );
  const hasContentInResult = Boolean(calculation && calculation.breakdown.contentUnits > 0);
  const calibrationAdjustmentPercent =
    calculation && calculation.calibration
      ? (calculation.calibration.factorApplied - 1) * 100
      : 0;
  const calibrationBandLabel = calculation
    ? CALIBRATION_BAND_LABELS[calculation.calibration.confidenceBand]
    : "Baixa";
  const activeMultiplierTags = calculation
    ? [
      EXCLUSIVITY_LABELS[calculation.params.exclusivity],
      USAGE_LABELS[calculation.params.usageRights],
      calculation.params.paidMediaDuration
        ? `Mídia paga ${PAID_MEDIA_DURATION_LABELS[calculation.params.paidMediaDuration]}`
        : "Sem mídia paga",
      calculation.params.repostTikTok ? "Repost TikTok" : "Sem repost TikTok",
      calculation.params.instagramCollab ? "Collab IG" : "Sem Collab IG",
      brandRiskV1Enabled ? `Porte ${BRAND_SIZE_LABELS[calculation.params.brandSize]}` : null,
      brandRiskV1Enabled ? `Risco ${IMAGE_RISK_LABELS[calculation.params.imageRisk]}` : null,
      brandRiskV1Enabled ? `Estratégico ${STRATEGIC_GAIN_LABELS[calculation.params.strategicGain]}` : null,
      brandRiskV1Enabled ? CONTENT_MODEL_LABELS[calculation.params.contentModel] : null,
      COMPLEXITY_LABELS[calculation.params.complexity],
      AUTHORITY_LABELS[calculation.params.authority],
      calculation.params.seasonality === "normal"
        ? "Sazonalidade normal"
        : `Sazonalidade ${calculation.params.seasonality}`,
      calculation.calibration.enabled
        ? `Calibração ${calibrationBandLabel} (${calibrationAdjustmentPercent >= 0 ? "+" : ""}${formatPercent(calibrationAdjustmentPercent)})`
        : "Calibração desativada",
    ].filter(Boolean) as string[]
    : [];
  const visibleMultiplierTags = activeMultiplierTags.slice(0, 6);
  const hiddenMultiplierCount = Math.max(0, activeMultiplierTags.length - visibleMultiplierTags.length);

  const SelectionGroup = ({ label, options, value, onChange, disabled }: any) => (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-semibold text-slate-800">{label}</legend>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {options.map((option: any) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={`flex w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${isSelected
                ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft-strong)]"
                : "border-transparent bg-slate-50 hover:bg-slate-100"
                } ${disabled ? "cursor-not-allowed opacity-60" : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent-ring)] focus-visible:ring-offset-1"}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm transition-colors ${isSelected ? "bg-[var(--brand-accent)] text-white" : "bg-slate-100 text-slate-500"}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                {option.helper && <p className="text-xs leading-snug text-slate-500">{option.helper}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </fieldset>
  );

  const QuantitySelectionGroup = ({
    label,
    quantities,
    onChange,
    disabled,
  }: {
    label: string;
    quantities: FormatQuantities;
    onChange: (key: keyof FormatQuantities, nextValue: number) => void;
    disabled?: boolean;
  }) => (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-semibold text-slate-800">{label}</legend>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {FORMAT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const currentValue = quantities[option.value as keyof FormatQuantities] ?? 0;
          const isSelected = currentValue > 0;
          const optionKey = option.value as keyof FormatQuantities;
          return (
            <div
              key={option.value}
              className={`rounded-xl border p-2.5 transition ${isSelected
                ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft-strong)]"
                : "border-transparent bg-slate-50"
                } ${disabled ? "opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm transition-colors ${isSelected ? "bg-[var(--brand-accent)] text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? "Desativar" : "Ativar"} ${option.label}`}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${isSelected ? "bg-[var(--brand-accent)] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  onClick={() => onChange(optionKey, isSelected ? 0 : 1)}
                >
                  {isSelected ? "Ativo" : "Ativar"}
                </button>
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                {option.helper && <p className="text-xs text-slate-500">{option.helper}</p>}
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => onChange(optionKey, clampQuantity(currentValue - 1))}
                  disabled={disabled || currentValue <= 0}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Diminuir ${option.label}`}
                >
                  -
                </button>
                <span className="text-sm font-semibold text-slate-900" aria-live="polite">
                  {currentValue}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(optionKey, clampQuantity(currentValue + 1))}
                  disabled={disabled || currentValue >= 20}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Aumentar ${option.label}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );

  const updateFormatQuantity = (key: keyof FormatQuantities, nextValue: number) => {
    setCalcParams((prev) => {
      const nextQuantities = {
        ...prev.formatQuantities,
        [key]: clampQuantity(nextValue),
      };
      const nextParams: CalculatorParams = {
        ...prev,
        formatQuantities: nextQuantities,
      };
      return {
        ...nextParams,
        format: deriveLegacyFormat(nextParams),
      };
    });
    setError(null);
  };

  const updateCoverageQuantity = (key: keyof FormatQuantities, nextValue: number) => {
    setCalcParams((prev) => ({
      ...prev,
      eventCoverageQuantities: {
        ...prev.eventCoverageQuantities,
        [key]: clampQuantity(nextValue),
      },
      format: deriveLegacyFormat(prev),
    }));
    setError(null);
  };

  const setDeliveryType = (nextType: DeliveryType) => {
    setCalcParams((prev) => {
      const nextParams: CalculatorParams = {
        ...prev,
        deliveryType: nextType,
      };
      return {
        ...nextParams,
        format: deriveLegacyFormat(nextParams),
      };
    });
    setError(null);
  };

  const setUsageRights = (nextUsageRights: CalculatorParams["usageRights"]) => {
    setCalcParams((prev) => ({
      ...prev,
      usageRights: nextUsageRights,
      paidMediaDuration: nextUsageRights === "organico" ? null : (prev.paidMediaDuration ?? "30d"),
    }));
    setError(null);
  };

  const setPaidMediaDuration = (nextDuration: Exclude<CalculatorParams["paidMediaDuration"], null>) => {
    setCalcParams((prev) => ({
      ...prev,
      paidMediaDuration: prev.usageRights === "organico" ? null : nextDuration,
    }));
    setError(null);
  };

  const toggleFlag = (field: "repostTikTok" | "instagramCollab" | "allowStrategicWaiver") => {
    setCalcParams((prev) => ({ ...prev, [field]: !prev[field] }));
    setError(null);
  };

  return (
    <div className="dashboard-page-shell py-4 sm:py-6">
      <div className="mx-auto w-full max-w-[900px] space-y-4 sm:space-y-5">
        <header className="space-y-1.5">
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Quanto cobrar pela sua publi?
          </h1>
          <p className="text-sm text-slate-500 sm:text-base">
            Defina as premissas da entrega e gere uma faixa de preço prática para negociação.
          </p>
        </header>

        {billingStatus.isLoading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 sm:p-8">
            <FaSpinner className="h-5 w-5 animate-spin text-slate-700" />
            <span className="font-medium">Carregando seus dados...</span>
          </div>
        )}

        {showLockedMessage && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex flex-col items-center gap-5 text-center md:flex-row md:text-left">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <FaLock className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1.5">
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  Desbloqueie o poder da precificação inteligente
                </h2>
                <p className="text-slate-600">
                  Assinantes Pro têm acesso completo à calculadora com sugestões baseadas em dados reais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleLockedAccess("banner")}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Quero acesso agora
                <FaArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <button
            type="button"
            onClick={() => toggleSectionCollapse("delivery")}
            aria-expanded={!collapsedSections.delivery}
            aria-controls="calculator-section-delivery"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-accent-soft)] text-xs font-semibold text-[var(--brand-accent-ink)]">1</span>
                Detalhes da Entrega
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Escolha entregas e marque evento só quando necessário.</p>
            </div>
            <FaChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${collapsedSections.delivery ? "" : "rotate-180"}`}
              aria-hidden
            />
          </button>
          {!collapsedSections.delivery ? (
          <div id="calculator-section-delivery" className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-900">Presença em Evento</p>
                <p className="text-xs text-slate-500">Ative apenas quando houver presença física.</p>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryType(calcParams.deliveryType === "evento" ? "conteudo" : "evento")}
                disabled={disableInputs}
                aria-pressed={calcParams.deliveryType === "evento"}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  calcParams.deliveryType === "evento"
                    ? "bg-[var(--brand-accent)] text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
                aria-label="Presença em Evento"
              >
                {calcParams.deliveryType === "evento" ? "Incluída" : "Não incluída"}
              </button>
            </div>

            <QuantitySelectionGroup
              label="Quais entregas de conteúdo entram no cálculo?"
              quantities={calcParams.formatQuantities}
              onChange={updateFormatQuantity}
              disabled={disableInputs}
            />

            {calcParams.deliveryType === "evento" ? (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-800">Duração do evento</span>
                    <select
                      value={calcParams.eventDetails.durationHours}
                      disabled={disableInputs}
                      onChange={(e) =>
                        setCalcParams((prev) => ({
                          ...prev,
                          eventDetails: { ...prev.eventDetails, durationHours: Number(e.target.value) as EventDetails["durationHours"] },
                          format: "evento",
                        }))
                      }
                      className="w-full rounded-lg border-slate-200 text-sm text-slate-700 focus:border-slate-400 focus:ring-slate-300"
                    >
                      <option value={2}>2 horas</option>
                      <option value={4}>4 horas</option>
                      <option value={8}>8 horas</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-800">Deslocamento</span>
                    <select
                      value={calcParams.eventDetails.travelTier}
                      disabled={disableInputs}
                      onChange={(e) =>
                        setCalcParams((prev) => ({
                          ...prev,
                          eventDetails: { ...prev.eventDetails, travelTier: e.target.value as EventDetails["travelTier"] },
                          format: "evento",
                        }))
                      }
                      className="w-full rounded-lg border-slate-200 text-sm text-slate-700 focus:border-slate-400 focus:ring-slate-300"
                    >
                      <option value="local">Local</option>
                      <option value="nacional">Nacional</option>
                      <option value="internacional">Internacional</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-semibold text-slate-800">Noites de hotel</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={calcParams.eventDetails.hotelNights}
                      disabled={disableInputs}
                      onChange={(e) =>
                        setCalcParams((prev) => ({
                          ...prev,
                          eventDetails: { ...prev.eventDetails, hotelNights: clampQuantity(Number(e.target.value)) },
                          format: "evento",
                        }))
                      }
                      className="w-full rounded-lg border-slate-200 text-sm text-slate-700 focus:border-slate-400 focus:ring-slate-300"
                    />
                  </label>
                </div>

                <QuantitySelectionGroup
                  label="Cobertura opcional no evento (não obrigatória)"
                  quantities={calcParams.eventCoverageQuantities}
                  onChange={updateCoverageQuantity}
                  disabled={disableInputs}
                />
              </div>
            ) : null}
            <SelectionGroup
              label="Qual a complexidade da produção?"
              options={COMPLEXITY_OPTIONS}
              value={calcParams.complexity}
              onChange={(v: any) => handleChange("complexity", v)}
              disabled={disableInputs}
            />
            {calcParams.contentModel === "ugc_whitelabel" ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800">
                <p>
                  UGC é um modelo de entrega separado da complexidade. Recomendação prática: usar{" "}
                  <span className="font-semibold">Simples</span> como padrão.
                </p>
                {calcParams.complexity !== "simples" ? (
                  <button
                    type="button"
                    onClick={() => handleChange("complexity", "simples")}
                    disabled={disableInputs}
                    className="mt-2 inline-flex rounded-md bg-amber-100 px-2.5 py-1 font-semibold text-amber-900 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Aplicar recomendado
                  </button>
                ) : null}
              </div>
            ) : null}
            <SelectionGroup
              label="Qual o momento (Sazonalidade)?"
              options={SEASONALITY_OPTIONS}
              value={calcParams.seasonality}
              onChange={(v: any) => handleChange("seasonality", v)}
              disabled={disableInputs}
            />
          </div>
          ) : null}
        </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <button
            type="button"
            onClick={() => toggleSectionCollapse("rights")}
            aria-expanded={!collapsedSections.rights}
            aria-controls="calculator-section-rights"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-accent-soft)] text-xs font-semibold text-[var(--brand-accent-ink)]">2</span>
                Direitos e Prazos
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Defina uso de imagem, prazos e adicionais.</p>
            </div>
            <FaChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${collapsedSections.rights ? "" : "rotate-180"}`}
              aria-hidden
            />
          </button>
          {!collapsedSections.rights ? (
          <div id="calculator-section-rights" className="mt-4 space-y-4">
            <SelectionGroup
              label="Exclusividade exigida"
              options={EXCLUSIVITY_OPTIONS}
              value={calcParams.exclusivity}
              onChange={(v: any) => handleChange("exclusivity", v)}
              disabled={disableInputs}
            />
            <SelectionGroup
              label="Direitos de uso de imagem"
              options={USAGE_OPTIONS}
              value={calcParams.usageRights}
              onChange={(v: any) => setUsageRights(v)}
              disabled={disableInputs}
            />
            <p className="text-xs text-slate-500">
              Quando houver mídia paga (ou global), o direito de impulsionamento vale para todas as plataformas envolvidas durante o prazo contratado.
            </p>
            {calcParams.usageRights !== "organico" ? (
              <SelectionGroup
                label="Prazo de uso de imagem em mídia paga"
                options={PAID_MEDIA_DURATION_OPTIONS}
                value={calcParams.paidMediaDuration}
                onChange={(v: any) => setPaidMediaDuration(v)}
                disabled={disableInputs}
              />
            ) : null}
            <div className="space-y-2.5">
              <p id="commercial-addons-label" className="text-sm font-semibold text-slate-800">Condições comerciais adicionais</p>
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="commercial-addons-label">
                <button
                  type="button"
                  onClick={() => toggleFlag("repostTikTok")}
                  disabled={disableInputs}
                  aria-pressed={calcParams.repostTikTok}
                  className={`rounded-xl border p-3 text-left transition ${calcParams.repostTikTok
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft-strong)] ring-1 ring-[var(--brand-accent-ring-soft)]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                    } ${disableInputs ? "opacity-70" : ""}`}
                >
                  <p className="text-sm font-semibold text-slate-900">Repost no TikTok</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {calcParams.repostTikTok
                      ? "Sim. Inclui direito de repost e impulsionamento no TikTok."
                      : "Não. Sem repost adicional no TikTok."}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => toggleFlag("instagramCollab")}
                  disabled={disableInputs}
                  aria-pressed={calcParams.instagramCollab}
                  className={`rounded-xl border p-3 text-left transition ${calcParams.instagramCollab
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent-soft-strong)] ring-1 ring-[var(--brand-accent-ring-soft)]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                    } ${disableInputs ? "opacity-70" : ""}`}
                >
                  <p className="text-sm font-semibold text-slate-900">Collab com marca no Instagram</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {calcParams.instagramCollab
                      ? "Sim. Registro contratual sem impacto no cálculo."
                      : "Não. Sem collab com marca no Instagram."}
                  </p>
                </button>
              </div>
            </div>
            <SelectionGroup
              label="Seu nível de autoridade atual"
              options={AUTHORITY_OPTIONS}
              value={calcParams.authority}
              onChange={(v: any) => handleChange("authority", v)}
              disabled={disableInputs}
            />
          </div>
          ) : null}
        </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <button
            type="button"
            onClick={() => toggleSectionCollapse("brand")}
            aria-expanded={!collapsedSections.brand}
            aria-controls="calculator-section-brand"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-accent-soft)] text-xs font-semibold text-[var(--brand-accent-ink)]">3</span>
                Marca e Estratégia
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">Classifique risco, porte e potencial estratégico.</p>
            </div>
            <FaChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${collapsedSections.brand ? "" : "rotate-180"}`}
              aria-hidden
            />
          </button>
          {!collapsedSections.brand ? (
          <div id="calculator-section-brand" className="mt-4 space-y-4">
            <SelectionGroup
              label="Porte da marca"
              options={BRAND_SIZE_OPTIONS}
              value={calcParams.brandSize}
              onChange={(v: CalculatorParams["brandSize"]) => handleChange("brandSize", v)}
              disabled={disableInputs}
            />
            <SelectionGroup
              label="Risco de imagem da parceria"
              options={IMAGE_RISK_OPTIONS}
              value={calcParams.imageRisk}
              onChange={(v: CalculatorParams["imageRisk"]) => handleChange("imageRisk", v)}
              disabled={disableInputs}
            />
            <SelectionGroup
              label="Ganho estratégico para posicionamento"
              options={STRATEGIC_GAIN_OPTIONS}
              value={calcParams.strategicGain}
              onChange={(v: CalculatorParams["strategicGain"]) => handleChange("strategicGain", v)}
              disabled={disableInputs}
            />
            <SelectionGroup
              label="Modelo de conteúdo"
              options={CONTENT_MODEL_OPTIONS}
              value={calcParams.contentModel}
              onChange={(v: CalculatorParams["contentModel"]) => setContentModel(v)}
              disabled={disableInputs}
            />
            <div className="space-y-2.5">
              <label className="text-sm font-semibold text-slate-800">Exceção estratégica</label>
              <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Permitir R$ 0 no preço estratégico</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Use somente em parcerias de alto ganho estratégico e baixo risco.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFlag("allowStrategicWaiver")}
                    disabled={disableInputs}
                    aria-pressed={calcParams.allowStrategicWaiver}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      calcParams.allowStrategicWaiver
                        ? "bg-[var(--brand-accent)] text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    } ${disableInputs ? "cursor-not-allowed opacity-70" : ""}`}
                  >
                    {calcParams.allowStrategicWaiver ? "Ligada" : "Desligada"}
                  </button>
                </div>
                <p className="mt-2.5 text-xs text-slate-600">
                  {calcParams.allowStrategicWaiver
                    ? "Com a opção ligada, o estratégico pode ir para R$ 0 quando todos os critérios forem atendidos."
                    : "Com a opção desligada, o estratégico sempre segue o cálculo normal."}
                </p>
              </div>
            </div>
          </div>
          ) : null}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="sticky bottom-3 z-20 rounded-xl border border-slate-200 bg-white/95 p-1.5 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white sm:ml-auto sm:w-auto sm:px-7 sm:py-3.5 sm:text-base"
            disabled={disableInputs}
            ref={submitButtonRef}
          >
            {isCalculating ? (
              <>
                <FaSpinner className="h-5 w-5 animate-spin" />
                Calculando Melhor Preço...
              </>
            ) : (
              <>
                Calcular Valor da Publi
                <FaArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
        </form>

      {calculation && statsCards && (
        <section
          ref={resultsSectionRef}
          className="animate-in fade-in slide-in-from-bottom-4 space-y-4 duration-700"
        >
          <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
            {statsCards.map((card) => (
              <div
                key={card.label}
                className="group flex min-h-[230px] flex-col overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white text-left shadow-sm ring-1 ring-transparent transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:ring-slate-200 sm:min-h-[250px] sm:rounded-[1.5rem]"
              >
                <div className={`flex items-center justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5 ${card.headerClass}`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {card.label}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    CPM {card.cpm}
                  </span>
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-3.5 sm:p-4">
                  <div className="space-y-1">
                    <p className="text-3xl font-semibold text-slate-900">{card.value}</p>
                  </div>
                  <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-slate-600">{card.description}</p>
                  <button
                    onClick={() => {
                      const labelText = typeof card?.label === 'string' ? card.label : '';
                      const baseLabel = (labelText.split('(')[0] ?? '').trim() || 'Pacote';
                      handleAddPackage({
                        name: baseLabel || 'Pacote',
                        price: card.amount,
                        description: card?.description ?? '',
                      }, "suggested_card");
                    }}
                    className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <FaPlus className="h-3 w-3" />
                    Usar como pacote
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[var(--brand-accent-soft)] p-2 text-[var(--brand-accent-ink)]">
                  <FaLayerGroup className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Seus Pacotes</h3>
                  <p className="text-sm text-slate-500">Estes pacotes aparecerão no seu Mídia Kit.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSectionCollapse("packages")}
                  aria-expanded={!collapsedSections.packages}
                  aria-controls="calculator-section-packages"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
                >
                  <FaChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsedSections.packages ? "" : "rotate-180"}`} aria-hidden />
                </button>
                <button
                  onClick={() => handleAddPackage()}
                  className="group flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FaPlus className="h-3 w-3" />
                  Novo Pacote
                </button>
              </div>
            </div>
            {!collapsedSections.packages ? (
              <div id="calculator-section-packages">
                {packages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                    <p className="text-slate-500">Nenhum pacote definido.</p>
                    <p className="text-sm text-slate-400">Adicione manualmente ou use as sugestões acima.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {packages.map((pkg) => (
                      <div key={pkg.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500">Nome do Pacote</label>
                                <input
                                  type="text"
                                  value={pkg.name}
                                  onChange={(e) => handleUpdatePackage(pkg.id!, { name: e.target.value })}
                                  className="w-full rounded-lg border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-slate-300"
                                  placeholder="Ex: Combo Reels"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$)</label>
                                <input
                                  type="number"
                                  value={pkg.price}
                                  onChange={(e) => handleUpdatePackage(pkg.id!, { price: sanitizePackagePrice(e.target.value) })}
                                  className="w-full rounded-lg border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-slate-300"
                                  placeholder="0,00"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs font-medium text-slate-500">Entregáveis (separados por vírgula)</label>
                              <input
                                type="text"
                                value={pkg.deliverables.join(",")}
                                onChange={(e) => handleUpdatePackage(pkg.id!, { deliverables: e.target.value.split(",") })}
                                className="w-full rounded-lg border-slate-200 text-sm text-slate-600 placeholder:text-slate-400 focus:border-slate-400 focus:ring-slate-300"
                                placeholder="Ex: 1 Reels, 3 Stories"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePackage(pkg.id!)}
                            className="inline-flex min-h-10 min-w-10 items-center justify-center self-start rounded-lg border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            title="Remover pacote"
                            aria-label={`Remover pacote ${pkg.name || ""}`.trim()}
                          >
                            <FaTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 border-t border-slate-200 pt-3.5">
                  <button
                    type="button"
                    onClick={handleAddToMediaKit}
                    disabled={isSavingPackages}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingPackages ? (
                      <>
                        <FaSpinner className="h-4 w-4 animate-spin" />
                        Salvando no Media Kit...
                      </>
                    ) : (
                      <>
                        <FaBullhorn className="h-4 w-4" />
                        Salvar pacotes no Media Kit
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[var(--brand-accent-soft)] p-2 text-[var(--brand-accent-ink)]">
                  <FaChartPie className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Entenda o cálculo</h3>
              </div>
              <button
                type="button"
                onClick={() => toggleSectionCollapse("insights")}
                aria-expanded={!collapsedSections.insights}
                aria-controls="calculator-section-insights"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
              >
                <FaChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsedSections.insights ? "" : "rotate-180"}`} aria-hidden />
              </button>
            </div>
            {!collapsedSections.insights ? (
            <div id="calculator-section-insights" className="space-y-3.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-sm text-slate-700">
                  <h4 className="mb-2 font-semibold text-slate-900">Resumo do que entra no preço</h4>
                  <p>Alcance considerado: <span className="font-medium text-slate-900">{calculation.metrics.reach.toLocaleString("pt-BR")}</span></p>
                  <p>CPM aplicado: <span className="font-medium text-slate-900">{formatCurrency(calculation.cpm)}</span></p>
                  <div className="mt-1.5 space-y-1">
                    <p>Multiplicadores ativos:</p>
                    <ul className="flex flex-wrap gap-1">
                      {visibleMultiplierTags.map((tag) => (
                        <li key={tag} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {tag}
                        </li>
                      ))}
                      {hiddenMultiplierCount > 0 ? (
                        <li className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-500">
                          +{hiddenMultiplierCount} fatores
                        </li>
                      ) : null}
                    </ul>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {calculation.params.usageRights === "organico"
                      ? "Sem mídia paga, o uso fica restrito ao orgânico."
                      : "Impulsionamento cobre todas as plataformas envolvidas durante o prazo contratado."}
                  </p>
                  {calculation.calibration.enabled ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Confiança</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            calculation.calibration.confidenceBand === "alta"
                              ? "bg-emerald-100 text-emerald-700"
                              : calculation.calibration.confidenceBand === "media"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {calibrationBandLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Ajuste de calibração aplicado:{" "}
                        <span className="font-semibold text-slate-900">
                          {calibrationAdjustmentPercent >= 0 ? "+" : ""}
                          {formatPercent(calibrationAdjustmentPercent)}
                        </span>
                        {" "}sobre o valor base justo.
                      </p>
                      {calculation.calibration.guardrailApplied ? (
                        <p className="text-xs text-amber-700">
                          Guardrail ativado: limite de ajuste em ±25% aplicado para segurança.
                        </p>
                      ) : null}
                      {calculation.calibration.lowConfidenceRangeExpanded ? (
                        <p className="text-xs text-amber-700">
                          Faixa estratégico/premium ampliada por baixa confiança para reduzir risco de subprecificação.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {brandRiskV1Enabled && strategicWaiverApplied ? (
                    <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Exceção estratégica aplicada: Estratégico em R$ 0, com Justo/Premium mantidos para referência comercial.
                    </p>
                  ) : null}
                </div>
                <details className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-900">Fatores de impacto</summary>
                  <ul className="mt-2.5 space-y-1.5 text-sm text-slate-600">
                    <li className="flex justify-between">
                      <span>Modo</span>
                      <span className="font-medium text-slate-900">
                        {calculation.params.deliveryType === "evento"
                          ? hasContentInResult
                            ? "Conteúdo + Evento"
                            : "Evento"
                          : "Conteúdo"}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Alcance Base</span>
                      <span className="font-medium text-slate-900">{calculation.metrics.reach.toLocaleString("pt-BR")}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Engajamento</span>
                      <span className="font-medium text-green-600">+{formatPercent(calculation.metrics.engagement)} (Bônus)</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Sazonalidade</span>
                      <span className="font-medium text-slate-900 capitalize">{calculation.params.seasonality || "Normal"}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Prazo de mídia paga</span>
                      <span className="font-medium text-slate-900">
                        {calculation.params.paidMediaDuration ? PAID_MEDIA_DURATION_LABELS[calculation.params.paidMediaDuration] : "Não se aplica"}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Repost no TikTok</span>
                      <span className="font-medium text-slate-900">{calculation.params.repostTikTok ? "Sim" : "Não"}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Confiança da calibração</span>
                      <span className="font-medium text-slate-900">{calibrationBandLabel}</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Ajuste da calibração</span>
                      <span className="font-medium text-slate-900">
                        {calibrationAdjustmentPercent >= 0 ? "+" : ""}
                        {formatPercent(calibrationAdjustmentPercent)}
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span>Collab no Instagram</span>
                      <span className="font-medium text-slate-900">{calculation.params.instagramCollab ? "Sim" : "Não"}</span>
                    </li>
                    {brandRiskV1Enabled ? (
                      <>
                        <li className="flex justify-between">
                          <span>Porte da marca</span>
                          <span className="font-medium text-slate-900">{BRAND_SIZE_LABELS[calculation.params.brandSize]}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Risco de imagem</span>
                          <span className="font-medium text-slate-900">{IMAGE_RISK_LABELS[calculation.params.imageRisk]}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Ganho estratégico</span>
                          <span className="font-medium text-slate-900">{STRATEGIC_GAIN_LABELS[calculation.params.strategicGain]}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Modelo de conteúdo</span>
                          <span className="font-medium text-slate-900">{CONTENT_MODEL_LABELS[calculation.params.contentModel]}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Exceção estratégica</span>
                          <span className="font-medium text-slate-900">{calculation.params.allowStrategicWaiver ? "Permitida" : "Desligada"}</span>
                        </li>
                      </>
                    ) : null}
                    {hasContentInResult ? (
                      <li className="flex justify-between">
                        <span>Unidades de conteúdo</span>
                        <span className="font-medium text-slate-900">
                          {calculation.breakdown.contentUnits.toFixed(2)}
                        </span>
                      </li>
                    ) : null}
                    {calculation.params.deliveryType === "evento" ? (
                      <>
                        <li className="flex justify-between">
                          <span>Presença no evento</span>
                          <span className="font-medium text-slate-900">
                            {formatCurrency(calculation.breakdown.eventPresenceJusto)}
                          </span>
                        </li>
                        {calculation.breakdown.coverageJusto > 0 ? (
                          <li className="flex justify-between">
                            <span>Cobertura opcional</span>
                            <span className="font-medium text-slate-900">
                              {formatCurrency(calculation.breakdown.coverageJusto)}
                            </span>
                          </li>
                        ) : null}
                        <li className="flex justify-between">
                          <span>Logística sugerida (extra)</span>
                          <span className="font-medium text-slate-900">
                            {formatCurrency(calculation.breakdown.logisticsSuggested)}
                          </span>
                        </li>
                      </>
                    ) : null}
                    <li className="flex justify-between">
                      <span>CPM do Nicho</span>
                      <span className="font-medium text-slate-900">{formatCurrency(calculation.cpm)}</span>
                    </li>
                  </ul>
                  <div className="mt-2.5 border-t border-gray-200 pt-2.5 text-xs text-slate-500">
                    {calculation.params.deliveryType === "conteudo" ? (
                      <p>Fórmula: (Alcance / 1.000) x CPM x multiplicadores (direitos, risco/estratégia, complexidade etc.) x unidades de conteúdo.</p>
                    ) : hasContentInResult ? (
                      <p>Fórmula: conteúdo + presença em evento + cobertura opcional, aplicando os mesmos multiplicadores.</p>
                    ) : (
                      <p>Fórmula: presença em evento + cobertura opcional, aplicando os mesmos multiplicadores (logística exibida separadamente).</p>
                    )}
                    <p className="mt-1">Logística é sugerida como extra e não entra no valor em cache da calculadora.</p>
                  </div>
                </details>
                {calculation.explanation ? (
                  <details className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                    <summary className="cursor-pointer font-medium text-slate-700">Ver explicação detalhada</summary>
                    <p className="mt-2 leading-relaxed text-slate-500">{calculation.explanation}</p>
                  </details>
                ) : null}
            </div>
            ) : null}
          </div>

          <div className="text-center text-xs text-slate-400">
            Cálculo ID: <span className="font-mono">{calculation.calculationId}</span> • Gerado em {formatDateTime(calculation.createdAt)}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}
