// src/app/dashboard/onboarding/page.tsx
"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaChartLine, FaGift, FaInstagram, FaUsers, FaWhatsapp } from "react-icons/fa";
import OnboardingStepper, { StepItem } from "@/components/onboarding/OnboardingStepper";
import { INSTAGRAM_READ_ONLY_COPY } from "@/app/constants/trustCopy";
import { track } from "@/lib/track";

const CTA_VARIANT_STORAGE_KEY = "onboarding_cta_variant";
const COMMUNITY_STEP_STORAGE_KEY = "onboarding_step_community";
const DEFAULT_COMMUNITY_COUNT = 60;
const DEMO_MEDIAKIT_URL = "https://data2content.ai/mediakit/livia-linhares";

function formatPtBrNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function isExternal(url: string) {
  return /^https?:\/\//i.test(url);
}

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [loadingReport, setLoadingReport] = useState(false);
  const [ctaVariant, setCtaVariant] = useState<"A" | "B">("A");
  const [communityStepDone, setCommunityStepDone] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COMMUNITY_STEP_STORAGE_KEY) === "1";
  });
  const [showCommunityModal, setShowCommunityModal] = useState(false);

  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const queryVariant = params.get("cta") ?? params.get("headline");
    if (queryVariant?.toLowerCase() === "b") {
      setCtaVariant("B");
      window.localStorage.setItem(CTA_VARIANT_STORAGE_KEY, "B");
      return;
    }

    const stored = window.localStorage.getItem(CTA_VARIANT_STORAGE_KEY);
    if (stored === "B") {
      setCtaVariant("B");
    }
  }, []);

  const telemetry = useCallback(
    (event: string, extra?: Record<string, unknown>) => {
      try {
        track(event, {
          cta_variant: ctaVariant,
          instagram_connected: instagramConnected,
          community_step_done: communityStepDone,
          ...extra,
        });
      } catch {
        /* noop */
      }
    },
    [ctaVariant, instagramConnected, communityStepDone]
  );

  const communityInviteUrl =
    (session?.user as any)?.communityFreeInviteUrl ??
    process.env.NEXT_PUBLIC_COMMUNITY_FREE_URL ??
    "/dashboard/home?intent=community";

  const isExternalCommunityLink = useMemo(
    () => isExternal(communityInviteUrl),
    [communityInviteUrl]
  );

  const communityActiveCount = useMemo(() => {
    const fromSession = Number((session?.user as any)?.communityActiveCount ?? 0);
    if (Number.isFinite(fromSession) && fromSession > 0) return fromSession;
    const fromEnv = Number(process.env.NEXT_PUBLIC_COMMUNITY_ACTIVE_COUNT ?? DEFAULT_COMMUNITY_COUNT);
    if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
    return DEFAULT_COMMUNITY_COUNT;
  }, [session?.user]);

  const steps = useMemo<StepItem[]>(() => {
    const communityState = communityStepDone ? "completed" : "current";
    const instagramState = instagramConnected ? "completed" : communityStepDone ? "current" : "pending";
    const trialState = instagramConnected ? "current" : "pending";

    return [
      {
        key: "community",
        title: "Entrar na Comunidade",
        description: "Participe das mentorias e desafios semanais.",
        state: communityState,
      },
      {
        key: "connect-instagram",
        title: "Gerar seu Relatório estratégico",
        description: "Conecte o Instagram (somente leitura) e desbloqueie seus dados.",
        state: instagramState,
      },
      {
        key: "activate-trial",
        title: "Ativar modo PRO por 48h",
        description: "Experimente o Mobi com IA completa no WhatsApp.",
        state: trialState,
      },
    ];
  }, [communityStepDone, instagramConnected]);

  const hasTrackedInitialView = useRef(false);
  const lastConnectionState = useRef(instagramConnected);

  useEffect(() => {
    if (!hasTrackedInitialView.current) {
      telemetry("onboarding_view", {
        surface: instagramConnected ? "success" : "community_prompt",
      });
      hasTrackedInitialView.current = true;
      return;
    }

    if (instagramConnected && !lastConnectionState.current) {
      telemetry("onboarding_connected_view", { surface: "success" });
    }
    lastConnectionState.current = instagramConnected;
  }, [instagramConnected, telemetry]);

  const communityCtaLabel =
    ctaVariant === "B" ? "Entrar na Comunidade de Criadores" : "Entrar na Comunidade";

  const persistCommunityProgress = useCallback(() => {
    setCommunityStepDone(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COMMUNITY_STEP_STORAGE_KEY, "1");
    }
  }, []);

  const navigateToCommunity = useCallback(() => {
    persistCommunityProgress();
    if (isExternalCommunityLink) {
      window.open(communityInviteUrl, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(communityInviteUrl);
  }, [communityInviteUrl, isExternalCommunityLink, persistCommunityProgress, router]);

  const handleCommunityAccess = useCallback(() => {
    telemetry("onboarding_cta_click", { cta: "join_community" });
    if (isExternalCommunityLink) {
      setShowCommunityModal(true);
      return;
    }
    navigateToCommunity();
  }, [isExternalCommunityLink, navigateToCommunity, telemetry]);

  const handleCommunityConfirm = useCallback(() => {
    telemetry("onboarding_cta_click", { cta: "join_community_confirmed" });
    setShowCommunityModal(false);
    navigateToCommunity();
  }, [navigateToCommunity, telemetry]);

  const handleCommunityCancel = useCallback(() => {
    telemetry("onboarding_cta_click", { cta: "join_community_cancel" });
    setShowCommunityModal(false);
  }, [telemetry]);

  const handleConnectInstagram = useCallback(() => {
    telemetry("onboarding_cta_click", { cta: "connect_instagram" });
    router.push("/dashboard/instagram/connect");
  }, [router, telemetry]);

  const handleViewExamples = useCallback(() => {
    telemetry("onboarding_cta_click", { cta: "view_examples" });
    try {
      window.open(DEMO_MEDIAKIT_URL, "_blank", "noopener,noreferrer");
    } catch {
      window.location.href = DEMO_MEDIAKIT_URL;
    }
  }, [telemetry]);

  const handleExplorePlatform = useCallback(() => {
    telemetry("onboarding_cta_click", { cta: "explore_platform" });
    router.push("/dashboard/discover");
  }, [router, telemetry]);

  const handleOpenWhy = useCallback(() => {
    telemetry("onboarding_cta_click", { cta: "read_trust_link" });
  }, [telemetry]);

  const handleOpenReport = useCallback(async () => {
    if (loadingReport) return;
    setLoadingReport(true);
    try {
      telemetry("onboarding_cta_click", { cta: "open_report" });

      await fetch("/api/user/complete-onboarding", { method: "POST" }).catch(() => {});
      await update?.({ isNewUserForOnboarding: false }).catch(() => {});
      window.location.assign("/dashboard/media-kit");
    } finally {
      setLoadingReport(false);
    }
  }, [loadingReport, telemetry, update]);

  const handleActivateTrial = useCallback(() => {
    telemetry("onboarding_cta_click", { cta: "activate_trial_whatsapp" });
    try {
      window.dispatchEvent(new Event("open-subscribe-modal"));
    } catch {
      /* noop */
    }
  }, [telemetry]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <header className="text-center space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
          Jornada guiada Data2Content
        </p>
        <h1 className="text-3xl font-semibold text-gray-900">Bem-vindo à Data2Content 👋</h1>
        <p className="text-lg text-gray-600">
          Você já pode entrar na comunidade, conectar seu Instagram e sentir o WOW do modo PRO.
        </p>
        <p className="text-sm text-gray-500">
          Passos simples, sempre com foco no que libera mais valor primeiro.
        </p>
      </header>

      <div className="mt-8">
        <OnboardingStepper steps={steps} />
      </div>

      {!instagramConnected ? (
        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <article className="flex flex-col justify-between rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white p-6 shadow-sm">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600">
                <FaUsers aria-hidden="true" /> Comunidade oficial
              </span>
              <h2 className="text-xl font-semibold text-slate-900">
                Entre no círculo de criadores que compartilham resultados reais.
              </h2>
              <p className="text-sm text-slate-600">
                Mentorias semanais, desafios guiados e bastidores das estratégias. O lugar para ganhar confiança e
                pertencer antes de investir.
              </p>
              <p className="text-sm font-medium text-rose-500">
                {`Mais de ${formatPtBrNumber(communityActiveCount)} criadores ativos esta semana.`}
              </p>
            </div>
            <div className="mt-6 space-y-2">
              <button
                onClick={handleCommunityAccess}
                type="button"
                className="inline-flex w-full items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                {communityCtaLabel}
              </button>
              <p className="text-center text-xs text-rose-500">
                Acesso imediato. Você pode voltar para conectar o Instagram quando preferir.
              </p>
            </div>
          </article>

          <article className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FaInstagram aria-hidden="true" /> Relatório estratégico gratuito
              </span>
              <h2 className="text-xl font-semibold text-slate-900">
                Receba seu diagnóstico com horários, formatos e tendências do perfil.
              </h2>
              <p className="text-sm text-slate-600">
                Conecte pelo Facebook (somente leitura). Em minutos você tem um relatório com métricas essenciais e
                habilita o sorteio semanal.
              </p>
            </div>
            <div className="mt-6 space-y-3">
              <button
                onClick={handleConnectInstagram}
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                type="button"
              >
                Conectar Instagram agora
              </button>
              <button
                onClick={handleExplorePlatform}
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                type="button"
              >
                Explorar plataforma primeiro
              </button>
              <a
                className="block text-center text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
                href="/dashboard/instagram/faq"
                onClick={handleOpenWhy}
              >
                Por que pedimos a conexão?
              </a>
              <button
                onClick={handleViewExamples}
                type="button"
                className="inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Ver relatório demo em 30s
              </button>
              <p className="text-center text-xs text-slate-500">{INSTAGRAM_READ_ONLY_COPY}</p>
            </div>
          </article>
        </section>
      ) : (
        <section className="mt-10 space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
                  <FaInstagram aria-hidden="true" /> Instagram conectado!
                </span>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  Seu Relatório estratégico básico já está pronto.
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Veja os horários, contextos e formatos que mais entregam para o seu perfil.
                </p>
              </div>
              <button
                onClick={handleOpenReport}
                disabled={loadingReport}
                aria-busy={loadingReport}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-60"
                type="button"
              >
                {loadingReport ? "Abrindo…" : "Abrir relatório"}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <FaChartLine aria-hidden="true" /> Relatório básico
                </span>
                <p className="mt-2 text-sm text-slate-700">
                  Métricas gerais, tendências iniciais e comparativos por formato para orientar seus próximos posts.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <FaGift aria-hidden="true" /> Micro-insight semanal
                </span>
                <p className="mt-2 text-sm text-slate-700">
                  Receba automaticamente 1 insight por semana com o melhor horário ou categoria para testar.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  🎯 Sorteio ativado
                </span>
                <p className="mt-2 text-sm text-slate-700">
                  Você já participa do sorteio semanal de análise estratégica completa com o time Data2Content.
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600">
                  <FaWhatsapp aria-hidden="true" /> Experimente o modo PRO por 48h
                </span>
                <p className="mt-2 text-sm text-rose-700">
                  Ative o Mobi no WhatsApp sem cartão, receba alertas inteligentes e libere o planner IA completo.
                </p>
                <p className="mt-1 text-xs text-rose-500">Sem cartão. Cancela quando quiser.</p>
              </div>
              <button
                onClick={handleActivateTrial}
                type="button"
                className="inline-flex items-center justify-center rounded-lg bg-brand-red px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Ativar IA no WhatsApp
              </button>
            </div>
          </aside>
        </section>
      )}

      {!instagramConnected ? (
        <>
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-white via-white/95 to-transparent pb-28 pt-16 md:hidden"
            aria-hidden="true"
          />
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCommunityAccess}
              className="w-full rounded-lg bg-brand-red px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              type="button"
            >
              {communityCtaLabel}
            </button>
            <button
              onClick={handleConnectInstagram}
              type="button"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Conectar Instagram agora
            </button>
            <button
              onClick={handleExplorePlatform}
              type="button"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Explorar plataforma
            </button>
            <p className="text-center text-xs text-slate-600">{INSTAGRAM_READ_ONLY_COPY}</p>
          </div>
        </div>
        </>
      ) : null}

      {showCommunityModal ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 px-4"
          role="dialog"
          aria-modal="true"
          onClick={handleCommunityCancel}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Você está saindo da plataforma</h2>
            <p className="mt-2 text-sm text-slate-600">
              Abriremos o grupo oficial da comunidade em outra janela (WhatsApp). Lá acontecem mentorias semanais,
              desafios e sorteios. Você pode voltar para continuar o onboarding quando quiser.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={handleCommunityCancel}
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
              >
                Cancelar
              </button>
              <button
                onClick={handleCommunityConfirm}
                type="button"
                className="inline-flex items-center justify-center rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                Entrar no grupo oficial
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
