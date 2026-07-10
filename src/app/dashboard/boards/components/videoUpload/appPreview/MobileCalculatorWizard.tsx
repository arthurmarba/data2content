"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DiagnosticoCloseButton } from "./DiagnosticoCloseButton";
import { SAFE_TOP } from "./diagnosticoTokens";

type PersonalReferenceReason = "not_configured" | "expired" | "creator_calibrated" | "feature_disabled" | "applied";

type PersonalPricingReference = {
  valueBRL: number;
  scope?: "reel_organico_padrao";
  confirmedAt?: string;
  updatedAt?: string;
};

export type MobileCalculatorResult = {
  estrategico: number;
  justo: number;
  premium: number;
  breakdown?: Record<string, unknown>;
  cpm?: number;
  cpmSource?: string;
  calibration?: Record<string, unknown>;
  personalReference?: {
    enabled?: boolean;
    applied?: boolean;
    reason?: PersonalReferenceReason;
    referenceValueBRL?: number | null;
    referenceAgeDays?: number | null;
    factorApplied?: number | null;
    weightApplied?: number;
    baseJusto?: number;
    adjustedJusto?: number;
  };
  params?: {
    format?: string;
    deliveryType?: string;
    formatQuantities?: {
      reels?: number;
      post?: number;
      stories?: number;
    };
    eventDetails?: Record<string, unknown>;
    eventCoverageQuantities?: Record<string, unknown>;
    exclusivity?: string;
    usageRights?: string;
    paidMediaDuration?: string | null;
    repostTikTok?: boolean;
    instagramCollab?: boolean;
    brandSize?: string;
    imageRisk?: string;
    strategicGain?: string;
    contentModel?: string;
    allowStrategicWaiver?: boolean;
    complexity?: string;
    authority?: string;
    seasonality?: string;
  };
  metrics?: {
    reach?: number;
    engagement?: number;
    profileSegment?: string;
    reachSampleSize?: number;
    reachMethod?: "trimmed_mean" | "median" | string;
    reachConfidence?: "alta" | "baixa" | string;
    reachFollowerAlert?: boolean;
  };
  avgTicket?: number | null;
  totalDeals?: number;
  calculationId?: string;
  explanation?: string | null;
  createdAt?: string;
};

type FormatKey = "reels" | "post" | "stories";
type WizardStep = 0 | 1 | 2;
type BrandSize = "pequena" | "media" | "grande";
type Level = "baixo" | "medio" | "alto";
type Exclusivity = "nenhuma" | "7d" | "15d" | "30d" | "90d";
type UsageRights = "organico" | "midiapaga" | "global";
type MediaDuration = "7d" | "15d" | "30d" | "90d";
type ContentModel = "publicidade_perfil" | "ugc_whitelabel";
type CalculationQuantities = NonNullable<NonNullable<MobileCalculatorResult["params"]>["formatQuantities"]>;

type MobileCalculatorWizardProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (calculation: MobileCalculatorResult) => void;
  latestCalculation?: MobileCalculatorResult | null;
  suggestedReach?: number | null;
  /** Mantido para compatibilidade com o shell; o intro não bloqueia mais este fluxo. */
  showPricingIntro?: boolean;
  /** Mantido para compatibilidade com o shell; o intro não bloqueia mais este fluxo. */
  onSavePricingProfile?: (data: { hasDoneSponsoredPosts?: string; pricingFear?: string }) => void;
};

const DEFAULT_QUANTITIES: Record<FormatKey, number> = { reels: 1, post: 0, stories: 0 };
const formatLabels: Record<FormatKey, string> = { reels: "Reels", post: "Post", stories: "Stories" };
const formatOrder: FormatKey[] = ["reels", "stories", "post"];
const wizardSteps: WizardStep[] = [0, 1, 2];
const stepCopy: Record<WizardStep, { title: string }> = {
  0: { title: "Entrega" },
  1: { title: "Condições da parceria" },
  2: { title: "Valor sugerido" },
};

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value)
    : "—";

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value)
    : null;

