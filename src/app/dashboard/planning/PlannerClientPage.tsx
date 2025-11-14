"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import ContentPlannerSection from "@/app/mediakit/components/ContentPlannerSection";
import { useHeaderSetup } from "../context/HeaderContext";
import { track } from "@/lib/track";
import { INSTAGRAM_READ_ONLY_COPY } from "@/app/constants/trustCopy";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

export default function PlannerClientPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slotIdParam = searchParams?.get("slotId") ?? searchParams?.get("slot") ?? null;
  const [initialSlotId, setInitialSlotId] = useState<string | null>(slotIdParam);
  const focusAnchorRef = useRef<HTMLDivElement | null>(null);
  const resumeHandledRef = useRef(false);
  const viewTrackedRef = useRef(false);

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
        <ContentPlannerSection
          userId={userId}
          publicMode={false}
          title="Seu plano da semana (Plano Agência)"
          description="Consistência melhora sua faixa justa e a taxa de aceite nas propostas. Ajuste a semana com as sugestões da IA."
          initialSlotId={initialSlotId}
          onInitialSlotConsumed={() => {
            if (initialSlotId) {
              setInitialSlotId(null);
              router.replace("/planning/planner");
            }
          }}
        />
      </div>
    </main>
  );
}
