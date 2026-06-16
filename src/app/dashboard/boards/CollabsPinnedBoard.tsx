"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import Board from "@/app/dashboard/components/Board";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { DiagnosticoCollabsFeed } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabsFeed";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import type { PaywallContext } from "@/types/paywall";

const FULL_MAP_ROUTE = "/dashboard/boards/mobile-strategic-profile";
const COMMUNITY_ROUTE = "/dashboard/discover";
const WHATSAPP_ROUTE = "/dashboard/whatsapp";
const PRO_ROUTE = "/pro";

const IDEAS_API = "/api/dashboard/mobile-strategic-profile/content-ideas";
const PER_PAUTA_API = "/api/dashboard/mobile-strategic-profile/collabs/per-pauta";
const SUMMARY_API = "/api/dashboard/strategic-map/summary";

type CollabMap = Map<string, NarrativeCollabMatch | null>;

/**
 * Board "Collabs" na central de controle do desktop. Reusa inteiro o
 * `DiagnosticoCollabsFeed` do mobile (feed de pautas com criador compatível
 * embutido — collab = pauta + conexão), alimentado pelas rotas que já existem:
 *   - GET content-ideas → pautas
 *   - GET strategic-map/summary → narrativa (rótulo p/ o match por território)
 *   - POST collabs/per-pauta → match de criador por pauta
 *   - PATCH content-ideas/[id] → salvar pauta
 *   - POST content-ideas/generate → gerar novas pautas
 *
 * Vitrine: salvar e gerar funcionam inline; as ações mais profundas (abrir
 * detalhe da pauta, mídia kit do criador, comunidade) abrem a experiência
 * completa via deep-link. Edição rica vem numa fase posterior.
 */
export default function CollabsPinnedBoard({
  showTitleMarker = true,
  isHighlighted = false,
}: {
  showTitleMarker?: boolean;
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const billing = useBillingStatus();
  const userId = session?.user?.id ?? null;
  const isPro = Boolean(billing.hasPremiumAccess);

  const [pautas, setPautas] = React.useState<ContentIdeaListItem[]>([]);
  const [pautaCollabs, setPautaCollabs] = React.useState<CollabMap>(new Map());
  const [collabsLoading, setCollabsLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const narrativeRef = React.useRef<string>("");

  const matchCollabs = React.useCallback(async (forPautas: ContentIdeaListItem[]) => {
    const narrative = narrativeRef.current;
    if (!narrative.trim() || forPautas.length === 0) {
      setPautaCollabs(new Map());
      return;
    }
    setCollabsLoading(true);
    try {
      const res = await fetch(PER_PAUTA_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeLabel: narrative,
          pautas: forPautas.map((p) => ({ id: p.id, territory: p.territory, title: p.title })),
        }),
      });
      const json = res.ok ? await res.json() : null;
      if (json?.ok && json.matches) setPautaCollabs(new Map(Object.entries(json.matches)));
    } catch {
      /* silencioso */
    } finally {
      setCollabsLoading(false);
    }
  }, []);

  // Busca pautas + narrativa, e então casa um criador por pauta (território).
  const loadAll = React.useCallback(async () => {
    if (!userId) return;
    try {
      const [ideasRes, summaryRes] = await Promise.all([
        fetch(IDEAS_API, { cache: "no-store" }),
        fetch(SUMMARY_API, { cache: "no-store" }),
      ]);
      const ideasJson = ideasRes.ok ? await ideasRes.json() : null;
      const summaryJson = summaryRes.ok ? await summaryRes.json() : null;
      const nextPautas: ContentIdeaListItem[] = ideasJson?.ideas ?? [];
      narrativeRef.current = summaryJson?.summary?.narrative ?? "";
      setPautas(nextPautas);
      void matchCollabs(nextPautas);
    } catch {
      /* silencioso — o board não derruba a central */
    }
  }, [userId, matchCollabs]);

  React.useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Salvar pauta — otimista, com rollback se o servidor recusar (espelha o mobile).
  const handleToggleSave = React.useCallback((id: string) => {
    if (!isPro) {
      router.push(PRO_ROUTE);
      return;
    }
    let nextStatus: "saved" | "active" = "saved";
    setPautas((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        nextStatus = p.status === "saved" ? "active" : "saved";
        return { ...p, status: nextStatus };
      }),
    );
    void (async () => {
      try {
        const res = await fetch(`${IDEAS_API}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setPautas((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: nextStatus === "saved" ? "active" : "saved" } : p)),
        );
      }
    })();
  }, [isPro, router]);

  const handleGenerate = React.useCallback(() => {
    if (!isPro) {
      router.push(PRO_ROUTE);
      return;
    }
    setGenerating(true);
    void (async () => {
      try {
        await fetch(`${IDEAS_API}/generate`, { method: "POST" });
        await loadAll();
      } catch {
        /* silencioso */
      } finally {
        setGenerating(false);
      }
    })();
  }, [isPro, loadAll, router]);

  const goFull = React.useCallback(() => router.push(FULL_MAP_ROUTE), [router]);
  const handleUpgrade = React.useCallback((_ctx?: PaywallContext) => router.push(PRO_ROUTE), [router]);

  return (
    <Board
      title="Collabs"
      showTitleMarker={showTitleMarker}
      titleMarkerVariant="chip"
      variant="card"
      showChevron={false}
      showOptions={false}
      contentClassName="bg-white"
      titleClassName="text-zinc-950"
      isHighlighted={isHighlighted}
    >
      <DiagnosticoCollabsFeed
        pautas={pautas}
        isPro={isPro}
        whatsappLinked={false}
        isGeneratingIdeas={generating}
        ideaGenerationBlocker={isPro ? null : "premium_required"}
        pautaCollabs={pautaCollabs}
        pautaCollabsLoading={collabsLoading}
        onOpenIdea={goFull}
        onToggleSave={handleToggleSave}
        onOpenCommunity={() => router.push(COMMUNITY_ROUTE)}
        onOpenCreatorMediaKit={goFull}
        onConnectWhatsApp={() => router.push(WHATSAPP_ROUTE)}
        onUpgrade={handleUpgrade}
        onGenerate={handleGenerate}
        onBackToPerfil={goFull}
      />
    </Board>
  );
}
