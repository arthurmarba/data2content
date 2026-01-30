"use client";

import React from "react";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import ButtonPrimary from "./ButtonPrimary";
import useCreatorProfileExtended from "@/hooks/useCreatorProfileExtended";
import type { LandingCommunityMetrics, CreatorProfileExtended, SurveyStepId, PlatformReason } from "@/types/landing";

type SurveyErrors = Partial<Record<keyof CreatorProfileExtended, string>>;

type OnboardingSurveyStepperProps = {
  metrics?: LandingCommunityMetrics | null;
  onSaved?: () => void;
};

const LOCAL_STORAGE_KEY = "d2c_creator_profile_extended";

const DEFAULT_PROFILE: CreatorProfileExtended = {
  stage: [],
  brandTerritories: [],
  niches: [],
  hasHelp: [],
  dreamBrands: [],
  mainGoal3m: null,
  mainGoalOther: "",
  success12m: "",
  mainPains: [],
  otherPain: "",
  hardestStage: [],
  hasDoneSponsoredPosts: null,
  avgPriceRange: null,
  bundlePriceRange: null,
  pricingMethod: null,
  pricingFear: null,
  pricingFearOther: "",
  mainPlatformReasons: [],
  reasonOther: "",
  dailyExpectation: "",
  nextPlatform: [],
  learningStyles: [],
  notificationPref: [],
};

const steps: Array<{ id: SurveyStepId; title: string; description: string }> = [
  { id: "niche", title: "Nicho", description: "Escolha o nicho em que quer ser reconhecido" },
  { id: "about", title: "Sobre você", description: "Quem é você e como cria hoje" },
  { id: "goals", title: "Objetivos & Dores", description: "Prioridades e travas" },
  { id: "publis", title: "Publis & Dinheiro", description: "Monetização e precificação" },
  { id: "support", title: "Como vamos te ajudar", description: "Estilo de suporte e canais" },
];

const stageOptions = [
  { value: "iniciante", label: "Estou começando agora", hint: "Preciso do passo a passo" },
  { value: "hobby", label: "Crio por hobby", hint: "Quero leveza e consistência" },
  { value: "renda-extra", label: "Tenho renda extra", hint: "Quero subir o ticket" },
  { value: "full-time", label: "É minha renda principal", hint: "Busco escala e time" },
  { value: "empresa", label: "Tenho estrutura/equipe", hint: "Equipe, CNPJ, processos" },
] as const;

const helperOptions = [
  { value: "solo", label: "Faço tudo sozinho" },
  { value: "edicao-design", label: "Alguém me ajuda com edição/design" },
  { value: "social-media", label: "Tenho social media" },
  { value: "agencia", label: "Tenho assessoria/gestão" },
] as const;

const nicheOptions = [
  "Lifestyle",
  "Carreira e produtividade",
  "Educação e estudos",
  "Humor/Entretenimento",
  "Notícias/Atualidades",
  "Negócios/PME",
  "Marketing/Branding",
  "Tech/IA/Automação",
  "Startups/Investimentos",
  "Creator Economy/B2B",
  "Finanças pessoais",
  "Investimentos e cripto",
  "Saúde mental",
  "Fitness/Treino",
  "Nutrição",
  "Bem-estar/Meditação",
  "Beleza/Skincare",
  "Maquiagem",
  "Moda",
  "Moda sustentável",
  "Receitas/Gastronomia",
  "Confeitaria/Panificação",
  "Bebidas/Vinhos",
  "Viagens (low cost)",
  "Viagens (luxo)",
  "Música",
  "Cinema/Séries",
  "Livros",
  "Fotografia",
  "Arte/Ilustração",
  "Games/E-sports",
  "Geek/Cosplay",
  "Esportes outdoor",
  "Yoga/Pilates",
  "Arquitetura/Decoração",
  "DIY/Organização",
  "Jardinagem/Plantas",
  "Maternidade/Paternidade",
  "Relacionamentos",
  "Pets",
  "Agro/Agtech",
  "Direito/Compliance",
  "Engenharia/Construção",
  "Auto/Carros/Motos",
  "Sustentabilidade/ESG",
  "Posicionamento para marcas (B2B)",
] as const;

const mainGoals = [
  { value: "crescer-seguidores", label: "Crescer seguidores" },
  { value: "aumentar-engajamento", label: "Aumentar engajamento" },
  { value: "profissionalizar-publis", label: "Profissionalizar publis/negociação" },
  { value: "organizar-rotina", label: "Organizar rotina e consistência" },
  { value: "aumentar-faturamento", label: "Aumentar faturamento" },
  { value: "outro", label: "Outro (descreva)" },
] as const;

const pains = [
  { value: "ideias", label: "Falta de ideias" },
  { value: "consistencia", label: "Falta de consistência" },
  { value: "metricas", label: "Entender minhas métricas" },
  { value: "camera", label: "Insegurança para aparecer" },
  { value: "negociar", label: "Negociar ou comunicar meu valor" },
  { value: "organizacao", label: "Organização de prazos/rotina" },
  { value: "outro", label: "Outro" },
] as const;

const hardestStages = [
  { value: "planejar", label: "Planejar conteúdos" },
  { value: "produzir", label: "Produzir (roteiro, gravação, edição)" },
  { value: "postar", label: "Postar com estratégia" },
  { value: "analisar", label: "Analisar meus resultados" },
  { value: "negociar", label: "Negociar/comercializar" },
] as const;

const monetizationStatus = [
  { value: "varias", label: "Sim, várias" },
  { value: "poucas", label: "Já fiz, mas poucas" },
  { value: "nunca-quero", label: "Nunca fiz, mas quero começar" },
  { value: "nunca-sem-interesse", label: "Nunca fiz e não tenho interesse agora" },
] as const;