const formatPercentage = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value)}%`;

function deriveFormat(quantities: Record<FormatKey, number>) {
  const active = Object.entries(quantities).filter(([, quantity]) => quantity > 0);
  if (active.length === 1 && active[0]?.[1] === 1) return active[0][0];
  return "pacote";
}

function buildDeliverablesLabel(quantities: Record<FormatKey, number>) {
  const parts = formatOrder
    .map((key) => (quantities[key] > 0 ? `${quantities[key]} ${formatLabels[key]}` : null))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Nenhuma entrega";
}

function parseCurrencyInput(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "");
  const normalized = sanitized.includes(",")
    ? sanitized.replace(/\./g, "").replace(",", ".")
    : sanitized;
  return Number(normalized);
}

function isOption<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function normalizedQuantities(value: CalculationQuantities | undefined): Record<FormatKey, number> {
  return {
    reels: typeof value?.reels === "number" && value.reels >= 0 ? Math.min(20, value.reels) : DEFAULT_QUANTITIES.reels,
    post: typeof value?.post === "number" && value.post >= 0 ? Math.min(20, value.post) : DEFAULT_QUANTITIES.post,
    stories: typeof value?.stories === "number" && value.stories >= 0 ? Math.min(20, value.stories) : DEFAULT_QUANTITIES.stories,
  };
}

function labelForUsageRights(value: UsageRights) {
  if (value === "midiapaga") return "Mídia paga";
  if (value === "global") return "Uso global";
  return "Orgânico";
}

function WizardSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-zinc-100 pt-3.5 first:border-t-0 first:pt-0">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      {children}
    </section>
  );
}

function SegmentedChoice<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${disabled ? "opacity-45" : ""}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          className={
            value === option.value
              ? "rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed"
              : "rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors active:bg-zinc-50 disabled:cursor-not-allowed"
          }
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BooleanChoice({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <p className="text-[13px] font-medium text-zinc-800">{label}</p>
      <div className="flex rounded-full border border-zinc-200 p-0.5">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={!value ? "rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-semibold text-white" : "rounded-full px-3 py-1 text-[11px] font-semibold text-zinc-500"}
        >
          Não
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={value ? "rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-semibold text-white" : "rounded-full px-3 py-1 text-[11px] font-semibold text-zinc-500"}
        >
          Sim
        </button>
      </div>
    </div>
  );
}

export function MobileCalculatorWizard({ open, onClose, onSaved, latestCalculation, suggestedReach }: MobileCalculatorWizardProps) {
  const wasOpenRef = useRef(false);
  const [step, setStep] = useState<WizardStep>(0);
  const [quantities, setQuantities] = useState<Record<FormatKey, number>>(DEFAULT_QUANTITIES);
  const [brandSize, setBrandSize] = useState<BrandSize>("media");
  const [imageRisk, setImageRisk] = useState<Level>("medio");
  const [strategicGain, setStrategicGain] = useState<Level>("baixo");
  const [exclusivity, setExclusivity] = useState<Exclusivity>("nenhuma");
  const [usageRights, setUsageRights] = useState<UsageRights>("organico");
  const [paidMediaDuration, setPaidMediaDuration] = useState<MediaDuration>("30d");
  const [repostTikTok, setRepostTikTok] = useState(false);
  const [instagramCollab, setInstagramCollab] = useState(false);
  const [contentModel, setContentModel] = useState<ContentModel>("publicidade_perfil");
  const [result, setResult] = useState<MobileCalculatorResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalReference, setPersonalReference] = useState<PersonalPricingReference | null>(null);
  const [referenceValue, setReferenceValue] = useState("");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [isSavingReference, setIsSavingReference] = useState(false);

  const loadPersonalReference = async () => {
    try {
      const response = await fetch("/api/calculator/personal-reference", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar seu valor habitual.");
      const reference = payload?.reference;
      if (typeof reference?.valueBRL === "number") {
        setPersonalReference(reference as PersonalPricingReference);
        setReferenceValue(String(reference.valueBRL));
      } else {
        setPersonalReference(null);
        setReferenceValue("");
      }
    } catch (loadError) {
      setReferenceError(loadError instanceof Error ? loadError.message : "Não foi possível carregar seu valor habitual.");
    }
  };

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    // Salvar um cálculo atualiza `latestCalculation` no pai. A inicialização deve
    // acontecer apenas ao abrir o modal, nunca ao receber esse novo histórico.
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    const params = latestCalculation?.params;
    setStep(0);
    setError(null);
    setResult(null);
    setIsSubmitting(false);
    setReferenceError(null);
    setPersonalReference(null);
    setReferenceValue("");
    setQuantities(normalizedQuantities(params?.formatQuantities));
    setBrandSize(isOption(params?.brandSize, ["pequena", "media", "grande"] as const) ? params.brandSize : "media");
    setImageRisk(isOption(params?.imageRisk, ["baixo", "medio", "alto"] as const) ? params.imageRisk : "medio");
    setStrategicGain(isOption(params?.strategicGain, ["baixo", "medio", "alto"] as const) ? params.strategicGain : "baixo");
    setExclusivity(isOption(params?.exclusivity, ["nenhuma", "7d", "15d", "30d", "90d"] as const) ? params.exclusivity : "nenhuma");
    setUsageRights(isOption(params?.usageRights, ["organico", "midiapaga", "global"] as const) ? params.usageRights : "organico");
    setPaidMediaDuration(isOption(params?.paidMediaDuration, ["7d", "15d", "30d", "90d"] as const) ? params.paidMediaDuration : "30d");
    setRepostTikTok(Boolean(params?.repostTikTok));
    setInstagramCollab(Boolean(params?.instagramCollab));
    setContentModel(isOption(params?.contentModel, ["publicidade_perfil", "ugc_whitelabel"] as const) ? params.contentModel : "publicidade_perfil");
    void loadPersonalReference();
  }, [open, latestCalculation]);

  const hasDeliverables = useMemo(() => Object.values(quantities).some((quantity) => quantity > 0), [quantities]);
  const visibleResult = result ?? latestCalculation;
  const reachLabel = formatNumber(result?.metrics?.reach) ?? formatNumber(latestCalculation?.metrics?.reach) ?? formatNumber(suggestedReach);
  const hasCalculatedThisSession = result !== null;
  const currentStepCopy = stepCopy[step];

  if (!open) return null;

  const updateQuantity = (key: FormatKey, delta: number) => {
    setQuantities((previous) => ({ ...previous, [key]: Math.min(20, Math.max(0, previous[key] + delta)) }));
  };

  const savePersonalReference = async () => {
    const valueBRL = parseCurrencyInput(referenceValue);
    if (!Number.isFinite(valueBRL) || valueBRL <= 0 || valueBRL > 100000) {
      setReferenceError("Informe um valor entre R$ 0,01 e R$ 100.000.");
      return;
    }
    setIsSavingReference(true);
    setReferenceError(null);
    try {
      const response = await fetch("/api/calculator/personal-reference", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valueBRL }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.reference?.valueBRL !== "number") {
        throw new Error(payload?.error || "Não foi possível salvar seu valor habitual.");
      }
      setPersonalReference(payload.reference as PersonalPricingReference);
      setReferenceValue(String(payload.reference.valueBRL));
    } catch (saveError) {
      setReferenceError(saveError instanceof Error ? saveError.message : "Não foi possível salvar seu valor habitual.");
    } finally {
      setIsSavingReference(false);
    }
  };

  const removePersonalReference = async () => {
    setIsSavingReference(true);
    setReferenceError(null);
    try {
      const response = await fetch("/api/calculator/personal-reference", { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível remover seu valor habitual.");
      setPersonalReference(null);
      setReferenceValue("");
    } catch (removeError) {
      setReferenceError(removeError instanceof Error ? removeError.message : "Não foi possível remover seu valor habitual.");
    } finally {
      setIsSavingReference(false);
    }
  };

  const submitCalculation = async () => {
    if (!hasDeliverables || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setStep(2);
    try {
      const response = await fetch("/api/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: deriveFormat(quantities),
          deliveryType: "conteudo",
          formatQuantities: quantities,
          eventDetails: { durationHours: 4, travelTier: "local", hotelNights: 0 },
          eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
          exclusivity,
          usageRights,
          paidMediaDuration: usageRights === "organico" ? null : paidMediaDuration,
          repostTikTok,
          instagramCollab,
          brandSize,
          imageRisk,
          strategicGain,
          contentModel,
          allowStrategicWaiver: false,
          complexity: "simples",
          authority: "padrao",
          seasonality: "normal",
          periodDays: 90,
          explanation: "Calculadora mobile do Mapa Estratégico.",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Não foi possível calcular agora.");
      if (typeof payload?.justo !== "number" || typeof payload?.estrategico !== "number" || typeof payload?.premium !== "number") {
        throw new Error("Resposta inválida da calculadora.");
      }
      const saved = payload as MobileCalculatorResult;
      setResult(saved);
      onSaved(saved);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível calcular agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const close = () => {
    if (!isSubmitting) onClose();
  };

  const resultReference = visibleResult?.personalReference;
  const referenceImpact =
    resultReference?.applied && typeof resultReference.baseJusto === "number" && resultReference.baseJusto > 0 && typeof resultReference.adjustedJusto === "number"
      ? ((resultReference.adjustedJusto / resultReference.baseJusto) - 1) * 100
      : null;
  const referenceReason: Record<PersonalReferenceReason, string> = {
    applied: "Seu valor habitual foi considerado neste cálculo.",
    expired: "Seu valor habitual precisa ser confirmado novamente para influenciar o cálculo.",
    creator_calibrated: "Usamos seus fechamentos reais, que já são uma referência mais confiável.",
    feature_disabled: "Seu valor habitual não está ativo nesta sugestão.",
    not_configured: "Você ainda não informou um valor habitual.",
  };
  const methodLabel = visibleResult?.metrics?.reachMethod === "trimmed_mean" ? "média aparada" : visibleResult?.metrics?.reachMethod === "median" ? "mediana" : null;

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-zinc-950/35 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-calculator-wizard-title"
        className="flex max-h-[min(88dvh,700px)] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-2xl animate-in slide-in-from-bottom duration-300"
      >
        <header className="shrink-0 px-5 pb-3.5 pt-3.5">
          <div className="mx-auto mb-3 h-1 w-7 rounded-full bg-zinc-200" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-2.5">
              {step > 0 ? (
                <button
                  type="button"
                  aria-label="Voltar para a etapa anterior"
                  onClick={() => setStep((previous) => (previous - 1) as WizardStep)}
                  disabled={isSubmitting}
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-zinc-200 text-base leading-none text-zinc-700 disabled:opacity-40"
                >
                  ←
                </button>
              ) : null}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Etapa {step + 1} de {wizardSteps.length}</p>
                <h2 id="mobile-calculator-wizard-title" className="mt-0.5 text-[18px] font-bold leading-tight text-zinc-950">{currentStepCopy.title}</h2>
              </div>
            </div>
            <DiagnosticoCloseButton onClose={close} ariaLabel="Fechar calculadora" disabled={isSubmitting} edgeAlign />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1" aria-hidden="true">
            {wizardSteps.map((index) => <span key={index} className={index <= step ? "h-1 rounded-full bg-zinc-950" : "h-1 rounded-full bg-zinc-200"} />)}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1">
          {step === 0 ? (
            <div className="grid gap-3.5">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <p className="text-[11px] font-medium text-zinc-500">Alcance usado no cálculo</p>
                <p className="text-[13px] font-bold text-zinc-950">{reachLabel ? `${reachLabel} pessoas` : "Métricas do perfil"}</p>
              </div>
              <div className="divide-y divide-zinc-100 border-y border-zinc-100">
                {formatOrder.map((key) => (
                  <div key={key} className="flex min-h-12 items-center justify-between gap-3 py-2">
                    <p className="text-[14px] font-semibold text-zinc-900">{formatLabels[key]}</p>
                    <div className="flex items-center gap-3">
                      <button type="button" aria-label={`Remover ${formatLabels[key]}`} className="grid h-7 w-7 place-items-center rounded-full border border-zinc-200 text-xs text-zinc-600 disabled:opacity-40" onClick={() => updateQuantity(key, -1)} disabled={quantities[key] === 0}>−</button>
                      <span className="w-4 text-center text-[13px] font-semibold text-zinc-950">{quantities[key]}</span>
                      <button type="button" aria-label={`Adicionar ${formatLabels[key]}`} className="grid h-7 w-7 place-items-center rounded-full bg-zinc-950 text-xs text-white shadow-[0_8px_18px_rgba(24,24,27,0.14)]" onClick={() => updateQuantity(key, 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              {!hasDeliverables ? <p className="text-xs font-medium text-red-600">Selecione pelo menos uma entrega.</p> : null}
              <WizardSection label="Seu valor habitual">
                <p className="mb-3 text-[12px] leading-5 text-zinc-500">Quanto você normalmente fecha por um Reel orgânico padrão? É opcional.</p>
                <div className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center rounded-xl border border-zinc-200 bg-white px-3 focus-within:border-zinc-950">
                    <span className="mr-1 text-[13px] font-semibold text-zinc-500">R$</span>
                    <input aria-label="Valor habitual por Reel orgânico" inputMode="decimal" placeholder="Ex.: 1.500" value={referenceValue} onChange={(event) => setReferenceValue(event.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-zinc-950 outline-none placeholder:font-normal placeholder:text-zinc-400" />
                  </label>
                  <button type="button" onClick={savePersonalReference} disabled={isSavingReference || !referenceValue.trim()} className="h-10 rounded-full bg-zinc-950 px-4 text-[12px] font-semibold text-white disabled:opacity-40">
                    {isSavingReference ? "Salvando" : personalReference ? "Salvar" : "Adicionar"}
                  </button>
                </div>
                {personalReference ? (
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-zinc-500">
                    <span>Confirmado {personalReference.confirmedAt ? new Date(personalReference.confirmedAt).toLocaleDateString("pt-BR") : "recentemente"}.</span>
                    <button type="button" onClick={removePersonalReference} disabled={isSavingReference} className="font-semibold text-zinc-700 underline underline-offset-2 disabled:opacity-40">Remover</button>
                  </div>
                ) : null}
                {referenceError ? <p className="mt-2 text-[11px] font-medium text-red-600">{referenceError}</p> : null}
              </WizardSection>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-3.5">
              <p className="text-[12px] leading-5 text-zinc-500">Esses itens ajustam seu valor sugerido.</p>
              <WizardSection label="Uso pela marca">
                <SegmentedChoice value={usageRights} onChange={setUsageRights} options={[{ value: "organico", label: "Orgânico" }, { value: "midiapaga", label: "Mídia paga" }, { value: "global", label: "Uso global" }]} />
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between gap-3"><p className="text-[11px] font-medium text-zinc-600">Duração de uso</p>{usageRights === "organico" ? <span className="text-[10px] text-zinc-400">Só para mídia paga ou global</span> : null}</div>
                  <SegmentedChoice value={paidMediaDuration} onChange={setPaidMediaDuration} disabled={usageRights === "organico"} options={[{ value: "7d", label: "7 dias" }, { value: "15d", label: "15 dias" }, { value: "30d", label: "30 dias" }, { value: "90d", label: "90 dias" }]} />
                </div>
              </WizardSection>
              <WizardSection label="Exclusividade">
                <SegmentedChoice value={exclusivity} onChange={setExclusivity} options={[{ value: "nenhuma", label: "Sem" }, { value: "7d", label: "7 dias" }, { value: "15d", label: "15 dias" }, { value: "30d", label: "30 dias" }, { value: "90d", label: "90 dias" }]} />
              </WizardSection>
              <WizardSection label="Distribuição">
                <div className="divide-y divide-zinc-100">
                  <BooleanChoice label="Collab no Instagram" value={instagramCollab} onChange={setInstagramCollab} />
                  <BooleanChoice label="Repost no TikTok" value={repostTikTok} onChange={setRepostTikTok} />
                  <BooleanChoice label="UGC para perfil da marca" value={contentModel === "ugc_whitelabel"} onChange={(value) => setContentModel(value ? "ugc_whitelabel" : "publicidade_perfil")} />
                </div>
              </WizardSection>
              <WizardSection label="Contexto">
                <div className="grid gap-3">
                  <div><p className="mb-2 text-[11px] font-medium text-zinc-600">Porte da marca</p><SegmentedChoice value={brandSize} onChange={setBrandSize} options={[{ value: "pequena", label: "Pequena" }, { value: "media", label: "Média" }, { value: "grande", label: "Grande" }]} /></div>
                  <div><p className="mb-2 text-[11px] font-medium text-zinc-600">Risco de imagem</p><SegmentedChoice value={imageRisk} onChange={setImageRisk} options={[{ value: "baixo", label: "Baixo" }, { value: "medio", label: "Médio" }, { value: "alto", label: "Alto" }]} /></div>
                  <div><p className="mb-2 text-[11px] font-medium text-zinc-600">Ganho estratégico</p><SegmentedChoice value={strategicGain} onChange={setStrategicGain} options={[{ value: "baixo", label: "Baixo" }, { value: "medio", label: "Médio" }, { value: "alto", label: "Alto" }]} /></div>
                </div>
              </WizardSection>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              {isSubmitting ? (
                <div className="bg-zinc-950 px-5 py-6 text-white">
                  <div className="flex items-center gap-3"><svg className="h-5 w-5 animate-spin text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><p className="text-sm font-semibold">Calculando sua faixa</p></div>
                  <p className="mt-3 text-sm leading-6 text-white/55">Combinando métricas, escopo e contexto comercial.</p>
                </div>
              ) : error ? (
                <div className="border border-red-100 bg-red-50 p-4"><p className="text-sm font-semibold text-red-700">Não foi possível calcular</p><p className="mt-2 text-sm leading-6 text-red-600">{error}</p></div>
              ) : visibleResult ? (
                <div>
                  <p className="text-[12px] font-medium text-zinc-500">Para {buildDeliverablesLabel(quantities)} · {labelForUsageRights(usageRights)} · marca {brandSize}</p>
                  <div className="mt-5 border-y border-zinc-100 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Mínimo</p><p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{formatCurrency(visibleResult.estrategico)}</p></div>
                  <div className="bg-zinc-950 px-5 py-5 text-white"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">Justo</p><p className="mt-1 text-3xl font-semibold tracking-tight">{formatCurrency(visibleResult.justo)}</p><p className="mt-1 text-[12px] font-medium text-white/65">Valor recomendado</p></div>
                  <div className="border-b border-zinc-100 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Máximo</p><p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{formatCurrency(visibleResult.premium)}</p></div>
                  <div className="mt-4 grid gap-2 border-t border-zinc-100 pt-3 text-[11px] leading-5 text-zinc-500">
                    {reachLabel ? <p>Alcance considerado: <span className="font-semibold text-zinc-700">{reachLabel} pessoas</span>{methodLabel ? ` · ${methodLabel}` : ""}{visibleResult.metrics?.reachSampleSize ? ` · ${visibleResult.metrics.reachSampleSize} conteúdos` : ""}.</p> : null}
                    {visibleResult.metrics?.reachConfidence === "baixa" ? <p className="text-amber-700">A amostra de alcance ainda é pequena; sincronize ou publique mais conteúdos para aumentar a confiança.</p> : null}
                    {visibleResult.metrics?.reachFollowerAlert ? <p className="text-amber-700">Seu alcance típico está bem acima dos seguidores. Confirme se ele continua consistente.</p> : null}
                    {resultReference ? <p>{referenceReason[resultReference.reason ?? "not_configured"]}{referenceImpact !== null ? ` Impacto: ${formatPercentage(referenceImpact)}.` : ""}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </main>

        <footer className="shrink-0 border-t border-zinc-100 bg-white px-5 pb-5 pt-3">
          {step === 0 ? <button type="button" className="h-11 w-full rounded-full bg-zinc-950 px-5 text-[13px] font-semibold text-white disabled:opacity-40" onClick={() => setStep(1)} disabled={!hasDeliverables}>Continuar</button> : null}
          {step === 1 ? <button type="button" className="h-11 w-full rounded-full bg-zinc-950 px-5 text-[13px] font-semibold text-white disabled:opacity-40" onClick={submitCalculation} disabled={!hasDeliverables || isSubmitting}>{hasCalculatedThisSession ? "Atualizar valor" : "Ver meu valor"}</button> : null}
          {step === 2 ? <button type="button" className="h-11 w-full rounded-full bg-zinc-950 px-5 text-[13px] font-semibold text-white disabled:opacity-40" onClick={error ? submitCalculation : close} disabled={isSubmitting}>{error ? "Tentar de novo" : "Concluir"}</button> : null}
        </footer>
      </section>
    </div>
  );
}
