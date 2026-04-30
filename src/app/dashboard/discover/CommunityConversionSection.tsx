"use client";

import * as React from "react";
import { ArrowRight, Sparkles, Users, FileEdit, Play, Target, CheckCircle2, Crown, Calendar, Instagram } from "lucide-react";
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

const MENTORING_TRACKS = [
  {
    eyebrow: "Networking",
    title: "Comunidade de Criadores",
    description: "Trocas práticas com creators em momentos parecidos.",
    icon: Users,
    color: "text-blue-600",
    bg: "bg-blue-50/40 border-blue-100/50",
    glow: "shadow-blue-500/10",
  },
  {
    eyebrow: "Execução",
    title: "Revisão de Conteúdo",
    description: "Ajustes objetivos de posts, formato e execução técnica.",
    icon: Play,
    color: "text-rose-600",
    bg: "bg-rose-50/40 border-rose-100/50",
    glow: "shadow-rose-500/10",
  },
  {
    eyebrow: "Roteiro",
    title: "Refino de Ideias",
    description: "Otimização de roteiros e ganchos antes de publicar.",
    icon: FileEdit,
    color: "text-amber-600",
    bg: "bg-amber-50/40 border-amber-100/50",
    glow: "shadow-amber-500/10",
  },
  {
    eyebrow: "Estratégia",
    title: "Análise Direcionada",
    description: "Direção clara para posicionamento e novos movimentos.",
    icon: Target,
    color: "text-emerald-600",
    bg: "bg-emerald-50/40 border-emerald-100/50",
    glow: "shadow-emerald-500/10",
  },
];

const MENTORING_STEPS = [
  {
    label: "Conta Ativa",
    description: "Seu cadastro na Data2Content.",
    icon: Users,
  },
  {
    label: "Plano Pro",
    description: "Libere o acesso às mentorias.",
    icon: Crown,
  },
  {
    label: "Instagram",
    description: "Conecte sua conta para análise.",
    icon: Instagram,
  },
  {
    label: "Grupo VIP",
    description: "Entre no grupo para o link ao vivo.",
    icon: ArrowRight,
  },
];

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
    };
    window.dispatchEvent(new CustomEvent("open-subscribe-modal", { detail }));
  } catch {
    /* noop */
  }
}

export default function CommunityConversionSection(props: {
  teaserMode?: boolean;
  compactView?: boolean;
}) {
  const { compactView = false } = props;
  const { status: sessionStatus } = useSession();
  const { hasPremiumAccess } = useBillingStatus();
  const [communitySummary, setCommunitySummary] = React.useState<HomeSummaryResponse["community"] | null>(null);
  const [mentorshipData, setMentorshipData] = React.useState<MentorshipCardData | null>(null);
  const [resolvingVipAccess, setResolvingVipAccess] = React.useState(false);
  const planActive = Boolean(hasPremiumAccess);

  const communityButtonLabel = planActive
    ? "Acessar Grupo VIP"
    : "Participar da Mentoria";

  const vipInviteUrl = communitySummary?.vip?.inviteUrl ?? null;
  const vipHasAccess = Boolean(communitySummary?.vip?.hasAccess);

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
        if (!cancelled) {
          setCommunitySummary(payload?.community ?? null);
          setMentorshipData(payload?.mentorship ?? null);
        }
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
    if (!planActive) {
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
  }, [planActive, vipHasAccess, vipInviteUrl]);

  const isCompact = compactView;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className={isCompact ? "space-y-4 pb-6" : "space-y-8 pb-10"}
    >
      <motion.section
        variants={itemVariants}
        className={`relative overflow-hidden border border-zinc-200/70 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.035)] ${
          isCompact ? "rounded-[1.35rem] px-5 py-5" : "rounded-[1.8rem] px-7 py-7"
        }`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-primary ring-1 ring-inset ring-brand-primary/12">
              <Crown className="h-3 w-3" />
              Mentoria VIP
            </span>
            {planActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600 ring-1 ring-inset ring-emerald-500/18">
                <CheckCircle2 className="h-3 w-3" />
                Acesso liberado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-500 ring-1 ring-inset ring-zinc-200/70">
                Plano Pro
              </span>
            )}
          </div>

          <div className="max-w-[34rem]">
            <h1 className={`font-black tracking-tight text-zinc-950 ${
              isCompact ? "text-[1.55rem] leading-[1.05]" : "text-[2.35rem] leading-[1.02]"
            }`}>
              Mentoria para criar com mais direção.
            </h1>
            <p className={`mt-3 max-w-xl text-zinc-500 ${isCompact ? "text-[13.5px] leading-5" : "text-base leading-7"}`}>
              Análise de perfil, revisão de ideias e encontros ao vivo para ajustar conteúdo, roteiro e posicionamento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200/70">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              Quintas às 19h
            </span>
            {planActive && mentorshipData?.nextSessionLabel ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-indigo-50/70 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                <span className="truncate">Próxima: {mentorshipData.nextSessionLabel}</span>
              </span>
            ) : null}
            {!planActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200/70">
                R$ 49,90/mês
              </span>
            ) : null}
          </div>
        </div>
      </motion.section>

      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="h-px flex-1 bg-zinc-100" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">O que você recebe</h2>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>

        <div className={`grid gap-4 ${isCompact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
          {MENTORING_TRACKS.map((track) => {
            const Icon = track.icon;
            return (
              <motion.div
                key={track.title}
                variants={itemVariants}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-sm transition-all duration-500 hover:shadow-2xl hover:shadow-zinc-200/60"
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${track.bg} group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className={`h-7 w-7 ${track.color}`} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${track.color} opacity-80`}>
                      {track.eyebrow}
                    </p>
                    <h3 className="mt-1 text-base font-bold text-zinc-900 tracking-tight">
                      {track.title}
                    </h3>
                    <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
                      {track.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="relative">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-100" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            Como funciona seu acesso
          </h2>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>

        <div className="overflow-hidden rounded-[1.25rem] border border-zinc-100 bg-white">
          {MENTORING_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.label}
                variants={itemVariants}
                className={`flex items-center gap-3 px-4 py-3.5 ${
                  index > 0 ? "border-t border-zinc-100" : ""
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-zinc-500 ring-1 ring-inset ring-zinc-200/70">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold leading-tight text-zinc-950">
                    {index + 1}. {step.label}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-5 text-zinc-500">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="mt-12 flex justify-center pb-12">
        <motion.div 
          className="pointer-events-auto w-full max-w-md px-4"
          whileHover={{ y: -4 }} 
          whileTap={{ scale: 0.97 }}
        >
          <button
            type="button"
            onClick={handleCommunityAccess}
            disabled={resolvingVipAccess}
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-zinc-950 py-4 text-sm font-bold text-white shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all hover:bg-black disabled:opacity-70"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
            
            {/* Subtle inner border for premium feel */}
            <div className="absolute inset-0 rounded-full border border-white/10" />

            {resolvingVipAccess ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <>
                <span className="relative z-10 tracking-tight">{communityButtonLabel}</span>
                <div className="relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-300 group-hover:bg-brand-primary group-hover:translate-x-1">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </>
            )}
          </button>
        </motion.div>
      </section>
    </motion.div>
  );
}
