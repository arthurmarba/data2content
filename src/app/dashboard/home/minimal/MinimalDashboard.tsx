// src/app/dashboard/home/minimal/MinimalDashboard.tsx
// Contêiner principal da experiência minimalista do dashboard.

"use client";

import React from "react";
import toast from "react-hot-toast";
import type { HomeSummaryResponse, DashboardChecklistStep } from "../types";
import type { DashboardCtaSurface, DashboardCtaTarget } from "../useHomeTelemetry";
import FlowChecklist from "./FlowChecklist";
import ProposalsPanel from "./ProposalsPanel";
import MediaKitSnapshot from "./MediaKitSnapshot";
import ProUpsellCard from "./ProUpsellCard";
import MinimalSkeleton from "./MinimalSkeleton";
import { track } from "@/lib/track";

const AUTO_REFRESH_INTERVAL_MS = 90_000;
const CTA_TARGET_VALUES: DashboardCtaTarget[] = [
  "connect_ig",
  "create_media_kit",
  "open_proposals",
  "analyze_with_ai",
  "copy_kit_link",
  "view_as_brand",
  "edit_kit",
  "activate_pro",
];

const CTA_TARGET_SET = new Set<string>(CTA_TARGET_VALUES);

const STEP_TARGET_FALLBACK: Record<DashboardChecklistStep["id"], DashboardCtaTarget> = {
  connect_ig: "connect_ig",
  create_media_kit: "create_media_kit",
  receive_proposals: "open_proposals",
  respond_with_ai: "analyze_with_ai",
};

function resolveTarget(step: DashboardChecklistStep): DashboardCtaTarget {
  if (step.trackEvent && CTA_TARGET_SET.has(step.trackEvent)) {
    return step.trackEvent as DashboardCtaTarget;
  }
  return STEP_TARGET_FALLBACK[step.id] ?? "open_proposals";
}

export interface MinimalDashboardProps {
  summary: HomeSummaryResponse | null;
  loading: boolean;
  onRefresh: (options?: { silent?: boolean }) => Promise<void> | void;
  onNavigate: (href: string) => void;
  onTriggerPaywall: (reason: "analyze_with_ai" | "activate_pro") => void;
  trackCta: (target: DashboardCtaTarget, surface: DashboardCtaSurface, extra?: Record<string, unknown>) => void;
  creatorId?: string | null;
}

