"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { isPlanActiveLike } from "@/utils/planStatus";
import { FaSpinner, FaLock, FaArrowRight, FaChartLine, FaChartPie, FaInstagram, FaVideo, FaImage, FaLayerGroup, FaCalendarCheck, FaCalendarAlt, FaCalendarTimes, FaGlobeAmericas, FaBullhorn, FaUser, FaUserCheck, FaUserTie, FaStar, FaSnowflake, FaSun, FaCloudSun, FaPlus, FaTrash, FaEdit, FaSave } from "react-icons/fa";
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
  exclusivity: "nenhuma" | "7d" | "15d" | "30d";
  usageRights: "organico" | "midiapaga" | "global";
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

type CalculationResult = {
  estrategico: number;
  justo: number;
  premium: number;
  cpm: number;
  breakdown: CalculationBreakdown;
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

const FORMAT_VALUES: CalculatorFormat[] = ["reels", "post", "stories", "pacote", "evento"];
const DELIVERY_TYPE_VALUES: DeliveryType[] = ["conteudo", "evento"];
const EXCLUSIVITY_VALUES: CalculatorParams["exclusivity"][] = ["nenhuma", "7d", "15d", "30d"];
const USAGE_VALUES: CalculatorParams["usageRights"][] = ["organico", "midiapaga", "global"];
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
];

