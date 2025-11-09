"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { useSession } from "next-auth/react";
import { RocketLaunchIcon } from "@heroicons/react/24/outline";
import { track } from "@/lib/track";

const STORAGE_KEY = "d2c-trial-checklist-v1";

type ChecklistState = Record<string, { completed: boolean; completedAt?: string }>;

function formatRemaining(ms: number) {
  if (ms <= 0) return "menos de 1 minuto";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const CHECKLIST_ITEMS: Array<{
  key: keyof ChecklistState;
  label: string;
  description: string;
  action: (router: ReturnType<typeof useRouter>) => void;
}> = [
  {
    key: "viewMediaKit",
    label: "Veja seu Mídia Kit automático",
    description: "Descubra os dados que a IA já organizou para você.",
    action: (router) => router.push("/media-kit"),
  },
  {
    key: "connectWhatsApp",
    label: "Ative o estrategista no WhatsApp",
    description: "Receba alertas e ideias em tempo real pelo seu número.",
    action: (router) => router.push("/planning/whatsapp"),
  },
];

function useChecklistState() {
  const [state, setState] = useState<ChecklistState>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") return parsed as ChecklistState;
    } catch {
      /* ignore */
    }
    return {};
  });

  const updateState = useCallback((next: ChecklistState) => {
    setState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const setCompleted = useCallback(
    (key: keyof ChecklistState) => {
      updateState({
        ...state,
        [key]: { completed: true, completedAt: new Date().toISOString() },
      });
    },
    [state, updateState]
  );

  return { state, setCompleted };
}

function TrialChecklist() {
  const router = useRouter();
  const { state, setCompleted } = useChecklistState();

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/10 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70 mb-3">
        Liberado no Modo Agência • Explore já
      </p>

      <div className="flex flex-col gap-3">
        {CHECKLIST_ITEMS.map((item) => {
          const completed = state[item.key]?.completed;
          return (
            <button
              key={item.key as string}
              onClick={() => {
                item.action(router);
                setCompleted(item.key);
              }}
              className={`group flex w-full items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 ${
                completed ? "opacity-80" : ""
              }`}
            >
              <span
                className={`mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                  completed
                    ? "border-emerald-300 bg-emerald-400/20 text-emerald-100"
                    : "border-white/50 bg-white/10 text-white/80 group-hover:border-white group-hover:text-white"
                }`}
              >
                {completed ? "✓" : "•"}
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{item.label}</span>
                <span className="mt-1 block text-xs text-white/70">{item.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActiveTrialBanner({
  expiresAt,
  countdownLabel,
}: {
  expiresAt: Date;
  countdownLabel: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-purple/20 bg-gradient-to-r from-brand-purple via-brand-magenta to-brand-red p-5 text-white shadow-lg sm:p-6">
      <div className="absolute -left-20 top-0 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-16 right-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/15 p-2 shadow-inner">
              <RocketLaunchIcon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/75">Modo Agência liberado</p>
              <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
                Mobi está ativo pelas próximas {countdownLabel}.
              </h2>
              <p className="mt-1 text-sm text-white/80">
                Peça conselhos no WhatsApp, libere o planner IA completo e veja o relatório estratégico avançado
                enquanto o acesso gratuito estiver valendo.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-sm text-white/80 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Trial encerra em</p>
            <div className="mt-1 text-2xl font-semibold text-white">{countdownLabel}</div>
            <p className="mt-1 text-[11px] text-white/60">Expira em {expiresAt.toLocaleString("pt-BR")}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/media-kit"
            className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow hover:bg-white/90"
          >
            Abrir relatório completo
          </Link>
          <Link
            href="/planning/whatsapp"
            className="inline-flex items-center rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
          >
            Falar com o Mobi no WhatsApp
          </Link>
          <Link
            href="/planning/planner"
            className="inline-flex items-center rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
          >
            Usar planner IA
          </Link>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            Checklist sugerido
          </p>
          <p className="text-xs text-white/60">
            Garanta o WOW moment completando as etapas abaixo durante o trial.
          </p>
          <TrialChecklist />
        </div>
      </div>
    </div>
  );
}

function TrialExpiredBanner({ onSubscribe }: { onSubscribe: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-amber-900 shadow-sm sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Seu Modo Agência gratuito terminou 💡</h2>
            <p className="mt-1 text-sm">
              Continue com o Mobi ativo para receber alertas, planner guiado e categorias completas do seu perfil.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-amber-800 shadow-sm">
            <p className="font-semibold">Durante o trial você desbloqueou:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Relatório estratégico com categorias e benchmarks completos.</li>
              <li>Insights personalizados do Mobi direto no WhatsApp.</li>
              <li>Planner IA com sugestões de slots e roteiros prontos.</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <button
            onClick={onSubscribe}
            className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600"
          >
            Assinar agora e continuar
          </button>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center justify-center rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
          >
            Ver planos detalhados
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TrialBanner() {
  const { data: session } = useSession();
  const billingStatus = useBillingStatus({ auto: true });
  const { isLoading } = billingStatus;

  const trial = billingStatus.trial;
  const expiresAt = useMemo(() => {
    if (trial?.expiresAt instanceof Date) return trial.expiresAt;
    if (billingStatus.planExpiresAt instanceof Date) return billingStatus.planExpiresAt;
    if (session?.user?.planExpiresAt) return new Date(session.user.planExpiresAt);
    return null;
  }, [trial?.expiresAt, billingStatus.planExpiresAt, session?.user?.planExpiresAt]);

  const [remainingLabel, setRemainingLabel] = useState(() =>
    expiresAt ? formatRemaining(expiresAt.getTime() - Date.now()) : ""
  );

  const countdownTrackedRef = useRef(false);
  const expiredTrackedRef = useRef(false);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      setRemainingLabel(formatRemaining(expiresAt.getTime() - Date.now()));
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const showExpired = useMemo(() => {
    if (!trial || trial.state !== "expired") return false;
    if (!trial.expiresAt) return true;
    const diff = Date.now() - trial.expiresAt.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
  }, [trial]);

  const handleSubscribeClick = useCallback(() => {
    try {
      window.dispatchEvent(new Event("open-subscribe-modal"));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (billingStatus.isTrialActive && expiresAt && !countdownTrackedRef.current) {
      countdownTrackedRef.current = true;
      try {
        track("trial_countdown_visible", {
          remaining_minutes: Math.floor(Math.max(expiresAt.getTime() - Date.now(), 0) / 60000),
        });
      } catch {
        /* ignore */
      }
    }

    if (!billingStatus.isTrialActive) {
      countdownTrackedRef.current = false;
    }
  }, [billingStatus.isTrialActive, expiresAt]);

  useEffect(() => {
    if (showExpired && !expiredTrackedRef.current) {
      expiredTrackedRef.current = true;
      try {
        track("trial_expired_viewed");
      } catch {
        /* ignore */
      }
    }

    if (!showExpired) {
      expiredTrackedRef.current = false;
    }
  }, [showExpired]);

  if (isLoading) return null;

  if (billingStatus.isTrialActive && expiresAt) {
    return <ActiveTrialBanner expiresAt={expiresAt} countdownLabel={remainingLabel} />;
  }

  if (showExpired) {
    return <TrialExpiredBanner onSubscribe={handleSubscribeClick} />;
  }

  return null;
}
