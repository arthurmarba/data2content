"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { useSession } from "next-auth/react";
import { RocketLaunchIcon } from "@heroicons/react/24/outline";

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
    action: (router) => router.push("/dashboard/media-kit"),
  },
  {
    key: "connectWhatsApp",
    label: "Ative o estrategista no WhatsApp",
    description: "Receba alertas e ideias em tempo real pelo seu número.",
    action: (router) => router.push("/dashboard/whatsapp"),
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
        Liberado no modo PRO • Explore já
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

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white/15 p-2 shadow-inner">
            <RocketLaunchIcon className="h-6 w-6 text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/75">Modo PRO liberado</p>
            <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
              Você tem acesso PRO grátis pelas próximas {countdownLabel}.
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Durante essas 48h você está no mesmo nível do PRO: Grupo VIP liberado, mentorias estratégicas semanais,
              alertas premium no WhatsApp e planos guiados pelo Mobi.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/dashboard/media-kit"
                className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-purple shadow hover:bg-white/90"
              >
                Ver meu Mídia Kit
              </Link>
              <Link
                href="/dashboard/whatsapp"
                className="inline-flex items-center rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                Ativar WhatsApp IA
              </Link>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                Conferir agenda do Grupo VIP
              </Link>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-sm text-white/80 backdrop-blur">
          Trial encerra em
          <div className="mt-1 text-2xl font-semibold text-white">{countdownLabel}</div>
          <p className="mt-1 text-[11px] text-white/60">
            Expira em {expiresAt.toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      <TrialChecklist />
    </div>
  );
}

function TrialExpiredBanner({ onSubscribe }: { onSubscribe: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Seu modo PRO gratuito terminou</h2>
          <p className="mt-1 text-sm">
            Continue com o estrategista pessoal, mantenha o Grupo VIP e libere alertas ilimitados assinando o plano PRO.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSubscribe}
            className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-600"
          >
            Assinar plano PRO
          </button>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100"
          >
            Ver planos
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

  if (isLoading) return null;

  if (billingStatus.isTrialActive && expiresAt) {
    return <ActiveTrialBanner expiresAt={expiresAt} countdownLabel={remainingLabel} />;
  }

  if (showExpired) {
    return <TrialExpiredBanner onSubscribe={handleSubscribeClick} />;
  }

  return null;
}
