"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DiagnosticoCloseButton } from "./DiagnosticoCloseButton";

type PersonalReferenceReason = "not_configured" | "expired" | "creator_calibrated" | "creator_opted_out" | "feature_disabled" | "applied";
type PersonalReferenceChoice = "use" | "skip" | null;

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
    canonicalJusto?: number | null;
    factorApplied?: number | null;
    weightApplied?: number;
    baseJusto?: number;
    adjustedJusto?: number;
  };
  params?: {
    format?: string;
    deliveryType?: string;
    formatQuantities?: { reels?: number; post?: number; stories?: number };
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
    usePersonalReference?: boolean;
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
type WizardStep = 0 | 1 | 2 | 3 | 4;
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
  showPricingIntro?: boolean;
  onSavePricingProfile?: (data: { hasDoneSponsoredPosts?: string; pricingFear?: string }) => void;
};

const DEFAULT_QUANTITIES: Record<FormatKey, number> = { reels: 1, post: 0, stories: 0 };
const formatLabels: Record<FormatKey, string> = { reels: "Reels", post: "Post", stories: "Stories" };
const formatOrder: FormatKey[] = ["reels", "stories", "post"];
const wizardSteps: WizardStep[] = [0, 1, 2, 3, 4];
const stepCopy: Record<WizardStep, { title: string }> = {
  0: { title: "Entrega" },
  1: { title: "Uso e proteção" },
  2: { title: "Contexto da parceria" },
  3: { title: "Seu histórico de preço" },
  4: { title: "Valor sugerido" },
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
  return active.length === 1 && active[0]?.[1] === 1 ? active[0][0] : "pacote";
}

function buildDeliverablesLabel(quantities: Record<FormatKey, number>) {
  const parts = formatOrder
    .map((key) => (quantities[key] > 0 ? `${quantities[key]} ${formatLabels[key]}` : null))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Nenhuma entrega";
}

function parseCurrencyInput(value: string) {
  const sanitized = value.replace(/[^\d,.-]/g, "");
  const normalized = sanitized.includes(",") ? sanitized.replace(/\./g, "").replace(",", ".") : sanitized;
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
    <section className="border-t border-zinc-100 pt-4 first:border-t-0 first:pt-0">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      {children}
    </section>
  );
}

