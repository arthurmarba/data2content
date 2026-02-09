// src/app/dashboard/chat/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import ChatPanel from "@/app/dashboard/ChatPanel";
import InstagramConnectCard from "@/app/dashboard/InstagramConnectCard";
import InstagramReconnectBanner from "@/app/dashboard/components/InstagramReconnectBanner";
import TrialBanner from "@/app/dashboard/components/TrialBanner";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { isPlanActiveLike } from "@/utils/planStatus";
import { useToast } from "@/app/components/ui/ToastA11yProvider";
import { openPaywallModal } from "@/utils/paywallModal";
import ChatBillingGate from "@/app/dashboard/components/chat/ChatBillingGate";

type ChatCalcContext = {
  calcId: string;
  context?: string | null;
  justo: number;
  estrategico: number;
  premium: number;
  cpm: number;
  cpmSource?: 'seed' | 'dynamic';
  params?: {
    format?: string | null;
    deliveryType?: 'conteudo' | 'evento' | string | null;
    formatQuantities?: {
      reels?: number;
      post?: number;
      stories?: number;
    } | null;
    eventDetails?: {
      durationHours?: 2 | 4 | 8 | number;
      travelTier?: 'local' | 'nacional' | 'internacional' | string;
      hotelNights?: number;
    } | null;
    eventCoverageQuantities?: {
      reels?: number;
      post?: number;
      stories?: number;
    } | null;
    exclusivity?: string | null;
    usageRights?: string | null;
    complexity?: string | null;
    authority?: string | null;
    seasonality?: string | null;
  };
  metrics: {
    reach: number;
    engagement: number;
    profileSegment: string;
  };
  breakdown?: {
    contentUnits?: number;
    contentJusto?: number;
    eventPresenceJusto?: number;
    coverageUnits?: number;
    coverageJusto?: number;
    travelCost?: number;
    hotelCost?: number;
    logisticsSuggested?: number;
    logisticsIncludedInCache?: boolean;
  } | null;
  avgTicket?: number | null;
  totalDeals?: number | null;
  explanation: string | null;
  createdAt: string | null;
};

