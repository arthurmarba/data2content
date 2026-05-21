"use client";

import * as React from "react";
import { ArrowRight, Calendar, CheckCircle2, Crown } from "lucide-react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import type { PaywallEventDetail } from "@/types/paywall";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type { HomeSummaryResponse, MentorshipCardData } from "@/app/dashboard/home/types";
import { fetchHomeSummaryCached } from "@/app/dashboard/home/homeSummaryClient";

const COMMUNITY_VIP_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
  process.env.NEXT_PUBLIC_COMMUNITY_URL ||
  "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c";

function openMentoriaPaywall() {
  try {
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}${window.location.hash}`
        : "/dashboard/discover";
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
      ? "Entrar na consultoria"
      : "Assinar Pro e entrar";

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
      openMentoriaPaywall();
      return;
    }

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
  }, [paymentPending, planActive, vipHasAccess, vipInviteUrl]);

  return (
    <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="pb-4">
      <motion.section
        variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
        className="relative overflow-hidden rounded-[1.25rem] border border-zinc-200/70 bg-white px-5 py-5 shadow-sm"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-primary ring-1 ring-inset ring-brand-primary/12">
                <Crown className="h-3 w-3" />
                Grupo VIP
              </span>
              {planActive && !paymentPending ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 ring-1 ring-inset ring-emerald-500/18">
                  <CheckCircle2 className="h-3 w-3" />
                  Acesso liberado
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-lg font-black tracking-tight text-zinc-950">
              {paymentPending
                ? "Finalize seu Plano Pro"
                : planActive
                  ? "Seu acesso à consultoria está liberado"
                  : "Consultoria em grupo da D2C"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              {paymentPending
                ? "Conclua o pagamento para liberar consultoria, Instagram e 10 leituras por mês."
                : planActive
                  ? "Entre no Grupo VIP para acompanhar a agenda e participar dos encontros."
                  : "No Plano Pro, você entra no Grupo VIP, participa das consultorias em grupo e libera o Perfil vivo com 10 leituras por mês e Instagram conectado."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {planActive && !paymentPending ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200/70">
                  via WhatsApp
                </span>
              ) : null}
              {mentorshipData?.nextSessionLabel ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-indigo-50/70 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="truncate">Próxima consultoria: {mentorshipData.nextSessionLabel}</span>
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCommunityAccess}
            disabled={resolvingVipAccess}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-black disabled:opacity-70"
          >
            {resolvingVipAccess ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
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
