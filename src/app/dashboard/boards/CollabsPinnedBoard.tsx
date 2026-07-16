"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import Board from "@/app/dashboard/components/Board";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";
import { COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import {
  DiagnosticoCollabsFeed,
  type PautaActionKind,
  type PautaActionState,
} from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabsFeed";
import type { CollabStackDecision } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabStack";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import {
  contentIdeaLocalDecisionStorageKey,
  forgetContentIdeaLocalDecision,
  readContentIdeaLocalDecisions,
  rememberContentIdeaLocalDecision,
} from "@/app/dashboard/boards/videoUpload/contentIdeaLocalDecisions";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import type { PaywallContext } from "@/types/paywall";

const FULL_MAP_ROUTE = "/dashboard/boards/mobile-strategic-profile";
const WHATSAPP_ROUTE = "/dashboard/whatsapp";
const PRO_ROUTE = "/pro";

const IDEAS_API = "/api/dashboard/mobile-strategic-profile/content-ideas";
const PER_PAUTA_API = "/api/dashboard/mobile-strategic-profile/collabs/per-pauta";
const INTEREST_API = "/api/dashboard/mobile-strategic-profile/collabs/interest";
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
  const [collabDecisions, setCollabDecisions] = React.useState<Map<string, CollabStackDecision>>(new Map());
  const [confirmedMatches, setConfirmedMatches] = React.useState<Array<{ pautaId: string; collab: NarrativeCollabMatch }>>([]);
  const [pautaActionStates, setPautaActionStates] = React.useState<Map<string, PautaActionState>>(new Map());
  const [collabsLoading, setCollabsLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const pautaActionInFlightRef = React.useRef<Set<string>>(new Set());
  const narrativeRef = React.useRef<string>("");
  const localPautaDecisionStorageKey = React.useMemo(
    () => contentIdeaLocalDecisionStorageKey(userId),
    [userId],
  );

  React.useEffect(() => {
    const localDecisions = readContentIdeaLocalDecisions(localPautaDecisionStorageKey);
    if (localDecisions.size === 0) return;
    setPautaActionStates((prev) => {
      const next = new Map(prev);
      for (const [id, kind] of localDecisions.entries()) {
        if (!next.has(id)) next.set(id, { kind, phase: "confirmed" });
      }
      return next;
    });
  }, [localPautaDecisionStorageKey]);

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
          pautas: forPautas.map((p) => ({
            id: p.id,
            territory: p.territory,
            title: p.title,
            angle: p.angle,
            hook: p.hook,
            suggestedFormat: p.suggestedFormat,
            scriptBlueprint: p.scriptBlueprint ?? null,
          })),
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

  const setPautaStatus = React.useCallback((id: string, status: ContentIdeaListItem["status"]) => {
    setPautas((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  const setPautaAction = React.useCallback((id: string, state: PautaActionState) => {
    setPautaActionStates((prev) => {
      const next = new Map(prev);
      next.set(id, state);
      return next;
    });
  }, []);

  const clearPautaAction = React.useCallback((id: string) => {
    setPautaActionStates((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const beginPautaAction = React.useCallback((id: string) => {
    if (pautaActionInFlightRef.current.has(id)) return false;
    pautaActionInFlightRef.current.add(id);
    return true;
  }, []);

  const finishPautaAction = React.useCallback((id: string) => {
    pautaActionInFlightRef.current.delete(id);
  }, []);

  const actionErrorMessage = React.useCallback((kind: PautaActionKind, reason?: string) => {
    if (reason === "storage_unavailable") {
      if (kind === "unsave") return "Removida da lista. Não consegui sincronizar; se recarregar, ela pode voltar.";
      if (kind === "dismiss") return "Descartada nesta sessão. Não consegui sincronizar; se recarregar, ela pode voltar.";
      return "Não foi possível salvar agora. Tente novamente.";
    }
    if (kind === "collab-interest") return "Não foi possível registrar a collab agora. Tente novamente.";
    if (kind === "unsave") return "Removida da lista. Não consegui sincronizar; se recarregar, ela pode voltar.";
    if (kind === "dismiss") return "Descartada nesta sessão. Não consegui sincronizar; se recarregar, ela pode voltar.";
    return "Não foi possível salvar agora. Tente novamente.";
  }, []);

  const persistPautaStatus = React.useCallback(async (id: string, status: "saved" | "active" | "dismissed") => {
    const res = await fetch(`${IDEAS_API}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      let reason: string | undefined;
      try {
        const json = await res.json();
        reason = typeof json?.reason === "string" ? json.reason : undefined;
      } catch {
        reason = undefined;
      }
      throw new Error(reason ?? String(res.status));
    }
  }, []);

  const handleSavePauta = React.useCallback((id: string) => {
    if (!isPro) {
      router.push(PRO_ROUTE);
      return;
    }
    if (!beginPautaAction(id)) return;
    forgetContentIdeaLocalDecision(localPautaDecisionStorageKey, id);
    setPautaStatus(id, "saved");
    setPautaAction(id, { kind: "save", phase: "pending" });
    void (async () => {
      try {
        await persistPautaStatus(id, "saved");
        clearPautaAction(id);
      } catch (err) {
        setPautaAction(id, {
          kind: "save",
          phase: "failed",
          message: actionErrorMessage("save", err instanceof Error ? err.message : undefined),
        });
      } finally {
        finishPautaAction(id);
      }
    })();
  }, [actionErrorMessage, beginPautaAction, clearPautaAction, finishPautaAction, isPro, localPautaDecisionStorageKey, persistPautaStatus, router, setPautaAction, setPautaStatus]);

  const handleUnsavePauta = React.useCallback((id: string) => {
    if (!beginPautaAction(id)) return;
    rememberContentIdeaLocalDecision(localPautaDecisionStorageKey, id, "unsave");
    setPautaStatus(id, "dismissed");
    setPautaAction(id, { kind: "unsave", phase: "confirmed" });
    void (async () => {
      try {
        await persistPautaStatus(id, "dismissed");
        setPautaAction(id, { kind: "unsave", phase: "confirmed" });
      } catch {
        setPautaAction(id, { kind: "unsave", phase: "confirmed" });
      } finally {
        finishPautaAction(id);
      }
    })();
  }, [beginPautaAction, finishPautaAction, localPautaDecisionStorageKey, persistPautaStatus, setPautaAction, setPautaStatus]);

  const handleDismissPauta = React.useCallback((id: string) => {
    if (!beginPautaAction(id)) return;
    rememberContentIdeaLocalDecision(localPautaDecisionStorageKey, id, "dismiss");
    setPautaStatus(id, "dismissed");
    setPautaAction(id, { kind: "dismiss", phase: "confirmed" });
    void (async () => {
      try {
        await persistPautaStatus(id, "dismissed");
        clearPautaAction(id);
      } catch {
        setPautaAction(id, { kind: "dismiss", phase: "confirmed" });
      } finally {
        finishPautaAction(id);
      }
    })();
  }, [beginPautaAction, clearPautaAction, finishPautaAction, localPautaDecisionStorageKey, persistPautaStatus, setPautaAction, setPautaStatus]);

  const handleAcceptCollabPauta = React.useCallback((id: string) => {
    if (!isPro) {
      router.push(PRO_ROUTE);
      return;
    }
    if (!beginPautaAction(id)) return;
    const pauta = pautas.find((p) => p.id === id) ?? null;
    const collab = pautaCollabs.get(id) ?? null;
    forgetContentIdeaLocalDecision(localPautaDecisionStorageKey, id);
    setPautaStatus(id, "saved");
    setPautaAction(id, { kind: "save", phase: "pending" });
    void (async () => {
      try {
        await persistPautaStatus(id, "saved");
      } catch (err) {
        setPautaAction(id, {
          kind: "save",
          phase: "failed",
          message: actionErrorMessage("save", err instanceof Error ? err.message : undefined),
        });
        finishPautaAction(id);
        return;
      }

      if (!pauta || !collab) {
        clearPautaAction(id);
        finishPautaAction(id);
        return;
      }

      setPautaAction(id, { kind: "collab-interest", phase: "pending" });
      try {
        const res = await fetch(INTEREST_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pautaId: pauta.id,
            pautaTitle: pauta.title,
            partnerId: collab.id,
            decision: "interested",
            territory: pauta.territory,
            fitReason: collab.narrativeFitReason,
            sharedSignal: collab.sharedSignal,
            recordingIdea: collab.collabRecordingIdea,
            collabBlueprint: collab.collabBlueprint ?? null,
            collabMode: collab.collabMode ?? null,
          }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) throw new Error(typeof json?.reason === "string" ? json.reason : String(res.status));
        setCollabDecisions((prev) => new Map(prev).set(id, "interested"));
        if (json.matched && json.match) {
          setConfirmedMatches((prev) =>
            prev.some((m) => m.pautaId === id) ? prev : [...prev, { pautaId: id, collab: json.match }],
          );
        }
        clearPautaAction(id);
      } catch (err) {
        setPautaAction(id, {
          kind: "collab-interest",
          phase: "failed",
          message: actionErrorMessage("collab-interest", err instanceof Error ? err.message : undefined),
        });
      } finally {
        finishPautaAction(id);
      }
    })();
  }, [
    actionErrorMessage,
    beginPautaAction,
    clearPautaAction,
    finishPautaAction,
    isPro,
    localPautaDecisionStorageKey,
    pautaCollabs,
    pautas,
    persistPautaStatus,
    router,
    setPautaAction,
    setPautaStatus,
  ]);

  const handleRetryPautaAction = React.useCallback((id: string) => {
    const action = pautaActionStates.get(id);
    if (!action) return;
    if (action.kind === "unsave") handleUnsavePauta(id);
    else if (action.kind === "dismiss") handleDismissPauta(id);
    else if (action.kind === "collab-interest") handleAcceptCollabPauta(id);
    else handleSavePauta(id);
  }, [handleAcceptCollabPauta, handleDismissPauta, handleSavePauta, handleUnsavePauta, pautaActionStates]);

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
  // Grupo da comunidade no WhatsApp — Pro entra direto; free vai pro upgrade.
  const handleOpenWhatsAppCommunity = React.useCallback(() => {
    if (isPro) window.open(COMMUNITY_WHATSAPP_URL, "_blank", "noopener,noreferrer");
    else router.push(PRO_ROUTE);
  }, [isPro, router]);

  return (
    <Board
      title="Collabs"
      showTitleMarker={showTitleMarker}
      titleMarkerVariant="chip"
      variant="card"
      showChevron={false}
      showOptions={false}
      contentClassName={`bg-white ${d2cFontVariables}`}
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
        collabDecisions={collabDecisions}
        confirmedMatches={confirmedMatches}
        pautaActionStates={pautaActionStates}
        onRetryPautaAction={handleRetryPautaAction}
        onOpenIdea={goFull}
        onSavePauta={handleSavePauta}
        onUnsavePauta={handleUnsavePauta}
        onAcceptCollabPauta={handleAcceptCollabPauta}
        onDismissPauta={handleDismissPauta}
        onOpenMatch={goFull}
        onOpenWhatsAppCommunity={handleOpenWhatsAppCommunity}
        onConnectWhatsApp={() => router.push(WHATSAPP_ROUTE)}
        onUpgrade={handleUpgrade}
        onGenerate={handleGenerate}
        onBackToPerfil={goFull}
      />
    </Board>
  );
}