const priceRanges = [
  { value: "permuta", label: "Faço permuta / não cobro ainda" },
  { value: "0-500", label: "Até R$ 500" },
  { value: "500-1500", label: "R$ 500–1.500" },
  { value: "1500-3000", label: "R$ 1.500–3.000" },
  { value: "3000-5000", label: "R$ 3.000–5.000" },
  { value: "5000-8000", label: "R$ 5.000–8.000" },
  { value: "8000-plus", label: "Acima de R$ 8.000" },
] as const;
const bundlePriceRanges = [
  { value: "permuta", label: "Faço permuta / não cobro ainda" },
  { value: "0-500", label: "Até R$ 500" },
  { value: "500-1500", label: "R$ 500–1.500" },
  { value: "1500-3000", label: "R$ 1.500–3.000" },
  { value: "3000-5000", label: "R$ 3.000–5.000" },
  { value: "5000-8000", label: "R$ 5.000–8.000" },
  { value: "8000-plus", label: "Acima de R$ 8.000" },
] as const;

const pricingMethods = [
  { value: "chute", label: "Decido na hora sem base" },
  { value: "seguidores", label: "Baseado em seguidores" },
  { value: "esforco", label: "Baseado no esforço/tempo" },
  { value: "agencia", label: "Gestor define" },
  { value: "calculadora", label: "Uso calculadora/tabela" },
] as const;

const pricingFears = [
  { value: "caro", label: "Cobrar caro e perder a marca" },
  { value: "barato", label: "Cobrar barato e me arrepender" },
  { value: "justificar", label: "Não saber justificar o preço" },
  { value: "amador", label: "Passar uma imagem amadora" },
  { value: "outro", label: "Outro" },
] as const;

const platformReasons = [
  { value: "metricas", label: "Entender melhor minhas métricas" },
  { value: "media-kit", label: "Criar/atualizar meu media kit" },
  { value: "planejar", label: "Planejar conteúdo com IA" },
  { value: "negociar", label: "Negociação com marcas" },
  { value: "mentorias", label: "Suporte em reuniões/mentorias semanais" },
  { value: "posicionamento-marcas", label: "Posicionar minha marca para marcas via conteúdo" },
  { value: "oportunidades", label: "Receber oportunidades de campanha" },
  { value: "outro", label: "Outro" },
] as const;

const nextPlatforms = [
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "outra", label: "Outra" },
  { value: "nenhuma", label: "Nenhuma no momento" },
] as const;

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-brand-dark shadow-sm ring-1 ring-white/60 backdrop-blur">
      <span className="h-2 w-2 rounded-full bg-brand-primary" />
      <span className="text-brand-text-secondary">{label}</span>
      <span className="text-brand-dark">{value}</span>
    </div>
  );
}

function MetricsContextBar({ metrics }: { metrics?: LandingCommunityMetrics | null }) {
  if (!metrics) return null;

  const formatter = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
  const followers = formatter.format(metrics.combinedFollowers ?? 0);
  const engagement = metrics.interactionsLast30Days && metrics.reachLast30Days
    ? ((metrics.interactionsLast30Days / Math.max(metrics.reachLast30Days, 1)) * 100).toFixed(1)
    : "—";
  const reach = formatter.format(metrics.reachLast30Days ?? 0);

  return (
    <div className="w-full rounded-xl border border-brand-glass bg-white p-3 text-sm text-brand-text-secondary">
      <p className="font-semibold text-brand-dark">
        {followers} seguidores · engajamento {engagement}% · alcance 30d {reach}
      </p>
    </div>
  );
}

function normalizeCommaSeparated(value: string, limit = 5) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function splitByAltSeparators(value: string) {
  return value
    .split(/[\/|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueOrdered(values: string[], limit?: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
    if (limit && result.length >= limit) break;
  }
  return limit ? result.slice(0, limit) : result;
}

function arraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function parseCommaSeparatedInput(value: string, limit = 5) {
  const values = normalizeCommaSeparated(value, limit);
  const endsWithComma = value.trimEnd().endsWith(",");
  const display = endsWithComma && values.length < limit ? `${values.join(", ")}${values.length ? ", " : ""}` : values.join(", ");
  return { values, display };
}

function sanitizeProfile(data: Partial<CreatorProfileExtended> | null | undefined): CreatorProfileExtended {
  if (!data) return { ...DEFAULT_PROFILE };
  const legacyReason = (data as any).mainPlatformReason;
  const legacyStage = (data as any).stage && !Array.isArray((data as any).stage) ? [(data as any).stage] : undefined;
  const legacyHasHelp = (data as any).hasHelp && !Array.isArray((data as any).hasHelp) ? [(data as any).hasHelp] : undefined;
  const legacyHardest = (data as any).hardestStage && !Array.isArray((data as any).hardestStage) ? [(data as any).hardestStage] : undefined;
  const legacyNextPlatform = (data as any).nextPlatform && !Array.isArray((data as any).nextPlatform) ? [(data as any).nextPlatform] : undefined;
  const legacyNotification = (data as any).notificationPref && !Array.isArray((data as any).notificationPref)
    ? [(data as any).notificationPref]
    : undefined;
  const normalizedBrandTerritories = uniqueOrdered((data.brandTerritories ?? []).flatMap(splitByAltSeparators), 6);
  const normalizedDreamBrands = uniqueOrdered((data.dreamBrands ?? []).flatMap(splitByAltSeparators), 3);
  const normalizeNiches = () => {
    const source = data.niches ?? [];
    const preset = source.filter((n) => nicheOptions.includes(n as (typeof nicheOptions)[number]));
    const manual = source.filter((n) => !nicheOptions.includes(n as (typeof nicheOptions)[number]));
    const normalizedManual = manual.flatMap(splitByAltSeparators);
    return uniqueOrdered([...preset, ...normalizedManual], 5);
  };
  return {
    ...DEFAULT_PROFILE,
    ...data,
    brandTerritories: normalizedBrandTerritories,
    niches: normalizeNiches(),
    dreamBrands: normalizedDreamBrands,
    mainPains: data.mainPains ?? [],
    stage: Array.isArray(data.stage) ? data.stage : legacyStage ?? [],
    hasHelp: Array.isArray(data.hasHelp) ? data.hasHelp : legacyHasHelp ?? [],
    hardestStage: Array.isArray(data.hardestStage) ? data.hardestStage : legacyHardest ?? [],
    nextPlatform: Array.isArray(data.nextPlatform) ? data.nextPlatform : legacyNextPlatform ?? [],
    notificationPref: Array.isArray(data.notificationPref) ? data.notificationPref : legacyNotification ?? [],
    mainPlatformReasons: data.mainPlatformReasons ?? (legacyReason ? [legacyReason as PlatformReason] : []),
    learningStyles: data.learningStyles ?? [],
  };
}

function useLocalSurveyState() {
  const [profile, setProfile] = React.useState<CreatorProfileExtended>(DEFAULT_PROFILE);
  const [hasHydrated, setHasHydrated] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<CreatorProfileExtended>;
        const sanitized = sanitizeProfile(parsed);
        setProfile(sanitized);
      }
    } catch (error) {
      console.warn("[survey] failed to read local draft", error);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  const persist = React.useCallback((next: CreatorProfileExtended) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn("[survey] failed to persist local draft", error);
    }
  }, []);

  return { profile, setProfile, persist, hasHydrated };
}

