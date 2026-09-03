// src/app/billing/success/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { track } from "@/lib/track";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";
import { PAYWALL_RETURN_STORAGE_KEY, type PostCheckoutIntent } from "@/types/paywall";
import { CREATOR_PROFILE_ROUTE, RECORDED_MEETINGS_ROUTE } from "@/constants/routes";
import { ProWelcome } from "./ProWelcome";
import {
  normalizeCheckoutJourney,
  type CheckoutJourney,
} from "@/app/lib/billing/checkoutJourney";
import {
  buildOpenAiSubscriptionEventId,
  hasOpenAiMeasurementConsent,
} from "@/lib/openAiAdsEvent";

type PlanSnapshot = {
  instagramConnected: boolean | null;
  /** null = não conseguimos confirmar; nunca deve liberar o pós-checkout. */
  planActive: boolean | null;
  /** Data real da próxima cobrança, vinda do Stripe. */
  nextChargeAt: Date | null;
};

const PAYMENT_CONFIRMATION_RETRY_DELAY_MS = 2_500;
const MAX_AUTOMATIC_PAYMENT_RETRIES = 3;

async function fetchPlanSnapshot(force = false): Promise<PlanSnapshot> {
  try {
    const suffix = force ? "?force=true" : "";
    const res = await fetch(`/api/plan/status${suffix}`, {
      cache: "no-store",
      credentials: "include",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) {
      return { instagramConnected: null, planActive: null, nextChargeAt: null };
    }
    const status = typeof payload?.status === "string" ? payload.status : null;
    const hasPremiumAccess = payload?.extras?.hasPremiumAccess;
    const parsedNextCharge = payload?.planExpiresAt ? new Date(payload.planExpiresAt) : null;
    return {
      instagramConnected: Boolean(payload?.instagram?.connected),
      planActive:
        typeof hasPremiumAccess === "boolean"
          ? hasPremiumAccess
          : status
            ? status === "active" || status === "non_renewing"
            : null,
      nextChargeAt:
        parsedNextCharge && !Number.isNaN(parsedNextCharge.getTime()) ? parsedNextCharge : null,
    };
  } catch {
    return { instagramConnected: null, planActive: null, nextChargeAt: null };
  }
}

async function fetchCheckoutJourney(attemptId: string | null): Promise<CheckoutJourney | null> {
  if (!attemptId) return null;
  try {
    const response = await fetch(
      `/api/billing/checkout-context?attempt_id=${encodeURIComponent(attemptId)}`,
      { cache: "no-store", credentials: "include" },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || !payload?.journey) return null;
    return normalizeCheckoutJourney(payload.journey);
  } catch {
    return null;
  }
}

function resolveInstagramNextTarget(
  context: string | null,
  source: string | null,
): "calculator" | "media-kit" | "campaigns" | "planner" | null {
  if (context === "calculator") return "calculator";
  if (context === "media_kit") return "media-kit";
  if (context === "reply_email" || context === "ai_analysis") return "campaigns";
  if (context === "publis") return "campaigns";
  if (context === "planning") return "planner";

  if (!source) return null;
  if (source.includes("calculator")) return "calculator";
  if (source.includes("media_kit") || source.includes("media-kit")) return "media-kit";
  if (source.includes("publis") || source.includes("campaign") || source.includes("proposal")) return "campaigns";
  if (source.includes("planning") || source.includes("planner")) return "planner";

  return null;
}

export function sanitizeBillingSuccessReturnTo(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return null;
}

export function normalizeBillingSuccessPostCheckoutIntent(value: unknown): PostCheckoutIntent | null {
  return value === "connect_instagram"
    || value === "join_community"
    || value === "watch_recorded_meeting"
    ? value
    : null;
}

export function isChatGptCheckoutFlow(returnTo: string | null, source: string | null): boolean {
  if (source === "chatgpt_profile_upgrade") return true;
  if (!returnTo) return false;
  try {
    const url = new URL(returnTo, "https://d2c.local");
    return url.searchParams.get("source") === "chatgpt";
  } catch {
    return false;
  }
}

export function buildProfileActivationHref(
  returnTo: string | null,
  activation: "instagram" | "whatsapp",
): string {
  const safeReturnTo = sanitizeBillingSuccessReturnTo(returnTo)
    ?? CREATOR_PROFILE_ROUTE;
  const url = new URL(safeReturnTo, "https://d2c.local");
  url.searchParams.set("activation", activation);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function resolveBillingSuccessAttemptId(
  params: Pick<URLSearchParams, "get">,
): string | null {
  return params.get("session_id") ?? params.get("sid");
}

export default function BillingSuccessPage() {
  const sp = useSearchParams();
  const sid = resolveBillingSuccessAttemptId(sp);
  const { update } = useSession();
  const router = useRouter();

  // "activating" enquanto resolvemos o redirect; "settled" só quando o usuário
  // de fato PERMANECE aqui (sem redirect). Evita o flash de conteúdo desktop
  // (/calendar, post-analysis) antes do redirect — especialmente no fluxo mobile,
  // onde quase todo mundo é encaminhado para conectar Instagram ou voltar ao mapa.
  // "pro_welcome" é o fallback genérico com ações independentes;
  // "payment_pending" cobre o caso em que a Stripe ainda não confirmou o pagamento,
  // e nesse estado nenhuma tela de conexão do Instagram pode ser oferecida.
  const [phase, setPhase] = useState<"activating" | "settled" | "pro_welcome" | "payment_pending">(
    "activating",
  );
  const [welcome, setWelcome] = useState<{
    instagramConnected: boolean;
    continueHref: string;
    nextChargeAt: Date | null;
  }>({
    instagramConnected: false,
    continueHref: CREATOR_PROFILE_ROUTE,
    nextChargeAt: null,
  });
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  // Evita repetir a mesma tentativa no double-invoke do StrictMode, sem impedir
  // as novas consultas disparadas pelo retry automático ou pelo botão manual.
  const startedRunKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const runKey = `${sid ?? "no-attempt-id"}:${verificationAttempt}`;
    if (startedRunKeyRef.current === runKey) return;
    startedRunKeyRef.current = runKey;

    (async () => {
      try {
        // Se você confirmar o checkout pelo client, descomente:
        // if (sid) await fetch(`/api/stripe/confirm?session_id=${sid}`, { method: "POST" });

        const updatedSession = await update(); // atualiza planStatus/stripe* no token uma única vez
        const user = updatedSession?.user as {
          id?: string | null;
          planInterval?: string | null;
          instagramConnected?: boolean;
        } | null | undefined;
        const [snapshot, persistedJourney] = await Promise.all([
          fetchPlanSnapshot(true),
          fetchCheckoutJourney(sid),
        ]);
        const instagramConnected =
          snapshot.instagramConnected ?? Boolean(user?.instagramConnected);
        // O pós-checkout só avança com confirmação positiva. Estado negativo ou
        // indisponível permanece pendente para não liberar Pro nem medir conversão
        // antes de a Stripe/rota de plano confirmar o acesso.
        const paymentConfirmed = snapshot.planActive === true;
        const paymentUnconfirmed = !paymentConfirmed;
        let resolvedContext: string | null = persistedJourney?.context ?? null;
        let redirectHref: string | null = null;
        let keepPaywallReturnState = false;
        let resolvedReturnTo: string | null = persistedJourney?.returnTo ?? null;
        let resolvedSource: string | null = persistedJourney?.source ?? null;
        let resolvedPostCheckoutIntent = persistedJourney?.postCheckoutIntent ?? null;
        const stored = sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (!resolvedContext && typeof data?.context === "string") {
              resolvedContext = data.context;
            }
            const returnTo = sanitizeBillingSuccessReturnTo(data?.returnTo);
            if (!resolvedReturnTo) resolvedReturnTo = returnTo;
            const storedPostCheckoutIntent = normalizeBillingSuccessPostCheckoutIntent(data?.postCheckoutIntent);
            if (!resolvedPostCheckoutIntent) resolvedPostCheckoutIntent = storedPostCheckoutIntent;
            const storedSource =
              typeof data?.source === "string" && data.source.trim().length > 0
                ? data.source.trim().toLowerCase()
                : null;
            if (!resolvedSource) resolvedSource = storedSource;
          } catch {
            sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
          }
        }

        if (resolvedPostCheckoutIntent) {
          trackMobileNarrativeEvent("mobile_post_checkout_intent_seen", {
            route: resolvedReturnTo ?? "/billing/success",
            paywallContext: resolvedContext ?? undefined,
            postCheckoutIntent: resolvedPostCheckoutIntent,
            actionType: "billing_success_seen",
          });
        }
        if (resolvedPostCheckoutIntent === "join_community" && paymentConfirmed) {
          redirectHref = buildProfileActivationHref(resolvedReturnTo, "whatsapp");
        } else if (resolvedPostCheckoutIntent === "connect_instagram" && paymentConfirmed) {
          redirectHref = isChatGptCheckoutFlow(resolvedReturnTo, resolvedSource)
            ? "/dashboard/instagram/connect?source=chatgpt&next=chatgpt-plugin"
            : buildProfileActivationHref(resolvedReturnTo, "instagram");
        } else if (resolvedPostCheckoutIntent === "watch_recorded_meeting" && paymentConfirmed) {
          redirectHref = resolvedReturnTo ?? RECORDED_MEETINGS_ROUTE;
        }
        const instagramNextTarget =
          !redirectHref && !instagramConnected && paymentConfirmed
            ? resolveInstagramNextTarget(resolvedContext, resolvedSource)
            : null;
        if (instagramNextTarget) {
          redirectHref = `/dashboard/instagram/connect?next=${encodeURIComponent(instagramNextTarget)}`;
          keepPaywallReturnState = true;
        } else if (!redirectHref && resolvedReturnTo && paymentConfirmed) {
          const current = `${window.location.pathname}${window.location.search || ""}`;
          if (current !== resolvedReturnTo) redirectHref = resolvedReturnTo;
        }
        if (resolvedPostCheckoutIntent && paymentConfirmed) {
          const consumedKey = sid
            ? `mobile-post-checkout-intent-consumed:${sid}:${resolvedPostCheckoutIntent}`
            : `mobile-post-checkout-intent-consumed:${resolvedPostCheckoutIntent}`;
          if (!sessionStorage.getItem(consumedKey)) {
            sessionStorage.setItem(consumedKey, "1");
            trackMobileNarrativeEvent("mobile_post_checkout_intent_consumed", {
              route: redirectHref ?? resolvedReturnTo ?? "/billing/success",
              paywallContext: resolvedContext ?? undefined,
              postCheckoutIntent: resolvedPostCheckoutIntent,
              actionType: "billing_success_consumed",
            });
          }
        }

        if (user?.id && paymentConfirmed) {
          const interval = user.planInterval === "year" ? "anual" : "mensal";
          track("paywall_subscribed", {
            creator_id: user.id,
            plan: interval,
            context: resolvedContext ?? "default",
          });
          track("subscription_activated", {
            creator_id: user.id,
            plan: interval,
            currency: null,
            value: null,
          });
          if (
            isChatGptCheckoutFlow(resolvedReturnTo, resolvedSource)
          ) {
            const openAiEventId = buildOpenAiSubscriptionEventId(sid);
            track("chatgpt_funnel_event", {
              creator_id: user.id,
              step: "subscription_activated",
              source: resolvedSource ?? "chatgpt",
              context: resolvedContext ?? "chatgpt_intelligence",
              status: interval,
              event_id: openAiEventId,
            });
            if (
              sid
              && openAiEventId
              && hasOpenAiMeasurementConsent(document.cookie)
            ) {
              void fetch("/api/analytics/openai-conversion", {
                method: "POST",
                credentials: "include",
                keepalive: true,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  attemptId: sid,
                  planId: interval === "anual" ? "d2c_pro_annual" : "d2c_pro_monthly",
                }),
              });
            }
          }
        }

        if (paymentConfirmed && !keepPaywallReturnState) {
          sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
        }

        if (redirectHref) {
          router.push(redirectHref);
          // Mantém o estado "activating" (spinner) até a navegação concluir —
          // não revela a confirmação desktop por baixo do redirect.
          return;
        }
        const continueHref = resolvedReturnTo ?? CREATOR_PROFILE_ROUTE;
        if (paymentUnconfirmed) {
          setWelcome({ instagramConnected, continueHref, nextChargeAt: snapshot.nextChargeAt });
          setPhase("payment_pending");
          return;
        }
        // Chegar aqui significa que nenhum destino específico da feature reivindicou
        // o usuário. A tela genérica oferece comunidade e Instagram sem impor ordem.
        setWelcome({ instagramConnected, continueHref, nextChargeAt: snapshot.nextChargeAt });
        setPhase("pro_welcome");
      } catch {
        // Erro de confirmação nunca equivale a assinatura ativa.
        setPhase("payment_pending");
      }
    })();
  }, [sid, update, router, verificationAttempt]);

  useEffect(() => {
    if (phase !== "payment_pending") return;
    if (verificationAttempt >= MAX_AUTOMATIC_PAYMENT_RETRIES) return;

    const timeoutId = window.setTimeout(() => {
      setPhase("activating");
      setVerificationAttempt((attempt) => attempt + 1);
    }, PAYMENT_CONFIRMATION_RETRY_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [phase, verificationAttempt]);

  const retryPaymentVerification = () => {
    setPhase("activating");
    setVerificationAttempt((attempt) => attempt + 1);
  };

  // Estado de transição — mostrado enquanto resolvemos para onde encaminhar.
  // Calmo e neutro: a esmagadora maioria dos usuários é redirecionada (conectar
  // Instagram / voltar ao mapa), então este é o que eles realmente veem.
  if (phase === "activating") {
    return (
      <main
        className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 text-center"
        role="status"
        aria-live="polite"
      >
        <svg className="h-7 w-7 animate-spin text-zinc-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="mt-5 text-[15px] font-medium text-zinc-700">Ativando seu Pro…</p>
        <p className="mt-1 text-[13px] text-zinc-400">Um momento.</p>
      </main>
    );
  }

  // Pagamento ainda não confirmado pela Stripe: nada de Pro é liberado aqui,
  // e principalmente nenhuma tela de conexão do Instagram é oferecida.
  if (phase === "payment_pending") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 text-center">
        <h1 className="text-[1.4rem] font-bold tracking-tight text-zinc-950">
          Estamos confirmando seu pagamento
        </h1>
        <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-zinc-500">
          Assim que a Stripe confirmar, o Pro é liberado automaticamente. Vamos verificar novamente
          por alguns instantes; se preferir, você também pode tentar agora.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={retryPaymentVerification}
            className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-7 py-3.5 text-[15px] font-semibold text-white"
          >
            Verificar novamente
          </button>
          <a
            href={welcome.continueHref}
            className="inline-flex items-center justify-center px-4 py-2 text-[14px] font-medium text-zinc-500 underline underline-offset-4"
          >
            Continuar no app
          </a>
        </div>
      </main>
    );
  }

  if (phase === "pro_welcome") {
    return (
      <ProWelcome
        instagramConnected={welcome.instagramConnected}
        continueHref={welcome.continueHref}
        nextChargeAt={welcome.nextChargeAt}
        onStep={(step) =>
          trackMobileNarrativeEvent("mobile_post_checkout_intent_consumed", {
            route: "/billing/success",
            postCheckoutIntent: "join_community",
            actionType: `pro_welcome_${step}`,
          })
        }
      />
    );
  }

  // Confirmação — só renderiza quando o usuário PERMANECE aqui (sem redirect).
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12.5l4 4 10-10" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="mt-5 text-[1.6rem] font-bold tracking-tight text-zinc-950">Seu Pro está ativo</h1>
      <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-zinc-500">
        Tudo liberado. Você pode ajustar ou cancelar quando quiser em Configurações.
      </p>

      <a
        href={CREATOR_PROFILE_ROUTE}
        className="mt-8 inline-flex items-center justify-center rounded-full bg-zinc-950 px-7 py-3.5 text-[15px] font-semibold text-white transition-colors active:bg-zinc-800"
      >
        Ir para o meu mapa
      </a>
    </main>
  );
}
