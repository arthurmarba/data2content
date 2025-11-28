"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { isPlanActiveLike } from "@/utils/planStatus";
import { FaSpinner, FaLock, FaArrowRight, FaChartLine, FaChartPie } from "react-icons/fa";
import { track } from "@/lib/track";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

type CalculatorParams = {
  format: "post" | "reels" | "stories" | "pacote";
  exclusivity: "nenhuma" | "7d" | "15d" | "30d";

  usageRights: "organico" | "midiapaga" | "global";
  complexity: "simples" | "roteiro" | "profissional";
  authority: "padrao" | "ascensao" | "autoridade" | "celebridade";
};

type CalculationResult = {
  estrategico: number;
  justo: number;
  premium: number;
  cpm: number;
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

const FORMAT_VALUES: CalculatorParams["format"][] = ["reels", "post", "stories", "pacote"];
const EXCLUSIVITY_VALUES: CalculatorParams["exclusivity"][] = ["nenhuma", "7d", "15d", "30d"];
const USAGE_VALUES: CalculatorParams["usageRights"][] = ["organico", "midiapaga", "global"];

const COMPLEXITY_VALUES: CalculatorParams["complexity"][] = ["simples", "roteiro", "profissional"];
const AUTHORITY_VALUES: CalculatorParams["authority"][] = ["padrao", "ascensao", "autoridade", "celebridade"];

const FORMAT_OPTIONS: { value: CalculatorParams["format"]; label: string; helper: string }[] = [
  { value: "reels", label: "Reels", helper: "Formato em vídeo curto" },
  { value: "post", label: "Post no feed", helper: "Imagem ou carrossel" },
  { value: "stories", label: "Stories", helper: "Sequências éphemeras" },
  { value: "pacote", label: "Pacote multiformato", helper: "Combinação personalizada" },
];

const EXCLUSIVITY_OPTIONS: { value: CalculatorParams["exclusivity"]; label: string }[] = [
  { value: "nenhuma", label: "Sem exclusividade" },
  { value: "7d", label: "7 dias" },
  { value: "15d", label: "15 dias" },
  { value: "30d", label: "30 dias" },
];

const USAGE_OPTIONS: { value: CalculatorParams["usageRights"]; label: string }[] = [
  { value: "organico", label: "Uso orgânico" },
  { value: "midiapaga", label: "Mídia paga" },
  { value: "global", label: "Global / perpétuo" },
];

const COMPLEXITY_OPTIONS: { value: CalculatorParams["complexity"]; label: string; helper: string }[] = [
  { value: "simples", label: "Simples", helper: "Execução rápida, sem roteiro" },
  { value: "roteiro", label: "Com roteiro", helper: "Necessita pré-aprovação de roteiro" },
  { value: "profissional", label: "Produção profissional", helper: "Inclui edição avançada/equipe" },
];

const AUTHORITY_OPTIONS: { value: CalculatorParams["authority"]; label: string; helper: string }[] = [
  { value: "padrao", label: "Padrão", helper: "Criador iniciante ou sem histórico relevante" },
  { value: "ascensao", label: "Em ascensão", helper: "Crescimento rápido e boa reputação" },
  { value: "autoridade", label: "Autoridade", helper: "Referência no nicho de atuação" },
  { value: "celebridade", label: "Celebridade", helper: "Fama mainstream ou alta demanda" },
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
    exclusivity: "nenhuma",
    usageRights: "organico",

    complexity: "simples",
    authority: "padrao",
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const handleLockedAccess = (source: string = "cta") => {
    toast({
      variant: "info",
      title: "Recurso exclusivo do Plano Agência",
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

  const formatCurrency = (value: number) => currencyFormatter.format(value);
  const formatPercent = (value: number) => `${percentFormatter.format(value)}%`;
  const findOptionLabel = (options: { value: string; label: string }[], value?: string | null) =>
    options.find((option) => option.value === value)?.label ?? (value ?? '—');
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
      const response = await fetch("/api/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calcParams),
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
      const sanitizedParams = {
        format: FORMAT_VALUES.includes((parsed.params as any)?.format)
          ? ((parsed.params as any).format as CalculatorParams["format"])
          : calcParams.format,
        exclusivity: EXCLUSIVITY_VALUES.includes((parsed.params as any)?.exclusivity)
          ? ((parsed.params as any).exclusivity as CalculatorParams["exclusivity"])
          : calcParams.exclusivity,
        usageRights: USAGE_VALUES.includes((parsed.params as any)?.usageRights)
          ? ((parsed.params as any).usageRights as CalculatorParams["usageRights"])
          : calcParams.usageRights,
        complexity: COMPLEXITY_VALUES.includes((parsed.params as any)?.complexity)
          ? ((parsed.params as any).complexity as CalculatorParams["complexity"])
          : calcParams.complexity,
        authority: AUTHORITY_VALUES.includes((parsed.params as any)?.authority)
          ? ((parsed.params as any).authority as CalculatorParams["authority"])
          : calcParams.authority,
      };

      const sanitized: CalculationResult = {
        estrategico: parsed.estrategico,
        justo: parsed.justo,
        premium: parsed.premium,
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

  const handleAddToMediaKit = () => {
    if (!calculation) return;
    router.push(`/media-kit?fromCalc=${encodeURIComponent(calculation.calculationId)}`);
  };

  const handleOpenChat = () => {
    if (!calculation) return;
    router.push(`/dashboard/chat?context=publi-calculator&calcId=${encodeURIComponent(calculation.calculationId)}`);
  };

  const disableInputs = isCalculating || !canAccessFeatures;

  const statsCards = calculation
    ? [
      {
        label: "Valor Estratégico (Total)",
        value: formatCurrency(calculation.estrategico),
        description: "Oferta para abrir relacionamento e fechar pacotes futuros.",
      },
      {
        label: "Valor Justo (Total)",
        value: formatCurrency(calculation.justo),
        description: "Preço recomendado para equilíbrio entre entrega e retorno.",
      },
      {
        label: "Valor Premium (Total)",
        value: formatCurrency(calculation.premium),
        description: "Valor para entregas com maior exposição e recursos extras.",
      },
    ]
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 space-y-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-3 py-1 text-sm font-medium text-pink-600">
          <FaChartLine className="h-3.5 w-3.5" />
          Calculadora de Publi
          <span className="inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pink-700">
            AGÊNCIA
          </span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          Descubra o valor ideal das suas entregas publicitárias
        </h1>
        <p className="max-w-2xl text-gray-600">

          Combinamos métricas reais do seu perfil, histórico de publis e multiplicadores de mercado para sugerir o VALOR TOTAL (não é CPM).
          Use o resultado estratégico para abrir conversas, o justo para propostas equilibradas e o premium para entregas de alto impacto.
        </p>
      </header>

      {billingStatus.isLoading && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-gray-600 shadow-sm">
          <FaSpinner className="h-4 w-4 animate-spin" />
          Carregando status da sua assinatura...
        </div>
      )}

      {showLockedMessage && (
        <div className="rounded-xl border border-dashed border-pink-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full bg-pink-100 p-2 text-pink-600">
                <FaLock className="h-4 w-4" />
              </div>
              <div>
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-pink-600">
                  <span aria-hidden>📊</span>
                  Recurso exclusivo Plano Agência
                </span>
                <h2 className="mt-2 text-lg font-semibold text-gray-900">
                  Calculadora de Publi liberada apenas para assinantes do Plano Agência
                </h2>
                <p className="text-sm text-gray-600">
                  Descubra o valor ideal da sua publi com base nas suas métricas reais e histórico de contratos, com sugestão automática do Mobi.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 md:items-end">
              <button
                type="button"
                onClick={() => handleLockedAccess("banner")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
              >
                Desbloquear IA
                <FaArrowRight className="h-3 w-3" />
              </button>
              <p className="text-xs text-gray-500 text-left md:text-right max-w-xs">
                {upgradeSubtitle}
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Formato da entrega</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              value={calcParams.format}
              onChange={(event) => handleChange("format", event.target.value as CalculatorParams["format"])}
              disabled={disableInputs}
            >
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              {FORMAT_OPTIONS.find((option) => option.value === calcParams.format)?.helper}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Exclusividade</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              value={calcParams.exclusivity}
              onChange={(event) => handleChange("exclusivity", event.target.value as CalculatorParams["exclusivity"])}
              disabled={disableInputs}
            >
              {EXCLUSIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Tempo que você fica sem divulgar marcas concorrentes.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Uso de imagem</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              value={calcParams.usageRights}
              onChange={(event) => handleChange("usageRights", event.target.value as CalculatorParams["usageRights"])}
              disabled={disableInputs}
            >
              {USAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Define se a marca pode impulsionar, veicular anúncios ou usar globalmente.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Complexidade da produção</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              value={calcParams.complexity}
              onChange={(event) => handleChange("complexity", event.target.value as CalculatorParams["complexity"])}
              disabled={disableInputs}
            >
              {COMPLEXITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              {COMPLEXITY_OPTIONS.find((option) => option.value === calcParams.complexity)?.helper}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Nível de Autoridade</label>
            <select
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              value={calcParams.authority}
              onChange={(event) => handleChange("authority", event.target.value as CalculatorParams["authority"])}
              disabled={disableInputs}
            >
              {AUTHORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">
              {AUTHORITY_OPTIONS.find((option) => option.value === calcParams.authority)?.helper}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:bg-pink-200"
            disabled={disableInputs}
            ref={submitButtonRef}
          >
            {isCalculating ? (
              <>
                <FaSpinner className="h-4 w-4 animate-spin" />
                Calculando...
              </>
            ) : (
              <>
                Calcular valores
                <FaArrowRight className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </form>

      {calculation && statsCards && (
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {statsCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-pink-500">
                  {card.label}
                </span>
                <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
                <p className="mt-3 text-sm text-gray-600">{card.description}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700">Métricas base consideradas</h3>
              <dl className="mt-3 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <dt>Alcance médio recente</dt>
                  <dd>{calculation.metrics.reach.toLocaleString("pt-BR")} pessoas</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Engajamento médio</dt>
                  <dd>{formatPercent(calculation.metrics.engagement)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Nicho detectado</dt>
                  <dd className="capitalize">{formatSegmentLabel(calculation.metrics.profileSegment)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>CPM aplicado</dt>
                  <dd>{formatCurrency(calculation.cpm)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Calculado em</dt>
                  <dd>{formatDateTime(calculation.createdAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700">Histórico comercial</h3>
              <dl className="mt-3 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <dt>Ticket médio recente</dt>
                  <dd>{calculation.avgTicket ? formatCurrency(calculation.avgTicket) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Formato considerado</dt>
                  <dd>{findOptionLabel(FORMAT_OPTIONS, calculation.params.format)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Exclusividade</dt>
                  <dd>{findOptionLabel(EXCLUSIVITY_OPTIONS, calculation.params.exclusivity)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Uso de imagem</dt>
                  <dd>{findOptionLabel(USAGE_OPTIONS, calculation.params.usageRights)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Complexidade</dt>
                  <dd>{findOptionLabel(COMPLEXITY_OPTIONS, calculation.params.complexity)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Autoridade</dt>
                  <dd>{findOptionLabel(AUTHORITY_OPTIONS, calculation.params.authority)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Publis analisadas</dt>
                  <dd>{calculation.totalDeals}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>ID do cálculo</dt>
                  <dd className="font-mono text-xs text-gray-500">{calculation.calculationId}</dd>
                </div>
              </dl>
            </div>
          </div>

          {calculation.explanation && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <FaChartPie className="h-4 w-4 text-pink-500" />
                Como chegamos nesses números
              </div>
              <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-700 font-mono border border-gray-200">
                <p className="mb-1 font-semibold text-gray-900">Fórmula base:</p>
                <p>(Alcance / 1.000) × CPM × Fatores = Valor Total</p>
                <div className="my-2 border-t border-gray-200"></div>
                <p>
                  ({calculation.metrics.reach.toLocaleString("pt-BR")} / 1.000) × {formatCurrency(calculation.cpm)} × ...
                </p>
              </div>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">
                {calculation.explanation}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleAddToMediaKit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-pink-200 bg-white px-5 py-3 text-sm font-semibold text-pink-600 shadow-sm transition hover:border-pink-400 hover:bg-pink-50 sm:w-auto"
            >
              Adicionar ao MediaKit
            </button>
            <button
              type="button"
              onClick={handleOpenChat}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 sm:w-auto"
            >
              Ver no Chat IA
              <FaArrowRight className="h-3 w-3" />
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
