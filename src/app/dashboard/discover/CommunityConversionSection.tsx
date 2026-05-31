"use client";

import * as React from "react";
import { ArrowRight, Calendar, CheckCircle2, Crown } from "lucide-react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import type { PaywallEventDetail } from "@/types/paywall";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type { HomeSummaryResponse, MentorshipCardData } from "@/app/dashboard/home/types";
import { fetchHomeSummaryCached } from "@/app/dashboard/home/homeSummaryClient";
import { MOBILE_COMMUNITY_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";

const COMMUNITY_VIP_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
  process.env.NEXT_PUBLIC_COMMUNITY_URL ||
  "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c";

function openMentoriaPaywall() {
  try {
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : MOBILE_COMMUNITY_ROUTE;
    const detail: PaywallEventDetail = {
      context: "mentoria",
      source: "community_mentoria",
      returnTo,
      postCheckoutIntent: "join_community",
    };
    window.dispatchEvent(new CustomEvent("open-subscribe-modal", { detail }));
  } catch {
    /* noop */
  }
}

export default function CommunityConversionSection(_props: {
  teaserMode?: boolean;
  compactView?: boolean;
} = {}) {
  const { status: sessionStatus } = useSession();
  const { hasPremiumAccess, needsCheckout, needsPaymentAction } = useBillingStatus();
  const [communitySummary, setCommunitySummary] = React.useState<HomeSummaryResponse["community"] | null>(null);
  const [mentorshipData, setMentorshipData] = React.useState<MentorshipCardData | null>(null);
  const [resolvingVipAccess, setResolvingVipAccess] = React.useState(false);
  const planActive = Boolean(hasPremiumAccess);
  const paymentPending = Boolean(needsCheckout || needsPaymentAction);

  const vipInviteUrl = communitySummary?.vip?.inviteUrl ?? null;
  const vipHasAccess = Boolean(communitySummary?.vip?.hasAccess);
  const communityButtonLabel = paymentPending
    ? "Continuar pagamento"
    : planActive
      ? "Entrar"
      : "Assinar e entrar";

  React.useEffect(() => {
    if (sessionStatus !== "authenticated") {
      setCommunitySummary(null);
      setMentorshipData(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadData = async () => {
      try {
        const payload = await fetchHomeSummaryCached("community");
        if (controller.signal.aborted || cancelled) return;
        setCommunitySummary(payload?.community ?? null);
        setMentorshipData(payload?.mentorship ?? null);
      } catch (error) {
        if (cancelled || (error as Error)?.name === "AbortError") return;
      }
    };

    void loadData();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionStatus]);

  const handleCommunityAccess = React.useCallback(async () => {
    if (!planActive || paymentPending) {
      trackMobileNarrativeEvent("mobile_community_action_clicked", {
        route: MOBILE_COMMUNITY_ROUTE,
        isPro: planActive,
        actionLabel: communityButtonLabel,
        actionType: paymentPending ? "continue_payment" : "open_paywall",
        paywallContext: "mentoria",
        postCheckoutIntent: "join_community",
      });
      openMentoriaPaywall();
      return;
    }

    trackMobileNarrativeEvent("mobile_community_action_clicked", {
      route: MOBILE_COMMUNITY_ROUTE,
      isPro: true,
      actionLabel: communityButtonLabel,
      actionType: "join_community",
      postCheckoutIntent: "join_community",
    });

    if (vipHasAccess && vipInviteUrl) {
      window.open(vipInviteUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setResolvingVipAccess(true);
    try {
      const response = await fetch("/api/plan/status?force=true", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      const normalizedStatus =
        typeof payload?.extras?.normalizedStatus === "string"
          ? payload.extras.normalizedStatus.trim().toLowerCase()
          : "";

      if (normalizedStatus !== "active" && normalizedStatus !== "non_renewing") {
        return;
      }

      setCommunitySummary((prev) => ({
        free: prev?.free ?? { isMember: false, inviteUrl: null },
        vip: {
          hasAccess: true,
          isMember: prev?.vip?.isMember ?? false,
          inviteUrl: prev?.vip?.inviteUrl ?? COMMUNITY_VIP_URL,
          joinedAt: prev?.vip?.joinedAt ?? null,
          needsJoinReminder: prev?.vip?.needsJoinReminder ?? true,
        },
      }));

      window.open(vipInviteUrl ?? COMMUNITY_VIP_URL, "_blank", "noopener,noreferrer");
    } finally {
      setResolvingVipAccess(false);
    }
  }, [communityButtonLabel, paymentPending, planActive, vipHasAccess, vipInviteUrl]);

  return (
    <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="pb-4">
      <motion.section
        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
        className="relative overflow-hidden rounded-[1.75rem] border border-white/60 bg-gradient-to-b from-white/95 to-white/88 px-5 py-5 shadow-[0_4px_20px_rgba(24,24,27,0.07)] backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-primary ring-1 ring-inset ring-brand-primary/12">
                <Crown className="h-3 w-3" />
                Grupo VIP
              </span>
              {/* WhatsApp badge — always visible to communicate the channel */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0fdf4] px-3 py-1 text-[10px] font-semibold text-[#15803d] ring-1 ring-inset ring-[#bbf7d0]">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                via WhatsApp
              </span>
              {planActive && !paymentPending ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 ring-1 ring-inset ring-emerald-500/18">
                  <CheckCircle2 className="h-3 w-3" />
                  Acesso liberado
                </span>
              ) : null}
            </div>

            {/* Title */}
            <h2 className="mt-3 text-lg font-black tracking-tight text-zinc-950">
              {paymentPending
                ? "Finalize seu Plano Pro"
                : planActive
                  ? "Grupo VIP liberado"
                  : "Grupo VIP da D2C"}
            </h2>

            {/* Description */}
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              {paymentPending
                ? "Conclua o pagamento para liberar o Grupo VIP, Instagram e 10 leituras por mês."
                : planActive
                  ? "Clique para entrar agora no WhatsApp e acompanhar a agenda de consultorias."
                  : "Creators Pro trocam estratégia toda semana — análises, feedbacks e acesso direto ao time da D2C."}
            </p>

            {/* Next session badge */}
            {mentorshipData?.nextSessionLabel ? (
              <div className="mt-3">
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-indigo-50/70 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Próxima sessão: {mentorshipData.nextSessionLabel}</span>
                </span>
              </div>
            ) : null}
          </div>

          {/* CTA button */}
          <button
            type="button"
            onClick={handleCommunityAccess}
            disabled={resolvingVipAccess}
            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all disabled:opacity-70 ${
              planActive && !paymentPending
                ? "bg-[#25D366] hover:bg-[#1ebe5d]"
                : "bg-zinc-950 hover:bg-black"
            }`}
          >
            {resolvingVipAccess ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : planActive && !paymentPending ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span>Entrar no grupo</span>
              </>
            ) : (
              <>
                <span>{communityButtonLabel}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}