export default function MinimalDashboard({
  summary,
  loading,
  onRefresh,
  onNavigate,
  onTriggerPaywall,
  trackCta,
  creatorId,
}: MinimalDashboardProps) {
  const autoRefreshEnabled = Boolean(summary?.proposalsSummary);

  React.useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = window.setInterval(() => {
      Promise.resolve(onRefresh({ silent: true })).catch(() => {
        // erros silenciosos durante o polling não devem quebrar a UI
      });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled, onRefresh]);

  const handleStepAction = React.useCallback(
    (step: DashboardChecklistStep) => {
      if (!step.actionHref) return;

      if (step.id === "respond_with_ai" && summary?.plan && !summary.plan.hasPremiumAccess) {
        onTriggerPaywall("analyze_with_ai");
        trackCta("activate_pro", "flow_checklist", { origin_step: step.id });
        return;
      }

      trackCta(resolveTarget(step), "flow_checklist", { step_id: step.id });
      onNavigate(step.actionHref);
    },
    [onNavigate, onTriggerPaywall, summary?.plan, trackCta]
  );

  const handleStepShortcut = React.useCallback(
    (step: DashboardChecklistStep) => {
      if (!step.completedHref) return;
      trackCta(resolveTarget(step), "flow_checklist", {
        step_id: step.id,
        shortcut: true,
      });
      onNavigate(step.completedHref);
    },
    [onNavigate, trackCta]
  );

  const flowChecklist = summary?.flowChecklist ?? null;
  const proposalsSummary = summary?.proposalsSummary ?? null;
  const mediaKitCard = summary?.mediaKit ?? null;
  const plan = summary?.plan ?? null;
  const mediaKitShareUrl = mediaKitCard?.shareUrl ?? null;

  const mediaKitId = React.useMemo(() => {
    if (!mediaKitShareUrl) return null;
    try {
      const url = new URL(
        mediaKitShareUrl,
        typeof window !== "undefined" ? window.location.origin : "https://app.data2content.ai"
      );
      const segments = url.pathname.split("/").filter(Boolean);
      return segments.pop() ?? null;
    } catch {
      return null;
    }
  }, [mediaKitShareUrl]);

  const copyMediaKitLink = React.useCallback(
    async (surface: DashboardCtaSurface) => {
      trackCta("copy_kit_link", surface, { origin: surface });

      if (!mediaKitShareUrl) {
        toast.error("Crie seu Mídia Kit para gerar um link compartilhável.");
        return true;
      }

      try {
        await navigator.clipboard.writeText(mediaKitShareUrl);
        toast.success("Link do Mídia Kit copiado!");
        track("copy_media_kit_link", {
          creator_id: creatorId ?? null,
          media_kit_id: mediaKitId,
          origin: surface,
        });
      } catch (error) {
        toast.error("Não foi possível copiar o link agora.");
      }
      return true;
    },
    [creatorId, mediaKitId, mediaKitShareUrl, trackCta]
  );

  const goToConnectInstagram = React.useCallback(
    (surface: DashboardCtaSurface) => {
      trackCta("connect_ig", surface, { origin: "empty_state" });
      onNavigate("/dashboard/instagram/connect");
    },
    [onNavigate, trackCta]
  );

  const goToCreateMediaKit = React.useCallback(
    (surface: DashboardCtaSurface) => {
      trackCta("create_media_kit", surface, { origin: "empty_state" });
      onNavigate("/dashboard/media-kit");
    },
    [onNavigate, trackCta]
  );

  if (!summary && loading) {
    return <MinimalSkeleton />;
  }

  return (
    <div className="grid w-full grid-cols-1 gap-6 pb-8 lg:grid-cols-2 xl:grid-cols-3">
      <section className="xl:col-span-3">
        <FlowChecklist
          loading={loading && !flowChecklist}
          checklist={flowChecklist}
          plan={plan}
          onStepAction={handleStepAction}
          onStepShortcut={handleStepShortcut}
        />
      </section>

      <section className="lg:col-span-2 xl:col-span-2">
        <ProposalsPanel
          loading={loading && !proposalsSummary}
          summary={proposalsSummary}
          onOpenProposals={() => {
            trackCta("open_proposals", "proposals_block");
            onNavigate("/dashboard/proposals");
          }}
          onRespondNow={() => {
            if (plan && plan.hasPremiumAccess) {
              trackCta("analyze_with_ai", "proposals_block");
              onNavigate("/dashboard/proposals?status=novo");
              return;
            }
            onTriggerPaywall("analyze_with_ai");
            trackCta("activate_pro", "proposals_block", { origin: "pending_banner" });
          }}
          onRefresh={() => {
            trackCta("open_proposals", "proposals_block", { intent: "refresh" });
            Promise.resolve(onRefresh({ silent: false })).catch(() => {
              // feedback de erro já tratado via toast no handler superior
            });
          }}
          plan={plan}
          checklistSummary={flowChecklist?.summary ?? null}
          onConnectInstagram={() => goToConnectInstagram("proposals_block")}
          onCreateMediaKit={() => goToCreateMediaKit("proposals_block")}
          onCopyMediaKitLink={() => copyMediaKitLink("proposals_block")}
        />
      </section>

      <section className="lg:col-span-2 xl:col-span-1">
        <MediaKitSnapshot
          loading={loading && !mediaKitCard}
          mediaKit={mediaKitCard}
          onCopyLink={() => copyMediaKitLink("media_kit_block")}
          creatorId={creatorId ?? null}
          onViewAsBrand={() => {
            trackCta("view_as_brand", "media_kit_block");
          }}
          onEdit={() => {
            trackCta("edit_kit", "media_kit_block");
            onNavigate("/dashboard/media-kit");
          }}
        />
      </section>

      <section className="xl:col-span-1">
        <ProUpsellCard
          plan={plan}
          onActivate={() => {
            trackCta("activate_pro", "upsell_block");
            onTriggerPaywall("activate_pro");
          }}
          onNavigate={onNavigate}
          loading={loading && !plan}
        />
      </section>
    </div>
  );
}