function validateStep(stepId: SurveyStepId, data: CreatorProfileExtended): SurveyErrors {
  const errors: SurveyErrors = {};

  if (stepId === "niche") {
    if (!data.niches.length) errors.niches = "Compartilhe seu nicho.";
    if (data.niches.length > 5) errors.niches = "Liste no máximo 5 nichos.";
  }

  if (stepId === "about") {
    if (!data.stage.length) errors.stage = "Escolha seu momento como criador.";
    if (data.stage.length > 2) errors.stage = "Escolha no máximo 2 opções.";
    if (!data.hasHelp.length) errors.hasHelp = "Conte se você tem apoio hoje.";
    if (data.hasHelp.length > 3) errors.hasHelp = "Escolha no máximo 3 opções.";
    if (!data.brandTerritories.length) {
      errors.brandTerritories = "Compartilhe temas nos quais quer ser reconhecido.";
    }
  }

  if (stepId === "goals") {
    if (!data.mainGoal3m) errors.mainGoal3m = "Selecione uma prioridade para os próximos 3 meses.";
    if (!data.success12m) errors.success12m = "Conte o que seria sucesso em 12 meses.";
    if (!data.mainPains.length) errors.mainPains = "Escolha até 2 pontos que te travam.";
    if (data.mainPains.length > 2) errors.mainPains = "Escolha no máximo 2 dores.";
    if (data.mainPains.includes("outro") && !data.otherPain) {
      errors.otherPain = "Descreva o que te trava.";
    }
    if (!data.hardestStage.length) errors.hardestStage = "Escolha em qual etapa sente mais dificuldade.";
    if (data.hardestStage.length > 2) errors.hardestStage = "Escolha no máximo 2 etapas.";
  }

  if (stepId === "publis") {
    if (!data.hasDoneSponsoredPosts) {
      errors.hasDoneSponsoredPosts = "Conte sobre sua experiência com publis.";
    }
    const monetizes = data.hasDoneSponsoredPosts && data.hasDoneSponsoredPosts !== "nunca-sem-interesse";
    if (monetizes) {
      if (!data.avgPriceRange) errors.avgPriceRange = "Selecione uma faixa de preço média.";
      if (!data.bundlePriceRange) errors.bundlePriceRange = "Selecione o valor para 1 reels + combo de stories.";
      if (!data.pricingMethod) errors.pricingMethod = "Conte como define valores.";
      if (!data.pricingFear) errors.pricingFear = "Compartilhe seu maior medo ao cobrar.";
      if (data.pricingFear === "outro" && !data.pricingFearOther) {
        errors.pricingFearOther = "Descreva seu medo ao cobrar.";
      }
    }
  }

  if (stepId === "support") {
    if (!data.mainPlatformReasons.length) errors.mainPlatformReasons = "Escolha pelo menos um motivo para usar a plataforma.";
    if (data.mainPlatformReasons.length > 2) errors.mainPlatformReasons = "Escolha no máximo 2 motivos.";
    if (data.mainPlatformReasons.includes("outro") && !data.reasonOther) {
      errors.reasonOther = "Descreva seu motivo.";
    }
    if (!data.nextPlatform.length) errors.nextPlatform = "Escolha a próxima plataforma prioritária.";
    if (data.nextPlatform.length > 2) errors.nextPlatform = "Escolha no máximo 2 plataformas.";
    if (!data.dailyExpectation) errors.dailyExpectation = "Conte o que espera que a plataforma faça por você.";
  }

  return errors;
}

function mergeErrors(...errors: SurveyErrors[]) {
  return errors.reduce<SurveyErrors>((acc, curr) => ({ ...acc, ...curr }), {});
}

function SelectCard({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      className={`group flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
        selected ? "border-brand-primary bg-brand-primary/5 shadow-[0_10px_30px_rgba(255,44,126,0.06)]" : "border-brand-glass bg-white hover:border-brand-primary/50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.04)]"
      }`}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-brand-dark">{label}</span>
        {hint ? <span className="text-xs text-brand-text-secondary">{hint}</span> : null}
      </div>
      <span
        className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition ${
          selected ? "border-brand-primary bg-brand-primary text-white" : "border-brand-soft-bg text-brand-text-secondary"
        }`}
        aria-hidden
      >
        {selected ? <Check size={14} /> : ""}
      </span>
    </button>
  );
}

function Chip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={selected}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
        selected
          ? "border-brand-primary bg-brand-primary/10 text-brand-primary shadow-[0_8px_24px_rgba(255,44,126,0.10)]"
          : "border-brand-glass bg-white text-brand-dark hover:border-brand-primary/50 hover:shadow-[0_6px_18px_rgba(0,0,0,0.04)]"
      }`}
    >
      {label}
    </button>
  );
}

