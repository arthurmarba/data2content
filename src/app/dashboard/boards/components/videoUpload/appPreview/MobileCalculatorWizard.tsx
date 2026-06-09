"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DiagnosticoCloseButton } from "./DiagnosticoCloseButton";
import { SAFE_TOP } from "./diagnosticoTokens";

export type MobileCalculatorResult = {
  estrategico: number;
  justo: number;
  premium: number;
  breakdown?: Record<string, unknown>;
  cpm?: number;
  cpmSource?: string;
  calibration?: Record<string, unknown>;
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
  };
  avgTicket?: number | null;
  totalDeals?: number;
  calculationId?: string;
  explanation?: string | null;
  createdAt?: string;
};

type FormatKey = "reels" | "post" | "stories";
type WizardStep = 0 | 1 | 2 | 3;

type MobileCalculatorWizardProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (calculation: MobileCalculatorResult) => void;
  latestCalculation?: MobileCalculatorResult | null;
  suggestedReach?: number | null;
  /** Fase 3 — exibe o intro de contexto de pricing antes do wizard (1ª abertura). */
  showPricingIntro?: boolean;
  /** Fase 3 — salva as respostas do intro de pricing. */
  onSavePricingProfile?: (data: { hasDoneSponsoredPosts?: string; pricingFear?: string }) => void;
};

const MONETIZATION_OPTIONS = [
  { value: "varias", label: "Sim, com frequência" },
  { value: "poucas", label: "Já fiz algumas" },
  { value: "nunca-quero", label: "Nunca, mas quero começar" },
  { value: "nunca-sem-interesse", label: "Nunca, e sem pressa" },
] as const;

const PRICING_FEAR_OPTIONS = [
  { value: "caro", label: "Cobrar caro demais" },
  { value: "barato", label: "Cobrar barato demais" },
  { value: "justificar", label: "Não saber justificar o preço" },
  { value: "amador", label: "Parecer amador" },
] as const;

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(value)
    : "—";

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value)
    : null;

const formatLabels: Record<FormatKey, string> = {
  reels: "Reels",
  post: "Post",
  stories: "Stories",
};

const formatOrder: FormatKey[] = ["reels", "stories", "post"];
const wizardSteps: WizardStep[] = [0, 1, 2, 3];
const stepCopy: Record<WizardStep, { title: string }> = {
  0: { title: "Pacote" },
  1: { title: "Uso pela marca" },
  2: { title: "Contexto comercial" },
  3: { title: "Resultado" },
};

function deriveFormat(quantities: Record<FormatKey, number>) {
  const active = Object.entries(quantities).filter(([, qty]) => qty > 0);
  if (active.length === 1 && active[0]?.[1] === 1) return active[0][0];
  return "pacote";
}

function buildDeliverablesLabel(quantities: Record<FormatKey, number>) {
  const parts = formatOrder
    .map((key) => {
      const qty = quantities[key];
      return qty > 0 ? `${qty} ${formatLabels[key]}` : null;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" + ") : "Nenhuma entrega";
}

const labelForUsageRights = (value: "organico" | "midiapaga" | "global") => {
  if (value === "midiapaga") return "Mídia paga";
  if (value === "global") return "Uso global";
  return "Orgânico";
};

const labelForExclusivity = (value: "nenhuma" | "7d" | "15d" | "30d" | "90d") =>
  value === "nenhuma" ? "Sem exclusividade" : `Exclusivo ${value}`;

const labelForBrandSize = (value: "pequena" | "media" | "grande") => {
  if (value === "pequena") return "Marca pequena";
  if (value === "grande") return "Marca grande";
  return "Marca média";
};

const labelForStrategicGain = (value: "baixo" | "medio" | "alto") => {
  if (value === "alto") return "Ganho alto";
  if (value === "medio") return "Ganho médio";
  return "Ganho baixo";
};

function WizardSection({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-zinc-100 pt-4 first:border-t-0 first:pt-0">
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        {helper ? <p className="mt-1 text-[11px] leading-4 text-zinc-500">{helper}</p> : null}
      </div>
      {children}
    </div>
  );
}

function SegmentedChoice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            value === option.value
              ? "rounded-full bg-zinc-950 px-3.5 py-1.5 text-xs font-semibold text-white"
              : "rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700"
          }
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ToggleTile({
  selected,
  title,
  detail,
  onClick,
}: {
  selected: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={
        selected
          ? "rounded-[14px] border border-zinc-950 bg-zinc-950 px-3.5 py-2.5 text-left text-white"
          : "rounded-[14px] border border-zinc-200 bg-white px-3.5 py-2.5 text-left text-zinc-800"
      }
      onClick={onClick}
    >
      <span className="flex items-center justify-between gap-3 text-[13px] font-semibold">
        {title}
        <span className={selected ? "rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/75" : "rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-400"}>
          {selected ? "Ligado" : "Inativo"}
        </span>
      </span>
      <span className={selected ? "mt-0.5 block text-[11px] text-white/60" : "mt-0.5 block text-[11px] text-zinc-500"}>
        {detail}
      </span>
    </button>
  );
}

