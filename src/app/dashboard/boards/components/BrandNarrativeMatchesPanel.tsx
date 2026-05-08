"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, Tag } from "lucide-react";

import type {
  BrandNarrativeMatchInput,
  BrandNarrativeMatchResult,
} from "@/app/lib/brands/brandNarrativeMatchTypes";
import { track } from "@/lib/track";

const BRAND_MATCHES_ENABLED =
  process.env.NEXT_PUBLIC_POST_CREATION_BRAND_MATCHES_ENABLED !== "0";
const BRAND_MATCH_LIMIT = 6;
const INITIAL_VISIBLE_MATCHES = 3;
const BRAND_MATCH_TIMEOUT_MS = 15_000;
const BRAND_MATCH_DEBUG = process.env.NODE_ENV === "development";
const BRAND_REPORT_CREATE_DEBUG = process.env.NODE_ENV === "development";
const REPORT_ERROR_MESSAGE = "Não foi possível gerar o relatório agora. Tente novamente em alguns instantes.";
const BRAND_MATCH_DISCLAIMER =
  "Marcas sugeridas por possível match narrativo. Não indicam parceria, campanha ativa ou cadastro formal na Data2Content.";
const BRAND_MATCH_EMPTY_TITLE = "Ainda não encontramos marcas com match narrativo forte para essa pauta.";
const BRAND_MATCH_EMPTY_SUBTEXT =
  "Tente escolher uma pauta mais específica ou gerar o relatório depois com uma marca em mente.";
const VISIBLE_SIGNAL_LIMIT = 3;

type BrandNarrativeDecision = {
  contextId?: string | null;
  proposalId?: string | null;
  toneId?: string | null;
  referenceId?: string | null;
  intentId?: string | null;
  narrativeId?: string | null;
  formatId?: string | null;
  durationId?: string | null;
  dayId?: string | null;
  hourId?: string | null;
  themeId?: string | null;
  pautaId?: string | null;
};

type BrandNarrativePauta = {
  title?: string | null;
  description?: string | null;
  reason?: string | null;
  theme?: string | null;
  keywords?: string[];
};

type BrandNarrativeCategories = NonNullable<BrandNarrativeMatchInput["categories"]>;

export type BrandNarrativeMatchesPanelProps = {
  decision: BrandNarrativeDecision;
  pauta?: BrandNarrativePauta | null;
  categories?: BrandNarrativeCategories | null;
  enabled?: boolean;
  compact?: boolean;
};

type MatchRequestState = "idle" | "loading" | "success" | "error";
type LocalPanelMessage = {
  text: string;
  href?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function cleanText(value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length ? trimmed : null;
}

function cleanKeywords(keywords?: string[]) {
  if (!Array.isArray(keywords)) return [];
  return Array.from(
    new Set(
      keywords
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length > 2)
    )
  ).slice(0, 16);
}

function cleanStringArray(values?: string[] | null) {
  if (!Array.isArray(values)) return undefined;
  const cleanValues = Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
  return cleanValues.length ? cleanValues : undefined;
}

function cleanDecision(decision: BrandNarrativeDecision): BrandNarrativeDecision {
  return {
    contextId: cleanText(decision?.contextId),
    proposalId: cleanText(decision?.proposalId),
    toneId: cleanText(decision?.toneId),
    referenceId: cleanText(decision?.referenceId),
    intentId: cleanText(decision?.intentId),
    narrativeId: cleanText(decision?.narrativeId),
    formatId: cleanText(decision?.formatId),
    durationId: cleanText(decision?.durationId),
    dayId: cleanText(decision?.dayId),
    hourId: cleanText(decision?.hourId),
    themeId: cleanText(decision?.themeId),
    pautaId: cleanText(decision?.pautaId),
  };
}

function getPrimaryCategory(category: string[]) {
  return category.find((item) => item.trim().length > 0) || "marca observada";
}

const SIGNAL_PRIORITY = [
  "rotina digital",
  "equilibrio digital",
  "notificacao",
  "notificacoes",
  "celular",
  "tecnologia",
  "autocuidado",
  "cuidado pessoal",
  "barulho",
  "vizinho",
  "som alto",
  "som",
  "ruido",
  "pausa interrompida",
  "descanso",
  "conforto",
  "casa",
  "silencio",
  "fone",
  "cancelamento de ruido",
  "audio",
  "rotina domestica",
  "pausa",
  "obra",
  "caos domestico",
  "corrida",
  "treino",
  "performance",
  "prova",
];