function SectionLabel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1 pb-2">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-primary">{title}</p>
      {description ? <p className="text-xs text-brand-text-secondary">{description}</p> : null}
    </div>
  );
}

function QuestionBlock({
  title,
  description,
  required = true,
  children,
  index,
}: {
  title: string;
  description?: string;
  required?: boolean;
  children: React.ReactNode;
  index: number;
}) {
  return (
    <div className="space-y-8 border-b border-brand-glass pb-10 last:border-0 sm:space-y-9">
      <div className="flex items-start gap-4 sm:gap-5">
        <span className="mt-[2px] flex h-7 w-7 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">
          {index}
        </span>
        <div className="flex-1 space-y-3">
          <div className="flex items-start gap-3 text-lg font-semibold leading-snug text-brand-dark">
            <p className="flex-1">{title}</p>
            {required ? (
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-text-secondary">
                Obrigatório
              </span>
            ) : null}
          </div>
          {description ? <p className="text-sm leading-relaxed text-brand-text-secondary">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  error,
  maxLength = 180,
  multiline,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  maxLength?: number;
  multiline?: boolean;
  optional?: boolean;
}) {
  const shared =
    "w-full rounded-xl border border-brand-glass bg-white px-4 py-3 text-base text-brand-dark outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-base font-semibold text-brand-dark">
        <span>{label}</span>
        {optional ? <span className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-text-secondary">Opcional</span> : null}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          className={`${shared} min-h-[96px] resize-none`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          className={shared}
        />
      )}
      {error ? <span className="text-xs font-medium text-brand-primary">{error}</span> : null}
    </label>
  );
}

function StepBadge({
  index,
  active,
  done,
  label,
  onClick,
}: {
  index: number;
  active: boolean;
  done: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-brand-primary/50 bg-brand-primary/10 text-brand-dark"
          : "border-brand-glass bg-white text-brand-dark hover:border-brand-primary/40 hover:bg-brand-soft-bg"
      }`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${
          active
            ? "border-brand-primary bg-white text-brand-primary"
            : done
              ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
              : "border-brand-soft-bg bg-white text-brand-text-secondary"
        }`}
      >
        {done ? <Check size={16} /> : index + 1}
      </span>
      <span className="text-base font-semibold">{label}</span>
    </button>
  );
}