export function MobileCalculatorWizard({
  open,
  onClose,
  onSaved,
  latestCalculation,
  suggestedReach,
  showPricingIntro = false,
  onSavePricingProfile,
}: MobileCalculatorWizardProps) {
  const [showingIntro, setShowingIntro] = useState(false);
  const [introMonetization, setIntroMonetization] = useState<string>("");
  const [introFear, setIntroFear] = useState<string>("");
  const [step, setStep] = useState<WizardStep>(0);
  const [quantities, setQuantities] = useState<Record<FormatKey, number>>({
    reels: 1,
    post: 0,
    stories: 3,
  });
  const [brandSize, setBrandSize] = useState<"pequena" | "media" | "grande">("media");
  const [imageRisk, setImageRisk] = useState<"baixo" | "medio" | "alto">("medio");
  const [strategicGain, setStrategicGain] = useState<"baixo" | "medio" | "alto">("baixo");
  const [exclusivity, setExclusivity] = useState<"nenhuma" | "7d" | "15d" | "30d" | "90d">("nenhuma");
  const [usageRights, setUsageRights] = useState<"organico" | "midiapaga" | "global">("organico");
  const [paidMediaDuration, setPaidMediaDuration] = useState<"7d" | "15d" | "30d" | "90d">("30d");
  const [repostTikTok, setRepostTikTok] = useState(false);
  const [instagramCollab, setInstagramCollab] = useState(false);
  const [contentModel, setContentModel] = useState<"publicidade_perfil" | "ugc_whitelabel">("publicidade_perfil");
  const [result, setResult] = useState<MobileCalculatorResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setError(null);
    setResult(null);
    setIsSubmitting(false);
    // Fase 3 — intro de pricing só na 1ª abertura e se não foi dispensado nesta sessão.
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem("d2c_pricing_intro_dismissed") === "1";
    } catch {
      // sessionStorage indisponível — segue mostrando o intro se aplicável.
    }
    setShowingIntro(showPricingIntro && !dismissed);
    setIntroMonetization("");
    setIntroFear("");
  }, [open, showPricingIntro]);

  const hasDeliverables = useMemo(
    () => Object.values(quantities).some((qty) => qty > 0),
    [quantities],
  );

  if (!open) return null;

  const dismissIntro = () => {
    try {
      sessionStorage.setItem("d2c_pricing_intro_dismissed", "1");
    } catch {
      // ignore
    }
    setShowingIntro(false);
  };

  const finishIntro = () => {
    if (introMonetization || introFear) {
      onSavePricingProfile?.({
        hasDoneSponsoredPosts: introMonetization || undefined,
        pricingFear: introFear || undefined,
      });
    }
    dismissIntro();
  };

  if (showingIntro) {
    return (
      <div className="fixed inset-0 z-[260] flex flex-col bg-white" style={{ paddingTop: SAFE_TOP }}>
        <div className="flex shrink-0 items-center justify-between px-5 pt-4 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            Antes de calcular
          </p>
          <DiagnosticoCloseButton onClose={onClose} edgeAlign />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-4">
          <h2 className="mb-2 text-[1.5rem] font-bold leading-tight tracking-tight text-zinc-950" style={{ textWrap: "balance" } as React.CSSProperties}>
            Duas perguntas rápidas sobre publis
          </h2>
          <p className="mb-7 text-[13px] font-medium leading-relaxed text-zinc-500">
            Ajuda o seu mapa a calibrar as sugestões de valor. Pode pular.
          </p>

          <p className="mb-3 text-[14px] font-semibold text-zinc-800">Você já fez publi paga?</p>
          <div className="mb-7 flex flex-col gap-2.5">
            {MONETIZATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntroMonetization(opt.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-[14px] font-medium transition-colors ${
                  introMonetization === opt.value
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-800 active:bg-zinc-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="mb-3 text-[14px] font-semibold text-zinc-800">Qual seu maior receio ao cobrar?</p>
          <div className="flex flex-col gap-2.5">
            {PRICING_FEAR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIntroFear(opt.value)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-[14px] font-medium transition-colors ${
                  introFear === opt.value
                    ? "border-zinc-950 bg-zinc-950 text-white"
                    : "border-zinc-200 bg-white text-zinc-800 active:bg-zinc-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3">
          <button
            type="button"
            onClick={finishIntro}
            className="w-full rounded-full bg-zinc-950 px-6 py-4 text-sm font-semibold text-white transition-colors active:bg-zinc-800"
          >
            {introMonetization || introFear ? "Continuar para a calculadora" : "Pular e calcular"}
          </button>
        </div>
      </div>
    );
  }

  const updateQuantity = (key: FormatKey, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [key]: Math.min(20, Math.max(0, prev[key] + delta)),
    }));
  };

  const submitCalculation = async () => {
    if (!hasDeliverables || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setStep(3);

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
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível calcular agora.");
      }
      if (
        typeof payload?.justo !== "number" ||
        typeof payload?.estrategico !== "number" ||
        typeof payload?.premium !== "number"
      ) {
        throw new Error("Resposta inválida da calculadora.");
      }
      const saved = payload as MobileCalculatorResult;
      setResult(saved);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível calcular agora.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const close = () => {
    if (isSubmitting) return;
    onClose();
  };

  const reachLabel =
    formatNumber(result?.metrics?.reach) ??
    formatNumber(latestCalculation?.metrics?.reach) ??
    formatNumber(suggestedReach);
  const visibleResult = result ?? latestCalculation;
  const currentStepCopy = stepCopy[step];
  const usageSummaryLabel =
    usageRights === "organico" ? "Orgânico" : `${labelForUsageRights(usageRights)} ${paidMediaDuration}`;
  const usageDetail =
    usageRights === "organico"
      ? "Uso pela marca sem mídia paga."
      : usageRights === "midiapaga"
        ? "Permite impulsionar por um período."
        : "Uso ampliado de imagem e campanha.";
  const resultChips = [
    usageSummaryLabel,
    labelForBrandSize(brandSize),
    labelForExclusivity(exclusivity),
    labelForStrategicGain(strategicGain),
    contentModel === "ugc_whitelabel" ? "UGC" : null,
  ].filter(Boolean).slice(0, 5) as string[];

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-zinc-950/35 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-calculator-wizard-title"
        className="flex max-h-[min(76dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-2xl animate-in slide-in-from-bottom duration-300"
      >
        <div className="shrink-0 px-5 pb-4 pt-3.5">
          <div className="mx-auto mb-3 h-1 w-7 rounded-full bg-zinc-200" aria-hidden="true" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Etapa {step + 1} de {wizardSteps.length}
              </p>
              <h2 id="mobile-calculator-wizard-title" className="mt-0.5 text-[18px] font-bold leading-tight text-zinc-950">
                {currentStepCopy.title}
              </h2>
            </div>
            <DiagnosticoCloseButton
              onClose={close}
              ariaLabel="Fechar calculadora"
              disabled={isSubmitting}
              edgeAlign
            />
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden="true">
            {wizardSteps.map((index) => (
              <span key={index} className={index <= step ? "h-1 rounded-full bg-zinc-950" : "h-1 rounded-full bg-zinc-200"} />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2">
          {step === 0 ? (
            <div className="grid gap-2.5">
              <div className="rounded-[14px] border border-zinc-200 bg-white px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Alcance médio</p>
                  <p className="text-[13px] font-bold text-zinc-950">
                    {reachLabel ? `${reachLabel} pessoas` : "Métricas do perfil"}
                  </p>
                </div>
              </div>
              {formatOrder.map((key) => (
                <div key={key} className="flex min-h-11 items-center justify-between gap-3 rounded-[14px] border border-zinc-200 bg-white px-3.5 py-2">
                  <div>
                    <p className="text-[13px] font-semibold text-zinc-900">{formatLabels[key]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={`Remover ${formatLabels[key]}`}
                      className="grid h-7 w-7 place-items-center rounded-full border border-zinc-200 bg-white text-xs text-zinc-600 disabled:opacity-40"
                      onClick={() => updateQuantity(key, -1)}
                      disabled={quantities[key] === 0}
                    >
                      -
                    </button>
                    <span className="w-4 text-center text-[13px] font-semibold text-zinc-950">{quantities[key]}</span>
                    <button
                      type="button"
                      aria-label={`Adicionar ${formatLabels[key]}`}
                      className="grid h-7 w-7 place-items-center rounded-full bg-zinc-950 text-xs text-white shadow-[0_8px_18px_rgba(24,24,27,0.14)]"
                      onClick={() => updateQuantity(key, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              {!hasDeliverables ? (
                <p className="text-xs font-medium text-red-600">Selecione pelo menos uma entrega.</p>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-3">
              <WizardSection label="Uso de imagem">
                <SegmentedChoice
                  value={usageRights}
                  onChange={setUsageRights}
                  options={[
                    { value: "organico", label: "Orgânico" },
                    { value: "midiapaga", label: "Mídia paga" },
                    { value: "global", label: "Uso global" },
                  ]}
                />
                <p className="mt-2 text-xs leading-4 text-zinc-500">{usageDetail}</p>
                {usageRights !== "organico" ? (
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Impulsionamento</p>
                    <SegmentedChoice
                      value={paidMediaDuration}
                      onChange={setPaidMediaDuration}
                      options={[
                        { value: "7d", label: "7d" },
                        { value: "15d", label: "15d" },
                        { value: "30d", label: "30d" },
                        { value: "90d", label: "90d" },
                      ]}
                    />
                  </div>
                ) : null}
              </WizardSection>
              <WizardSection label="Exclusividade">
                <SegmentedChoice
                  value={exclusivity}
                  onChange={setExclusivity}
                  options={[
                    { value: "nenhuma", label: "Sem" },
                    { value: "15d", label: "15 dias" },
                    { value: "30d", label: "30 dias" },
                    { value: "90d", label: "90 dias" },
                  ]}
                />
              </WizardSection>
              <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 pt-4">
                <ToggleTile
                  selected={instagramCollab}
                  title="Collab"
                  detail="Instagram"
                  onClick={() => setInstagramCollab((value) => !value)}
                />
                <ToggleTile
                  selected={repostTikTok}
                  title="TikTok"
                  detail="Repost"
                  onClick={() => setRepostTikTok((value) => !value)}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3">
              <WizardSection label="Porte da marca">
                <SegmentedChoice
                  value={brandSize}
                  onChange={setBrandSize}
                  options={[
                    { value: "pequena", label: "Pequena" },
                    { value: "media", label: "Média" },
                    { value: "grande", label: "Grande" },
                  ]}
                />
              </WizardSection>
              <WizardSection label="Risco de imagem">
                <SegmentedChoice
                  value={imageRisk}
                  onChange={setImageRisk}
                  options={[
                    { value: "baixo", label: "Baixo" },
                    { value: "medio", label: "Médio" },
                    { value: "alto", label: "Alto" },
                  ]}
                />
              </WizardSection>
              <WizardSection label="Ganho estratégico">
                <SegmentedChoice
                  value={strategicGain}
                  onChange={setStrategicGain}
                  options={[
                    { value: "baixo", label: "Baixo" },
                    { value: "medio", label: "Médio" },
                    { value: "alto", label: "Alto" },
                  ]}
                />
              </WizardSection>
              <ToggleTile
                selected={contentModel === "ugc_whitelabel"}
                title="UGC"
                detail="Entrega fora do perfil"
                onClick={() =>
                  setContentModel((value) =>
                    value === "ugc_whitelabel" ? "publicidade_perfil" : "ugc_whitelabel",
                  )
                }
              />
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              {isSubmitting ? (
                <div className="rounded-[1.5rem] bg-zinc-950 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <svg className="h-5 w-5 animate-spin text-white/60" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm font-semibold">Calculando sua faixa</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/55">Combinando métricas, escopo e contexto comercial.</p>
                </div>
              ) : error ? (
                <div className="rounded-[1.5rem] border border-red-100 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700">Não foi possível calcular</p>
                  <p className="mt-2 text-sm leading-6 text-red-600">{error}</p>
                </div>
              ) : visibleResult ? (
                <div>
                  <div className="rounded-[1.5rem] bg-zinc-950 p-5 text-white">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Valor sugerido</p>
                    <p className="mt-1 text-3xl font-semibold">{formatCurrency(visibleResult.justo)}</p>
                    <p className="mt-1 text-sm font-semibold text-white/70">{buildDeliverablesLabel(quantities)}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {resultChips.map((chip) => (
                        <span key={chip} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Estratégico</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCurrency(visibleResult.estrategico)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-100 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Premium</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-950">{formatCurrency(visibleResult.premium)}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 bg-white px-5 pb-5 pt-1.5">
          <div className="flex gap-2">
          {step > 0 && step < 3 ? (
            <button
              type="button"
              className="h-10 rounded-full border border-zinc-200 px-4 text-[13px] font-semibold text-zinc-700"
              onClick={() => setStep((prev) => Math.max(0, prev - 1) as WizardStep)}
            >
              Voltar
            </button>
          ) : null}
          {step < 2 ? (
            <button
              type="button"
              className="h-10 flex-1 rounded-full bg-zinc-950 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
              onClick={() => setStep((prev) => Math.min(2, prev + 1) as WizardStep)}
              disabled={step === 0 && !hasDeliverables}
            >
              Continuar
            </button>
          ) : step === 2 ? (
            <button
              type="button"
              className="h-10 flex-1 rounded-full bg-zinc-950 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
              onClick={submitCalculation}
              disabled={!hasDeliverables || isSubmitting}
            >
              Calcular valor
            </button>
          ) : (
            <button
              type="button"
              className="h-10 flex-1 rounded-full bg-zinc-950 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
              onClick={error ? submitCalculation : close}
              disabled={isSubmitting}
            >
              {error ? "Tentar de novo" : "Concluir"}
            </button>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}