function SegmentedChoice<T extends string>({ options, value, onChange, disabled = false }: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${disabled ? "opacity-45" : ""}`}>
      {options.map((option) => (
        <button key={option.value} type="button" disabled={disabled} onClick={() => onChange(option.value)} className={
          value === option.value
            ? "min-h-10 rounded-full bg-zinc-950 px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed"
            : "min-h-10 rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-700 active:bg-zinc-50 disabled:cursor-not-allowed"
        }>{option.label}</button>
      ))}
    </div>
  );
}

function BooleanChoice({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3">
      <p className="text-[14px] font-medium text-zinc-800">{label}</p>
      <div className="flex rounded-full border border-zinc-200 p-0.5">
        <button type="button" onClick={() => onChange(false)} className={!value ? "min-h-8 rounded-full bg-zinc-950 px-3.5 text-[12px] font-semibold text-white" : "min-h-8 rounded-full px-3.5 text-[12px] font-semibold text-zinc-500"}>Não</button>
        <button type="button" onClick={() => onChange(true)} className={value ? "min-h-8 rounded-full bg-zinc-950 px-3.5 text-[12px] font-semibold text-white" : "min-h-8 rounded-full px-3.5 text-[12px] font-semibold text-zinc-500"}>Sim</button>
      </div>
    </div>
  );
}

function HistoryChoice({ selected, title, detail, onClick }: { selected: boolean; title: string; detail: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={selected
      ? "w-full border border-zinc-950 bg-zinc-950 px-4 py-3.5 text-left text-white"
      : "w-full border border-zinc-200 bg-white px-4 py-3.5 text-left text-zinc-900 active:bg-zinc-50"}>
      <span className="flex items-center justify-between gap-3 text-[14px] font-semibold"><span>{title}</span><span className={selected ? "text-white" : "text-zinc-400"}>{selected ? "✓" : ""}</span></span>
      <span className={selected ? "mt-1 block text-[12px] leading-5 text-white/65" : "mt-1 block text-[12px] leading-5 text-zinc-500"}>{detail}</span>
    </button>
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
  const [historyChoice, setHistoryChoice] = useState<PersonalReferenceChoice>(null);
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
      if (typeof payload?.reference?.valueBRL === "number") {
        setPersonalReference(payload.reference as PersonalPricingReference);
        setReferenceValue(String(payload.reference.valueBRL));
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
    setHistoryChoice(null);
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
  const currentStepCopy = stepCopy[step];
  const canUseHistory = historyChoice === "skip" || (historyChoice === "use" && personalReference !== null);

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
      if (!response.ok || typeof payload?.reference?.valueBRL !== "number") throw new Error(payload?.error || "Não foi possível salvar seu valor habitual.");
      setPersonalReference(payload.reference as PersonalPricingReference);
      setReferenceValue(String(payload.reference.valueBRL));
      setHistoryChoice("use");
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
      setHistoryChoice(null);
    } catch (removeError) {
      setReferenceError(removeError instanceof Error ? removeError.message : "Não foi possível remover seu valor habitual.");
    } finally {
      setIsSavingReference(false);
    }
  };

  const submitCalculation = async () => {
    if (!hasDeliverables || !canUseHistory || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setStep(4);
    try {
      const response = await fetch("/api/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: deriveFormat(quantities), deliveryType: "conteudo", formatQuantities: quantities,
          eventDetails: { durationHours: 4, travelTier: "local", hotelNights: 0 },
          eventCoverageQuantities: { reels: 0, post: 0, stories: 0 },
          exclusivity, usageRights, paidMediaDuration: usageRights === "organico" ? null : paidMediaDuration,
          repostTikTok, instagramCollab, brandSize, imageRisk, strategicGain, contentModel,
          usePersonalReference: historyChoice === "use", allowStrategicWaiver: false,
          complexity: "simples", authority: "padrao", seasonality: "normal", periodDays: 90,
          explanation: "Calculadora mobile do Mapa Estratégico.", source: "mobile_board",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Não foi possível calcular agora.");
      if (typeof payload?.justo !== "number" || typeof payload?.estrategico !== "number" || typeof payload?.premium !== "number") throw new Error("Resposta inválida da calculadora.");
      const saved = payload as MobileCalculatorResult;
      setResult(saved);
      onSaved(saved);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível calcular agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const close = () => { if (!isSubmitting) onClose(); };
  const resultReference = visibleResult?.personalReference;
  const referenceImpact = resultReference?.applied && typeof resultReference.baseJusto === "number" && resultReference.baseJusto > 0 && typeof resultReference.adjustedJusto === "number"
    ? ((resultReference.adjustedJusto / resultReference.baseJusto) - 1) * 100 : null;
  const referenceEquivalent = resultReference?.applied && typeof resultReference.referenceValueBRL === "number" && typeof resultReference.canonicalJusto === "number" && resultReference.canonicalJusto > 0 && typeof resultReference.baseJusto === "number"
    ? resultReference.referenceValueBRL * (resultReference.baseJusto / resultReference.canonicalJusto) : null;
  const referenceReason: Record<PersonalReferenceReason, string> = {
    applied: "Seu valor habitual foi considerado nesta sugestão.",
    expired: "Seu valor habitual precisa ser confirmado novamente para influenciar o cálculo.",
    creator_calibrated: "Usamos seus fechamentos reais, que já são uma referência mais confiável.",
    creator_opted_out: "Você escolheu usar apenas métricas e escopo nesta proposta.",
    feature_disabled: "Seu valor habitual não está ativo nesta sugestão.",
    not_configured: "Você ainda não informou um valor habitual.",
  };
  const methodLabel = visibleResult?.metrics?.reachMethod === "trimmed_mean" ? "média aparada" : visibleResult?.metrics?.reachMethod === "median" ? "mediana" : null;

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center ds-scrim">
      <section role="dialog" aria-modal="true" aria-labelledby="mobile-calculator-wizard-title" className="ds-sheet ds-enter-sheet flex max-h-[min(92dvh,740px)] flex-col overflow-hidden">
        <header className="shrink-0 px-5 pb-3.5 pt-3.5">
          <div className="ds-sheet__handle !mt-0 mb-3" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-2.5">
              {step > 0 ? <button type="button" aria-label="Voltar para a etapa anterior" onClick={() => setStep((previous) => (previous - 1) as WizardStep)} disabled={isSubmitting} className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-zinc-200 text-base leading-none text-zinc-700 disabled:opacity-40">←</button> : null}
              <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Etapa {step + 1} de {wizardSteps.length}</p><h2 id="mobile-calculator-wizard-title" className="mt-0.5 font-display text-[1.45rem] font-bold leading-[1.05] tracking-[-0.03em] text-zinc-950">{currentStepCopy.title}</h2></div>
            </div>
            <DiagnosticoCloseButton onClose={close} ariaLabel="Fechar calculadora" disabled={isSubmitting} edgeAlign />
          </div>
          <div className="mt-3 grid grid-cols-5 gap-1" aria-hidden="true">{wizardSteps.map((index) => <span key={index} className={index <= step ? "h-1 rounded-full bg-[var(--ds-color-brand)]" : "h-1 rounded-full bg-zinc-200"} />)}</div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-1">
          {step === 0 ? <div className="grid gap-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3"><p className="text-[11px] font-medium text-zinc-500">Alcance usado no cálculo</p><p className="text-[13px] font-bold text-zinc-950">{reachLabel ? `${reachLabel} pessoas` : "Métricas do perfil"}</p></div>
            <div className="divide-y divide-zinc-100 border-y border-zinc-100">{formatOrder.map((key) => <div key={key} className="flex min-h-14 items-center justify-between gap-3 py-2"><p className="text-[15px] font-semibold text-zinc-900">{formatLabels[key]}</p><div className="flex items-center gap-3"><button type="button" aria-label={`Remover ${formatLabels[key]}`} className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 text-sm text-zinc-600 disabled:opacity-40" onClick={() => updateQuantity(key, -1)} disabled={quantities[key] === 0}>−</button><span className="w-4 text-center text-[14px] font-semibold text-zinc-950">{quantities[key]}</span><button type="button" aria-label={`Adicionar ${formatLabels[key]}`} className="grid h-8 w-8 place-items-center rounded-full bg-zinc-950 text-sm text-white" onClick={() => updateQuantity(key, 1)}>+</button></div></div>)}</div>
            {!hasDeliverables ? <p className="text-xs font-medium text-red-600">Selecione pelo menos uma entrega.</p> : null}
          </div> : null}

          {step === 1 ? <div className="grid gap-4">
            <p className="text-[12px] leading-5 text-zinc-500">Defina como a marca pode usar seu conteúdo e imagem.</p>
            <WizardSection label="Uso pela marca"><SegmentedChoice value={usageRights} onChange={setUsageRights} options={[{ value: "organico", label: "Orgânico" }, { value: "midiapaga", label: "Mídia paga" }, { value: "global", label: "Uso global" }]} /><div className="mt-4"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-[11px] font-medium text-zinc-600">Duração de uso</p>{usageRights === "organico" ? <span className="text-[10px] text-zinc-400">Só para mídia paga ou global</span> : null}</div><SegmentedChoice value={paidMediaDuration} onChange={setPaidMediaDuration} disabled={usageRights === "organico"} options={[{ value: "7d", label: "7 dias" }, { value: "15d", label: "15 dias" }, { value: "30d", label: "30 dias" }, { value: "90d", label: "90 dias" }]} /></div></WizardSection>
            <WizardSection label="Exclusividade"><SegmentedChoice value={exclusivity} onChange={setExclusivity} options={[{ value: "nenhuma", label: "Sem" }, { value: "7d", label: "7 dias" }, { value: "15d", label: "15 dias" }, { value: "30d", label: "30 dias" }, { value: "90d", label: "90 dias" }]} /></WizardSection>
          </div> : null}

          {step === 2 ? <div className="grid gap-4">
            <p className="text-[12px] leading-5 text-zinc-500">Considere a marca e como o conteúdo será distribuído.</p>
            <WizardSection label="Distribuição"><div className="divide-y divide-zinc-100"><BooleanChoice label="Collab no Instagram" value={instagramCollab} onChange={setInstagramCollab} /><BooleanChoice label="Repost no TikTok" value={repostTikTok} onChange={setRepostTikTok} /><BooleanChoice label="UGC para perfil da marca" value={contentModel === "ugc_whitelabel"} onChange={(value) => setContentModel(value ? "ugc_whitelabel" : "publicidade_perfil")} /></div></WizardSection>
            <WizardSection label="Contexto"><div className="grid gap-4"><div><p className="mb-2 text-[11px] font-medium text-zinc-600">Porte da marca</p><SegmentedChoice value={brandSize} onChange={setBrandSize} options={[{ value: "pequena", label: "Pequena" }, { value: "media", label: "Média" }, { value: "grande", label: "Grande" }]} /></div><div><p className="mb-2 text-[11px] font-medium text-zinc-600">Risco de imagem</p><SegmentedChoice value={imageRisk} onChange={setImageRisk} options={[{ value: "baixo", label: "Baixo" }, { value: "medio", label: "Médio" }, { value: "alto", label: "Alto" }]} /></div><div><p className="mb-2 text-[11px] font-medium text-zinc-600">Ganho estratégico</p><SegmentedChoice value={strategicGain} onChange={setStrategicGain} options={[{ value: "baixo", label: "Baixo" }, { value: "medio", label: "Médio" }, { value: "alto", label: "Alto" }]} /></div></div></WizardSection>
          </div> : null}

          {step === 3 ? <div className="grid gap-4">
            <div><p className="text-[14px] font-semibold text-zinc-950">Você já tem um valor habitual?</p><p className="mt-1 text-[12px] leading-5 text-zinc-500">Ele é uma referência pessoal; direitos e contexto continuam sendo calculados.</p></div>
            <div className="grid gap-2"><HistoryChoice selected={historyChoice === "use"} title={personalReference ? "Usar meu valor habitual" : "Adicionar valor habitual"} detail={personalReference ? `${formatCurrency(personalReference.valueBRL)} por 1 Reel orgânico` : "Informe quanto costuma fechar por 1 Reel orgânico."} onClick={() => setHistoryChoice("use")} /><HistoryChoice selected={historyChoice === "skip"} title="Prefiro só a sugestão" detail="Use somente métricas, escopo e contexto desta proposta." onClick={() => setHistoryChoice("skip")} /></div>
            {historyChoice === "use" ? <WizardSection label="Seu valor por Reel orgânico"><p className="mb-3 text-[12px] leading-5 text-zinc-500">Essa referência fica salva no seu perfil para propostas futuras.</p><div className="flex items-center gap-2"><label className="flex min-w-0 flex-1 items-center border border-zinc-200 bg-white px-3 focus-within:border-zinc-950"><span className="mr-1 text-[13px] font-semibold text-zinc-500">R$</span><input aria-label="Valor habitual por Reel orgânico" inputMode="decimal" placeholder="Ex.: 1.500" value={referenceValue} onChange={(event) => setReferenceValue(event.target.value)} className="h-11 min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-zinc-950 outline-none placeholder:font-normal placeholder:text-zinc-400" /></label><button type="button" onClick={savePersonalReference} disabled={isSavingReference || !referenceValue.trim()} className="h-11 bg-zinc-950 px-4 text-[12px] font-semibold text-white disabled:opacity-40">{isSavingReference ? "Salvando" : personalReference ? "Salvar" : "Adicionar"}</button></div>{personalReference ? <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-zinc-500"><span>Confirmado {personalReference.confirmedAt ? new Date(personalReference.confirmedAt).toLocaleDateString("pt-BR") : "recentemente"}.</span><button type="button" onClick={removePersonalReference} disabled={isSavingReference} className="font-semibold text-zinc-700 underline underline-offset-2 disabled:opacity-40">Remover</button></div> : null}{referenceError ? <p className="mt-2 text-[11px] font-medium text-red-600">{referenceError}</p> : null}</WizardSection> : null}
          </div> : null}

          {step === 4 ? <div>
            {isSubmitting ? <div className="bg-zinc-950 px-5 py-6 text-white"><div className="flex items-center gap-3"><svg className="h-5 w-5 animate-spin text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg><p className="text-sm font-semibold">Calculando sua faixa</p></div><p className="mt-3 text-sm leading-6 text-white/55">Combinando métricas, escopo, contexto e seu histórico.</p></div> : error ? <div className="border border-red-100 bg-red-50 p-4"><p className="text-sm font-semibold text-red-700">Não foi possível calcular</p><p className="mt-2 text-sm leading-6 text-red-600">{error}</p></div> : visibleResult ? <div>
              <p className="text-[12px] font-medium text-zinc-500">Para {buildDeliverablesLabel(quantities)} · {labelForUsageRights(usageRights)} · marca {brandSize}</p>
              <div className="mt-5 border-y border-zinc-100 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Mínimo</p><p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{formatCurrency(visibleResult.estrategico)}</p></div><div className="bg-zinc-950 px-5 py-5 text-white"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">Justo</p><p className="mt-1 text-3xl font-semibold tracking-tight">{formatCurrency(visibleResult.justo)}</p><p className="mt-1 text-[12px] font-medium text-white/65">Valor recomendado</p></div><div className="border-b border-zinc-100 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Máximo</p><p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">{formatCurrency(visibleResult.premium)}</p></div>
              <div className="mt-4 grid gap-2 border-t border-zinc-100 pt-3 text-[11px] leading-5 text-zinc-500">{reachLabel ? <p>Alcance considerado: <span className="font-semibold text-zinc-700">{reachLabel} pessoas</span>{methodLabel ? ` · ${methodLabel}` : ""}{visibleResult.metrics?.reachSampleSize ? ` · ${visibleResult.metrics.reachSampleSize} conteúdos` : ""}.</p> : null}{visibleResult.metrics?.reachConfidence === "baixa" ? <p className="text-amber-700">A amostra de alcance ainda é pequena; sincronize ou publique mais conteúdos para aumentar a confiança.</p> : null}{visibleResult.metrics?.reachFollowerAlert ? <p className="text-amber-700">Seu alcance típico está bem acima dos seguidores. Confirme se ele continua consistente.</p> : null}</div>
              {resultReference ? <div className="mt-4 border-t border-zinc-100 pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Como seu histórico entrou nesta sugestão</p>{resultReference.applied && resultReference.referenceValueBRL !== null ? <div className="mt-2 text-[12px] leading-5 text-zinc-600"><p>Você costuma fechar <span className="font-semibold text-zinc-900">{formatCurrency(resultReference.referenceValueBRL)}</span> por 1 Reel orgânico.</p>{referenceEquivalent !== null ? <p>Para esta proposta, essa referência equivale a cerca de <span className="font-semibold text-zinc-900">{formatCurrency(referenceEquivalent)}</span>.</p> : null}{referenceImpact !== null ? <p className="font-medium text-zinc-800">Ela ajustou seu valor sugerido em {formatPercentage(referenceImpact)}.</p> : null}</div> : <p className="mt-2 text-[12px] leading-5 text-zinc-600">{referenceReason[resultReference.reason ?? "not_configured"]}</p>}</div> : null}
            </div> : null}
          </div> : null}
        </main>

        <footer className="shrink-0 border-t border-zinc-100 bg-white px-5 pb-5 pt-3">
          {step < 3 ? <button type="button" className="ds-button ds-button--primary ds-button--block" onClick={() => setStep((previous) => (previous + 1) as WizardStep)} disabled={step === 0 && !hasDeliverables}>Continuar</button> : null}
          {step === 3 ? <button type="button" className="ds-button ds-button--primary ds-button--block" onClick={submitCalculation} disabled={!hasDeliverables || !canUseHistory || isSubmitting}>Ver meu valor</button> : null}
          {step === 4 ? <button type="button" className="ds-button ds-button--primary ds-button--block" onClick={error ? submitCalculation : close} disabled={isSubmitting}>{error ? "Tentar de novo" : "Concluir"}</button> : null}
        </footer>
      </section>
    </div>
  );
}
