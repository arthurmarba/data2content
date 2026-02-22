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
import SurveyModal from "./SurveyModal";

const AUTO_REFRESH_INTERVAL_MS = 90_000;
const PROPOSAL_COPY_FEEDBACK_MS = 20_000;
const CTA_TARGET_VALUES: DashboardCtaTarget[] = [
  "connect_ig",
  "create_media_kit",
  "open_proposals",
  "analyze_with_ai",
  "copy_kit_link",
  "copy_proposal_form_link",
  "view_as_brand",
  "edit_kit",
  "activate_pro",
  "open_creator_survey",
];

const CTA_TARGET_SET = new Set<string>(CTA_TARGET_VALUES);

const STEP_TARGET_FALLBACK: Record<DashboardChecklistStep["id"], DashboardCtaTarget> = {
  connect_ig: "connect_ig",
  create_media_kit: "create_media_kit",
  receive_proposals: "open_proposals",
  respond_with_ai: "analyze_with_ai",
  share_proposal_form_link: "copy_proposal_form_link",
  personalize_support: "open_creator_survey",
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
  const proposalCopyFeedbackTimerRef = React.useRef<number | null>(null);
  const [proposalCopyFeedbackVisible, setProposalCopyFeedbackVisible] = React.useState(false);

  const showProposalCopyFeedback = React.useCallback(() => {
    setProposalCopyFeedbackVisible(true);
    if (typeof window === "undefined") return;
    if (proposalCopyFeedbackTimerRef.current) {
      window.clearTimeout(proposalCopyFeedbackTimerRef.current);
    }
    proposalCopyFeedbackTimerRef.current = window.setTimeout(() => {
      setProposalCopyFeedbackVisible(false);
      proposalCopyFeedbackTimerRef.current = null;
    }, PROPOSAL_COPY_FEEDBACK_MS);
  }, []);

  React.useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = window.setInterval(() => {
      Promise.resolve(onRefresh({ silent: true })).catch(() => {
        // erros silenciosos durante o polling não devem quebrar a UI
      });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled, onRefresh]);

  React.useEffect(
    () => () => {
      if (proposalCopyFeedbackTimerRef.current && typeof window !== "undefined") {
        window.clearTimeout(proposalCopyFeedbackTimerRef.current);
      }
    },
    []
  );

  const flowChecklist = summary?.flowChecklist ?? null;
  const proposalsSummary = summary?.proposalsSummary ?? null;
  const mediaKitCard = summary?.mediaKit ?? null;
  const plan = summary?.plan ?? null;
  const mediaKitShareUrl = mediaKitCard?.shareUrl ?? null;
  const proposalFormShareUrl = mediaKitCard?.proposalFormUrl ?? null;

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

  const tryCopyShareUrl = React.useCallback(
    async (shareUrl: string): Promise<"clipboard" | "execCommand" | null> => {
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && typeof window !== "undefined" && window.isSecureContext) {
          await navigator.clipboard.writeText(shareUrl);
          return "clipboard";
        }
      } catch {
        // fallback
      }

      try {
        if (typeof document === "undefined") return null;
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (success) return "execCommand";
      } catch {
        // ignore
      }
      return null;
    },
    []
  );

  const copyMediaKitLink = React.useCallback(
    async (surface: DashboardCtaSurface) => {
      trackCta("copy_kit_link", surface, { origin: surface });

      if (!mediaKitShareUrl) {
        toast.error("Crie seu Mídia Kit para gerar um link compartilhável.");
        return true;
      }

      try {
        const copyMethod = await tryCopyShareUrl(mediaKitShareUrl);
        if (copyMethod) {
          toast.success("Link do Mídia Kit copiado!");
          track("copy_media_kit_link", {
            creator_id: creatorId ?? null,
            media_kit_id: mediaKitId,
            origin: surface,
          });
        } else {
          toast.error("Não foi possível copiar. Toque e segure para copiar manualmente.");
        }
      } catch (error) {
        toast.error("Não foi possível copiar. Toque e segure para copiar manualmente.");
      }
      return true;
    },
    [creatorId, mediaKitId, mediaKitShareUrl, trackCta, tryCopyShareUrl]
  );

  const copyProposalFormLink = React.useCallback(
    async (surface: DashboardCtaSurface) => {
      trackCta("copy_proposal_form_link", surface, { origin: surface });

      if (!plan?.hasPremiumAccess) {
        toast.error("Ative sua assinatura para liberar o link do formulário.");
        return true;
      }

      let proposalUrl = proposalFormShareUrl;
      if (!proposalUrl) {
        try {
          const response = await fetch("/api/users/media-kit-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body?.error || "Falha ao gerar link do formulário.");
          }

          const generatedBaseUrl =
            typeof body?.url === "string" ? body.url.trim() : "";
          if (!generatedBaseUrl) {
            throw new Error("Falha ao gerar link do formulário.");
          }

          const url = new URL(
            generatedBaseUrl,
            typeof window !== "undefined" ? window.location.origin : "https://app.data2content.ai"
          );
          url.searchParams.set("proposal", "only");
          proposalUrl = url.toString();
        } catch {
          toast.error("Não foi possível gerar o link do formulário agora.");
          return true;
        }
      }

      try {
        const response = await fetch("/api/dashboard/home/proposal-link-copied", {
          method: "POST",
        });
        if (response.ok) {
          void Promise.resolve(onRefresh({ silent: true })).catch(() => {
            // se falhar aqui, a UI atualiza no próximo polling automático
          });
        }
      } catch {
        // falha de marcação não deve bloquear a cópia do link
      }

      try {
        const copyMethod = await tryCopyShareUrl(proposalUrl);
        if (copyMethod) {
          showProposalCopyFeedback();
          toast.success("Link copiado. Agora cole na bio do Instagram.");
          track("copy_proposal_form_link", {
            creator_id: creatorId ?? null,
            media_kit_id: mediaKitId,
            origin: surface,
          });
        } else {
          if (typeof window !== "undefined") {
            window.prompt("Copie manualmente o link do formulário:", proposalUrl);
          } else {
            toast.error("Não foi possível copiar. Toque e segure para copiar manualmente.");
          }
        }
      } catch {
        toast.error("Não foi possível copiar. Toque e segure para copiar manualmente.");
      }
      return true;
    },
    [
      creatorId,
      mediaKitId,
      onRefresh,
      plan?.hasPremiumAccess,
      proposalFormShareUrl,
      trackCta,
      tryCopyShareUrl,
      showProposalCopyFeedback,
    ]
  );

  const handleStepAction = React.useCallback(
    (step: DashboardChecklistStep) => {
      if (step.id === "share_proposal_form_link") {
        if (!summary?.plan?.hasPremiumAccess) {
          onTriggerPaywall("activate_pro");
          trackCta("activate_pro", "flow_checklist", { origin_step: step.id });
          return;
        }
        void copyProposalFormLink("flow_checklist");
        return;
      }

      if (step.id === "personalize_support") {
        trackCta("open_creator_survey", "flow_checklist", { step_id: step.id });
        setShowSurveyModal(true);
        return;
      }

      if (!step.actionHref) return;

      if (step.id === "respond_with_ai" && summary?.plan && !summary.plan.hasPremiumAccess) {
        onTriggerPaywall("analyze_with_ai");
        trackCta("activate_pro", "flow_checklist", { origin_step: step.id });
        return;
      }

      trackCta(resolveTarget(step), "flow_checklist", { step_id: step.id });
      onNavigate(step.actionHref);
    },
    [copyProposalFormLink, onNavigate, onTriggerPaywall, summary?.plan, trackCta]
  );

  const handleStepShortcut = React.useCallback(
    (step: DashboardChecklistStep) => {
      if (step.id === "share_proposal_form_link") {
        if (!summary?.plan?.hasPremiumAccess) {
          onTriggerPaywall("activate_pro");
          trackCta("activate_pro", "flow_checklist", { origin_step: step.id, shortcut: true });
          return;
        }
        void copyProposalFormLink("flow_checklist");
        return;
      }

      if (step.id === "personalize_support") {
        trackCta("open_creator_survey", "flow_checklist", { step_id: step.id, shortcut: true });
        setShowSurveyModal(true);
        return;
      }

      if (!step.completedHref) return;
      trackCta(resolveTarget(step), "flow_checklist", {
        step_id: step.id,
        shortcut: true,
      });
      onNavigate(step.completedHref);
    },
    [copyProposalFormLink, onNavigate, onTriggerPaywall, summary?.plan, trackCta]
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

  const [showSurveyModal, setShowSurveyModal] = React.useState(false);

  if (!summary && loading) {
    return <MinimalSkeleton />;
  }

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-6 pb-8 lg:grid-cols-2 xl:grid-cols-3">
        <section className="xl:col-span-3">
          <FlowChecklist
            loading={loading && !flowChecklist}
            checklist={flowChecklist}
            plan={plan}
            creatorId={creatorId}
            proposalCopyFeedbackVisible={proposalCopyFeedbackVisible}
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

      <SurveyModal
        open={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        onSaved={() => {
          setShowSurveyModal(false);
          Promise.resolve(onRefresh({ silent: false })).catch(() => undefined);
        }}
      />
    </>
  );
}