const WEAK_VISIBLE_SIGNALS = new Set([
  "bem",
  "estar",
  "vida",
  "base",
  "rotina",
  "relaxar",
  "conteudo",
  "pauta",
  "dia",
  "semana",
]);

function normalizeDisplaySignal(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function sortSignalsByPriority(signals: string[]) {
  return [...signals].sort((a, b) => {
    const priorityA = SIGNAL_PRIORITY.indexOf(normalizeDisplaySignal(a));
    const priorityB = SIGNAL_PRIORITY.indexOf(normalizeDisplaySignal(b));
    const scoreA = priorityA === -1 ? SIGNAL_PRIORITY.length : priorityA;
    const scoreB = priorityB === -1 ? SIGNAL_PRIORITY.length : priorityB;
    return scoreA - scoreB;
  });
}

function getVisibleSignals(signals: string[]) {
  const uniqueSignals = Array.from(new Set(signals.map((signal) => signal.trim()).filter(Boolean)));
  const specificSignals = uniqueSignals.filter((signal) => !WEAK_VISIBLE_SIGNALS.has(normalizeDisplaySignal(signal)));
  const baseSignals = specificSignals.length >= 2 ? specificSignals : uniqueSignals;
  return sortSignalsByPriority(baseSignals).slice(0, VISIBLE_SIGNAL_LIMIT);
}

function hasAnyNormalizedTerm(values: string[], terms: string[]) {
  const normalizedValues = values.map(normalizeDisplaySignal);
  return terms.some((term) => normalizedValues.some((value) => value.includes(term)));
}

function getMatchTextCorpus(match: BrandNarrativeMatchResult) {
  return [
    match.brandName,
    ...match.category,
    ...match.matchedSignals,
    match.rationale,
    match.insertionAngle,
    ...match.suggestedDeliverables,
  ];
}

function shortText(value: string, maxLength = 120) {
  const cleanValue = value.replace(/\s+/g, " ").trim();
  if (cleanValue.length <= maxLength) return cleanValue;
  return `${cleanValue.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildNarrativeConnectionLine(match: BrandNarrativeMatchResult) {
  const brandName = normalizeDisplaySignal(match.brandName);
  const corpus = getMatchTextCorpus(match);
  const visibleSignals = getVisibleSignals(match.matchedSignals);
  const primaryCategory = getPrimaryCategory(match.category);

  if (brandName.includes("bose")) {
    return "Áudio e controle de ruído como resposta ao descanso interrompido.";
  }
  if (brandName.includes("jbl")) {
    return "Som como parte do conflito da narrativa, com entrada natural pelo território de áudio.";
  }
  if (brandName.includes("sony")) {
    return "Tecnologia de áudio conectada à tentativa de recuperar silêncio e foco.";
  }
  if (brandName.includes("philips")) {
    return "Conforto doméstico e tecnologia cotidiana dentro da pausa interrompida.";
  }
  if (brandName.includes("leroy merlin")) {
    return "Casa e ambiente como parte da tentativa de transformar o espaço em descanso.";
  }
  if (brandName.includes("emma") || brandName.includes("zissou") || brandName.includes("ortobom")) {
    return "Conforto e sono como promessa narrativa diante do barulho externo.";
  }
  if (brandName.includes("apple")) {
    return "Celular e notificações como conflito central da tentativa de relaxar.";
  }
  if (brandName.includes("samsung")) {
    return "Tecnologia cotidiana atravessando o momento de descanso.";
  }
  if (brandName.includes("motorola")) {
    return "Celular e rotina digital como ponto de tensão e organização da pausa.";
  }
  if (brandName.includes("natura")) {
    return "Autocuidado natural como tentativa de pausa em meio ao caos cotidiano.";
  }
  if (brandName.includes("o boticario")) {
    return "Ritual de cuidado para recuperar humor e pausa dentro da rotina real.";
  }
  if (brandName.includes("l'oreal") || brandName.includes("l oreal") || brandName.includes("garnier") || brandName.includes("sallve")) {
    return "Cuidado prático de pele ou cabelo dentro de uma pausa possível.";
  }
  if (brandName.includes("nivea") || brandName.includes("dove")) {
    return "Cuidado diário, hidratação e conforto conectados ao descanso real.";
  }
  if (brandName.includes("gatorade")) {
    return "Hidratação e esforço físico conectados à rotina de performance.";
  }
  if (
    brandName.includes("asics") ||
    brandName.includes("adidas") ||
    brandName.includes("nike") ||
    brandName.includes("olympikus")
  ) {
    return "Corrida, treino e performance como eixo natural da narrativa.";
  }

  const isTechnology = hasAnyNormalizedTerm(corpus, [
    "tecnologia",
    "celular",
    "smartphone",
    "notificacao",
    "notificacoes",
    "rotina digital",
    "internet",
  ]);
  const isAudioNoise = hasAnyNormalizedTerm(corpus, [
    "audio",
    "som",
    "barulho",
    "ruido",
    "silencio",
    "fone",
  ]);
  const isHomeComfort = hasAnyNormalizedTerm(corpus, [
    "casa",
    "conforto",
    "sono",
    "descanso",
    "ambiente domestico",
  ]);
  const isBeautyCare = hasAnyNormalizedTerm(corpus, [
    "beleza",
    "autocuidado",
    "cuidado pessoal",
    "skincare",
    "cabelo",
    "fragrancia",
  ]);
  const isWellnessFood = hasAnyNormalizedTerm(corpus, [
    "alimentacao",
    "saudavel",
    "cha",
    "lanche",
    "bem estar",
    "rotina saudavel",
  ]);
  const isSport = hasAnyNormalizedTerm(corpus, [
    "corrida",
    "treino",
    "performance",
    "prova",
    "atleta",
  ]);

  if (isAudioNoise) return "Áudio, silêncio e ruído conectados ao conflito principal da pauta.";
  if (isTechnology) {
    return "Tecnologia cotidiana ligada à rotina digital e às interrupções da pauta.";
  }
  if (isHomeComfort) {
    return "Casa, conforto e descanso como resposta ao conflito cotidiano.";
  }
  if (isBeautyCare) {
    return "Autocuidado e cuidado pessoal como pausa possível dentro da rotina real.";
  }
  if (isWellnessFood) {
    return "Pausa saudável e rotina equilibrada como entrada natural da marca.";
  }
  if (isSport) return "Treino, esforço e performance conectados à história da pauta.";

  const signalText = visibleSignals.length ? visibleSignals.join(", ") : primaryCategory;
  return shortText(`${match.brandName}: ${primaryCategory} conectado a ${signalText}.`);
}

function debugBrandMatches(message: string, payload?: Record<string, unknown>) {
  if (!BRAND_MATCH_DEBUG) return;
  console.debug(`[BrandNarrativeMatchesPanel] ${message}`, payload || {});
}

function debugBrandReportCreate(message: string, payload?: Record<string, unknown>) {
  if (!BRAND_REPORT_CREATE_DEBUG) return;
  console.debug("[BRAND_REPORT_CREATE_CLIENT]", message, payload || {});
}

function getRawMatchItems(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const matches = (payload as { matches?: unknown }).matches;
  return Array.isArray(matches) ? matches : [];
}

function summarizeMatchLevels(matches: unknown[]) {
  return matches.reduce<{ alto: number; medio: number; baixo: number }>(
    (summary, match) => {
      if (!match || typeof match !== "object") return summary;
      const level = (match as Partial<BrandNarrativeMatchResult>).matchLevel;
      if (level === "alto") summary.alto += 1;
      if (level === "medio") summary.medio += 1;
      if (level === "baixo") summary.baixo += 1;
      return summary;
    },
    { alto: 0, medio: 0, baixo: 0 }
  );
}

function summarizeMatches(matches: unknown[]) {
  return matches.map((match) => {
    if (!match || typeof match !== "object") return null;
    const candidate = match as Partial<BrandNarrativeMatchResult>;
    return {
      brandName: candidate.brandName,
      matchLevel: candidate.matchLevel,
      matchScore: candidate.matchScore,
      matchedSignals: candidate.matchedSignals,
    };
  }).filter(Boolean);
}

function resolveEmptyReason(rawMatches: unknown[], filteredMatches: BrandNarrativeMatchResult[]) {
  if (filteredMatches.length > 0) return null;
  if (rawMatches.length === 0) return "endpoint retornou matches vazio";
  const levels = summarizeMatchLevels(rawMatches);
  if (levels.baixo > 0 && levels.alto === 0 && levels.medio === 0) {
    return "endpoint retornou apenas matchLevel baixo, filtrado pelo painel";
  }
  return "matches retornados não passaram na validação/filtro do painel";
}

function normalizeMatchResponse(payload: unknown): BrandNarrativeMatchResult[] {
  if (!payload || typeof payload !== "object") return [];
  const matches = (payload as { matches?: unknown }).matches;
  if (!Array.isArray(matches)) return [];
  return matches
    .filter((match): match is BrandNarrativeMatchResult => {
      if (!match || typeof match !== "object") return false;
      const candidate = match as Partial<BrandNarrativeMatchResult>;
      return Boolean(
        candidate.brandId &&
          candidate.brandName &&
          candidate.slug &&
          (candidate.matchLevel === "alto" || candidate.matchLevel === "medio")
      );
    })
    .slice(0, BRAND_MATCH_LIMIT);
}

const BrandNarrativeMatchesPanel = memo(function BrandNarrativeMatchesPanel({
  decision,
  pauta,
  categories,
  enabled = BRAND_MATCHES_ENABLED,
  compact = false,
}: BrandNarrativeMatchesPanelProps) {
  const [status, setStatus] = useState<MatchRequestState>("idle");
  const [matches, setMatches] = useState<BrandNarrativeMatchResult[]>([]);
  const [localMessage, setLocalMessage] = useState<LocalPanelMessage | null>(null);
  const [generatingReportBrandIds, setGeneratingReportBrandIds] = useState<string[]>([]);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const loadedTrackKeyRef = useRef<string | null>(null);
  const localMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generatingReportBrandIdsRef = useRef<Set<string>>(new Set());

  const cleanDecisionPayload = useMemo(
    () => cleanDecision(decision),
    [
      decision?.contextId,
      decision?.proposalId,
      decision?.toneId,
      decision?.referenceId,
      decision?.intentId,
      decision?.narrativeId,
      decision?.formatId,
      decision?.durationId,
      decision?.dayId,
      decision?.hourId,
      decision?.themeId,
      decision?.pautaId,
    ]
  );

  const cleanPauta = useMemo(
    () => ({
      title: cleanText(pauta?.title),
      description: cleanText(pauta?.description),
      reason: cleanText(pauta?.reason),
      theme: cleanText(pauta?.theme),
      keywords: cleanKeywords(pauta?.keywords),
    }),
    [pauta?.description, pauta?.keywords, pauta?.reason, pauta?.theme, pauta?.title]
  );

  const cleanCategories = useMemo<BrandNarrativeCategories>(
    () => ({
      context: cleanStringArray(categories?.context),
      proposal: cleanStringArray(categories?.proposal),
      tone: cleanStringArray(categories?.tone),
      reference: cleanStringArray(categories?.reference),
      contentIntent: cleanStringArray(categories?.contentIntent),
      narrativeForm: cleanStringArray(categories?.narrativeForm),
      contentSignals: cleanStringArray(categories?.contentSignals),
      stance: cleanStringArray(categories?.stance),
      proofStyle: cleanStringArray(categories?.proofStyle),
      commercialMode: cleanStringArray(categories?.commercialMode),
    }),
    [
      categories?.commercialMode,
      categories?.contentIntent,
      categories?.contentSignals,
      categories?.context,
      categories?.narrativeForm,
      categories?.proofStyle,
      categories?.proposal,
      categories?.reference,
      categories?.stance,
      categories?.tone,
    ]
  );

  const requestPayload = useMemo(
    () => ({
      decision: cleanDecisionPayload,
      pauta: cleanPauta,
      categories: cleanCategories,
      limit: BRAND_MATCH_LIMIT,
    }),
    [cleanCategories, cleanDecisionPayload, cleanPauta]
  );

  const requestKey = useMemo(() => JSON.stringify(requestPayload), [requestPayload]);

  const canFetchMatches = Boolean(enabled && (cleanDecisionPayload.pautaId || cleanPauta.title));

  useEffect(() => {
    return () => {
      if (localMessageTimerRef.current) {
        clearTimeout(localMessageTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canFetchMatches) {
      setStatus("idle");
      setMatches([]);
      return;
    }

    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, BRAND_MATCH_TIMEOUT_MS);

    setStatus("loading");
    setShowAllMatches(false);
    debugBrandMatches("payload enviado ao endpoint", {
      payload: requestPayload,
      categories: cleanCategories,
    });

    void fetch("/api/brand-narratives/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestKey,
      signal: controller.signal,
    })
      .then(async (response) => {
        debugBrandMatches("status da resposta", {
          status: response.status,
          ok: response.ok,
        });
        if (!response.ok) {
          throw new Error(`Brand narrative match request failed with ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        const rawMatches = getRawMatchItems(payload);
        const nextMatches = normalizeMatchResponse(payload);
        debugBrandMatches("matches retornados", {
          count: rawMatches.length,
          levels: summarizeMatchLevels(rawMatches),
          matches: summarizeMatches(rawMatches),
        });
        debugBrandMatches("matches após filtro alto/médio", {
          count: nextMatches.length,
          matches: summarizeMatches(nextMatches),
        });
        const emptyReason = resolveEmptyReason(rawMatches, nextMatches);
        if (emptyReason) {
          debugBrandMatches("motivo do empty state", {
            reason: emptyReason,
            categories: cleanCategories,
            pauta: cleanPauta,
            decision: cleanDecisionPayload,
          });
        }
        setMatches(nextMatches);
        setShowAllMatches(false);
        setStatus("success");

        if (loadedTrackKeyRef.current !== requestKey) {
          loadedTrackKeyRef.current = requestKey;
          track("post_creation_brand_matches_loaded", {
            count: nextMatches.length,
          });
        }
      })
      .catch((error) => {
        if ((controller.signal.aborted || error?.name === "AbortError") && !didTimeout) return;
        setMatches([]);
        setStatus("error");
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [canFetchMatches, requestKey]);

  const showLocalMessage = useCallback((message: LocalPanelMessage) => {
    setLocalMessage(message);
    if (localMessageTimerRef.current) {
      clearTimeout(localMessageTimerRef.current);
    }
    localMessageTimerRef.current = setTimeout(() => {
      setLocalMessage(null);
    }, 4200);
  }, []);

  const handleReportClick = useCallback(
    async (match: BrandNarrativeMatchResult) => {
      if (match.matchLevel === "baixo") return;
      if (generatingReportBrandIdsRef.current.has(match.brandId)) return;

      generatingReportBrandIdsRef.current.add(match.brandId);
      setGeneratingReportBrandIds(Array.from(generatingReportBrandIdsRef.current));
      setLocalMessage(null);

      try {
        debugBrandReportCreate("enviando criação de relatório", {
          brandName: match.brandName,
        });

        const response = await fetch("/api/brand-narratives/reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision: cleanDecisionPayload,
            pauta: cleanPauta,
            brandMatch: match,
          }),
        });

        debugBrandReportCreate("status da criação de relatório", {
          brandName: match.brandName,
          status: response.status,
          ok: response.ok,
        });

        if (!response.ok) {
          throw new Error(`Brand narrative report request failed with ${response.status}`);
        }

        const payload = (await response.json()) as {
          report?: {
            publicSlug?: string;
            publicUrl?: string;
          };
        };
        const publicUrl = payload.report?.publicUrl;
        if (!publicUrl) {
          throw new Error("Brand narrative report response missing publicUrl");
        }

        debugBrandReportCreate("relatório criado", {
          brandName: match.brandName,
          publicSlug: payload.report?.publicSlug,
          publicUrl,
        });

        track("post_creation_brand_report_created", {
          brandName: match.brandName,
          brandId: match.brandId,
          matchLevel: match.matchLevel,
        });

        const opened = window.open(publicUrl, "_blank");
        if (opened) {
          opened.opener = null;
          opened.focus?.();
        } else {
          showLocalMessage({
            text: "O relatório foi gerado. Se a nova aba não abriu, use o link abaixo.",
            href: publicUrl,
          });
        }
      } catch (error) {
        debugBrandReportCreate("erro ao criar relatório", {
          brandName: match.brandName,
          error: error instanceof Error ? error.message : String(error),
        });
        showLocalMessage({ text: REPORT_ERROR_MESSAGE });
      } finally {
        generatingReportBrandIdsRef.current.delete(match.brandId);
        setGeneratingReportBrandIds(Array.from(generatingReportBrandIdsRef.current));
      }
    },
    [cleanDecisionPayload, cleanPauta, showLocalMessage]
  );

  if (!canFetchMatches) return null;

  const isLoading = status === "loading";
  const isError = status === "error";
  const isEmpty = status === "success" && matches.length === 0;
  const hasMoreMatches = matches.length > INITIAL_VISIBLE_MATCHES;
  const displayedMatches = showAllMatches ? matches : matches.slice(0, INITIAL_VISIBLE_MATCHES);

  return (
    <section
      className={cn(
        "w-full rounded-[24px] bg-[linear-gradient(180deg,rgba(250,250,251,0.86)_0%,rgba(248,249,252,0.58)_100%)] px-3 py-4 ring-1 ring-white/70 transform-gpu backface-hidden antialiased will-change-transform",
        compact ? "mt-4" : "mt-2"
      )}
      aria-label="Marcas sugeridas por match narrativo"
    >
      <div className="min-w-0 px-1">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Oportunidade narrativa
        </p>
        <h3 className="mt-1.5 text-[1rem] font-semibold leading-tight tracking-[-0.025em] text-zinc-950">
          Marcas que combinam com essa narrativa
        </h3>
      </div>

      <p className="mx-1 mt-2.5 text-[10.5px] font-semibold leading-4 text-zinc-400">
        Nota: {BRAND_MATCH_DISCLAIMER}
      </p>

      {localMessage ? (
        <div
          className={cn(
            "mt-3 rounded-[16px] border px-3 py-2.5 text-[12px] font-semibold leading-5",
            localMessage.href
              ? "border-sky-200 bg-sky-50 text-sky-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          <p>{localMessage.text}</p>
          {localMessage.href ? (
            <a
              href={localMessage.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
            >
              Abrir relatório gerado
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3.5">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-[18px] bg-zinc-50/90 px-3 py-3 text-[12px] font-semibold text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Buscando marcas com match narrativo...
          </div>
        ) : null}

        {isError ? (
          <div className="flex items-center gap-2 rounded-[18px] bg-rose-50 px-3 py-3 text-[12px] font-semibold text-rose-700">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Não foi possível carregar marcas sugeridas agora.
          </div>
        ) : null}

        {isEmpty ? (
          <div className="rounded-[18px] bg-zinc-50/90 px-3 py-3 text-[12px] font-semibold leading-5 text-zinc-500">
            <p>{BRAND_MATCH_EMPTY_TITLE}</p>
            <p className="mt-1 text-[11.5px] font-medium text-zinc-400">{BRAND_MATCH_EMPTY_SUBTEXT}</p>
          </div>
        ) : null}

        {matches.length ? (
          <div className="space-y-2">
            {displayedMatches.map((match) => {
              const isGeneratingReport = generatingReportBrandIds.includes(match.brandId);
              const visibleSignals = getVisibleSignals(match.matchedSignals);
              const extraSignalsCount = Math.max(0, match.matchedSignals.length - visibleSignals.length);
              const connectionLine = buildNarrativeConnectionLine(match);
              const primaryCategory = getPrimaryCategory(match.category);
              const signalLabel = visibleSignals.length
                ? `${visibleSignals.join(" · ")}${extraSignalsCount > 0 ? ` · +${extraSignalsCount}` : ""}`
                : null;

              return (
              <article
                key={match.brandId}
                className="rounded-[16px] border border-zinc-200/70 bg-white/62 px-3 py-3.5 ring-1 ring-white/75 transition duration-300 hover:border-indigo-100 hover:bg-white hover:ring-indigo-100/80"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <p className="break-words text-[14px] font-bold leading-[1.15] text-zinc-950">
                      {match.brandName}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleReportClick(match)}
                      disabled={isGeneratingReport}
                      aria-label={`${isGeneratingReport ? "Gerando relatório" : "Gerar relatório"} para ${match.brandName}`}
                      className={cn(
                        "group inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold leading-4 transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-wait",
                        isGeneratingReport
                          ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                          : "border-indigo-100 bg-indigo-50/70 text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
                      )}
                    >
                      {isGeneratingReport ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          Gerando...
                        </>
                      ) : (
                        <>
                          Relatório
                          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold leading-4 text-zinc-400">
                      <Tag className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{primaryCategory}</span>
                    </span>
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-[12.5px] font-semibold leading-5 text-zinc-600">
                    {connectionLine}
                  </p>
                  {signalLabel ? (
                    <p className="mt-1.5 line-clamp-1 text-[11px] font-semibold leading-4 text-zinc-500">
                      <span className="text-zinc-400">Sinais </span>
                      {signalLabel}
                    </p>
                  ) : null}
                </div>

              </article>
              );
            })}
            {hasMoreMatches ? (
              <button
                type="button"
                onClick={() => setShowAllMatches((current) => !current)}
                className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-[12px] font-bold text-zinc-700 transition duration-200 hover:border-zinc-300 hover:bg-zinc-50"
              >
                {showAllMatches ? "Ver menos" : "Ver mais marcas"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
});

export default BrandNarrativeMatchesPanel;
