"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import ContentPlannerSection from "@/app/mediakit/components/ContentPlannerSection";
import { useHeaderSetup } from "../context/HeaderContext";
import { track } from "@/lib/track";
import { INSTAGRAM_READ_ONLY_COPY } from "@/app/constants/trustCopy";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";
import DiscoverInsightsSection from "../discover/DiscoverInsightsSection";
import DiscoverBillingGate from "../discover/DiscoverBillingGate";

const MAX_POST_AGE_DAYS = 80;
const MAX_POST_AGE_MS = MAX_POST_AGE_DAYS * 24 * 60 * 60 * 1000;
const INSIGHTS_LIMIT_PER_ROW = 36;

type PlannerPostCard = {
  id: string;
  postDate?: string | null;
  stats?: {
    views?: number;
    total_interactions?: number;
  };
};

type PlannerFeedSection = {
  key: string;
  items?: PlannerPostCard[];
};

type PlannerInsights = {
  viewsP50: number | null;
  viewsP75: number | null;
  interactionsP50: number | null;
  interactionsP75: number | null;
  totalPosts: number;
  topHourLabel: string | null;
  heatmapBuckets: Array<{ label: string; count: number }>;
  sectionsCount: number;
};

function percentile(sortedValues: number[], ratio: number): number | null {
  if (!sortedValues.length) return null;
  if (sortedValues.length === 1) return sortedValues[0] ?? null;
  const index = (sortedValues.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower] ?? null;
  const weight = index - lower;
  return sortedValues[lower]! * (1 - weight) + sortedValues[upper]! * weight;
}

function computeInsightsFromSections(sections: PlannerFeedSection[]): PlannerInsights {
  const cutoff = Date.now() - MAX_POST_AGE_MS;
  const flattened: PlannerPostCard[] = [];

  sections.forEach((section) => {
    const items = Array.isArray(section.items) ? section.items : [];
    items.forEach((item) => {
      if (!item?.postDate) return;
      const timestamp = new Date(item.postDate).getTime();
      if (Number.isNaN(timestamp) || timestamp < cutoff) return;
      flattened.push(item);
    });
  });

  const viewValues = flattened
    .map((item) => item?.stats?.views)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  const interactionValues = flattened
    .map((item) => item?.stats?.total_interactions)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  const sortedViews = viewValues.slice().sort((a, b) => a - b);
  const sortedInteractions = interactionValues.slice().sort((a, b) => a - b);

  const viewsP50 = percentile(sortedViews, 0.5);
  const viewsP75 = percentile(sortedViews, 0.75);
  const interactionsP50 = percentile(sortedInteractions, 0.5);
  const interactionsP75 = percentile(sortedInteractions, 0.75);

  const hourBuckets = new Map<string, number>();
  flattened.forEach((item) => {
    if (!item?.postDate) return;
    const timestamp = new Date(item.postDate).getTime();
    if (Number.isNaN(timestamp)) return;
    const hour = new Date(timestamp).getHours();
    const label =
      hour >= 6 && hour < 12
        ? "Manhã (6h-11h)"
        : hour >= 12 && hour < 18
        ? "Tarde (12h-17h)"
        : hour >= 18 && hour < 24
        ? "Noite (18h-23h)"
        : "Madrugada (0h-5h)";
    hourBuckets.set(label, (hourBuckets.get(label) || 0) + 1);
  });

  let topHourLabel: string | null = null;
  for (const [label, count] of hourBuckets.entries()) {
    if (!topHourLabel || (hourBuckets.get(topHourLabel) || 0) < count) {
      topHourLabel = label;
    }
  }

  const heatmapBuckets = Array.from(hourBuckets.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    viewsP50,
    viewsP75,
    interactionsP50,
    interactionsP75,
    totalPosts: flattened.length,
    topHourLabel,
    heatmapBuckets,
    sectionsCount: sections.length,
  };
}

type PlannerCardProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

function PlannerCard({ eyebrow, title, description, actions, children }: PlannerCardProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
          )}
          <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h3>
          {description && <p className="text-sm text-slate-600">{description}</p>}
        </div>
        {actions ? <div className="sm:shrink-0">{actions}</div> : null}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