export default function ChatHomePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const showIgConnect = sp.get("instagramLinked") === "true";
  const calcId = sp.get("calcId");
  const calcContextType = sp.get("context");

  const { data: session } = useSession();
  const billingStatus = useBillingStatus();
  const instagramConnected = Boolean(session?.user?.instagramConnected);
  const planStatus = (session?.user as any)?.planStatus;
  const isActiveLike = useMemo(
    () => Boolean(billingStatus.hasPremiumAccess || isPlanActiveLike(planStatus)),
    [billingStatus.hasPremiumAccess, planStatus]
  );

  const openedAfterIgRef = useRef(false);
  const { toast } = useToast();
  const [calcContext, setCalcContext] = useState<ChatCalcContext | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);


  // Limpa o parâmetro ?instagramLinked=true do URL após a primeira renderização
  useEffect(() => {
    const params = new URLSearchParams(sp.toString());
    if (params.get("instagramLinked") === "true") {
      params.delete("instagramLinked");
      const next = window.location.pathname + (params.toString() ? `?${params}` : "");
      router.replace(next, { scroll: false });
    }
  }, [sp, router]);

  // Abre o modal após IG conectar (se não tiver plano ativo) — apenas uma vez
  useEffect(() => {
    if (showIgConnect && instagramConnected && !isActiveLike && !openedAfterIgRef.current) {
      openedAfterIgRef.current = true;
      openPaywallModal({ context: "calculator", source: "chat_instagram_link" });
    }
  }, [showIgConnect, instagramConnected, isActiveLike]);

  useEffect(() => {
    if (!calcId) return;
    let cancelled = false;

    const loadCalculationContext = async () => {
      try {
        const response = await fetch(`/api/calculator/${calcId}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          throw new Error((payload as any)?.error || "Não foi possível carregar o cálculo.");
        }

        const metricsPayload = (payload as any)?.metrics ?? {};
        const paramsPayload = (payload as any)?.params ?? {};
        const avgTicket = (payload as any)?.avgTicket;
        const totalDeals = (payload as any)?.totalDeals;

        setCalcContext({
          calcId,
          context: calcContextType ?? null,
          justo: typeof payload?.justo === "number" ? payload.justo : 0,
          estrategico: typeof payload?.estrategico === "number" ? payload.estrategico : 0,
          premium: typeof payload?.premium === "number" ? payload.premium : 0,
          cpm: typeof payload?.cpm === "number" ? payload.cpm : 0,
          cpmSource: (payload as any)?.cpmSource ?? 'dynamic',
          params: {
            format: paramsPayload?.format ?? null,
            deliveryType: paramsPayload?.deliveryType ?? null,
            formatQuantities: paramsPayload?.formatQuantities ?? null,
            eventDetails: paramsPayload?.eventDetails ?? null,
            eventCoverageQuantities: paramsPayload?.eventCoverageQuantities ?? null,
            exclusivity: paramsPayload?.exclusivity ?? null,
            usageRights: paramsPayload?.usageRights ?? null,
            complexity: paramsPayload?.complexity ?? null,
            authority: paramsPayload?.authority ?? null,
            seasonality: paramsPayload?.seasonality ?? null,
          },
          metrics: {
            reach: typeof metricsPayload?.reach === "number" ? metricsPayload.reach : 0,
            engagement: typeof metricsPayload?.engagement === "number" ? metricsPayload.engagement : 0,
            profileSegment: metricsPayload?.profileSegment ?? "default",
          },
          breakdown: (payload as any)?.breakdown ?? null,
          avgTicket: typeof avgTicket === "number" ? avgTicket : null,
          totalDeals: typeof totalDeals === "number" ? totalDeals : null,
          explanation: (payload as any)?.explanation ?? null,
          createdAt: (payload as any)?.createdAt ?? null,
        });

        toast({
          variant: "success",
          title: "Contexto da Calculadora carregado.",
          description: "Posso te ajudar a transformar esse cálculo em um plano de ação.",
        });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Não foi possível carregar o cálculo.";
          toast({ variant: "error", title: message });
        }
      } finally {
        if (cancelled) return;
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(sp.toString());
          if (params.has("calcId")) params.delete("calcId");
          if (params.has("context")) params.delete("context");
          const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
          router.replace(next, { scroll: false });
        }
      }
    };

    loadCalculationContext();
    return () => {
      cancelled = true;
    };
  }, [calcId, calcContextType, router, sp, toast]);

  if (billingStatus.isLoading) {
    return (
      <div className="relative w-full bg-white text-gray-900 flex flex-col overflow-hidden flex-1 min-h-0 items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando...</div>
      </div>
    );
  }

  if (!isActiveLike) {
    return (
      <div className="relative w-full bg-white text-gray-900 flex flex-col overflow-hidden flex-1 min-h-0">
        <ChatBillingGate />
      </div>
    );
  }

  const topSlot = (
    <div className="space-y-4">
      <InstagramReconnectBanner />
      <TrialBanner />
      {showIgConnect ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <InstagramConnectCard
            canAccessFeatures={true}
            onActionRedirect={() => { }}
            showToast={() => { }}
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative w-full h-full min-h-0 bg-white text-gray-900 flex overflow-hidden flex-1">
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full">
        <div className="flex flex-col overflow-hidden w-full h-full min-h-0">
          {/* Chat ocupa todo o restante */}
          <div className="flex-1 w-full min-h-0 h-full relative">
            <ChatPanel
              onUpsellClick={() => openPaywallModal({ context: "default", source: "chat_panel" })}
              calculationContext={calcContext}
              topSlot={topSlot}
              fullHeight
              selectedThreadId={selectedThreadId}
              onSelectThread={setSelectedThreadId}
              onThreadCreated={(newId) => {
                setSelectedThreadId(newId);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
