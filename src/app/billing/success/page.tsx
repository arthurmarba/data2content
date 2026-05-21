// src/app/billing/success/page.tsx
"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { track } from "@/lib/track";
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";

async function fetchInstagramConnected(force = false): Promise<boolean | null> {
  try {
    const suffix = force ? "?force=true" : "";
    const res = await fetch(`/api/plan/status${suffix}`, {
      cache: "no-store",
      credentials: "include",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok || !payload?.ok) return null;
    return Boolean(payload?.instagram?.connected);
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

function sanitizeReturnTo(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return null;
}

export default function BillingSuccessPage() {
  const sp = useSearchParams();
  const sid = sp.get("session_id");
  const { update } = useSession();
  const router = useRouter();

  // ✅ Atualiza a sessão apenas UMA vez (mesmo em StrictMode) e sem refresh em loop
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onceKey = sid ? `billing-success:${sid}` : "billing-success";
    if (sessionStorage.getItem(onceKey)) return; // já rodou
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
        const billingInstagramConnected = await fetchInstagramConnected(true);
        const instagramConnected =
          billingInstagramConnected ?? Boolean(user?.instagramConnected);
        let resolvedContext: string | null = null;
        let redirectHref: string | null = null;
        let keepPaywallReturnState = false;
        const stored = sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            if (typeof data?.context === "string") {
              resolvedContext = data.context;
            }
            const returnTo = sanitizeReturnTo(data?.returnTo);
            const postCheckoutIntent =
              data?.postCheckoutIntent === "connect_instagram" || data?.postCheckoutIntent === "join_community"
                ? data.postCheckoutIntent
                : null;
            const source =
              typeof data?.source === "string" && data.source.trim().length > 0
                ? data.source.trim().toLowerCase()
                : null;
            if (postCheckoutIntent === "connect_instagram" && !instagramConnected) {
              redirectHref = "/dashboard/instagram/connect?next=narrative-map";
              keepPaywallReturnState = true;
            } else if (postCheckoutIntent === "join_community" && returnTo) {
              redirectHref = returnTo;
            }
            const instagramNextTarget = !redirectHref && !instagramConnected
              ? resolveInstagramNextTarget(resolvedContext, source)
              : null;
            if (instagramNextTarget) {
              redirectHref = `/dashboard/instagram/connect?next=${encodeURIComponent(instagramNextTarget)}`;
              keepPaywallReturnState = true;
            } else if (returnTo) {
              const current = `${window.location.pathname}${window.location.search || ""}`;
              if (current !== returnTo) {
                redirectHref = returnTo;
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
          return;
        }
        // Não precisa chamar router.refresh() aqui. Ao navegar, o server já refaz o fetch.
      } catch {
        // ignora erros; não bloqueia a tela
      }
    })();
  // dependemos só do sid para a chave de "uma vez"
  }, [sid, update, router]);

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Tudo certo!</h1>
      <p className="text-gray-700">
        Sua assinatura do Plano Pro foi ativada com sucesso. Você já tem acesso total a todos os
        recursos.
      </p>
      <p className="mt-2 text-gray-600">
        Precisa de algo? Você pode ajustar ou cancelar a assinatura a qualquer momento em{" "}
        <span className="font-medium">Configurações &gt; Billing</span>.
      </p>

      {sid && (
        <p className="mt-3 text-xs text-gray-400">
          ID da sessão: <span className="font-mono">{sid}</span>
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <a className="inline-block rounded-xl bg-black px-4 py-2 text-white" href="/calendar">
          Abrir Criação de Post
        </a>
        <a className="inline-block rounded-xl border border-gray-300 px-4 py-2 text-gray-800" href="/dashboard/post-analysis">
          Abrir Review de Post
        </a>
      </div>
    </div>
  );
}