export default function PlannerClientPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slotIdParam = searchParams?.get("slotId") ?? searchParams?.get("slot") ?? null;
  const [initialSlotId, setInitialSlotId] = useState<string | null>(slotIdParam);
  const focusAnchorRef = useRef<HTMLDivElement | null>(null);
  const resumeHandledRef = useRef(false);
  const viewTrackedRef = useRef(false);
  const [insights, setInsights] = useState<PlannerInsights | null>(null);
  const [insightsStatus, setInsightsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    setInitialSlotId(slotIdParam);
  }, [slotIdParam]);

  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);
  const userId = (session?.user as any)?.id as string | undefined;

  useHeaderSetup(
    {
      variant: "compact",
      showSidebarToggle: true,
      showUserMenu: true,
      sticky: true,
      contentTopPadding: 8,
      title: undefined,
      subtitle: undefined,
      condensedOnScroll: false,
    },
    []
  );

  const handleConnectInstagram = useCallback(() => {
    track("planner_gate_cta_click", { cta: "connect_instagram" });
    router.push("/dashboard?intent=instagram");
  }, [router]);

  const handleExploreCommunity = useCallback(() => {
    track("planner_gate_cta_click", { cta: "explore_community" });
    router.push("/planning/discover");
  }, [router]);

  const handleOpenPlannerDemo = useCallback(() => {
    track("planner_gate_cta_click", { cta: "open_demo" });
    router.push("/planning/demo");
  }, [router]);

  useEffect(() => {
    if (viewTrackedRef.current) return;
    if (status !== "authenticated") return;
    if (!userId) return;
    track("planning_viewed", { creator_id: userId, surface: "planner_page" });
    viewTrackedRef.current = true;
  }, [status, userId]);

  useEffect(() => {
    if (resumeHandledRef.current) return;
    if (status !== "authenticated") return;
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
      if (!stored) return;
      const data = JSON.parse(stored);
      if (data?.context !== "planning") return;
      window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
      resumeHandledRef.current = true;
      focusAnchorRef.current?.focus({ preventScroll: false });
    } catch {
      try {
        window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;
    const controller = new AbortController();
    setInsightsStatus("loading");
    setInsights(null);

    fetch(`/api/discover/feed?limitPerRow=${INSIGHTS_LIMIT_PER_ROW}`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error("invalid_response");
        }
        const sections: PlannerFeedSection[] = Array.isArray(payload.sections) ? payload.sections : [];
        setInsights(computeInsightsFromSections(sections));
        setInsightsStatus("ready");
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;
        setInsights(null);
        setInsightsStatus("error");
      });

    return () => {
      controller.abort();
    };
  }, [status, userId]);

  if (status === "loading") {
    return (
      <main className="w-full max-w-none pb-12">
        <div className="mx-auto max-w-[800px] px-3 sm:px-4 lg:max-w-7xl lg:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
            <div className="flex items-center gap-3 text-slate-700">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg">
                ⏳
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Carregando seu planejamento</p>
                <p className="text-xs text-slate-500">Estamos validando sua sessão para montar o calendário inteligente.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="w-full max-w-none pb-12">
        <div className="mx-auto max-w-[800px] px-3 sm:px-4 lg:max-w-7xl lg:px-6">
          <p className="text-sm text-gray-500">
            Você precisa estar autenticado para acessar o planejamento.
          </p>
        </div>
      </main>
    );
  }

  if (status === "authenticated" && !instagramConnected) {
    return (
      <main className="w-full max-w-none pb-12">
        <div className="mx-auto max-w-[800px] px-3 sm:px-4 lg:max-w-7xl lg:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planner IA</span>
            <h2 className="mt-4 text-2xl font-semibold text-slate-900">Conecte seu Instagram em menos de 2 minutos</h2>
            <p className="mt-2 text-sm text-slate-600">
              Liberamos horários quentes e pautas prontas assim que o perfil estiver sincronizado.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={handleConnectInstagram}
                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:w-auto"
              >
                Conectar agora
              </button>
              <button
                type="button"
                onClick={handleOpenPlannerDemo}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Ver planner demo
              </button>
              <button
                type="button"
                onClick={handleExploreCommunity}
                className="inline-flex items-center justify-center text-sm font-semibold text-slate-500 underline underline-offset-4 hover:text-slate-900 sm:ml-3"
              >
                Explorar comunidade
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">{INSTAGRAM_READ_ONLY_COPY}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-none pb-12">
      <div
        ref={focusAnchorRef}
        tabIndex={-1}
        className="mx-auto max-w-[800px] px-3 sm:px-4 lg:max-w-7xl lg:px-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
      >
        <div className="space-y-8">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planner IA</p>
            <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Planeje com IA e mantenha o ritmo pelo WhatsApp
            </h2>
            <p className="text-sm text-slate-600">
              Organize os slots da semana, gere roteiros e ative alertas no celular para não perder os horários quentes.
            </p>
          </section>

          <PlannerCard
            eyebrow="Ative o WhatsApp IA"
            title="Receba alertas e ajustes direto no celular"
            description="Use o estrategista no WhatsApp para lembrar horários quentes, validar pautas e puxar benchmarks."
            actions={<DiscoverBillingGate />}
          />

          <ContentPlannerSection
            userId={userId}
            publicMode={false}
            title="Seu plano da semana (Plano Agência)"
            initialSlotId={initialSlotId}
            onInitialSlotConsumed={() => {
              if (initialSlotId) {
                setInitialSlotId(null);
                router.replace("/planning/planner");
              }
            }}
          />

          {insightsStatus === "loading" && (
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-600 shadow-sm sm:px-6">
              Carregando insights do seu segmento…
            </div>
          )}

          {insightsStatus === "ready" && insights && (
            <DiscoverInsightsSection
              viewsP50={insights.viewsP50 ?? undefined}
              viewsP75={insights.viewsP75 ?? undefined}
              interactionsP50={insights.interactionsP50 ?? undefined}
              interactionsP75={insights.interactionsP75 ?? undefined}
              totalPosts={insights.totalPosts}
              topHourLabel={insights.topHourLabel ?? undefined}
              heatmapBuckets={insights.heatmapBuckets}
              sampleWindowDays={MAX_POST_AGE_DAYS}
              sectionsCount={insights.sectionsCount}
            />
          )}

          {insightsStatus === "error" && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 shadow-sm sm:px-6">
              Não conseguimos carregar os insights agora. Tente novamente em instantes.
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
