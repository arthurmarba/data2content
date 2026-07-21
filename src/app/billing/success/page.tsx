// src/app/billing/success/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { track } from "@/lib/track";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";
import { ProWelcome } from "./ProWelcome";

type PlanSnapshot = {
  instagramConnected: boolean | null;
  /** null = não conseguimos confirmar; usamos o token como fallback. */
  planActive: boolean | null;
};

async function fetchPlanSnapshot(force = false): Promise<PlanSnapshot> {
  try {
    const suffix = force ? "?force=true" : "";
    const res = await fetch(`/api/plan/status${suffix}`, {
      cache: "no-store",
      credentials: "include",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) return { instagramConnected: null, planActive: null };
    const status = typeof payload?.status === "string" ? payload.status : null;
    return {
      instagramConnected: Boolean(payload?.instagram?.connected),
      planActive: status ? status === "active" || status === "non_renewing" : null,
    };
  } catch {
    return { instagramConnected: null, planActive: null };
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

export function normalizeBillingSuccessPostCheckoutIntent(value: unknown): "connect_instagram" | "join_community" | null {
  return value === "connect_instagram" || value === "join_community" ? value : null;
}

export default function BillingSuccessPage() {
  const sp = useSearchParams();
  const sid = sp.get("session_id");
  const { update } = useSession();
  const router = useRouter();

  // "activating" enquanto resolvemos o redirect; "settled" só quando o usuário
  // de fato PERMANECE aqui (sem redirect). Evita o flash de conteúdo desktop
  // (/calendar, post-analysis) antes do redirect — especialmente no fluxo mobile,
  // onde quase todo mundo é encaminhado para conectar Instagram ou voltar ao mapa.
  // "pro_welcome" é o passo de boas-vindas do funil da reunião (grupo → Instagram);
  // "payment_pending" cobre o caso em que a Stripe ainda não confirmou o pagamento,
  // e nesse estado nenhuma tela de conexão do Instagram pode ser oferecida.
  const [phase, setPhase] = useState<"activating" | "settled" | "pro_welcome" | "payment_pending">(
    "activating",
  );
  const [welcome, setWelcome] = useState<{ instagramConnected: boolean; continueHref: string }>({
    instagramConnected: false,
    continueHref: "/dashboard/boards/mobile-strategic-profile",
  });
  // Guarda o trabalho async dentro desta instância (cobre o double-invoke do
  // StrictMode sem depender do sessionStorage para o estado de UI).
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (startedRef.current) return;
    startedRef.current = true;

    const onceKey = sid ? `billing-success:${sid}` : "billing-success";
    if (sessionStorage.getItem(onceKey)) {
      // Reload/revisita com o mesmo session_id — o trabalho já rodou numa visita
      // anterior. Nenhum redirect vai disparar daqui, então mostra a confirmação.
      setPhase("settled");
      return;
    }
    sessionStorage.setItem(onceKey, "1");

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
        const snapshot = await fetchPlanSnapshot(true);
        const instagramConnected =
          snapshot.instagramConnected ?? Boolean(user?.instagramConnected);
        // Só tratamos como "não pago" quando a origem responde explicitamente que
        // o plano não está ativo. Indisponibilidade da rota não pode travar quem pagou.
        const paymentUnconfirmed = snapshot.planActive === false;
        let resolvedContext: string | null = null;
        let redirectHref: string | null = null;
        let keepPaywallReturnState = false;
        let proWelcomeHref: string | null = null;
        let resolvedReturnTo: string | null = null;
        const stored = sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (typeof data?.context === "string") {
              resolvedContext = data.context;
            }
            const returnTo = sanitizeBillingSuccessReturnTo(data?.returnTo);
            resolvedReturnTo = returnTo;
            const postCheckoutIntent = normalizeBillingSuccessPostCheckoutIntent(data?.postCheckoutIntent);
            const source =
              typeof data?.source === "string" && data.source.trim().length > 0
                ? data.source.trim().toLowerCase()
                : null;
            if (postCheckoutIntent) {
              trackMobileNarrativeEvent("mobile_post_checkout_intent_seen", {
                route: returnTo ?? "/billing/success",
                paywallContext: resolvedContext ?? undefined,
                postCheckoutIntent,
                actionType: "billing_success_seen",
              });
            }
            if (postCheckoutIntent === "join_community") {
              // Funil da reunião: em vez de cair direto no app, o assinante passa
              // pelas boas-vindas Pro — grupo primeiro, Instagram depois.
              proWelcomeHref = returnTo ?? "/dashboard/boards/mobile-strategic-profile";
              keepPaywallReturnState = false;
            } else if (
              postCheckoutIntent === "connect_instagram" &&
              !instagramConnected &&
              !paymentUnconfirmed
            ) {
              redirectHref = "/dashboard/instagram/connect?next=narrative-map";
              keepPaywallReturnState = true;
            }
            const instagramNextTarget =
              !redirectHref && !proWelcomeHref && !instagramConnected && !paymentUnconfirmed
                ? resolveInstagramNextTarget(resolvedContext, source)
                : null;
            if (instagramNextTarget) {
              redirectHref = `/dashboard/instagram/connect?next=${encodeURIComponent(instagramNextTarget)}`;
              keepPaywallReturnState = true;
            } else if (returnTo && !proWelcomeHref && !paymentUnconfirmed) {
              const current = `${window.location.pathname}${window.location.search || ""}`;
              if (current !== returnTo) {
                redirectHref = returnTo;
              }
            }
            if (postCheckoutIntent) {
              const consumedKey = sid
                ? `mobile-post-checkout-intent-consumed:${sid}:${postCheckoutIntent}`
                : `mobile-post-checkout-intent-consumed:${postCheckoutIntent}`;
              if (!sessionStorage.getItem(consumedKey)) {
                sessionStorage.setItem(consumedKey, "1");
                trackMobileNarrativeEvent("mobile_post_checkout_intent_consumed", {
                  route: redirectHref ?? returnTo ?? "/billing/success",
                  paywallContext: resolvedContext ?? undefined,
                  postCheckoutIntent,
                  actionType: "billing_success_consumed",
                });
              }
            }
          } catch {
            sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
          }
        }

        if (user?.id) {
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
        }

        if (!keepPaywallReturnState) {
          sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
        }

        if (redirectHref) {
          router.push(redirectHref);
          // Mantém o estado "activating" (spinner) até a navegação concluir —
          // não revela a confirmação desktop por baixo do redirect.
          return;
        }
        const continueHref =
          proWelcomeHref ?? resolvedReturnTo ?? "/dashboard/boards/mobile-strategic-profile";
        if (paymentUnconfirmed) {
          setWelcome({ instagramConnected, continueHref });
          setPhase("payment_pending");
          return;
        }
        // Chegar aqui significa que nenhum destino específico da feature reivindicou
        // o usuário. Nesse caso as boas-vindas Pro são o destino padrão — o grupo é
        // onde a presença é confirmada, então ele precisa vir antes de qualquer outra
        // coisa, independentemente de onde a assinatura começou.
        setWelcome({ instagramConnected, continueHref });
        setPhase("pro_welcome");
      } catch {
        // Erro não bloqueia a tela: revela a confirmação (a assinatura já foi
        // ativada no Stripe; o usuário não fica preso num spinner).
        setPhase("settled");
      }
    })();
  // dependemos só do sid para a chave de "uma vez"
  }, [sid, update, router]);

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
          Assim que a Stripe confirmar, o Pro é liberado automaticamente. Você pode continuar no app
          enquanto isso — as reuniões seguem abertas para assistir.
        </p>
        <a
          href={welcome.continueHref}
          className="mt-8 inline-flex items-center justify-center rounded-full border border-zinc-300 px-7 py-3.5 text-[15px] font-semibold text-zinc-900"
        >
          Continuar no app
        </a>
      </main>
    );
  }

  if (phase === "pro_welcome") {
    return (
      <ProWelcome
        instagramConnected={welcome.instagramConnected}
        continueHref={welcome.continueHref}
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
        href="/dashboard/boards/mobile-strategic-profile"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-zinc-950 px-7 py-3.5 text-[15px] font-semibold text-white transition-colors active:bg-zinc-800"
      >
        Ir para o meu mapa
      </a>
    </main>
  );
}
