"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useActivationChecklist } from "./useActivationChecklist";

export default function ActivationPendingWidget() {
  const router = useRouter();
  const {
    loading,
    error,
    isVisible,
    title,
    subtitle,
    progressLabel,
    progressPercent,
    primaryStep,
    secondarySteps,
    communityCta,
    completionState,
    dismissCompletion,
  } = useActivationChecklist();
  const [minimized, setMinimized] = React.useState(false);

  const handleToggle = React.useCallback(() => {
    setMinimized((current) => !current);
  }, []);

  const handlePrimaryClick = React.useCallback(() => {
    if (!primaryStep) return;
    if (primaryStep.external) {
      window.open(primaryStep.href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(primaryStep.href);
  }, [primaryStep, router]);

  React.useEffect(() => {
    if (!completionState.visible) return;
    const timeoutId = window.setTimeout(() => {
      dismissCompletion();
    }, 4200);
    return () => window.clearTimeout(timeoutId);
  }, [completionState.visible, dismissCompletion]);

  if (!completionState.visible && (!isVisible || (!primaryStep && !communityCta.visible))) return null;

  if (completionState.visible) {
    return (
      <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] z-[170] sm:inset-x-auto sm:right-5 sm:w-[340px]">
        <div className="pointer-events-auto overflow-hidden rounded-[1.6rem] border border-emerald-400/14 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.16),transparent_34%),linear-gradient(180deg,rgba(33,33,38,0.96),rgba(18,18,22,0.94))] ring-1 ring-white/6 shadow-[0_24px_52px_rgba(15,23,42,0.24)] backdrop-blur-xl transition-all duration-300">
          <div className="px-4 py-3 sm:px-3.5 sm:py-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Acesso liberado
            </div>
            <p className="mt-2 text-[0.96rem] font-semibold tracking-[-0.02em] text-white">
              {completionState.title}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-300">
              {completionState.subtitle}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full rounded-full bg-[linear-gradient(90deg,#34d399,#10b981)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.9rem)] z-[170] sm:inset-x-auto sm:right-5 sm:w-[340px]">
      <div
        className={[
          "pointer-events-auto overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.18),transparent_34%),linear-gradient(180deg,rgba(33,33,38,0.96),rgba(18,18,22,0.94))] ring-1 ring-white/6 backdrop-blur-xl transition-all duration-300",
          minimized
            ? "rounded-[1.2rem] shadow-[0_16px_32px_rgba(15,23,42,0.2)] sm:ml-auto sm:w-[272px]"
            : "rounded-[1.6rem] shadow-[0_24px_52px_rgba(15,23,42,0.24)]",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={handleToggle}
          className={[
            "flex w-full justify-between gap-3 text-left transition-all duration-300",
            minimized
              ? "items-start px-3.5 py-3"
              : "items-start px-4 py-3 sm:px-3.5 sm:py-2.5",
          ].join(" ")}
        >
          <div className="min-w-0 flex-1">
            {!minimized ? (
              <>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/18 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Etapas pendentes
                </div>
                <p className="mt-1.5 text-[0.96rem] font-semibold tracking-[-0.02em] text-white">
                  {title}
                </p>
                <p className="mt-1 text-xs text-slate-400">{progressLabel}</p>
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rose-400/18 bg-rose-500/10 text-rose-200">
                    <Sparkles className="h-3 w-3" aria-hidden />
                  </span>
                  <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200/90">
                    Etapas pendentes
                  </span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-white/95">{progressLabel}</p>
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#fb7185,#ec4899,#f97316)] transition-[width] duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300">
            {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {!minimized ? (
          <div className="px-4 pb-3 sm:px-3.5 sm:pb-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#fb7185,#ec4899,#f97316)] transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        {!minimized ? (
          <div className="space-y-3 border-t border-white/8 px-4 pb-4 pt-3 sm:px-3.5 sm:pb-3.5">
            <div>
              <p className="text-sm font-semibold text-white">
                {primaryStep?.title ?? "Comunidade e próximos passos"}
              </p>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-300">
                {loading ? "Atualizando seu status..." : subtitle}
              </p>
              {error ? <p className="mt-1 text-xs text-amber-300">{error}</p> : null}
            </div>

            {communityCta.visible && communityCta.href ? (
              <a
                href={communityCta.href}
                target={communityCta.external ? "_blank" : undefined}
                rel={communityCta.external ? "noreferrer" : undefined}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[1.05rem] border border-emerald-400/20 bg-[linear-gradient(135deg,#22c55e,#16a34a)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(34,197,94,0.24)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                {communityCta.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            ) : null}

            {primaryStep ? (
              <button
                type="button"
                onClick={handlePrimaryClick}
                className="activation-widget-shimmer inline-flex w-full items-center justify-center gap-2 rounded-[1.05rem] bg-[linear-gradient(135deg,#fb7185,#ec4899)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(236,72,153,0.24)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              >
                {primaryStep.actionLabel}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : null}

            {secondarySteps.length ? (
              <div className="grid gap-2 border-t border-white/8 pt-3 sm:grid-cols-2">
                {secondarySteps.map((step) => (
                  step.external ? (
                    <a
                      key={step.id}
                      href={step.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-[0.95rem] border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-white/14 hover:bg-white/[0.07]"
                    >
                      <span className="truncate">{step.title}</span>
                      <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden />
                    </a>
                  ) : (
                    <Link
                      key={step.id}
                      href={step.href}
                      className="flex items-center justify-between rounded-[0.95rem] border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-white/14 hover:bg-white/[0.07]"
                    >
                      <span className="truncate">{step.title}</span>
                      <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden />
                    </Link>
                  )
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .activation-widget-shimmer {
          position: relative;
          overflow: hidden;
        }

        .activation-widget-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-130%);
          background: linear-gradient(
            100deg,
            rgba(255, 255, 255, 0) 20%,
            rgba(255, 255, 255, 0.18) 46%,
            rgba(255, 255, 255, 0.46) 50%,
            rgba(255, 255, 255, 0.14) 54%,
            rgba(255, 255, 255, 0) 80%
          );
          animation: activationShimmer 3.2s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes activationShimmer {
          0% {
            transform: translateX(-130%);
          }
          55%,
          100% {
            transform: translateX(130%);
          }
        }
      `}</style>
    </div>
  );
}
