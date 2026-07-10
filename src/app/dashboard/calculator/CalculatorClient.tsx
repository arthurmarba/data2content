"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { isPlanActiveLike } from "@/utils/planStatus";
import { Loader2, Lock, ArrowRight, TrendingUp, PieChart, Instagram, Video, Image as ImageIcon, Layers, CalendarCheck, Calendar, CalendarOff, Globe, Megaphone, User, UserCheck, Briefcase, Star, Snowflake, Sun, CloudSun, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { track } from "@/lib/track";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

const CreatorQuickSearch = dynamic(
  () => import("@/app/admin/creator-dashboard/components/CreatorQuickSearch"),
  { ssr: false, loading: () => null }
);

type ViewerInfo = {
  id?: string | null;
  role?: string | null;
  name?: string | null;
  planStatus?: string | null;
};

type AdminTargetUser = {
  id: string;
  name: string;
  profilePictureUrl?: string | null;
};

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

type PersonalPricingReference = {
  valueBRL: number;
  scope: "reel_organico_padrao";
  confirmedAt: string;
  updatedAt: string;
};

type CalculationPersonalReference = {
  enabled: boolean;
  applied: boolean;
  reason: "not_configured" | "expired" | "creator_calibrated" | "creator_opted_out" | "feature_disabled" | "applied";
  referenceValueBRL: number | null;
  referenceAgeDays: number | null;
  canonicalJusto: number | null;
  factorRaw: number | null;
  factorApplied: number | null;
  weightApplied: number;
  baseJusto: number;
  adjustedJusto: number;
};

type CalculationResult = {
  estrategico: number;
  justo: number;
  premium: number;
  cpm: number;
  breakdown: CalculationBreakdown;
  calibration: CalculationCalibration;
  personalReference: CalculationPersonalReference;
  params: CalculatorParams;
  metrics: {
    reach: number;
    engagement: number;
    profileSegment: string;
    reachSampleSize: number;
    reachMethod: "trimmed_mean" | "median";
    reachConfidence: "alta" | "baixa";
    reachFollowerAlert: boolean;
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

const ADMIN_CALCULATOR_TARGET_STORAGE_KEY = "calculator_admin_target_user";
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
  { value: "reels", label: "Reels", icon: Video, helper: "Vídeo curto (até 90s)" },
  { value: "post", label: "Post no Feed", icon: ImageIcon, helper: "Foto única ou carrossel" },
  { value: "stories", label: "Stories", icon: Instagram, helper: "Sequência de 3 stories" },
];

const EXCLUSIVITY_OPTIONS = [
  { value: "nenhuma", label: "Sem Exclusividade", icon: CalendarOff },
  { value: "7d", label: "7 Dias", icon: CalendarCheck },
  { value: "15d", label: "15 Dias", icon: CalendarCheck },
  { value: "30d", label: "30 Dias", icon: Calendar },
  { value: "90d", label: "90 Dias", icon: Calendar },
  { value: "180d", label: "180 Dias", icon: Calendar },
  { value: "365d", label: "365 Dias", icon: Calendar },
];

const USAGE_OPTIONS = [
  { value: "organico", label: "Orgânico", icon: User, helper: "Apenas no seu perfil" },
  { value: "midiapaga", label: "Mídia Paga", icon: Megaphone, helper: "Impulsionamento em todas as plataformas envolvidas" },
  { value: "global", label: "Global", icon: Globe, helper: "Uso amplo + impulsionamento cross-plataforma" },
];

const PAID_MEDIA_DURATION_OPTIONS = [
  { value: "7d", label: "7 Dias", icon: CalendarCheck },
  { value: "15d", label: "15 Dias", icon: CalendarCheck },
  { value: "30d", label: "30 Dias", icon: Calendar },
  { value: "90d", label: "90 Dias", icon: Calendar },
  { value: "180d", label: "180 Dias", icon: Calendar },
  { value: "365d", label: "365 Dias", icon: Calendar },
];
const BRAND_SIZE_OPTIONS = [
  { value: "pequena", label: "Pequena", icon: User, helper: "Menor caixa e risco comercial maior" },
  { value: "media", label: "Média", icon: UserCheck, helper: "Cenário intermediário" },
  { value: "grande", label: "Grande", icon: Briefcase, helper: "Mais previsível e potencial estratégico" },
];
const IMAGE_RISK_OPTIONS = [
  { value: "baixo", label: "Baixo", icon: CloudSun, helper: "Baixo risco reputacional" },
  { value: "medio", label: "Médio", icon: Calendar, helper: "Risco moderado para imagem" },
  { value: "alto", label: "Alto", icon: Sun, helper: "Risco alto, exige prêmio" },
];
const STRATEGIC_GAIN_OPTIONS = [
  { value: "baixo", label: "Baixo", icon: CalendarOff, helper: "Pouco ganho de posicionamento" },
  { value: "medio", label: "Médio", icon: TrendingUp, helper: "Ajuda parcialmente no posicionamento" },
  { value: "alto", label: "Alto", icon: Star, helper: "Parceria muito estratégica para imagem" },
];
const CONTENT_MODEL_OPTIONS = [
  { value: "publicidade_perfil", label: "Publicidade no perfil", icon: Instagram, helper: "Publicado no perfil do creator" },
  { value: "ugc_whitelabel", label: "UGC (whitelabel)", icon: Video, helper: "Conteúdo de uso da marca, mais barato" },
];

const COMPLEXITY_OPTIONS = [
  { value: "simples", label: "Simples", icon: User, helper: "Sem roteiro prévio" },
  { value: "roteiro", label: "Com Roteiro", icon: UserCheck, helper: "Roteiro aprovado" },
  { value: "profissional", label: "Pro", icon: Briefcase, helper: "Edição avançada" },
];

const AUTHORITY_OPTIONS = [
  { value: "padrao", label: "Padrão", icon: User, helper: "Iniciante" },
  { value: "ascensao", label: "Em Ascensão", icon: TrendingUp, helper: "Crescendo" },
  { value: "autoridade", label: "Autoridade", icon: Star, helper: "Referência" },
  { value: "celebridade", label: "Celebridade", icon: Star, helper: "Famoso" },
];

const SEASONALITY_OPTIONS = [
  { value: "normal", label: "Normal", icon: CloudSun, helper: "Dias comuns" },
  { value: "alta", label: "Alta Demanda", icon: Sun, helper: "Black Friday, Natal" },
  { value: "baixa", label: "Baixa", icon: Snowflake, helper: "Pós-datas festivas" },
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

type CalculatorTone = "neutral" | "sky" | "amber" | "rose" | "emerald";

const OPTION_TONE_CLASSES: Record<
  CalculatorTone,
  {
    selectedCard: string;
    selectedIcon: string;
    selectedIndicatorRing: string;
    selectedDot: string;
    selectedToggle: string;
    stepperShell: string;
    stepperButton: string;
    legendText: string;
    summaryText: string;
    selectedRow: string;
    selectedText: string;
    subsectionText: string;
    divider: string;
    accentBar: string;
  }
> = {
  neutral: {
    selectedCard: "border-zinc-900 bg-white ring-1 ring-zinc-900/10",
    selectedIcon: "bg-zinc-900 text-white",
    selectedIndicatorRing: "border-zinc-300 bg-zinc-50",
    selectedDot: "bg-zinc-900",
    selectedToggle: "bg-zinc-100 text-zinc-700",
    stepperShell: "border-zinc-200 bg-white",
    stepperButton: "text-zinc-700",
    legendText: "text-zinc-500",
    summaryText: "text-zinc-500",
    selectedRow: "bg-zinc-50/65",
    selectedText: "text-zinc-950",
    subsectionText: "text-zinc-500",
    divider: "border-zinc-100/70",
    accentBar: "bg-zinc-300",
  },
  sky: {
    selectedCard: "border-sky-200 bg-sky-50/70 ring-1 ring-sky-100",
    selectedIcon: "bg-sky-600 text-white",
    selectedIndicatorRing: "border-sky-200 bg-sky-50/70",
    selectedDot: "bg-sky-500",
    selectedToggle: "bg-sky-100 text-sky-700",
    stepperShell: "border-sky-200 bg-sky-50/55",
    stepperButton: "text-sky-700",
    legendText: "text-sky-600",
    summaryText: "text-sky-500",
    selectedRow: "bg-sky-50/38",
    selectedText: "text-zinc-950",
    subsectionText: "text-sky-500",
    divider: "border-zinc-100/70",
    accentBar: "bg-sky-500",
  },
  amber: {
    selectedCard: "border-amber-200 bg-amber-50/75 ring-1 ring-amber-100",
    selectedIcon: "bg-amber-600 text-white",
    selectedIndicatorRing: "border-amber-200 bg-amber-50/75",
    selectedDot: "bg-amber-500",
    selectedToggle: "bg-amber-100 text-amber-700",
    stepperShell: "border-amber-200 bg-amber-50/55",
    stepperButton: "text-amber-700",
    legendText: "text-amber-600",
    summaryText: "text-amber-500",
    selectedRow: "bg-amber-50/38",
    selectedText: "text-zinc-950",
    subsectionText: "text-amber-500",
    divider: "border-zinc-100/70",
    accentBar: "bg-amber-500",
  },
  rose: {
    selectedCard: "border-rose-200 bg-rose-50/75 ring-1 ring-rose-100",
    selectedIcon: "bg-rose-600 text-white",
    selectedIndicatorRing: "border-rose-200 bg-rose-50/75",
    selectedDot: "bg-rose-500",
    selectedToggle: "bg-rose-100 text-rose-700",
    stepperShell: "border-rose-200 bg-rose-50/55",
    stepperButton: "text-rose-700",
    legendText: "text-rose-600",
    summaryText: "text-rose-500",
    selectedRow: "bg-rose-50/38",
    selectedText: "text-zinc-950",
    subsectionText: "text-rose-500",
    divider: "border-zinc-100/70",
    accentBar: "bg-rose-500",
  },
  emerald: {
    selectedCard: "border-emerald-200 bg-emerald-50/75 ring-1 ring-emerald-100",
    selectedIcon: "bg-emerald-600 text-white",
    selectedIndicatorRing: "border-emerald-200 bg-emerald-50/75",
    selectedDot: "bg-emerald-500",
    selectedToggle: "bg-emerald-100 text-emerald-700",
    stepperShell: "border-emerald-200 bg-emerald-50/55",
    stepperButton: "text-emerald-700",
    legendText: "text-emerald-600",
    summaryText: "text-emerald-500",
    selectedRow: "bg-emerald-50/38",
    selectedText: "text-zinc-950",
    subsectionText: "text-emerald-500",
    divider: "border-zinc-100/70",
    accentBar: "bg-emerald-500",
  },
};

const RESULT_CARD_TONE_CLASSES: Record<
  Exclude<CalculatorTone, "neutral" | "rose">,
  {
    panel: string;
    header: string;
    accent: string;
    labelBadge: string;
    cpm: string;
    value: string;
    button: string;
  }
> = {
  emerald: {
    panel: "border-zinc-100/90 bg-zinc-50/68",
    header: "bg-white/86",
    accent: "bg-emerald-500",
    labelBadge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100/90",
    cpm: "text-zinc-400",
    value: "text-zinc-900",
    button: "border-emerald-100 bg-emerald-50/82 text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50",
  },
  amber: {
    panel: "border-zinc-100/90 bg-zinc-50/68",
    header: "bg-white/86",
    accent: "bg-amber-500",
    labelBadge: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    cpm: "text-zinc-400",
    value: "text-zinc-900",
    button: "border-amber-100 bg-amber-50/82 text-amber-700 hover:border-amber-200 hover:bg-amber-50",
  },
  sky: {
    panel: "border-zinc-100/90 bg-zinc-50/68",
    header: "bg-white/86",
    accent: "bg-sky-500",
    labelBadge: "bg-sky-50 text-sky-700 ring-1 ring-sky-100/90",
    cpm: "text-zinc-400",
    value: "text-zinc-900",
    button: "border-sky-100 bg-sky-50/82 text-sky-700 hover:border-sky-200 hover:bg-sky-50",
  },
};

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

function formatPostsCount(count: number): string {
  return `${count} ${count === 1 ? "item" : "itens"}`;
}

export default function CalculatorClient({
  viewer,
  compactView = false,
}: {
  viewer?: ViewerInfo;
  compactView?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session, status: sessionStatus } = useSession();
  const viewerRoleFromProp = typeof viewer?.role === "string" ? viewer.role.trim().toLowerCase() : null;
  const billingStatus = useBillingStatus({ auto: viewerRoleFromProp !== "admin" });
  const brandRiskV1Enabled = true;
  const sessionUser = (session?.user as any) ?? null;
  const sessionUserId =
    typeof viewer?.id === "string" && viewer.id.trim().length > 0
      ? viewer.id.trim()
      : typeof sessionUser?.id === "string" && sessionUser.id.trim().length > 0
        ? sessionUser.id.trim()
        : null;
  const rawViewerRole = viewerRoleFromProp ?? sessionUser?.role ?? null;
  const viewerRole = typeof rawViewerRole === "string" ? rawViewerRole.trim().toLowerCase() : null;
  const isAdminViewer = viewerRole === "admin";
  const [adminTargetUser, setAdminTargetUser] = useState<AdminTargetUser | null>(null);
  const targetUserId = isAdminViewer && adminTargetUser?.id ? adminTargetUser.id : null;
  const isActingOnBehalf = Boolean(
    isAdminViewer &&
    targetUserId &&
    sessionUserId &&
    targetUserId !== sessionUserId
  );

  const planStatusSession = viewer?.planStatus ?? sessionUser?.planStatus;
  const billingInstagramConnected = Boolean(billingStatus.instagram?.connected);
  const instagramConnected = isAdminViewer
    ? true
    : billingStatus.hasResolvedOnce
      ? billingInstagramConnected
      : billingInstagramConnected || Boolean(sessionUser?.instagramConnected);
  const resolvedPlanAccess = Boolean(
    billingStatus.hasPremiumAccess ||
    isPlanActiveLike(planStatusSession)
  );
  const canAccessFeatures =
    isAdminViewer ||
    (sessionStatus === "authenticated" &&
      !billingStatus.isLoading &&
      resolvedPlanAccess &&
      instagramConnected);
  const showLockedMessage =
    sessionStatus === "authenticated" &&
    !isAdminViewer &&
    !billingStatus.isLoading &&
    !resolvedPlanAccess;
  const showBillingLoading =
    sessionStatus === "authenticated" && !isAdminViewer && billingStatus.isLoading;
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
  const [personalPricingReference, setPersonalPricingReference] = useState<PersonalPricingReference | null>(null);
  const [personalPricingReferenceValue, setPersonalPricingReferenceValue] = useState("");
  const [isSavingPersonalPricingReference, setIsSavingPersonalPricingReference] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<CollapsibleSectionKey, boolean>>(() => ({
    delivery: compactView ? false : true,
    rights: true,
    brand: true,
    packages: true,
    insights: true,
  }));

  // Package Management State
  const [packages, setPackages] = useState<MediaKitPackage[]>([]);
  const [isSavingPackages, setIsSavingPackages] = useState(false);
  const hasHydratedAdminTargetRef = useRef(false);

  useEffect(() => {
    if (!isAdminViewer || hasHydratedAdminTargetRef.current || typeof window === "undefined") return;
    hasHydratedAdminTargetRef.current = true;
    try {
      const raw = window.sessionStorage.getItem(ADMIN_CALCULATOR_TARGET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AdminTargetUser>;
      if (typeof parsed?.id !== "string" || typeof parsed?.name !== "string") return;
      const normalizedId = parsed.id.trim();
      const normalizedName = parsed.name.trim();
      if (!normalizedId || !normalizedName) return;
      setAdminTargetUser({
        id: normalizedId,
        name: normalizedName,
        profilePictureUrl: parsed.profilePictureUrl ?? null,
      });
    } catch {
      /* ignore */
    }
  }, [isAdminViewer]);

  useEffect(() => {
    if (!isAdminViewer || typeof window === "undefined") return;
    try {
      if (!adminTargetUser?.id) {
        window.sessionStorage.removeItem(ADMIN_CALCULATOR_TARGET_STORAGE_KEY);
        return;
      }
      window.sessionStorage.setItem(
        ADMIN_CALCULATOR_TARGET_STORAGE_KEY,
        JSON.stringify(adminTargetUser)
      );
    } catch {
      /* ignore */
    }
  }, [adminTargetUser, isAdminViewer]);

  useEffect(() => {
    setCalculation(null);
    setError(null);
  }, [targetUserId]);

  useEffect(() => {
    // Fetch existing packages on mount or when access is confirmed
    if (canAccessFeatures && !isActingOnBehalf) {
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
      return;
    }
    setPackages([]);
  }, [canAccessFeatures, isActingOnBehalf]);

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
    if (sessionStatus === "unauthenticated" || !resolvedPlanAccess) {
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
      return;
    }

    if (!instagramConnected) {
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.setItem(
            PAYWALL_RETURN_STORAGE_KEY,
            JSON.stringify({
              context: "calculator",
              source,
              returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
              ts: Date.now(),
            })
          );
        } catch {
          /* ignore */
        }
      }
      router.push("/dashboard/instagram/connect?next=calculator");
      return;
    }

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

  const savePersonalPricingReference = async () => {
    const valueBRL = Number(personalPricingReferenceValue.replace(',', '.'));
    if (!Number.isFinite(valueBRL) || valueBRL <= 0 || valueBRL > 100000) {
      toast({
        variant: 'error',
        title: 'Valor inválido',
        description: 'Informe um valor entre R$ 0,01 e R$ 100.000,00.',
      });
      return;
    }

    setIsSavingPersonalPricingReference(true);
    try {
      const response = await fetch('/api/calculator/personal-reference', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueBRL }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.reference?.valueBRL !== 'number') {
        throw new Error(payload?.error || 'Não foi possível salvar a referência.');
      }
      setPersonalPricingReference(payload.reference as PersonalPricingReference);
      setPersonalPricingReferenceValue(String(payload.reference.valueBRL));
      toast({ variant: 'success', title: 'Referência salva', description: 'Ela será considerada nos próximos cálculos elegíveis.' });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Não foi possível salvar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsSavingPersonalPricingReference(false);
    }
  };

  const loadPersonalPricingReference = async () => {
    setIsSavingPersonalPricingReference(true);
    try {
      const response = await fetch('/api/calculator/personal-reference', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar a referência.');
      const reference = payload?.reference;
      if (typeof reference?.valueBRL !== 'number') {
        toast({ variant: 'info', title: 'Nenhuma referência salva', description: 'Você ainda não informou um valor habitual para Reel orgânico.' });
        return;
      }
      setPersonalPricingReference(reference as PersonalPricingReference);
      setPersonalPricingReferenceValue(String(reference.valueBRL));
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Não foi possível carregar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsSavingPersonalPricingReference(false);
    }
  };

  const removePersonalPricingReference = async () => {
    setIsSavingPersonalPricingReference(true);
    try {
      const response = await fetch('/api/calculator/personal-reference', { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível remover a referência.');
      setPersonalPricingReference(null);
      setPersonalPricingReferenceValue('');
      toast({ variant: 'success', title: 'Referência removida', description: 'Os próximos cálculos voltarão a usar apenas as métricas e o escopo.' });
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Não foi possível remover',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setIsSavingPersonalPricingReference(false);
    }
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
        body: JSON.stringify({
          ...normalizedParams,
          targetUserId: isActingOnBehalf ? targetUserId : undefined,
        }),
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
        personalReference: {
          enabled: typeof (parsed as any)?.personalReference?.enabled === "boolean" ? (parsed as any).personalReference.enabled : false,
          applied: typeof (parsed as any)?.personalReference?.applied === "boolean" ? (parsed as any).personalReference.applied : false,
          reason:
            ["not_configured", "expired", "creator_calibrated", "creator_opted_out", "feature_disabled", "applied"].includes((parsed as any)?.personalReference?.reason)
              ? (parsed as any).personalReference.reason
              : "not_configured",
          referenceValueBRL: typeof (parsed as any)?.personalReference?.referenceValueBRL === "number" ? (parsed as any).personalReference.referenceValueBRL : null,
          referenceAgeDays: typeof (parsed as any)?.personalReference?.referenceAgeDays === "number" ? (parsed as any).personalReference.referenceAgeDays : null,
          canonicalJusto: typeof (parsed as any)?.personalReference?.canonicalJusto === "number" ? (parsed as any).personalReference.canonicalJusto : null,
          factorRaw: typeof (parsed as any)?.personalReference?.factorRaw === "number" ? (parsed as any).personalReference.factorRaw : null,
          factorApplied: typeof (parsed as any)?.personalReference?.factorApplied === "number" ? (parsed as any).personalReference.factorApplied : null,
          weightApplied: typeof (parsed as any)?.personalReference?.weightApplied === "number" ? (parsed as any).personalReference.weightApplied : 0,
          baseJusto: typeof (parsed as any)?.personalReference?.baseJusto === "number" ? (parsed as any).personalReference.baseJusto : parsed.justo,
          adjustedJusto: typeof (parsed as any)?.personalReference?.adjustedJusto === "number" ? (parsed as any).personalReference.adjustedJusto : parsed.justo,
        },
        params: sanitizedParams,
        metrics: {
          reach: parsed.metrics?.reach ?? 0,
          engagement: parsed.metrics?.engagement ?? 0,
          profileSegment: parsed.metrics?.profileSegment ?? "default",
          reachSampleSize: typeof parsed.metrics?.reachSampleSize === "number" ? parsed.metrics.reachSampleSize : 0,
          reachMethod: parsed.metrics?.reachMethod === "trimmed_mean" ? "trimmed_mean" : "median",
          reachConfidence: parsed.metrics?.reachConfidence === "alta" ? "alta" : "baixa",
          reachFollowerAlert: Boolean(parsed.metrics?.reachFollowerAlert),
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
    if (isActingOnBehalf) {
      toast({
        variant: "info",
        title: "Pacotes desativados",
        description: "No modo admin para outro criador, pacotes do Media Kit ficam desativados.",
      });
      return;
    }
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
    if (sessionStatus === "unauthenticated") {
      handleLockedAccess("save_media_kit");
      return;
    }
    if (!resolvedPlanAccess || !instagramConnected) {
      handleLockedAccess("save_media_kit");
      return;
    }
    if (isActingOnBehalf) {
      toast({
        variant: "info",
        title: "Ação indisponível",
        description: "Para evitar alterações indevidas, o salvamento no Media Kit só funciona no modo da sua conta.",
      });
      return;
    }
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

  const disableInputs = isCalculating;
  const submitDisabled =
    isCalculating ||
    sessionStatus === "loading" ||
    (sessionStatus === "authenticated" && !isAdminViewer && billingStatus.isLoading);

  const calculateEffectiveCpm = (totalValue: number, reach: number) => {
    if (reach <= 0) return 0;
    return (totalValue / reach) * 1000;
  };

  const statsCards = calculation
    ? (compactView
      ? [
        {
          label: "Valor Justo",
          amount: calculation.justo,
          value: formatCurrency(calculation.justo),
          cpm: formatCurrency(calculateEffectiveCpm(calculation.justo, calculation.metrics.reach)),
          description: "Referência principal para negociar.",
          tone: "emerald" as const,
        },
        {
          label: "Estratégico",
          amount: calculation.estrategico,
          value: formatCurrency(calculation.estrategico),
          cpm: formatCurrency(calculateEffectiveCpm(calculation.estrategico, calculation.metrics.reach)),
          description: "Piso para abrir a conversa.",
          tone: "amber" as const,
        },
        {
          label: "Premium",
          amount: calculation.premium,
          value: formatCurrency(calculation.premium),
          cpm: formatCurrency(calculateEffectiveCpm(calculation.premium, calculation.metrics.reach)),
          description: "Faixa alta para demanda maior.",
          tone: "sky" as const,
        },
      ]
      : [
        {
          label: "Estratégico (Mínimo)",
          amount: calculation.estrategico,
          value: formatCurrency(calculation.estrategico),
          cpm: formatCurrency(calculateEffectiveCpm(calculation.estrategico, calculation.metrics.reach)),
          description: "Para abrir portas e fechar pacotes.",
          tone: "amber" as const,
        },
        {
          label: "Valor Justo (Sugerido)",
          amount: calculation.justo,
          value: formatCurrency(calculation.justo),
          cpm: formatCurrency(calculateEffectiveCpm(calculation.justo, calculation.metrics.reach)),
          description: "Equilíbrio ideal entre esforço e retorno.",
          tone: "emerald" as const,
        },
        {
          label: "Premium (Alto Valor)",
          amount: calculation.premium,
          value: formatCurrency(calculation.premium),
          cpm: formatCurrency(calculateEffectiveCpm(calculation.premium, calculation.metrics.reach)),
          description: "Para alta demanda e entregas complexas.",
          tone: "sky" as const,
        },
      ])
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
  const personalReferenceReviewDue = Boolean(
    personalPricingReference &&
    Date.now() - new Date(personalPricingReference.confirmedAt).getTime() > 90 * 24 * 60 * 60 * 1000
  );
  const personalReferenceReasonLabel: Record<CalculationPersonalReference["reason"], string> = {
    applied: "aplicada ao valor sugerido",
    not_configured: "não informada",
    expired: "aguarda sua reconfirmação",
    creator_calibrated: "substituída por negócios reais suficientes",
    creator_opted_out: "não usada nesta proposta",
    feature_disabled: "temporariamente desativada",
  };
  const compactFormatOptions = compactView
    ? FORMAT_OPTIONS.map((option) => ({
        ...option,
        label: option.value === "post" ? "Feed" : option.label,
      }))
    : FORMAT_OPTIONS;
  const compactBoardShell = "rounded-[1.2rem] border border-zinc-100/90 bg-zinc-50/68";
  const compactPanelShell = `${compactBoardShell} overflow-hidden`;
  const compactSubtleShell = "rounded-[1rem] border border-zinc-100/90 bg-white/80";
  const compactDetailsShell = compactView ? "border-t border-zinc-100/75 pt-3.5" : "border-t border-zinc-100/90 pt-3";
  const calculatorHeaderTextClassName = compactView ? "space-y-1" : "space-y-1";
  const calculatorTitleClassName = compactView ? "dashboard-type-section-title text-zinc-950" : "text-[15px] font-semibold tracking-[-0.01em] text-zinc-950";
  const calculatorSupportClassName = compactView ? "dashboard-type-meta text-zinc-400" : "text-[11px] text-zinc-400";
  const calculatorFieldLabelClassName = compactView ? "dashboard-type-meta text-zinc-400" : "text-[11px] font-medium text-zinc-400";
  const calculatorControlButtonClassName = "inline-flex items-center gap-1 rounded-full border border-zinc-200/80 bg-white/84 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-zinc-300 hover:bg-zinc-50/82";
  const calculatorInlineActionClassName = compactView
    ? "inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100/80 hover:text-zinc-600"
    : "inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 transition hover:text-zinc-600";
  const calculatorPrimaryCtaClassName = compactView
    ? "inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-[12px] font-semibold tracking-[-0.01em] text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
    : "inline-flex w-full items-center justify-center gap-2 rounded-[1rem] bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white";
  const calculatorSecondaryCtaClassName = compactView
    ? "inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200/80 bg-white/84 px-4 py-2.5 text-[12px] font-semibold tracking-[-0.01em] text-zinc-700 transition hover:border-zinc-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    : "inline-flex w-full items-center justify-center gap-2 rounded-[1rem] border border-zinc-200/80 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50";
  const calculatorInputClassName = "w-full rounded-[1rem] border border-zinc-100/90 bg-zinc-50/72 px-3 py-2.5 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-zinc-200 focus:bg-white focus:ring-0";
  const calculatorInputStrongClassName = `${calculatorInputClassName} font-semibold text-slate-900`;
  const calculatorInlineFieldClassName = "space-y-1.5";
  const compactCanvasSectionClassName = "border-t border-zinc-100/75";
  const compactSectionBlockClassName = "border-t border-zinc-100/70 pt-3.5 first:border-t-0 first:pt-0";
  const compactSubsectionTitleClassName = "dashboard-type-meta uppercase tracking-[0.18em]";
  const compactToggleLineClassName = "flex items-center justify-between gap-3 py-2";
  const compactSelectionIndicatorRailClassName = "flex w-[60px] shrink-0 justify-center";
  const compactSelectionIndicatorBaseClassName = "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white";
  const compactSectionTheme = {
    delivery: {
      shell: "border-zinc-100/90",
      header: "bg-white/82",
      badge: "bg-sky-50 text-sky-700 ring-1 ring-sky-100/90",
      icon: Video,
      iconContainer: "bg-sky-50 text-sky-600 ring-1 ring-sky-100/90",
      eyebrow: "text-sky-600",
      toggle: "border-sky-200 bg-white/82 text-sky-700 hover:bg-sky-50",
      tone: "sky" as const,
    },
    rights: {
      shell: "border-zinc-100/90",
      header: "bg-white/82",
      badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
      icon: Globe,
      iconContainer: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
      eyebrow: "text-amber-600",
      toggle: "border-amber-200 bg-white/82 text-amber-700 hover:bg-amber-50",
      tone: "amber" as const,
    },
    brand: {
      shell: "border-zinc-100/90",
      header: "bg-white/82",
      badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-100/90",
      icon: Star,
      iconContainer: "bg-rose-50 text-rose-600 ring-1 ring-rose-100/90",
      eyebrow: "text-rose-600",
      toggle: "border-rose-200 bg-white/82 text-rose-700 hover:bg-rose-50",
      tone: "rose" as const,
    },
  };
  const deliveryItemsSelected = Object.values(calcParams.formatQuantities).reduce((total, qty) => total + qty, 0);
  const deliverySummary = [
    deliveryItemsSelected > 0 ? `${formatPostsCount(deliveryItemsSelected)} no calculo` : "Selecione entregas",
    calcParams.deliveryType === "evento" ? "Evento" : null,
  ].filter(Boolean).join(" • ");
  const rightsSummary = [
    USAGE_LABELS[calcParams.usageRights],
    EXCLUSIVITY_LABELS[calcParams.exclusivity],
  ].filter(Boolean).join(" • ");
  const brandSummary = [
    BRAND_SIZE_LABELS[calcParams.brandSize],
    IMAGE_RISK_LABELS[calcParams.imageRisk],
    STRATEGIC_GAIN_LABELS[calcParams.strategicGain],
  ].filter(Boolean).join(" • ");
  const deliveryToneClasses = OPTION_TONE_CLASSES[compactSectionTheme.delivery.tone];
  const rightsToneClasses = OPTION_TONE_CLASSES[compactSectionTheme.rights.tone];
  const brandToneClasses = OPTION_TONE_CLASSES[compactSectionTheme.brand.tone];

  const SelectionGroup = ({ label, options, value, onChange, disabled, tone = "neutral" }: any) => {
    const toneClasses = OPTION_TONE_CLASSES[tone as CalculatorTone] ?? OPTION_TONE_CLASSES.neutral;
    const selectedOption = options.find((option: any) => option.value === value);
    const selectedLabel = selectedOption?.label ?? "Selecione";

    return (
      <fieldset className={compactView ? "space-y-2.5" : "space-y-2.5"}>
        {compactView ? (
          <div className="flex items-center justify-between gap-3">
            <legend className={`dashboard-type-meta ${toneClasses.legendText}`}>{label}</legend>
            <span className={`dashboard-type-meta ${toneClasses.summaryText}`}>{selectedLabel}</span>
          </div>
        ) : (
          <legend className="text-sm font-medium text-zinc-400">{label}</legend>
        )}
        {compactView ? (
          <div className="space-y-1.5">
            {options.map((option: any) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(option.value)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  className={`w-full rounded-[0.95rem] px-2.5 py-3 text-left transition ${isSelected ? toneClasses.selectedRow : ""} ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50/55"}`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className={`h-6.5 w-1.5 shrink-0 rounded-full ${isSelected ? toneClasses.accentBar : "bg-transparent"}`} />
                    <span className={`min-w-0 flex-1 truncate text-[0.94rem] leading-[1.4] tracking-[-0.015em] ${isSelected ? `font-semibold ${toneClasses.selectedText}` : "font-medium text-zinc-700"}`}>{option.label}</span>
                    <span className={compactSelectionIndicatorRailClassName}>
                      <span className={`${compactSelectionIndicatorBaseClassName} ${isSelected ? toneClasses.selectedIndicatorRing : ""}`} aria-hidden>
                        <span className={`h-3 w-3 rounded-full ${isSelected ? toneClasses.selectedDot : "bg-zinc-300"}`} />
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
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
                  className={`flex w-full items-start gap-2.5 rounded-[1.05rem] border px-3.5 py-3 text-left transition ${isSelected
                    ? toneClasses.selectedCard
                    : "border-zinc-200/80 bg-zinc-50/70 hover:border-zinc-300 hover:bg-white"
                  } ${disabled ? "cursor-not-allowed opacity-60" : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200 focus-visible:ring-offset-1"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm transition-colors ${isSelected ? toneClasses.selectedIcon : "border border-zinc-200 bg-white text-zinc-500"}`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                    {option.helper ? <p className="text-xs leading-snug text-slate-500">{option.helper}</p> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>
    );
  };

  const compactStepperButtonBaseClassName =
    "inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-[12px] font-semibold text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-35";
  const compactStepperRailClassName = "flex w-[88px] shrink-0 items-center justify-end gap-2";

  const QuantitySelectionGroup = ({
    label,
    quantities,
    onChange,
    disabled,
    tone = "neutral",
  }: {
    label: string;
    quantities: FormatQuantities;
    onChange: (key: keyof FormatQuantities, nextValue: number) => void;
    disabled?: boolean;
    tone?: CalculatorTone;
  }) => {
    const toneClasses = OPTION_TONE_CLASSES[tone] ?? OPTION_TONE_CLASSES.neutral;
    const selectedTotal = quantityTotal(quantities);
    return (
      <fieldset className={compactView ? "space-y-2" : "space-y-2.5"}>
        {compactView ? (
          <div className="flex items-center justify-between gap-3">
            <legend className={`dashboard-type-meta ${toneClasses.legendText}`}>{label}</legend>
            <span className={`dashboard-type-meta ${toneClasses.summaryText}`}>
              {selectedTotal > 0 ? formatPostsCount(selectedTotal) : "Nenhum"}
            </span>
          </div>
        ) : (
          <legend className="text-sm font-medium text-zinc-400">{label}</legend>
        )}
        {compactView ? (
          <div className="space-y-1.5">
            {compactFormatOptions.map((option) => {
              const currentValue = quantities[option.value as keyof FormatQuantities] ?? 0;
              const isSelected = currentValue > 0;
              const optionKey = option.value as keyof FormatQuantities;
              return (
                <div
                  key={option.value}
                  className={`rounded-[0.95rem] px-2.5 py-3 transition ${isSelected ? toneClasses.selectedRow : ""} ${disabled ? "opacity-70" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3.5">
                    <span className="flex min-w-0 items-center gap-3.5">
                      <span className={`h-6.5 w-1.5 shrink-0 rounded-full ${isSelected ? toneClasses.accentBar : "bg-transparent"}`} />
                      <span className={`truncate text-[0.94rem] leading-[1.4] tracking-[-0.015em] ${isSelected ? `font-semibold ${toneClasses.selectedText}` : "font-medium text-zinc-700"}`}>{option.label}</span>
                    </span>
                    <div className={compactStepperRailClassName}>
                      <button
                        type="button"
                        onClick={() => onChange(optionKey, clampQuantity(currentValue - 1))}
                        disabled={disabled || currentValue <= 0}
                        className={`${compactStepperButtonBaseClassName} ${isSelected ? `${toneClasses.stepperShell} ${toneClasses.stepperButton}` : ""}`}
                        aria-label={`Diminuir ${option.label}`}
                      >
                        -
                      </button>
                      <span className={`min-w-[1.75rem] text-center text-[13px] font-semibold tabular-nums ${isSelected ? "text-zinc-950" : "text-zinc-400"}`} aria-live="polite">
                        {currentValue}
                      </span>
                      <button
                        type="button"
                        onClick={() => onChange(optionKey, clampQuantity(currentValue + 1))}
                        disabled={disabled || currentValue >= 20}
                        className={`${compactStepperButtonBaseClassName} ${isSelected ? `${toneClasses.stepperShell} ${toneClasses.stepperButton}` : ""}`}
                        aria-label={`Aumentar ${option.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {compactFormatOptions.map((option) => {
              const Icon = option.icon;
              const currentValue = quantities[option.value as keyof FormatQuantities] ?? 0;
              const isSelected = currentValue > 0;
              const optionKey = option.value as keyof FormatQuantities;
              return (
                <div
                  key={option.value}
                  className={`rounded-[1.05rem] border p-3 transition ${isSelected
                    ? toneClasses.selectedCard
                    : "border-zinc-200/80 bg-zinc-50/70"
                  } ${disabled ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm transition-colors ${isSelected ? toneClasses.selectedIcon : "border border-zinc-200 bg-white text-zinc-500"}`}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={isSelected}
                      aria-label={`${isSelected ? "Desativar" : "Ativar"} ${option.label}`}
                      className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide transition ${isSelected ? toneClasses.selectedToggle : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"}`}
                      onClick={() => onChange(optionKey, isSelected ? 0 : 1)}
                    >
                      {isSelected ? "On" : "Add"}
                    </button>
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                    {option.helper ? <p className="text-xs text-slate-500">{option.helper}</p> : null}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between rounded-[0.9rem] border border-zinc-200 bg-white px-2.5 py-1.5">
                    <button
                      type="button"
                      onClick={() => onChange(optionKey, clampQuantity(currentValue - 1))}
                      disabled={disabled || currentValue <= 0}
                      className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Aumentar ${option.label}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </fieldset>
    );
  };

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
    <div className={`${compactView ? "px-0 py-0.5" : "px-4 py-2"} shadow-none`}>
      <div className={`mx-auto w-full pt-1.5 ${compactView ? "space-y-2" : "space-y-4 sm:space-y-6"}`}>

        {isAdminViewer ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {(!compactView || isActingOnBehalf || adminTargetUser) ? (
              <div className="w-full sm:max-w-md">
                <CreatorQuickSearch
                  onSelect={(creator) =>
                    setAdminTargetUser({
                      id: creator.id,
                      name: creator.name,
                      profilePictureUrl: creator.profilePictureUrl,
                    })
                  }
                  selectedCreatorName={adminTargetUser?.name || null}
                  selectedCreatorPhotoUrl={adminTargetUser?.profilePictureUrl || null}
                  onClear={() => setAdminTargetUser(null)}
                  apiPrefix="/api/admin"
                />
              </div>
            ) : null}
            {(!compactView || isActingOnBehalf || adminTargetUser) ? (
              <p className="text-xs text-slate-500">
                {isActingOnBehalf
                  ? `Calculando para ${adminTargetUser?.name}.`
                  : "Calculando para sua própria conta."}
              </p>
            ) : null}
          </div>
        ) : null}

        {showBillingLoading && (
          <div className={`${compactView ? `${compactBoardShell} flex items-center justify-center gap-3 p-5 text-zinc-600` : "dashboard-panel flex items-center justify-center gap-3 p-6 text-zinc-600 sm:p-8"}`}>
            <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            <span className="font-medium">Carregando seus dados...</span>
          </div>
        )}

        {showLockedMessage && (
          <div className={compactView ? `${compactBoardShell} p-4` : "dashboard-dark-spotlight rounded-[2rem] border border-white/10 p-6 shadow-[0_26px_70px_rgba(17,24,39,0.22)] sm:p-8"}>
            <div className="flex flex-col items-center gap-5 text-center md:flex-row md:text-left">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${compactView ? "bg-zinc-100 text-zinc-700" : "bg-white/10 text-pink-200 backdrop-blur-sm"}`}>
                <Lock className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1.5">
                <h2 className={`${compactView ? "text-lg text-zinc-900" : "text-xl text-white sm:text-2xl"} font-semibold`}>
                  Desbloqueie o poder da precificação inteligente
                </h2>
                <p className={compactView ? "text-sm text-zinc-500" : "text-zinc-300"}>
                  Assinantes Pro têm acesso completo à calculadora com sugestões baseadas em dados reais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleLockedAccess("banner")}
                className={`dashboard-primary-button inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold ${compactView ? "" : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"}`}
              >
                Quero acesso agora
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={compactView ? "space-y-0" : "space-y-4"}>
          <div className={compactView ? "" : "dashboard-panel overflow-hidden"}>
            <div className={`flex items-center justify-between gap-3 ${compactView ? "px-0 py-3.5" : "px-4 py-3"}`}>
              <div className="min-w-0">
                {compactView ? (
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] ${compactSectionTheme.delivery.iconContainer}`}>
                      <Video className="h-3.5 w-3.5" />
                    </div>
                    <div className={calculatorHeaderTextClassName}>
                      <h2 className={calculatorTitleClassName}>Entregas e contexto</h2>
                      {collapsedSections.delivery ? <p className={`${calculatorSupportClassName} ${deliveryToneClasses.summaryText}`}>{deliverySummary}</p> : null}
                    </div>
                  </div>
                ) : (
                  <div className={calculatorHeaderTextClassName}>
                    <h2 className={calculatorTitleClassName}>Detalhes da Entrega</h2>
                    <p className={calculatorSupportClassName}>Escolha entregas e marque evento só quando necessário.</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleSectionCollapse("delivery")}
                aria-expanded={!collapsedSections.delivery}
                aria-controls="calculator-section-delivery"
                aria-label={!collapsedSections.delivery ? "Ocultar entrega" : "Ver entrega"}
                className={compactView ? calculatorInlineActionClassName : `${calculatorControlButtonClassName} ${compactSectionTheme.delivery.toggle}`}
              >
                {!compactView ? (!collapsedSections.delivery ? "Ocultar" : "Ver") : null}
                {!collapsedSections.delivery ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {!collapsedSections.delivery && (
              <div id="calculator-section-delivery" className={compactView ? "space-y-3 pt-3.5" : "border-t border-zinc-100/80 space-y-4 px-4 py-4"}>
                <div className={`${compactView ? `${compactSectionBlockClassName} ${deliveryToneClasses.divider}` : ""} ${compactView ? "space-y-2" : "dashboard-panel-subtle flex items-center justify-between px-3.5 py-2.5"}`}>
                  {compactView ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <p className={`dashboard-type-meta ${deliveryToneClasses.legendText}`}>Evento</p>
                        <span className={`dashboard-type-meta ${calcParams.deliveryType === "evento" ? deliveryToneClasses.summaryText : "text-zinc-400"}`}>
                          {calcParams.deliveryType === "evento" ? "Incluído" : "Sem evento"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeliveryType(calcParams.deliveryType === "evento" ? "conteudo" : "evento")}
                        disabled={disableInputs}
                        aria-pressed={calcParams.deliveryType === "evento"}
                        className={`w-full rounded-[0.9rem] py-3 text-left transition ${disableInputs ? "cursor-not-allowed opacity-60" : "hover:bg-zinc-50/55"}`}
                        aria-label="Presença em Evento"
                      >
                        <div className="flex items-center gap-3.5">
                          <span className={`h-6.5 w-1.5 shrink-0 rounded-full ${calcParams.deliveryType === "evento" ? deliveryToneClasses.accentBar : "bg-transparent"}`} />
                          <span className={`min-w-0 flex-1 truncate text-[0.94rem] leading-[1.4] tracking-[-0.015em] ${calcParams.deliveryType === "evento" ? `font-semibold ${deliveryToneClasses.selectedText}` : "font-medium text-zinc-700"}`}>
                            Presença física
                          </span>
                          <span className={compactSelectionIndicatorRailClassName}>
                            <span className={`${compactSelectionIndicatorBaseClassName} ${calcParams.deliveryType === "evento" ? deliveryToneClasses.selectedIndicatorRing : ""}`} aria-hidden>
                              <span className={`h-3 w-3 rounded-full ${calcParams.deliveryType === "evento" ? deliveryToneClasses.selectedDot : "bg-zinc-300"}`} />
                            </span>
                          </span>
                        </div>
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">Presença em Evento</p>
                        <p className="text-xs text-zinc-500">Ative apenas quando houver presença física.</p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDeliveryType(calcParams.deliveryType === "evento" ? "conteudo" : "evento")}
                          disabled={disableInputs}
                          aria-pressed={calcParams.deliveryType === "evento"}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            calcParams.deliveryType === "evento"
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-zinc-200/80 bg-white/84 text-slate-600 hover:border-zinc-300 hover:bg-zinc-50/82"
                          }`}
                          aria-label="Presença em Evento"
                        >
                          {calcParams.deliveryType === "evento" ? "Incluída" : "Não incluída"}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className={compactView ? `${compactSectionBlockClassName} ${deliveryToneClasses.divider}` : ""}>
                  <QuantitySelectionGroup
                    label={compactView ? "Entregas no cálculo" : "Quais entregas de conteúdo entram no cálculo?"}
                    quantities={calcParams.formatQuantities}
                    onChange={updateFormatQuantity}
                    disabled={disableInputs}
                    tone={compactSectionTheme.delivery.tone}
                  />
                </div>

                {calcParams.deliveryType === "evento" ? (
                  compactView ? (
                    <div className={`${compactDetailsShell} ${deliveryToneClasses.divider}`}>
                      <p className={`${compactSubsectionTitleClassName} ${deliveryToneClasses.subsectionText}`}>Ajustes de evento</p>
                    <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-1 gap-2.5">
                          <label className={calculatorInlineFieldClassName}>
                            <span className={calculatorFieldLabelClassName}>Duração do evento</span>
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
                              className={calculatorInputClassName}
                            >
                              <option value={2}>2 horas</option>
                              <option value={4}>4 horas</option>
                              <option value={8}>8 horas</option>
                            </select>
                          </label>
                          <label className={calculatorInlineFieldClassName}>
                            <span className={calculatorFieldLabelClassName}>Deslocamento</span>
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
                              className={calculatorInputClassName}
                            >
                              <option value="local">Local</option>
                              <option value="nacional">Nacional</option>
                              <option value="internacional">Internacional</option>
                            </select>
                          </label>
                          <label className={calculatorInlineFieldClassName}>
                            <span className={calculatorFieldLabelClassName}>Noites de hotel</span>
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
                              className={calculatorInputClassName}
                            />
                          </label>
                        </div>

                        <QuantitySelectionGroup
                          label="Cobertura no evento"
                          quantities={calcParams.eventCoverageQuantities}
                          onChange={updateCoverageQuantity}
                          disabled={disableInputs}
                          tone={compactSectionTheme.delivery.tone}
                        />
                      </div>
                    </div>
                  ) : (
                  <div className={`space-y-3 rounded-[1.25rem] ${compactView ? "border border-zinc-100/90 bg-white/78 p-3" : "border border-zinc-200/80 bg-zinc-50/70 p-3.5 sm:p-4"}`}>
                    <div className={`grid gap-3 ${compactView ? "grid-cols-1" : "sm:grid-cols-3"}`}>
                      <label className={calculatorInlineFieldClassName}>
                        <span className={calculatorFieldLabelClassName}>Duração do evento</span>
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
                          className={calculatorInputClassName}
                        >
                          <option value={2}>2 horas</option>
                          <option value={4}>4 horas</option>
                          <option value={8}>8 horas</option>
                        </select>
                      </label>
                      <label className={calculatorInlineFieldClassName}>
                        <span className={calculatorFieldLabelClassName}>Deslocamento</span>
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
                          className={calculatorInputClassName}
                        >
                          <option value="local">Local</option>
                          <option value="nacional">Nacional</option>
                          <option value="internacional">Internacional</option>
                        </select>
                      </label>
                      <label className={calculatorInlineFieldClassName}>
                        <span className={calculatorFieldLabelClassName}>Noites de hotel</span>
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
                          className={calculatorInputClassName}
                        />
                      </label>
                    </div>

                    <QuantitySelectionGroup
                      label={compactView ? "Cobertura no evento" : "Cobertura opcional no evento (não obrigatória)"}
                      quantities={calcParams.eventCoverageQuantities}
                      onChange={updateCoverageQuantity}
                      disabled={disableInputs}
                      tone={compactSectionTheme.delivery.tone}
                    />
                  </div>
                  )
                ) : null}
                <div className={compactView ? `${compactSectionBlockClassName} ${deliveryToneClasses.divider}` : ""}>
                  <SelectionGroup
                    label={compactView ? "Complexidade" : "Qual a complexidade da produção?"}
                    options={COMPLEXITY_OPTIONS}
                    value={calcParams.complexity}
                    onChange={(v: any) => handleChange("complexity", v)}
                    disabled={disableInputs}
                    tone={compactSectionTheme.delivery.tone}
                  />
                  {calcParams.contentModel === "ugc_whitelabel" ? (
                    <div className="mt-3 rounded-[1.15rem] border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-800">
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
                </div>
                <div className={compactView ? `${compactSectionBlockClassName} ${deliveryToneClasses.divider}` : ""}>
                  <SelectionGroup
                    label={compactView ? "Sazonalidade" : "Qual o momento (Sazonalidade)?"}
                    options={SEASONALITY_OPTIONS}
                    value={calcParams.seasonality}
                    onChange={(v: any) => handleChange("seasonality", v)}
                    disabled={disableInputs}
                    tone={compactSectionTheme.delivery.tone}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={compactView ? compactCanvasSectionClassName : "dashboard-panel overflow-hidden"}>
            <div className={`flex items-center justify-between gap-3 ${compactView ? "px-0 py-3.5" : "px-4 py-3"}`}>
              <div className="min-w-0">
                {compactView ? (
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] ${compactSectionTheme.rights.iconContainer}`}>
                      <Globe className="h-3.5 w-3.5" />
                    </div>
                    <div className={calculatorHeaderTextClassName}>
                      <h2 className={calculatorTitleClassName}>Uso, prazo e adicionais</h2>
                      {collapsedSections.rights ? <p className={`${calculatorSupportClassName} ${rightsToneClasses.summaryText}`}>{rightsSummary}</p> : null}
                    </div>
                  </div>
                ) : (
                  <div className={calculatorHeaderTextClassName}>
                    <h2 className={calculatorTitleClassName}>Direitos e Prazos</h2>
                    <p className={calculatorSupportClassName}>Defina uso de imagem, prazos e adicionais.</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleSectionCollapse("rights")}
                aria-expanded={!collapsedSections.rights}
                aria-controls="calculator-section-rights"
                aria-label={!collapsedSections.rights ? "Ocultar direitos" : "Ver direitos"}
                className={compactView ? calculatorInlineActionClassName : `${calculatorControlButtonClassName} ${compactSectionTheme.rights.toggle}`}
              >
                {!compactView ? (!collapsedSections.rights ? "Ocultar" : "Ver") : null}
                {!collapsedSections.rights ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {!collapsedSections.rights && (
              <div id="calculator-section-rights" className={compactView ? "space-y-3 pt-3.5" : "border-t border-zinc-100/80 space-y-4 px-4 py-4"}>
                <div className={compactView ? `${compactSectionBlockClassName} ${rightsToneClasses.divider}` : ""}>
                  <SelectionGroup
                    label={compactView ? "Exclusividade" : "Exclusividade exigida"}
                    options={EXCLUSIVITY_OPTIONS}
                    value={calcParams.exclusivity}
                    onChange={(v: any) => handleChange("exclusivity", v)}
                    disabled={disableInputs}
                    tone={compactSectionTheme.rights.tone}
                  />
                </div>
                <div className={compactView ? `${compactSectionBlockClassName} ${rightsToneClasses.divider}` : ""}>
                  <SelectionGroup
                    label={compactView ? "Uso de imagem" : "Direitos de uso de imagem"}
                    options={USAGE_OPTIONS}
                    value={calcParams.usageRights}
                    onChange={(v: any) => setUsageRights(v)}
                    disabled={disableInputs}
                    tone={compactSectionTheme.rights.tone}
                  />
                </div>
                {!compactView ? <p className="text-xs text-zinc-500">
                  Quando houver mídia paga (ou global), o direito de impulsionamento vale para todas as plataformas envolvidas durante o prazo contratado.
                </p> : null}
                {calcParams.usageRights !== "organico" ? (
                  <div className={compactView ? `${compactSectionBlockClassName} ${rightsToneClasses.divider}` : ""}>
                    <SelectionGroup
                      label={compactView ? "Prazo da mídia paga" : "Prazo de uso de imagem em mídia paga"}
                      options={PAID_MEDIA_DURATION_OPTIONS}
                      value={calcParams.paidMediaDuration}
                      onChange={(v: any) => setPaidMediaDuration(v)}
                      disabled={disableInputs}
                      tone={compactSectionTheme.rights.tone}
                    />
                  </div>
                ) : null}
                {compactView ? (
                  <div className={`${compactDetailsShell} ${rightsToneClasses.divider}`}>
                    <p className={`${compactSubsectionTitleClassName} ${rightsToneClasses.subsectionText}`}>Adicionais e autoridade</p>
                    <div className="mt-3 space-y-3">
                      <div className="divide-y divide-zinc-100" role="group" aria-label="Adicionais comerciais">
                        <button
                          type="button"
                          onClick={() => toggleFlag("repostTikTok")}
                          disabled={disableInputs}
                          aria-pressed={calcParams.repostTikTok}
                          className={`w-full text-left transition ${disableInputs ? "opacity-70" : ""}`}
                        >
                          <div className={compactToggleLineClassName}>
                            <span className="text-[0.94rem] font-medium leading-[1.4] tracking-[-0.015em] text-zinc-700">Repost no TikTok</span>
                            <span className={`inline-flex items-center gap-2 text-[11px] font-medium ${calcParams.repostTikTok ? rightsToneClasses.summaryText : "text-zinc-400"}`}>
                              <span>{calcParams.repostTikTok ? "Incluído" : "Não"}</span>
                              <span className={`h-1.5 w-1.5 rounded-full ${calcParams.repostTikTok ? "bg-amber-500" : "bg-zinc-300"}`} />
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFlag("instagramCollab")}
                          disabled={disableInputs}
                          aria-pressed={calcParams.instagramCollab}
                          className={`w-full text-left transition ${disableInputs ? "opacity-70" : ""}`}
                        >
                          <div className={compactToggleLineClassName}>
                            <span className="text-[0.94rem] font-medium leading-[1.4] tracking-[-0.015em] text-zinc-700">Collab no Instagram</span>
                            <span className={`inline-flex items-center gap-2 text-[11px] font-medium ${calcParams.instagramCollab ? rightsToneClasses.summaryText : "text-zinc-400"}`}>
                              <span>{calcParams.instagramCollab ? "Incluído" : "Não"}</span>
                              <span className={`h-1.5 w-1.5 rounded-full ${calcParams.instagramCollab ? "bg-amber-500" : "bg-zinc-300"}`} />
                            </span>
                          </div>
                        </button>
                      </div>
                      <SelectionGroup
                        label="Autoridade"
                        options={AUTHORITY_OPTIONS}
                        value={calcParams.authority}
                        onChange={(v: any) => handleChange("authority", v)}
                        disabled={disableInputs}
                        tone={compactSectionTheme.rights.tone}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      <p id="commercial-addons-label" className="text-sm font-semibold text-zinc-900">Condições comerciais adicionais</p>
                      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="commercial-addons-label">
                        <button
                          type="button"
                          onClick={() => toggleFlag("repostTikTok")}
                          disabled={disableInputs}
                          aria-pressed={calcParams.repostTikTok}
                          className={`rounded-[1.15rem] border p-3 text-left transition ${calcParams.repostTikTok
                            ? "border-zinc-900 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-zinc-900"
                            : "border-zinc-200/80 bg-zinc-50/70 hover:border-zinc-300 hover:bg-white"
                            } ${disableInputs ? "opacity-70" : ""}`}
                        >
                          <p className="text-sm font-semibold text-zinc-900">Repost no TikTok</p>
                          <p className="mt-1 text-xs text-zinc-500">
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
                          className={`rounded-[1.15rem] border p-3 text-left transition ${calcParams.instagramCollab
                            ? "border-zinc-900 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-zinc-900"
                            : "border-zinc-200/80 bg-zinc-50/70 hover:border-zinc-300 hover:bg-white"
                            } ${disableInputs ? "opacity-70" : ""}`}
                        >
                          <p className="text-sm font-semibold text-zinc-900">Collab com marca no Instagram</p>
                          <p className="mt-1 text-xs text-zinc-500">
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
                      tone={compactSectionTheme.rights.tone}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <div className={compactView ? compactCanvasSectionClassName : "dashboard-panel overflow-hidden"}>
            <div className={`flex items-center justify-between gap-3 ${compactView ? "px-0 py-3.5" : "px-4 py-3"}`}>
              <div className="min-w-0">
                {compactView ? (
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] ${compactSectionTheme.brand.iconContainer}`}>
                      <Star className="h-3.5 w-3.5" />
                    </div>
                    <div className={calculatorHeaderTextClassName}>
                      <h2 className={calculatorTitleClassName}>Marca, risco e ganho</h2>
                      {collapsedSections.brand ? <p className={`${calculatorSupportClassName} ${brandToneClasses.summaryText}`}>{brandSummary}</p> : null}
                    </div>
                  </div>
                ) : (
                  <div className={calculatorHeaderTextClassName}>
                    <h2 className={calculatorTitleClassName}>Marca e Estratégia</h2>
                    <p className={calculatorSupportClassName}>Classifique risco, porte e potencial estratégico.</p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => toggleSectionCollapse("brand")}
                aria-expanded={!collapsedSections.brand}
                aria-controls="calculator-section-brand"
                aria-label={!collapsedSections.brand ? "Ocultar estrategia" : "Ver estrategia"}
                className={compactView ? calculatorInlineActionClassName : `${calculatorControlButtonClassName} ${compactSectionTheme.brand.toggle}`}
              >
                {!compactView ? (!collapsedSections.brand ? "Ocultar" : "Ver") : null}
                {!collapsedSections.brand ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>

            {!collapsedSections.brand && (
              <div id="calculator-section-brand" className={compactView ? "space-y-3 pt-3.5" : "border-t border-zinc-100/80 space-y-4 px-4 py-4"}>
                <div className={compactView ? `${compactSectionBlockClassName} ${brandToneClasses.divider}` : ""}>
                  <SelectionGroup
                    label={compactView ? "Porte" : "Porte da marca"}
                    options={BRAND_SIZE_OPTIONS}
                    value={calcParams.brandSize}
                    onChange={(v: CalculatorParams["brandSize"]) => handleChange("brandSize", v)}
                    disabled={disableInputs}
                    tone={compactSectionTheme.brand.tone}
                  />
                </div>
                <div className={compactView ? `${compactSectionBlockClassName} ${brandToneClasses.divider}` : ""}>
                  <SelectionGroup
                    label={compactView ? "Risco de imagem" : "Risco de imagem da parceria"}
                    options={IMAGE_RISK_OPTIONS}
                    value={calcParams.imageRisk}
                    onChange={(v: CalculatorParams["imageRisk"]) => handleChange("imageRisk", v)}
                    disabled={disableInputs}
                    tone={compactSectionTheme.brand.tone}
                  />
                </div>
                <div className={compactView ? `${compactSectionBlockClassName} ${brandToneClasses.divider}` : ""}>
                  <SelectionGroup
                    label={compactView ? "Ganho estratégico" : "Ganho estratégico para posicionamento"}
                    options={STRATEGIC_GAIN_OPTIONS}
                    value={calcParams.strategicGain}
                    onChange={(v: CalculatorParams["strategicGain"]) => handleChange("strategicGain", v)}
                    disabled={disableInputs}
                    tone={compactSectionTheme.brand.tone}
                  />
                </div>
                <div className={compactView ? `${compactSectionBlockClassName} ${brandToneClasses.divider}` : ""}>
                  <SelectionGroup
                    label={compactView ? "Modelo" : "Modelo de conteúdo"}
                    options={CONTENT_MODEL_OPTIONS}
                    value={calcParams.contentModel}
                    onChange={(v: CalculatorParams["contentModel"]) => setContentModel(v)}
                    disabled={disableInputs}
                    tone={compactSectionTheme.brand.tone}
                  />
                </div>
                {compactView ? (
                  <div className={`${compactDetailsShell} ${brandToneClasses.divider}`}>
                    <p className={`${compactSubsectionTitleClassName} ${brandToneClasses.subsectionText}`}>Exceção</p>
                    <button
                      type="button"
                      onClick={() => toggleFlag("allowStrategicWaiver")}
                      disabled={disableInputs}
                      aria-pressed={calcParams.allowStrategicWaiver}
                      className={`mt-2 w-full text-left transition ${disableInputs ? "opacity-70" : ""}`}
                    >
                      <div className={compactToggleLineClassName}>
                        <span className="text-[0.94rem] font-medium leading-[1.4] tracking-[-0.015em] text-zinc-700">Permitir R$ 0 no estratégico</span>
                        <span className={`inline-flex items-center gap-2 text-[11px] font-medium ${calcParams.allowStrategicWaiver ? "text-rose-700" : "text-zinc-400"}`}>
                          <span>{calcParams.allowStrategicWaiver ? "Ligada" : "Desligada"}</span>
                          <span className={`h-1.5 w-1.5 rounded-full ${calcParams.allowStrategicWaiver ? "bg-rose-500" : "bg-zinc-300"}`} />
                        </span>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <label className="text-sm font-semibold text-zinc-900">Exceção estratégica</label>
                    <div className="rounded-[1.15rem] border border-zinc-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Permitir R$ 0 no preço estratégico</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Use somente em parcerias de alto ganho estratégico e baixo risco.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleFlag("allowStrategicWaiver")}
                          disabled={disableInputs}
                          aria-pressed={calcParams.allowStrategicWaiver}
                          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition ${calcParams.allowStrategicWaiver
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
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
                )}
              </div>
            )}
          </div>

          {!isActingOnBehalf ? (
            <section className={compactView ? "border-t border-zinc-100/75 pt-4" : "rounded-[1.2rem] border border-zinc-200 bg-zinc-50/70 p-4"} aria-labelledby="personal-pricing-reference-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="personal-pricing-reference-title" className="text-sm font-semibold text-zinc-900">Sua referência de mercado</h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                    Quanto você normalmente fecha por um Reel orgânico padrão? É opcional e ajusta a sugestão com peso limitado.
                  </p>
                </div>
                {personalPricingReference ? (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${personalReferenceReviewDue ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                    {personalReferenceReviewDue ? "Revisão necessária" : "Ativa"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={loadPersonalPricingReference}
                    disabled={isSavingPersonalPricingReference}
                    className="text-xs font-semibold text-zinc-600 underline underline-offset-4 hover:text-zinc-900 disabled:opacity-60"
                  >
                    Ver referência salva
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex-1 text-xs font-semibold text-zinc-700" htmlFor="personal-pricing-reference-value">
                  Valor habitual (R$)
                  <input
                    id="personal-pricing-reference-value"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="100000"
                    step="0.01"
                    value={personalPricingReferenceValue}
                    onChange={(event) => setPersonalPricingReferenceValue(event.target.value)}
                    disabled={isSavingPersonalPricingReference}
                    className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="Ex.: 850"
                  />
                </label>
                <button
                  type="button"
                  onClick={savePersonalPricingReference}
                  disabled={isSavingPersonalPricingReference || !personalPricingReferenceValue.trim()}
                  className="rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingPersonalPricingReference ? "Salvando..." : personalPricingReference ? "Atualizar" : "Salvar"}
                </button>
                {personalPricingReference ? (
                  <button
                    type="button"
                    onClick={removePersonalPricingReference}
                    disabled={isSavingPersonalPricingReference}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              {personalPricingReference ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Salva em {formatDateTime(personalPricingReference.confirmedAt)}. {personalReferenceReviewDue ? "Confirme o valor para que volte a influenciar a sugestão." : "A referência expira para revisão em 90 dias."}
                </p>
              ) : null}
            </section>
          ) : null}

          {error && (
            <div className="rounded-[1.2rem] border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-[0_16px_30px_rgba(239,68,68,0.08)]">
              {error}
            </div>
          )}

          <div className={compactView ? "border-t border-zinc-100/75 pt-5 mt-2" : "mt-8 sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"}>
            <button
              type="submit"
              className={compactView ? calculatorPrimaryCtaClassName : "dashboard-primary-button inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white sm:ml-auto sm:w-auto sm:px-7 sm:py-3.5 sm:text-base"}
              disabled={submitDisabled}
              ref={submitButtonRef}
            >
              {isCalculating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {compactView ? "Calculando..." : "Calculando Melhor Preço..."}
                </>
              ) : (
                <>
                  {compactView ? "Calcular valor" : "Calcular Valor da Publi"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {
          calculation && statsCards && (
            <section
              ref={resultsSectionRef}
              className={`animate-in fade-in slide-in-from-bottom-4 ${compactView ? "space-y-2" : "space-y-4"} duration-700`}
            >
              {compactView ? (
                <div className="border-t border-zinc-100/75 pt-4">
                  {(() => {
                    const maxAmount = Math.max(...statsCards.map((card) => card.amount), 0);
                    return (
                  <div className="space-y-0">
                    {statsCards.map((card, index) => (
                      <div key={card.label} className={`${index === 0 ? "" : "border-t border-zinc-100/75 pt-4"} ${index < statsCards.length - 1 ? "pb-4" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${RESULT_CARD_TONE_CLASSES[card.tone].labelBadge}`}>
                              {card.label}
                            </span>
                            <p className="mt-2.5 text-[0.94rem] font-semibold leading-[1.4] tracking-[-0.015em] text-slate-900">{card.description}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-[20px] font-bold tracking-[-0.03em] ${RESULT_CARD_TONE_CLASSES[card.tone].value}`}>{card.value}</p>
                            <p className="mt-1 dashboard-type-meta text-zinc-400">CPM {card.cpm}</p>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 rounded-full bg-zinc-100">
                          <div className={`h-full rounded-full ${RESULT_CARD_TONE_CLASSES[card.tone].accent}`} style={{ width: `${maxAmount > 0 ? Math.max(18, (card.amount / maxAmount) * 100) : 18}%` }} />
                        </div>
                        <button
                          onClick={() => {
                            const labelText = typeof card?.label === "string" ? card.label : "";
                            const baseLabel = (labelText.split("(")[0] ?? "").trim() || "Pacote";
                            handleAddPackage({
                              name: baseLabel || "Pacote",
                              price: card.amount,
                              description: card?.description ?? "",
                            }, "suggested_card");
                          }}
                          disabled={isActingOnBehalf}
                          className={`mt-3 inline-flex items-center gap-1 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${RESULT_CARD_TONE_CLASSES[card.tone].cpm}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Criar pacote
                        </button>
                      </div>
                    ))}
                  </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {statsCards.map((card) => (
                    <div
                      key={card.label}
                      className="dashboard-panel group flex flex-col overflow-hidden text-left transition-all"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-slate-50 px-4 py-2.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                          {card.label}
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-400">
                          CPM {card.cpm}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col bg-white/40 p-4">
                        <div className="space-y-1">
                          <p className="text-2xl font-bold text-zinc-900">{card.value}</p>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-zinc-500">{card.description}</p>
                        <button
                          onClick={() => {
                            const labelText = typeof card?.label === "string" ? card.label : "";
                            const baseLabel = (labelText.split("(")[0] ?? "").trim() || "Pacote";
                            handleAddPackage({
                              name: baseLabel || "Pacote",
                              price: card.amount,
                              description: card?.description ?? "",
                            }, "suggested_card");
                          }}
                          disabled={isActingOnBehalf}
                          className="dashboard-secondary-button mt-4 flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Criar pacote
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={compactView ? compactCanvasSectionClassName : "dashboard-panel overflow-hidden"}>
                <div className={`flex items-center justify-between gap-3 ${compactView ? "px-0 py-3.5" : "px-4 py-3"}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    {!compactView ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                      <Layers size={16} />
                      </div>
                    ) : null}
                    {compactView ? (
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-violet-50 text-violet-600 ring-1 ring-violet-100/90">
                          <Layers className="h-3.5 w-3.5" />
                        </div>
                        <div className={calculatorHeaderTextClassName}>
                          <h3 className={calculatorTitleClassName}>Pacotes</h3>
                          {collapsedSections.packages ? (
                            <p className={calculatorSupportClassName}>
                              {packages.length > 0 ? `${formatPostsCount(packages.length)} criados` : "Monte pacotes a partir dos valores."}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className={calculatorHeaderTextClassName}>
                        <h3 className={calculatorTitleClassName}>Seus Pacotes</h3>
                        <p className={calculatorSupportClassName}>Estes pacotes aparecerão no seu Mídia Kit.</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddPackage()}
                      disabled={isActingOnBehalf}
                      className={`${compactView ? "dashboard-type-control inline-flex h-7 items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/84 px-2.5 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700" : `${calculatorControlButtonClassName} inline-flex h-8 px-3`} disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <Plus size={13} />
                      Novo
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSectionCollapse("packages")}
                      aria-expanded={!collapsedSections.packages}
                      aria-controls="calculator-section-packages"
                      aria-label={!collapsedSections.packages ? "Ocultar pacotes" : "Ver pacotes"}
                      className={compactView ? calculatorInlineActionClassName : calculatorControlButtonClassName}
                    >
                      {!collapsedSections.packages ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {isActingOnBehalf && (
                  <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-[10px] text-amber-700">
                    Modo admin ativo: edição de pacotes desativada para evitar salvar no Media Kit da conta errada.
                  </div>
                )}

                {!collapsedSections.packages && (
                  <div id="calculator-section-packages" className={compactView ? "pt-3.5" : "border-t border-zinc-100 px-4 py-4"}>
                    {packages.length === 0 ? (
                      <div className={`dashboard-empty-state text-center ${compactView ? "p-3.5" : "p-6"}`}>
                        <p className="text-zinc-500">{compactView ? "Nenhum pacote." : "Nenhum pacote definido."}</p>
                        {!compactView ? <p className="text-sm text-zinc-400">Adicione manualmente ou use as sugestões acima.</p> : null}
                      </div>
                    ) : (
                      <div className={compactView ? "space-y-0" : "space-y-3"}>
                        {packages.map((pkg) => (
                          <div key={pkg.id} className={`flex flex-col gap-3 ${compactView ? "border-t border-zinc-100/75 pt-4 first:border-t-0 first:pt-0" : "rounded-[1.2rem] border border-zinc-200/80 bg-zinc-50/70 p-3.5"}`}>
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                              <div className={compactView ? "space-y-2.5" : "space-y-3"}>
                                <div className={`grid gap-3 ${compactView ? "grid-cols-1" : "sm:grid-cols-2"}`}>
                                  <div>
                                    <label className={`${calculatorFieldLabelClassName} mb-1 block`}>Nome</label>
                                    <input
                                      type="text"
                                      value={pkg.name}
                                      onChange={(e) => handleUpdatePackage(pkg.id!, { name: e.target.value })}
                                      className={`${calculatorInputStrongClassName} ${compactView ? "" : "text-sm"}`}
                                      placeholder="Ex: Combo Reels"
                                    />
                                  </div>
                                  <div>
                                    <label className={`${calculatorFieldLabelClassName} mb-1 block`}>Valor</label>
                                    <input
                                      type="number"
                                      value={pkg.price}
                                      onChange={(e) => handleUpdatePackage(pkg.id!, { price: sanitizePackagePrice(e.target.value) })}
                                      className={`${calculatorInputStrongClassName} ${compactView ? "" : "text-sm"}`}
                                      placeholder="0,00"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className={`${calculatorFieldLabelClassName} mb-1 block`}>Entregáveis</label>
                                  <input
                                    type="text"
                                    value={pkg.deliverables.join(",")}
                                    onChange={(e) => handleUpdatePackage(pkg.id!, { deliverables: e.target.value.split(",") })}
                                    className={`${calculatorInputClassName} ${compactView ? "" : "text-sm"}`}
                                    placeholder="Ex: 1 Reels, 3 Stories"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeletePackage(pkg.id!)}
                                className={`dashboard-secondary-button inline-flex items-center justify-center self-start text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 ${compactView ? "min-h-8 min-w-8 p-2" : "min-h-10 min-w-10 p-2.5"}`}
                                title="Remover pacote"
                                aria-label={`Remover pacote ${pkg.name || ""}`.trim()}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={`border-t border-zinc-100/75 ${compactView ? "mt-4 pt-4" : "mt-4 pt-3.5"}`}>
                      <button
                        type="button"
                        onClick={handleAddToMediaKit}
                        disabled={isSavingPackages || isActingOnBehalf}
                        className={`${compactView ? calculatorSecondaryCtaClassName : "dashboard-primary-button inline-flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-semibold"} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {isSavingPackages ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Salvando no Media Kit...
                          </>
                        ) : (
                          <>
                            <Megaphone className="h-4 w-4" />
                            {compactView ? "Salvar no Mídia Kit" : "Salvar pacotes no Media Kit"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className={compactView ? compactCanvasSectionClassName : "dashboard-panel overflow-hidden"}>
                <div className={`flex items-center justify-between gap-3 ${compactView ? "px-0 py-3.5" : "px-4 py-3"}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    {!compactView ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                      <PieChart size={16} />
                      </div>
                    ) : null}
                    {compactView ? (
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90">
                          <PieChart className="h-3.5 w-3.5" />
                        </div>
                        <div className={calculatorHeaderTextClassName}>
                          <h3 className={calculatorTitleClassName}>Cálculo</h3>
                          {collapsedSections.insights ? <p className={calculatorSupportClassName}>Alcance, CPM e fatores ativos.</p> : null}
                        </div>
                      </div>
                    ) : (
                      <div className={calculatorHeaderTextClassName}>
                        <h3 className={calculatorTitleClassName}>Entenda o cálculo</h3>
                        <p className={calculatorSupportClassName}>Resumo do alcance, CPM e fatores que puxam o valor.</p>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSectionCollapse("insights")}
                    aria-expanded={!collapsedSections.insights}
                    aria-controls="calculator-section-insights"
                    aria-label={!collapsedSections.insights ? "Ocultar calculo" : "Ver calculo"}
                    className={compactView ? calculatorInlineActionClassName : calculatorControlButtonClassName}
                  >
                    {!collapsedSections.insights ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
                {!collapsedSections.insights && (
                  <div id="calculator-section-insights" className={compactView ? "space-y-4 pt-4" : "border-t border-zinc-100 space-y-4 px-4 py-4"}>
                    <div className={`${compactView ? "" : "rounded-[1.2rem] border border-zinc-200/80 bg-zinc-50/80 p-3.5"} text-sm text-zinc-700`}>
                      {compactView ? (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.94rem] leading-[1.4] tracking-[-0.015em] text-zinc-700">
                          <span>Alcance: <span className="font-semibold text-zinc-900">{calculation.metrics.reach.toLocaleString("pt-BR")}</span></span>
                          <span>CPM: <span className="font-semibold text-zinc-900">{formatCurrency(calculation.cpm)}</span></span>
                        </div>
                      ) : (
                        <>
                          <h4 className="mb-2 font-semibold text-zinc-900">Resumo do que entra no preço</h4>
                          <p>Alcance considerado: <span className="font-medium text-zinc-900">{calculation.metrics.reach.toLocaleString("pt-BR")}</span></p>
                          <p>CPM aplicado: <span className="font-medium text-zinc-900">{formatCurrency(calculation.cpm)}</span></p>
                        </>
                      )}
                      <div className={`${compactView ? "mt-2 space-y-1" : "mt-1.5 space-y-1"}`}>
                        {!compactView ? <p>Multiplicadores ativos:</p> : null}
                        <ul className="flex flex-wrap gap-1">
                          {visibleMultiplierTags.map((tag) => (
                            <li key={tag} className="dashboard-chip border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700">
                              {tag}
                            </li>
                          ))}
                          {hiddenMultiplierCount > 0 ? (
                            <li className="dashboard-chip border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-500">
                              +{hiddenMultiplierCount} fatores
                            </li>
                          ) : null}
                        </ul>
                      </div>
                      <p className={`${compactView ? "mt-2 dashboard-type-meta" : "mt-2 text-xs"} text-zinc-500`}>
                        Alcance calculado por {calculation.metrics.reachMethod === "trimmed_mean" ? "média aparada" : "mediana"} de {calculation.metrics.reachSampleSize} conteúdos recentes.
                      </p>
                      {calculation.metrics.reachFollowerAlert ? (
                        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                          O alcance típico é mais de 4× sua base de seguidores. Confirme que esse desempenho é recorrente antes de negociar.
                        </p>
                      ) : null}
                      <p className={`${compactView ? "mt-2 dashboard-type-meta" : "mt-2 text-xs"} text-zinc-500`}>
                        {calculation.params.usageRights === "organico"
                          ? "Sem mídia paga, o uso fica restrito ao orgânico."
                          : "Impulsionamento cobre todas as plataformas envolvidas durante o prazo contratado."}
                      </p>
                      {calculation.calibration.enabled ? (
                        <div className={`space-y-2 ${compactView ? "border-t border-zinc-100 pt-3" : "mt-3 rounded-[1rem] border border-zinc-200 bg-white p-2.5"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Confiança</span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${calculation.calibration.confidenceBand === "alta"
                                ? "bg-emerald-100 text-emerald-700"
                                : calculation.calibration.confidenceBand === "media"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-rose-100 text-rose-700"
                                }`}
                            >
                              {calibrationBandLabel}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-600">
                            Ajuste de calibração aplicado:{" "}
                            <span className="font-semibold text-zinc-900">
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
                      {calculation.personalReference.referenceValueBRL !== null ? (
                        <div className={`space-y-1.5 ${compactView ? "border-t border-zinc-100 pt-3" : "mt-3 rounded-[1rem] border border-zinc-200 bg-white p-2.5"}`}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Referência pessoal</p>
                          <p className="text-xs text-zinc-700">
                            Reel orgânico habitual: <span className="font-semibold text-zinc-900">{formatCurrency(calculation.personalReference.referenceValueBRL)}</span>
                          </p>
                          <p className="text-xs text-zinc-600">
                            {personalReferenceReasonLabel[calculation.personalReference.reason]}
                            {calculation.personalReference.applied && calculation.personalReference.factorApplied !== null
                              ? ` · impacto de ${formatPercent((calculation.personalReference.adjustedJusto / calculation.personalReference.baseJusto - 1) * 100)}.`
                              : "."}
                          </p>
                        </div>
                      ) : null}
                      {brandRiskV1Enabled && strategicWaiverApplied ? (
                        <p className="mt-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                          Exceção estratégica aplicada: Estratégico em R$ 0, com Justo/Premium mantidos para referência comercial.
                        </p>
                      ) : null}
                    </div>
                    <details className={`rounded-[1.2rem] border ${compactView ? "border-zinc-100/90 bg-white/84 p-2.5" : "border-zinc-200 bg-white p-3.5"}`}>
                      <summary className="cursor-pointer text-sm font-semibold text-zinc-900">{compactView ? "Detalhes" : "Fatores de impacto"}</summary>
                      <ul className="mt-2.5 space-y-1.5 text-sm text-zinc-600">
                        <li className="flex justify-between">
                          <span>Modo</span>
                          <span className="font-medium text-zinc-900">
                            {calculation.params.deliveryType === "evento"
                              ? hasContentInResult
                                ? "Conteúdo + Evento"
                                : "Evento"
                              : "Conteúdo"}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Alcance Base</span>
                          <span className="font-medium text-zinc-900">{calculation.metrics.reach.toLocaleString("pt-BR")}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Engajamento</span>
                          <span className="font-medium text-green-600">+{formatPercent(calculation.metrics.engagement)} (Bônus)</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Sazonalidade</span>
                          <span className="font-medium text-zinc-900 capitalize">{calculation.params.seasonality || "Normal"}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Prazo de mídia paga</span>
                          <span className="font-medium text-zinc-900">
                            {calculation.params.paidMediaDuration ? PAID_MEDIA_DURATION_LABELS[calculation.params.paidMediaDuration] : "Não se aplica"}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Repost no TikTok</span>
                          <span className="font-medium text-zinc-900">{calculation.params.repostTikTok ? "Sim" : "Não"}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Confiança da calibração</span>
                          <span className="font-medium text-zinc-900">{calibrationBandLabel}</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Ajuste da calibração</span>
                          <span className="font-medium text-zinc-900">
                            {calibrationAdjustmentPercent >= 0 ? "+" : ""}
                            {formatPercent(calibrationAdjustmentPercent)}
                          </span>
                        </li>
                        <li className="flex justify-between">
                          <span>Collab no Instagram</span>
                          <span className="font-medium text-zinc-900">{calculation.params.instagramCollab ? "Sim" : "Não"}</span>
                        </li>
                        {brandRiskV1Enabled ? (
                          <>
                            <li className="flex justify-between">
                              <span>Porte da marca</span>
                              <span className="font-medium text-zinc-900">{BRAND_SIZE_LABELS[calculation.params.brandSize]}</span>
                            </li>
                            <li className="flex justify-between">
                              <span>Risco de imagem</span>
                              <span className="font-medium text-zinc-900">{IMAGE_RISK_LABELS[calculation.params.imageRisk]}</span>
                            </li>
                            <li className="flex justify-between">
                              <span>Ganho estratégico</span>
                              <span className="font-medium text-zinc-900">{STRATEGIC_GAIN_LABELS[calculation.params.strategicGain]}</span>
                            </li>
                            <li className="flex justify-between">
                              <span>Modelo de conteúdo</span>
                              <span className="font-medium text-zinc-900">{CONTENT_MODEL_LABELS[calculation.params.contentModel]}</span>
                            </li>
                            <li className="flex justify-between">
                              <span>Exceção estratégica</span>
                              <span className="font-medium text-zinc-900">{calculation.params.allowStrategicWaiver ? "Permitida" : "Desligada"}</span>
                            </li>
                          </>
                        ) : null}
                        {hasContentInResult ? (
                          <li className="flex justify-between">
                            <span>Unidades de conteúdo</span>
                            <span className="font-medium text-zinc-900">
                              {calculation.breakdown.contentUnits.toFixed(2)}
                            </span>
                          </li>
                        ) : null}
                        {calculation.params.deliveryType === "evento" ? (
                          <>
                            <li className="flex justify-between">
                              <span>Presença no evento</span>
                              <span className="font-medium text-zinc-900">
                                {formatCurrency(calculation.breakdown.eventPresenceJusto)}
                              </span>
                            </li>
                            {calculation.breakdown.coverageJusto > 0 ? (
                              <li className="flex justify-between">
                                <span>Cobertura opcional</span>
                                <span className="font-medium text-zinc-900">
                                  {formatCurrency(calculation.breakdown.coverageJusto)}
                                </span>
                              </li>
                            ) : null}
                            <li className="flex justify-between">
                              <span>Logística sugerida (extra)</span>
                              <span className="font-medium text-zinc-900">
                                {formatCurrency(calculation.breakdown.logisticsSuggested)}
                              </span>
                            </li>
                          </>
                        ) : null}
                        <li className="flex justify-between">
                          <span>CPM do Nicho</span>
                          <span className="font-medium text-zinc-900">{formatCurrency(calculation.cpm)}</span>
                        </li>
                      </ul>
                      <div className={`border-t border-zinc-200 text-xs text-zinc-500 ${compactView ? "mt-2 pt-2" : "mt-2.5 pt-2.5"}`}>
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
                      <details className={`rounded-[1.2rem] border ${compactView ? "border-zinc-100/90 bg-white/84 p-2.5" : "border-zinc-200 bg-white p-3"} text-sm text-zinc-600`}>
                        <summary className="cursor-pointer font-medium text-zinc-700">Ver explicação detalhada</summary>
                        <p className="mt-2 leading-relaxed text-zinc-500">{calculation.explanation}</p>
                      </details>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-slate-400">
                Cálculo ID: <span className="font-mono">{calculation.calculationId}</span> • Gerado em {formatDateTime(calculation.createdAt)}
              </div>
            </section>
          )
        }
      </div >
    </div >
  );
}