function AnswerSummary({ data }: { data: CreatorProfileExtended }) {
  const monetizes = data.hasDoneSponsoredPosts && data.hasDoneSponsoredPosts !== "nunca-sem-interesse";
  return (
    <div className="grid gap-3 rounded-2xl border border-brand-glass bg-white/80 p-4 text-sm text-brand-dark md:grid-cols-2">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Perfil</span>
        <span>
          {data.stage.length
            ? data.stage.map((s) => stageOptions.find((o) => o.value === s)?.label ?? s).join(", ")
            : "Sem estágio"}{" "}
          •{" "}
          {data.hasHelp.length
            ? data.hasHelp.map((h) => helperOptions.find((o) => o.value === h)?.label ?? h).join(", ")
            : "Sem apoio"}
        </span>
        <span className="text-brand-text-secondary">
          Territórios: {data.brandTerritories.length ? data.brandTerritories.join(", ") : "—"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Objetivos</span>
        <span>
          3 meses: {data.mainGoal3m ? mainGoals.find((g) => g.value === data.mainGoal3m)?.label : "—"}
          {data.mainGoal3m === "outro" && data.mainGoalOther ? ` (${data.mainGoalOther})` : ""}
        </span>
        <span className="text-brand-text-secondary">
          12 meses: {data.success12m || "—"} | Dores: {data.mainPains.join(", ") || "—"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Publis</span>
        <span>
          {data.hasDoneSponsoredPosts
            ? monetizationStatus.find((m) => m.value === data.hasDoneSponsoredPosts)?.label
            : "Sem info"}
        </span>
        {monetizes ? (
          <span className="text-brand-text-secondary">
            Faixa: {data.avgPriceRange ? priceRanges.find((p) => p.value === data.avgPriceRange)?.label : "—"} •{" "}
            Método: {data.pricingMethod ? pricingMethods.find((p) => p.value === data.pricingMethod)?.label : "—"}
          </span>
        ) : (
          <span className="text-brand-text-secondary">Focando em construir antes de cobrar</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Suporte</span>
        <span>
          Motivos:{" "}
          {data.mainPlatformReasons.length
            ? data.mainPlatformReasons
                .map((reason) => platformReasons.find((p) => p.value === reason)?.label ?? reason)
                .join(", ")
            : "—"}
        </span>
        <span className="text-brand-text-secondary">
          Próximas plataformas:{" "}
          {data.nextPlatform.length
            ? data.nextPlatform.map((p) => nextPlatforms.find((n) => n.value === p)?.label ?? p).join(", ")
            : "—"}
        </span>
      </div>
    </div>
  );
}

export default function OnboardingSurveyStepper({ metrics, onSaved }: OnboardingSurveyStepperProps) {
  const { profile, setProfile, persist, hasHydrated } = useLocalSurveyState();
  const { profile: remoteProfile, isLoading: isLoadingRemote, mutate } = useCreatorProfileExtended();
  const [currentStep, setCurrentStep] = React.useState<SurveyStepId>("about");
  const [errors, setErrors] = React.useState<SurveyErrors>({});
  const [isSaving, setIsSaving] = React.useState(false);
  const [completedSteps, setCompletedSteps] = React.useState<Set<SurveyStepId>>(new Set());
  const [didBootstrap, setDidBootstrap] = React.useState(false);
  const [brandTerritoriesInput, setBrandTerritoriesInput] = React.useState("");
  const [dreamBrandsInput, setDreamBrandsInput] = React.useState("");
  const [manualNichesInput, setManualNichesInput] = React.useState("");

  const updateField = <K extends keyof CreatorProfileExtended>(key: K, value: CreatorProfileExtended[K]) => {
    setProfile((prev) => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  };

  const canGoMonetization = profile.hasDoneSponsoredPosts && profile.hasDoneSponsoredPosts !== "nunca-sem-interesse";

  const handlePainToggle = (value: string) => {
    setProfile((prev) => {
      const alreadySelected = prev.mainPains.includes(value);
      let nextPains = alreadySelected ? prev.mainPains.filter((p) => p !== value) : [...prev.mainPains, value];
      if (!alreadySelected && nextPains.length > 2) {
        nextPains = nextPains.slice(0, 2);
      }
      const nextProfile = {
        ...prev,
        mainPains: nextPains,
        otherPain: nextPains.includes("outro") ? prev.otherPain : "",
      };
      persist(nextProfile);
      return nextProfile;
    });
  };

  const handleNicheToggle = (value: string) => {
    setProfile((prev) => {
      const already = prev.niches.includes(value);
      let nextNiches = already ? prev.niches.filter((n) => n !== value) : [...prev.niches, value];
      if (!already && nextNiches.length > 5) {
        nextNiches = nextNiches.slice(0, 5);
      }
      const nextProfile = { ...prev, niches: nextNiches };
      persist(nextProfile);
      return nextProfile;
    });
  };

  const mergeNiches = (current: string[], manualValues: string[]) => {
    const filtered = current.filter((n) => nicheOptions.includes(n as (typeof nicheOptions)[number]));
    return uniqueOrdered([...filtered, ...manualValues.map((n) => n.trim())].filter(Boolean), 5);
  };

  const handleMonetizationChange = (value: CreatorProfileExtended["hasDoneSponsoredPosts"]) => {
    setProfile((prev) => {
      const nextProfile: CreatorProfileExtended = {
        ...prev,
    hasDoneSponsoredPosts: value,
    avgPriceRange: value === "nunca-sem-interesse" ? null : prev.avgPriceRange,
    bundlePriceRange: value === "nunca-sem-interesse" ? null : prev.bundlePriceRange,
    pricingMethod: value === "nunca-sem-interesse" ? null : prev.pricingMethod,
    pricingFear: value === "nunca-sem-interesse" ? null : prev.pricingFear,
    pricingFearOther: value === "nunca-sem-interesse" ? "" : prev.pricingFearOther,
  };
      persist(nextProfile);
      return nextProfile;
    });
  };

  const togglePlatformReason = (value: PlatformReason) => {
    setProfile((prev) => {
      const already = prev.mainPlatformReasons.includes(value);
      let nextReasons: PlatformReason[] = already
        ? prev.mainPlatformReasons.filter((r) => r !== value)
        : [...prev.mainPlatformReasons, value];
      if (!already && nextReasons.length > 2) {
        nextReasons = nextReasons.slice(0, 2);
      }
      const nextProfile: CreatorProfileExtended = {
        ...prev,
        mainPlatformReasons: nextReasons,
        reasonOther: nextReasons.includes("outro") ? prev.reasonOther : "",
      };
      persist(nextProfile);
      return nextProfile;
    });
  };

  const toggleArrayField = <T extends string>(
    key: keyof Pick<
      CreatorProfileExtended,
      "stage" | "hasHelp" | "hardestStage" | "nextPlatform" | "notificationPref"
    >,
    value: T,
    limit: number,
  ) => {
    setProfile((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as T[]) : [];
      const already = current.includes(value);
      let next = already ? current.filter((v) => v !== value) : [...current, value];
      if (!already && next.length > limit) {
        next = next.slice(0, limit);
      }
      const nextProfile = { ...prev, [key]: next } as CreatorProfileExtended;
      persist(nextProfile);
      return nextProfile;
    });
  };

  const completionSet = React.useMemo(() => {
    const next = new Set<SurveyStepId>();
    steps.forEach((step) => {
      const stepErrors = validateStep(step.id, profile);
      if (Object.keys(stepErrors).length === 0) {
        next.add(step.id);
      }
    });
    return next;
  }, [profile]);

  React.useEffect(() => {
    setCompletedSteps(completionSet);
  }, [completionSet]);

  React.useEffect(() => {
    if (!hasHydrated || didBootstrap) return;
    const firstIncomplete = steps.find((step) => !completionSet.has(step.id))?.id;
    if (firstIncomplete) {
      setCurrentStep(firstIncomplete);
    }
    setDidBootstrap(true);
  }, [completionSet, didBootstrap, hasHydrated]);

  React.useEffect(() => {
    if (!remoteProfile || !hasHydrated || didBootstrap) return;
    const sanitized = sanitizeProfile(remoteProfile);
    setProfile(() => {
      persist(sanitized);
      return sanitized;
    });
    setDidBootstrap(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteProfile, hasHydrated]);

  const manualNiches = React.useMemo(
    () => profile.niches.filter((n) => !nicheOptions.includes(n as (typeof nicheOptions)[number])),
    [profile.niches],
  );

  React.useEffect(() => {
    const normalized = normalizeCommaSeparated(brandTerritoriesInput, 6);
    if (!arraysEqual(normalized, profile.brandTerritories)) {
      setBrandTerritoriesInput(profile.brandTerritories.join(", "));
    }
  }, [brandTerritoriesInput, profile.brandTerritories]);

  React.useEffect(() => {
    const normalized = normalizeCommaSeparated(dreamBrandsInput, 3);
    if (!arraysEqual(normalized, profile.dreamBrands)) {
      setDreamBrandsInput(profile.dreamBrands.join(", "));
    }
  }, [dreamBrandsInput, profile.dreamBrands]);

  React.useEffect(() => {
    const normalized = normalizeCommaSeparated(manualNichesInput, 5);
    if (!arraysEqual(normalized, manualNiches)) {
      setManualNichesInput(manualNiches.join(", "));
    }
  }, [manualNichesInput, manualNiches]);

  const goToStep = (stepId: SurveyStepId) => {
    const targetIndex = steps.findIndex((s) => s.id === stepId);
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    if (targetIndex > currentIndex) {
      const validation = validateStep(currentStep, profile);
      setErrors(validation);
      if (Object.keys(validation).length) {
        toast.error("Complete os campos obrigatórios antes de avançar.");
        return;
      }
    }
    setErrors({});
    setCurrentStep(stepId);
  };

  const handleNext = () => {
    const validation = validateStep(currentStep, profile);
    setErrors(validation);
    if (Object.keys(validation).length) {
      toast.error("Complete os campos obrigatórios antes de avançar.");
      return;
    }
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    const nextStep = steps[currentIndex + 1]?.id;
    if (nextStep) setCurrentStep(nextStep);
  };

  const handleBack = () => {
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    const prevStep = steps[currentIndex - 1]?.id;
    if (prevStep) setCurrentStep(prevStep);
  };

  const handleSubmit = async () => {
    const finalValidation = mergeErrors(
      validateStep("about", profile),
      validateStep("goals", profile),
      validateStep("publis", profile),
      validateStep("support", profile),
    );
    setErrors(finalValidation);
    if (Object.keys(finalValidation).length) {
      toast.error("Complete os campos obrigatórios antes de salvar.");
      return;
    }

    setIsSaving(true);
    try {
      persist(profile);
      const res = await fetch("/api/creator/profile-extended", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      await mutate(async () => sanitizeProfile(profile), { revalidate: false });
      toast.success("Preferências salvas. Vamos personalizar sua experiência!");
      onSaved?.();
    } catch (error) {
      console.warn("[survey] Failed to sync profile, kept locally", error);
      toast.error("Não conseguimos salvar agora. Guardamos aqui e tentamos de novo quando possível.");
    } finally {
      setIsSaving(false);
    }
  };

  const skipSurvey = () => {
    toast("Você pode voltar e completar quando quiser.", { icon: "⏱️" });
  };

  const renderStep = () => {
    switch (currentStep) {
      case "niche":
        return (
          <div className="space-y-12 sm:space-y-14">
            <QuestionBlock title="Qual é o seu nicho principal (ou nichos)?" description="Selecione até 5 ou use 'Outro' para digitar." index={1}>
              <div className="flex flex-wrap gap-3">
                {nicheOptions.map((option) => (
                  <Chip
                    key={option}
                    label={option}
                    selected={profile.niches.includes(option)}
                    onToggle={() => handleNicheToggle(option)}
                  />
                ))}
              </div>
              <InputField
                label="Outro (digite se não encontrar na lista)"
                value={manualNichesInput}
                onChange={(value) => {
                  const parsed = parseCommaSeparatedInput(value, 5);
                  setManualNichesInput(parsed.display);
                  updateField("niches", mergeNiches(profile.niches, parsed.values));
                }}
                placeholder="Ex.: jurídico tributário, odontologia estética, nichos regionais"
                error={errors.niches}
                optional
              />
              {errors.niches ? <p className="text-xs font-medium text-brand-primary">{errors.niches}</p> : null}
            </QuestionBlock>
          </div>
        );
      case "about":
        return (
          <div className="space-y-12 sm:space-y-14">
            <QuestionBlock title="Como você se enxerga hoje como criador?" required index={2}>
              <div className="flex flex-wrap gap-3">
                {stageOptions.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={profile.stage.includes(option.value)}
                    onToggle={() => toggleArrayField("stage", option.value, 2)}
                  />
                ))}
              </div>
              {errors.stage ? <p className="text-xs font-medium text-brand-primary">{errors.stage}</p> : null}
            </QuestionBlock>

            <QuestionBlock title="Com quais temas você quer ser reconhecido?" description="Separe por vírgula (máx. 6)" index={3}>
              <InputField
                label=""
                value={brandTerritoriesInput}
                onChange={(value) => {
                  const parsed = parseCommaSeparatedInput(value, 6);
                  setBrandTerritoriesInput(parsed.display);
                  updateField("brandTerritories", parsed.values);
                }}
                placeholder="Ex.: fintech para autônomos, estilo de vida leve, marketing pessoal"
                error={errors.brandTerritories}
              />
            </QuestionBlock>

            <QuestionBlock title="Você tem alguém te ajudando hoje?" index={4}>
              <div className="flex flex-wrap gap-3">
                {helperOptions.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={profile.hasHelp.includes(option.value)}
                    onToggle={() => toggleArrayField("hasHelp", option.value, 3)}
                  />
                ))}
              </div>
              {errors.hasHelp ? <p className="text-xs font-medium text-brand-primary">{errors.hasHelp}</p> : null}
            </QuestionBlock>

            <QuestionBlock title="Quais 3 marcas você sonha em trabalhar?" required={false} description="Separe por vírgula (máx. 3)" index={5}>
              <InputField
                label=""
                value={dreamBrandsInput}
                onChange={(value) => {
                  const parsed = parseCommaSeparatedInput(value, 3);
                  setDreamBrandsInput(parsed.display);
                  updateField("dreamBrands", parsed.values);
                }}
                placeholder="Ex.: Nike, Nubank, Netflix"
                optional
              />
            </QuestionBlock>
          </div>
        );
      case "goals":
        return (
          <div className="space-y-16 sm:space-y-18">
            <SectionLabel title="Objetivos & dores" description="Prioridades de 3 e 12 meses." />

            <QuestionBlock title="Se tivesse que escolher UMA prioridade para os próximos 3 meses, qual seria?" index={6}>
              <div className="grid gap-2 md:grid-cols-2">
                {mainGoals.map((option) => (
                  <SelectCard
                    key={option.value}
                    label={option.label}
                    selected={profile.mainGoal3m === option.value}
                    onSelect={() => updateField("mainGoal3m", option.value)}
                  />
                ))}
              </div>
              {profile.mainGoal3m === "outro" ? (
                <InputField
                  label=""
                  value={profile.mainGoalOther ?? ""}
                  onChange={(value) => updateField("mainGoalOther", value)}
                  placeholder="Descreva em uma frase"
                  error={errors.mainGoalOther}
                  optional
                />
              ) : null}
              {errors.mainGoal3m ? <p className="text-xs font-medium text-brand-primary">{errors.mainGoal3m}</p> : null}
            </QuestionBlock>

            <QuestionBlock title="Em 12 meses, o que seria história de sucesso para você?" index={7}>
              <InputField
                label=""
                value={profile.success12m}
                onChange={(value) => updateField("success12m", value)}
                placeholder="Ex.: viver só de publis, fechar contrato anual, lançar produto..."
                error={errors.success12m}
                maxLength={200}
                multiline
              />
            </QuestionBlock>

            <QuestionBlock title="Quais são os 2 pontos que mais te travam hoje?" description="Escolha até 2" index={8}>
              <div className="flex flex-wrap gap-2">
                {pains.map((pain) => (
                  <Chip
                    key={pain.value}
                    label={pain.label}
                    selected={profile.mainPains.includes(pain.value)}
                    onToggle={() => handlePainToggle(pain.value)}
                  />
                ))}
              </div>
              {profile.mainPains.includes("outro") ? (
                <InputField
                  label=""
                  value={profile.otherPain ?? ""}
                  onChange={(value) => updateField("otherPain", value)}
                  placeholder="Descreva rapidamente"
                  error={errors.otherPain}
                  optional
                />
              ) : null}
              {errors.mainPains ? <p className="text-xs font-medium text-brand-primary">{errors.mainPains}</p> : null}
            </QuestionBlock>

            <QuestionBlock title="Em qual etapa você sente mais dificuldade?" index={9}>
              <div className="flex flex-wrap gap-2">
                {hardestStages.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={profile.hardestStage.includes(option.value)}
                    onToggle={() => toggleArrayField("hardestStage", option.value, 2)}
                  />
                ))}
              </div>
              {errors.hardestStage ? (
                <p className="text-xs font-medium text-brand-primary">{errors.hardestStage}</p>
              ) : null}
            </QuestionBlock>
          </div>
        );
      case "publis":
        return (
          <div className="space-y-14 sm:space-y-16">
            <SectionLabel title="Publis & dinheiro" description="Dados para precificação e casting." />

              <QuestionBlock title="Você já fez publi paga?" index={10}>
              <div className="grid gap-3 md:grid-cols-2">
                {monetizationStatus.map((option) => (
                  <SelectCard
                    key={option.value}
                    label={option.label}
                    selected={profile.hasDoneSponsoredPosts === option.value}
                    onSelect={() => handleMonetizationChange(option.value)}
                  />
                ))}
              </div>
              {errors.hasDoneSponsoredPosts ? (
                <p className="text-xs font-medium text-brand-primary">{errors.hasDoneSponsoredPosts}</p>
              ) : null}
            </QuestionBlock>

            {canGoMonetization ? (
              <>
                <QuestionBlock title="Na média, quanto cobra por uma publi?" required index={11}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {priceRanges.map((option) => (
                      <SelectCard
                        key={option.value}
                        label={option.label}
                        selected={profile.avgPriceRange === option.value}
                        onSelect={() => updateField("avgPriceRange", option.value)}
                      />
                    ))}
                  </div>
                  {errors.avgPriceRange ? (
                    <p className="text-xs font-medium text-brand-primary">{errors.avgPriceRange}</p>
                  ) : null}
                </QuestionBlock>

                <QuestionBlock title="Quanto costuma cobrar por 1 reels + combo de stories?" required index={12}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {bundlePriceRanges.map((option) => (
                      <SelectCard
                        key={option.value}
                        label={option.label}
                        selected={profile.bundlePriceRange === option.value}
                        onSelect={() => updateField("bundlePriceRange", option.value)}
                      />
                    ))}
                  </div>
                  {errors.bundlePriceRange ? (
                    <p className="text-xs font-medium text-brand-primary">{errors.bundlePriceRange}</p>
                  ) : null}
                </QuestionBlock>

                <QuestionBlock title="Como costuma definir seus valores?" required index={13}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {pricingMethods.map((option) => (
                      <SelectCard
                        key={option.value}
                        label={option.label}
                        selected={profile.pricingMethod === option.value}
                        onSelect={() => updateField("pricingMethod", option.value)}
                      />
                    ))}
                  </div>
                  {errors.pricingMethod ? (
                    <p className="text-xs font-medium text-brand-primary">{errors.pricingMethod}</p>
                  ) : null}
                </QuestionBlock>

                <QuestionBlock title="Qual seu maior medo na hora de cobrar de uma marca?" required index={14}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {pricingFears.map((option) => (
                      <SelectCard
                        key={option.value}
                        label={option.label}
                        selected={profile.pricingFear === option.value}
                        onSelect={() => updateField("pricingFear", option.value)}
                      />
                    ))}
                  </div>
                  {profile.pricingFear === "outro" ? (
                    <InputField
                      label=""
                      value={profile.pricingFearOther ?? ""}
                      onChange={(value) => updateField("pricingFearOther", value)}
                      placeholder="Conte em uma frase"
                      error={errors.pricingFearOther}
                      optional
                    />
                  ) : null}
                  {errors.pricingFear ? (
                    <p className="text-xs font-medium text-brand-primary">{errors.pricingFear}</p>
                  ) : null}
                </QuestionBlock>
              </>
            ) : (
              <QuestionBlock title="Publis" description="Sem pressão para monetizar agora." required={false} index={10}>
                <p className="text-sm text-brand-text-secondary">
                  Quando quiser monetizar, liberamos benchmarks e calculadora de preço.
                </p>
              </QuestionBlock>
            )}
          </div>
        );
      case "support":
        return (
          <div className="space-y-14 sm:space-y-16">
            <SectionLabel title="Como vamos te ajudar" description="Personalização de UX, IA e notificações." />

            <QuestionBlock title="Qual foi o principal motivo pra você criar conta aqui?" description="Escolha até 2." index={15}>
              <div className="flex flex-wrap gap-3">
                {platformReasons.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={profile.mainPlatformReasons.includes(option.value)}
                    onToggle={() => togglePlatformReason(option.value)}
                  />
                ))}
              </div>
              {profile.mainPlatformReasons.includes("outro") ? (
                <InputField
                  label=""
                  value={profile.reasonOther ?? ""}
                  onChange={(value) => updateField("reasonOther", value)}
                  placeholder="Descreva em uma frase"
                  error={errors.reasonOther}
                  optional
                />
              ) : null}
              {errors.mainPlatformReasons ? (
                <p className="text-xs font-medium text-brand-primary">{errors.mainPlatformReasons}</p>
              ) : null}
            </QuestionBlock>

            <QuestionBlock title="No dia a dia, o que você espera que a plataforma faça por você?" index={16}>
              <InputField
                label=""
                value={profile.dailyExpectation}
                onChange={(value) => updateField("dailyExpectation", value)}
                placeholder="Ex.: puxar roteiros semanais, avisar sobre campanhas, revisar propostas..."
                error={errors.dailyExpectation}
                maxLength={180}
                multiline
              />
            </QuestionBlock>

            <QuestionBlock title="Além do Instagram, quais plataformas você mais pretende priorizar?" description="Escolha até 2." index={17}>
              <div className="flex flex-wrap gap-3">
                {nextPlatforms.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={profile.nextPlatform.includes(option.value)}
                    onToggle={() => toggleArrayField("nextPlatform", option.value, 2)}
                  />
                ))}
              </div>
              {errors.nextPlatform ? <p className="text-xs font-medium text-brand-primary">{errors.nextPlatform}</p> : null}
            </QuestionBlock>

            <AnswerSummary data={profile} />
          </div>
        );
      default:
        return null;
    }
  };

  const currentIndex = steps.findIndex((step) => step.id === currentStep);
  const isLast = currentIndex === steps.length - 1;

  if (!hasHydrated) {
    return (
      <div className="mt-10 w-full max-w-5xl rounded-3xl border border-brand-glass bg-white/70 p-6 text-brand-text-secondary shadow-glass-md">
        Carregando sua experiência personalizada...
      </div>
    );
  }

  if (isLoadingRemote && !remoteProfile) {
    return (
      <div className="mt-10 w-full max-w-5xl rounded-3xl border border-brand-glass bg-white/70 p-6 text-brand-text-secondary shadow-glass-md">
        Buscando seu perfil para personalizar o onboarding...
      </div>
    );
  }

  return (
    <div id="etapa-5-pesquisa" className="mt-10 w-full max-w-5xl space-y-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-primary">Etapa 5 · Pesquisa</p>
      <MetricsContextBar metrics={metrics} />

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-text-secondary">Passo a passo</p>
        <div className="grid gap-2 md:grid-cols-4 md:gap-3">
          {steps.map((step, idx) => (
            <StepBadge
              key={step.id}
              index={idx}
              active={currentStep === step.id}
              done={completedSteps.has(step.id)}
              label={step.title}
              onClick={() => goToStep(step.id)}
            />
          ))}
        </div>
      </div>

      <div className="mt-12 space-y-16 rounded-3xl border border-brand-glass bg-white/90 px-3 py-4 shadow-glass-md sm:space-y-18 sm:px-7 sm:py-8">
        {renderStep()}
      </div>

      <div className="mt-12 flex flex-col gap-5 border-t border-brand-glass pt-7 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={skipSurvey}
          className="text-sm font-semibold text-brand-primary underline-offset-4 hover:underline"
        >
          Pular agora (salva rascunho)
        </button>

        <div className="flex items-center gap-3">
          {currentStep !== "about" ? (
            <ButtonPrimary
              variant="ghost"
              size="md"
              onClick={handleBack}
              className="border border-brand-glass bg-white text-brand-dark hover:bg-white"
            >
              <ChevronLeft size={18} />
              Voltar
            </ButtonPrimary>
          ) : null}

          {!isLast ? (
            <ButtonPrimary
              onClick={handleNext}
              size="md"
              className="bg-brand-primary text-white shadow-[0_14px_32px_rgba(255,44,126,0.18)] hover:shadow-lg"
            >
              Próxima etapa
              <ChevronRight size={18} />
            </ButtonPrimary>
          ) : (
            <ButtonPrimary
              onClick={handleSubmit}
              size="md"
              className="bg-brand-primary text-white shadow-[0_14px_32px_rgba(255,44,126,0.18)] hover:shadow-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Salvando...
                </>
              ) : (
                <>Salvar e personalizar</>
              )}
            </ButtonPrimary>
          )}
        </div>
      </div>
    </div>
  );
}
