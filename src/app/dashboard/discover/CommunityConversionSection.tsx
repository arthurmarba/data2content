"use client";

import * as React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import type { PaywallEventDetail } from "@/types/paywall";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type { HomeSummaryResponse } from "@/app/dashboard/home/types";

type CommunityConversionSectionProps = {
  teaserMode?: boolean;
  compactView?: boolean;
};

const COMMUNITY_VIP_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
  process.env.NEXT_PUBLIC_COMMUNITY_URL ||
  "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c";

const MENTORING_TRACKS = [
  {
    eyebrow: "Comunidade",
    title: "Networking entre creators",
    description: "Trocas práticas com creators em momentos parecidos.",
  },
  {
    eyebrow: "Conteúdo",
    title: "Revisão de conteúdo",
    description: "Ajustes objetivos de posts, formato e execução.",
  },
  {
    eyebrow: "Roteiro",
    title: "Revisão de roteiro",
    description: "Refino de ideias e roteiros antes de publicar.",
  },
  {
    eyebrow: "Estratégia",
    title: "Análise estratégica",
    description: "Direção para posicionamento, crescimento e próximos movimentos.",
  },
];

const MENTORING_STEPS = [
  {
    label: "Entrar com Google",
    description: "Crie sua conta para continuar.",
  },
  {
    label: "Ativar o Plano Pro",
    description: "Desbloqueie a mentoria.",
  },
  {
    label: "Entrar no grupo VIP",
    description: "Receba os acessos e participe.",
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

export default function CommunityConversionSection({
  teaserMode = false,
  compactView = false,
}: CommunityConversionSectionProps) {
  const { status: sessionStatus } = useSession();
  const { hasPremiumAccess } = useBillingStatus();
  const [communitySummary, setCommunitySummary] = React.useState<HomeSummaryResponse["community"] | null>(null);
  const [resolvingVipAccess, setResolvingVipAccess] = React.useState(false);
  const planActive = Boolean(hasPremiumAccess);
  const communityButtonLabel = planActive
    ? "Entrar no grupo VIP"
    : "Participar da mentoria";
  const vipInviteUrl = communitySummary?.vip?.inviteUrl ?? null;
  const vipHasAccess = Boolean(communitySummary?.vip?.hasAccess);

  React.useEffect(() => {
    if (sessionStatus !== "authenticated") {
      setCommunitySummary(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadCommunitySummary = async () => {
      try {
        const response = await fetch("/api/dashboard/home/summary?scope=community", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: HomeSummaryResponse | null };
        if (!cancelled) {
          setCommunitySummary(payload?.data?.community ?? null);
        }
      } catch (error) {
        if (cancelled || (error as Error)?.name === "AbortError") return;
      }
    };

    void loadCommunitySummary();

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
  const buttonClassName =
    `inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 ${
      isCompact ? "py-3.5 text-[13px]" : "py-4 text-sm"
    } font-bold text-white ${
      isCompact ? "" : "shadow-[0_16px_30px_rgba(15,23,42,0.14)]"
    } transition hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950`;

  return (
    <div className={isCompact ? "space-y-5 pb-4" : "space-y-8 pb-6"}>
      <section
        className={`border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,251,0.96))] ${
          isCompact
            ? "rounded-[1.35rem] px-3.5 py-3.5 shadow-none ring-1 ring-white/70"
            : "rounded-[1.8rem] px-4 py-5 shadow-[0_14px_32px_rgba(15,23,42,0.04)]"
        }`}
      >
        <div className="min-w-0">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-brand-primary ring-1 ring-inset ring-brand-primary/10 ${
              isCompact
                ? "bg-[linear-gradient(180deg,rgba(255,241,246,0.9),rgba(255,255,255,0.95))] text-[9px]"
                : "bg-brand-primary/5 text-[10px]"
            }`}
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Comunidade VIP
          </div>
          <h4
            className={`mt-3 font-black tracking-tight text-zinc-950 ${
              isCompact
                ? "max-w-[15rem] text-[1.03rem] leading-[1.02]"
                : "max-w-[18rem] text-[1.72rem] leading-[0.96]"
            }`}
          >
            Conteúdo, posicionamento e crescimento com mais direção
          </h4>
        </div>

        {!planActive ? (
          <div
            className={`mt-4 rounded-[1.2rem] border border-zinc-200/90 ${
              isCompact
                ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(252,252,253,0.92))] px-3 py-3 shadow-none"
                : "bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`font-semibold uppercase tracking-[0.18em] text-brand-primary ${isCompact ? "text-[10px]" : "text-[11px]"}`}>
                  Investimento
                </p>
                <p className={`mt-2 font-black tracking-tight text-zinc-950 ${isCompact ? "text-[1.22rem]" : "text-[1.55rem]"}`}>
                  R$ 49,90<span className="text-base font-semibold text-zinc-500">/mês</span>
                </p>
              </div>
              {!isCompact ? (
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-primary/70" aria-hidden />
              ) : null}
            </div>
            {!isCompact ? <div className="mt-3 h-px bg-zinc-100/90 sm:hidden" aria-hidden /> : null}
            <p className={`max-w-[21rem] text-zinc-600 ${isCompact ? "mt-2.5 text-[13px] leading-5" : "mt-3 text-sm leading-6"}`}>
              Um formato enxuto, apoiado pela análise de perfil da plataforma e por IA.
            </p>
          </div>
        ) : null}
      </section>

      <section className={isCompact ? "pt-1" : "border-t border-zinc-100/90 pt-6"}>
        <div className={isCompact ? "mb-2 flex items-end justify-between gap-3" : "mb-4 flex items-end justify-between gap-3"}>
          <div>
            <h5 className={`flex items-center gap-2 font-semibold tracking-[-0.02em] text-zinc-950 ${isCompact ? "text-[0.86rem]" : "text-[1rem]"}`}>
              <span className={`rounded-full bg-brand-primary/70 ${isCompact ? "h-1.5 w-1.5" : "h-2 w-2"}`} aria-hidden />
              Como entrar
            </h5>
          </div>
        </div>

        <div
          className={`overflow-hidden border border-zinc-200/90 bg-white ${
            isCompact
              ? "rounded-[1.2rem] shadow-none"
              : "space-y-3 border-transparent bg-transparent shadow-none"
          }`}
        >
          {MENTORING_STEPS.map((step, index) => (
            <div
              key={step.label}
              className={`relative overflow-hidden ${
                isCompact
                  ? "px-3.5 py-3"
                  : "rounded-[1.5rem] border border-zinc-200/90 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]"
              }`}
            >
              {!isCompact ? <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-zinc-100" /> : null}
              {isCompact && index > 0 ? (
                <div className="absolute inset-x-3.5 top-0 h-px bg-zinc-100/90" aria-hidden />
              ) : null}
              <div className={`relative ${isCompact ? "" : "min-h-[90px]"}`}>
                <div className={`flex ${isCompact ? "items-start gap-3" : "items-center gap-2"}`}>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2 text-[10px] font-bold ${
                      isCompact
                        ? "mt-0.5 h-5 min-w-5 border border-brand-primary/15 bg-brand-primary/[0.03] text-brand-primary"
                        : "h-6 min-w-6 bg-zinc-950 text-white"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className={`max-w-[14rem] font-semibold leading-tight tracking-[-0.03em] text-zinc-950 ${isCompact ? "text-[0.95rem]" : "mt-3 text-[1rem]"}`}>
                      {step.label}
                    </p>
                    <p className={`max-w-[15rem] text-zinc-600 ${isCompact ? "mt-1 text-[13px] leading-5" : "mt-3 text-sm leading-6"}`}>
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={isCompact ? "pt-1" : "border-t border-zinc-100/90 pt-6"}>
        <div className={isCompact ? "mb-2 flex items-end justify-between gap-3" : "mb-4 flex items-end justify-between gap-3"}>
          <div>
            <h5 className={`flex items-center gap-2 font-semibold tracking-[-0.02em] text-zinc-950 ${isCompact ? "text-[0.86rem]" : "text-[1rem]"}`}>
              <span className={`rounded-full bg-brand-primary/70 ${isCompact ? "h-1.5 w-1.5" : "h-2 w-2"}`} aria-hidden />
              O que você recebe
            </h5>
          </div>
        </div>

        <div
          className={`overflow-hidden border border-zinc-200/90 bg-white ${
            isCompact
              ? "rounded-[1.2rem] shadow-none"
              : "space-y-3 border-transparent bg-transparent shadow-none"
          }`}
        >
          {MENTORING_TRACKS.map((track, index) => (
            <div
              key={track.title}
              className={`relative overflow-hidden ${
                isCompact
                  ? "px-3.5 py-3"
                  : "rounded-[1.5rem] border border-zinc-200/90 bg-white px-4 py-4 shadow-[0_8px_20px_rgba(15,23,42,0.03)]"
              }`}
            >
              {!isCompact ? <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-zinc-100" /> : null}
              {isCompact && index > 0 ? (
                <div className="absolute inset-x-3.5 top-0 h-px bg-zinc-100/90" aria-hidden />
              ) : null}
              <div className={`relative ${isCompact ? "" : "min-h-[102px]"}`}>
                <div className={`flex ${isCompact ? "items-start gap-3" : "items-center gap-2"}`}>
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-2 text-[10px] font-bold ${
                      isCompact
                        ? "mt-0.5 h-5 min-w-5 border border-brand-primary/15 bg-brand-primary/[0.03] text-brand-primary"
                        : "h-6 min-w-6 bg-zinc-950 text-white"
                    }`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className={`font-semibold uppercase tracking-[0.18em] text-zinc-400 ${isCompact ? "text-[9px]" : "text-[11px]"}`}>
                      {track.eyebrow}
                    </p>
                    <p className={`max-w-[14rem] font-semibold leading-tight tracking-[-0.03em] text-zinc-950 ${isCompact ? "mt-1 text-[0.95rem]" : "mt-3 text-[1rem]"}`}>
                      {track.title}
                    </p>
                    <p className={`max-w-[16rem] text-zinc-600 ${isCompact ? "mt-1 text-[13px] leading-5" : "mt-3 text-sm leading-6"}`}>
                      {track.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className={`sticky bottom-0 z-10 -mx-4 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.95)_22%,rgba(255,255,255,0.98)_100%)] px-4 sm:-mx-5 sm:px-5 ${
          isCompact ? "pb-0 pt-4" : "pb-0 pt-6"
        }`}
      >
        <div>
          <button
            type="button"
            onClick={handleCommunityAccess}
            disabled={resolvingVipAccess}
            className={buttonClassName}
          >
            {resolvingVipAccess ? "Verificando acesso..." : communityButtonLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </section>

    </div>
  );
}