const USAGE_OPTIONS = [
  { value: "organico", label: "Orgânico", icon: FaUser, helper: "Apenas no seu perfil" },
  { value: "midiapaga", label: "Mídia Paga", icon: FaBullhorn, helper: "Impulsionamento (Ads)" },
  { value: "global", label: "Global", icon: FaGlobeAmericas, helper: "Uso irrestrito/TV" },
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

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatSegmentLabel(segment?: string): string {
  if (!segment) return "default";
  return segment
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CalculatorClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const billingStatus = useBillingStatus();

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
  const upgradeSubtitle =
    "Tenha o Mobi como seu consultor pessoal e receba análises e precificações automáticas.";

  const [calcParams, setCalcParams] = useState<CalculatorParams>({
    format: "reels",
    deliveryType: "conteudo",
    formatQuantities: { reels: 1, post: 0, stories: 0 },
    eventDetails: { durationHours: 4, travelTier: "local", hotelNights: 0 },
    eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
    exclusivity: "nenhuma",
    usageRights: "organico",
    complexity: "simples",
    authority: "padrao",
    seasonality: "normal",
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsSectionRef = useRef<HTMLDivElement | null>(null);

  // Package Management State
  const [packages, setPackages] = useState<MediaKitPackage[]>([]);
  const [isSavingPackages, setIsSavingPackages] = useState(false);

  useEffect(() => {
    // Fetch existing packages on mount or when access is confirmed
    if (canAccessFeatures) {
      fetch('/api/mediakit/self/packages')
        .then(res => res.json())
        .then(data => {
          if (data.packages) {
            setPackages(data.packages.map((p: any) => ({ ...p, id: p._id || Math.random().toString(36).substr(2, 9) })));
          }
        })
        .catch(err => console.error('Failed to load packages', err));
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

  const clampQuantity = (value: number) => Math.min(20, Math.max(0, Math.trunc(value)));
  const quantityTotal = (quantities: FormatQuantities) => quantities.reels + quantities.post + quantities.stories;
  const hasAnyQuantity = (quantities: FormatQuantities) => quantityTotal(quantities) > 0;

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

    const normalized: CalculatorParams = {
      ...params,
      deliveryType: DELIVERY_TYPE_VALUES.includes(params.deliveryType) ? params.deliveryType : "conteudo",
      formatQuantities,
      eventCoverageQuantities,
      eventDetails,
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

    return {
      ...candidate,
      format: deriveLegacyFormat(candidate),
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
      if (normalizedParams.deliveryType === "conteudo" && !hasAnyQuantity(normalizedParams.formatQuantities)) {
        const message = "Selecione pelo menos uma entrega (Reels, Post ou Stories) para calcular.";
        setError(message);
        toast({
          variant: "error",
          title: "Entregas obrigatórias",
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
          handleLockedAccess("api_call");
          return;
        }
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
        throw new Error("Resposta inválida do servidor.");
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
    } catch (err: any) {
      const message = err?.message || "Erro inesperado ao calcular.";
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

  const handleAddPackage = (pkg?: Partial<MediaKitPackage>) => {
    const newPackage: MediaKitPackage = {
      id: Math.random().toString(36).substr(2, 9),
      name: pkg?.name || "Novo Pacote",
      price: pkg?.price || 0,
      currency: "BRL",
      deliverables: pkg?.deliverables || ["1x Reels"],
      description: pkg?.description || "",
      type: "manual",
    };
    setPackages((prev) => [...prev, newPackage]);
    toast({
      variant: "success",
      title: "Pacote adicionado",
      description: "Edite os detalhes abaixo.",
    });
  };

  const handleUpdatePackage = (id: string, updates: Partial<MediaKitPackage>) => {
    setPackages((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
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
      // 1. Save packages
      // Sanitize deliverables before saving
      const sanitizedPackages = packages.map(p => ({
        ...p,
        deliverables: p.deliverables.map(d => d.trim()).filter(Boolean)
      }));

      const res = await fetch('/api/mediakit/self/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: sanitizedPackages }),
      });

      if (!res.ok) throw new Error('Falha ao salvar pacotes');

      // 2. Redirect
      if (calculation) {
        // Still track the calculation ID for legacy/fallback purposes if needed
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
      toast({
        variant: "error",
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o Media Kit.",
      });
    } finally {
      setIsSavingPackages(false);
    }
  };

  const handleOpenChat = () => {
    if (!calculation) return;
    router.push(`/dashboard/chat?context=publi-calculator&calcId=${encodeURIComponent(calculation.calculationId)}`);
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
        value: formatCurrency(calculation.estrategico),
        cpm: formatCurrency(calculateEffectiveCpm(calculation.estrategico, calculation.metrics.reach)),
        description: "Para abrir portas e fechar pacotes.",
        badgeClass: "bg-blue-50 text-blue-700",
        accentDot: "bg-blue-500",
      },
      {
        label: "Valor Justo (Sugerido)",
        value: formatCurrency(calculation.justo),
        cpm: formatCurrency(calculateEffectiveCpm(calculation.justo, calculation.metrics.reach)),
        description: "Equilíbrio ideal entre esforço e retorno.",
        badgeClass: "bg-emerald-50 text-emerald-700",
        accentDot: "bg-emerald-500",
      },
      {
        label: "Premium (Alto Valor)",
        value: formatCurrency(calculation.premium),
        cpm: formatCurrency(calculateEffectiveCpm(calculation.premium, calculation.metrics.reach)),
        description: "Para alta demanda e entregas complexas.",
        badgeClass: "bg-amber-50 text-amber-700",
        accentDot: "bg-amber-500",
      },
    ]
    : null;

  const SelectionGroup = ({ label, options, value, onChange, disabled }: any) => (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-800">{label}</label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option: any) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className={`group relative flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all sm:p-5 ${isSelected
                ? "border-[#F6007B]/50 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] ring-2 ring-[#F6007B]/25"
                : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
                } ${disabled ? "cursor-not-allowed opacity-60 hover:translate-y-0 hover:shadow-none" : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/25 focus-visible:ring-offset-1"}`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition-colors ${isSelected ? "bg-[#F6007B]/10 text-[#F6007B]" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"}`}>
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                {option.helper && <p className="text-xs text-slate-500">{option.helper}</p>}
              </div>
              {isSelected ? (
                <span className="absolute right-3 top-3 rounded-full bg-[#F6007B]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F6007B]">
                  Selecionado
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
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
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-800">{label}</label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FORMAT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const currentValue = quantities[option.value as keyof FormatQuantities] ?? 0;
          const isSelected = currentValue > 0;
          const optionKey = option.value as keyof FormatQuantities;
          return (
            <div
              key={option.value}
              className={`rounded-2xl border p-4 transition-all sm:p-5 ${isSelected
                ? "border-[#F6007B]/50 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)] ring-2 ring-[#F6007B]/25"
                : "border-gray-200 bg-white"
                } ${disabled ? "opacity-70" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg transition-colors ${isSelected ? "bg-[#F6007B]/10 text-[#F6007B]" : "bg-slate-100 text-slate-500"}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${isSelected ? "bg-[#F6007B]/10 text-[#F6007B]" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  onClick={() => onChange(optionKey, isSelected ? 0 : 1)}
                >
                  {isSelected ? "Ativo" : "Ativar"}
                </button>
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                {option.helper && <p className="text-xs text-slate-500">{option.helper}</p>}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => onChange(optionKey, clampQuantity(currentValue - 1))}
                  disabled={disabled || currentValue <= 0}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Diminuir ${option.label}`}
                >
                  -
                </button>
                <span className="text-sm font-semibold text-slate-900">{currentValue}</span>
                <button
                  type="button"
                  onClick={() => onChange(optionKey, clampQuantity(currentValue + 1))}
                  disabled={disabled || currentValue >= 20}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Aumentar ${option.label}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

  return (
    <div className="dashboard-page-shell py-10 space-y-10">
      <header className="space-y-4 text-center sm:text-left">
        <div className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600">
          <FaChartLine className="h-3.5 w-3.5 text-[#F6007B]" />
          Calculadora inteligente · Pro
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          Quanto cobrar pela sua publi?
        </h1>
        <p className="max-w-2xl text-base text-slate-600 sm:text-lg">
          Nossa IA analisa seu engajamento, nicho e histórico para sugerir o preço ideal.
          Personalize os detalhes abaixo para um cálculo preciso.
        </p>
      </header>

      {billingStatus.isLoading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-slate-600 shadow-sm sm:p-8">
          <FaSpinner className="h-5 w-5 animate-spin text-[#F6007B]" />
          <span className="font-medium">Carregando seus dados...</span>
        </div>
      )}

      {showLockedMessage && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F6007B]/10 text-[#F6007B]">
              <FaLock className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                Desbloqueie o poder da precificação inteligente
              </h2>
              <p className="text-slate-600">
                Assinantes do Plano Pro têm acesso ilimitado à calculadora, com sugestões baseadas em dados reais de mercado.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLockedAccess("banner")}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F6007B] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e2006f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40 focus-visible:ring-offset-2"
            >
              Quero acesso agora
              <FaArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">1</span>
            Detalhes da Entrega
          </h3>
          <div className="space-y-8">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType("conteudo")}
                  disabled={disableInputs}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${calcParams.deliveryType === "conteudo"
                    ? "bg-white text-[#F6007B] shadow-sm ring-1 ring-[#F6007B]/20"
                    : "text-slate-600 hover:bg-white/70"
                    }`}
                >
                  Conteúdo
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("evento")}
                  disabled={disableInputs}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${calcParams.deliveryType === "evento"
                    ? "bg-white text-[#F6007B] shadow-sm ring-1 ring-[#F6007B]/20"
                    : "text-slate-600 hover:bg-white/70"
                    }`}
                >
                  Presença em Evento
                </button>
              </div>
            </div>

            {calcParams.deliveryType === "conteudo" ? (
              <QuantitySelectionGroup
                label="Quais entregas entram no cálculo?"
                quantities={calcParams.formatQuantities}
                onChange={updateFormatQuantity}
                disabled={disableInputs}
              />
            ) : (
              <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
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
                      className="w-full rounded-lg border-slate-200 text-sm text-slate-700 focus:border-[#F6007B] focus:ring-[#F6007B]"
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
                      className="w-full rounded-lg border-slate-200 text-sm text-slate-700 focus:border-[#F6007B] focus:ring-[#F6007B]"
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
                      className="w-full rounded-lg border-slate-200 text-sm text-slate-700 focus:border-[#F6007B] focus:ring-[#F6007B]"
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
            )}
            <SelectionGroup
              label="Qual a complexidade da produção?"
              options={COMPLEXITY_OPTIONS}
              value={calcParams.complexity}
              onChange={(v: any) => handleChange("complexity", v)}
              disabled={disableInputs}
            />
            <SelectionGroup
              label="Qual o momento (Sazonalidade)?"
              options={SEASONALITY_OPTIONS}
              value={calcParams.seasonality}
              onChange={(v: any) => handleChange("seasonality", v)}
              disabled={disableInputs}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">2</span>
            Direitos e Prazos
          </h3>
          <div className="space-y-8">
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
              onChange={(v: any) => handleChange("usageRights", v)}
              disabled={disableInputs}
            />
            <SelectionGroup
              label="Seu nível de autoridade atual"
              options={AUTHORITY_OPTIONS}
              value={calcParams.authority}
              onChange={(v: any) => handleChange("authority", v)}
              disabled={disableInputs}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#F6007B] px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#e2006f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:shadow-none"
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
          className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8"
        >
          <div className="grid gap-6 md:grid-cols-3">
            {statsCards.map((card) => (
              <div
                key={card.label}
                className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${card.badgeClass}`}>
                      <span className={`h-2 w-2 rounded-full ${card.accentDot}`} aria-hidden />
                      {card.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      CPM aprox. {card.cpm}
                    </span>
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="text-3xl font-semibold text-slate-900">{card.value}</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-600 leading-relaxed">{card.description}</p>
                </div>
                <button
                  onClick={() => {
                    const labelText = typeof card?.label === 'string' ? card.label : '';
                    const baseLabel = (labelText.split('(')[0] ?? '').trim() || 'Pacote';
                    const priceLabel = typeof card?.value === 'string' ? card.value : '0';
                    const parsedPrice = Number.parseFloat(priceLabel.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
                    handleAddPackage({
                      name: baseLabel || 'Pacote',
                      price: parsedPrice,
                      description: card?.description ?? '',
                    });
                  }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <FaPlus className="h-3 w-3" />
                  Usar como pacote
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-purple-100 p-2 text-purple-600">
                  <FaLayerGroup className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">Seus Pacotes</h3>
                  <p className="text-sm text-slate-500">Estes pacotes aparecerão no seu Mídia Kit.</p>
                </div>
              </div>
              <button
                onClick={() => handleAddPackage()}
                className="group flex items-center gap-2 rounded-lg bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
              >
                <FaPlus className="h-3 w-3" />
                Novo Pacote
              </button>
            </div>

            {packages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <p className="text-slate-500">Nenhum pacote definido.</p>
                <p className="text-sm text-slate-400">Adicione manualmente ou use as sugestões da IA acima.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {packages.map((pkg, idx) => (
                  <div key={pkg.id} className="relative flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-start">
                    <div className="flex-1 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Nome do Pacote</label>
                          <input
                            type="text"
                            value={pkg.name}
                            onChange={(e) => handleUpdatePackage(pkg.id!, { name: e.target.value })}
                            className="w-full rounded-lg border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500"
                            placeholder="Ex: Combo Reels"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Valor (R$)</label>
                          <input
                            type="number"
                            value={pkg.price}
                            onChange={(e) => handleUpdatePackage(pkg.id!, { price: parseFloat(e.target.value) })}
                            className="w-full rounded-lg border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500"
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
                          className="w-full rounded-lg border-slate-200 text-sm text-slate-600 placeholder:text-slate-400 focus:border-purple-500 focus:ring-purple-500"
                          placeholder="Ex: 1 Reels, 3 Stories"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePackage(pkg.id!)}
                      className="absolute right-2 top-2 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 sm:static sm:mt-1"
                      title="Remover pacote"
                    >
                      <FaTrash className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-full bg-pink-100 p-2 text-pink-600">
                <FaChartPie className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">Entenda o cálculo</h3>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">Fatores de impacto</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex justify-between">
                      <span>Modo</span>
                      <span className="font-medium text-slate-900">
                        {calculation.params.deliveryType === "evento" ? "Evento" : "Conteúdo"}
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
                    {calculation.params.deliveryType === "conteudo" ? (
                      <li className="flex justify-between">
                        <span>Unidades de conteúdo</span>
                        <span className="font-medium text-slate-900">
                          {calculation.breakdown.contentUnits.toFixed(2)}
                        </span>
                      </li>
                    ) : (
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
                    )}
                    <li className="flex justify-between">
                      <span>CPM do Nicho</span>
                      <span className="font-medium text-slate-900">{formatCurrency(calculation.cpm)}</span>
                    </li>
                  </ul>
                  <div className="mt-3 border-t border-gray-200 pt-3 text-xs text-slate-500">
                    {calculation.params.deliveryType === "conteudo" ? (
                      <p>Fórmula: (Alcance / 1.000) x CPM x multiplicadores x unidades de conteúdo.</p>
                    ) : (
                      <p>Fórmula: presença em evento + cobertura opcional (logística exibida separadamente).</p>
                    )}
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-slate-500">
                  {calculation.explanation}
                </p>
              </div>

              <div className="flex flex-col justify-center gap-4 border-t pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
                <button
                  type="button"
                  onClick={handleAddToMediaKit}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-pink-100 bg-white px-6 py-4 text-sm font-bold text-pink-600 transition hover:border-pink-200 hover:bg-pink-50"
                >
                  <FaBullhorn className="h-4 w-4" />
                  Adicionar ao Media Kit
                </button>
                <button
                  type="button"
                  onClick={handleOpenChat}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-4 text-sm font-bold text-white transition hover:bg-gray-800"
                >
                  <FaArrowRight className="h-4 w-4" />
                  Pedir Ajuda à IA para Negociar
                </button>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
            Cálculo ID: <span className="font-mono">{calculation.calculationId}</span> • Gerado em {formatDateTime(calculation.createdAt)}
          </div>
        </section>
      )}
    </div>
  );
}
