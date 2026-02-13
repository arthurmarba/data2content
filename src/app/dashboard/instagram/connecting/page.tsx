"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  IG_RECONNECT_ERROR_CODES,
  mapNextAuthErrorToReconnectCode,
  reconnectErrorMessageForCode,
  type InstagramReconnectErrorCode,
} from "@/app/lib/instagram/reconnectErrors";
import { track } from "@/lib/track";

type NextTarget = "chat" | "media-kit" | "instagram-connection";
type AvailableIgAccount = {
  igAccountId: string;
  username?: string;
  pageName?: string;
};

function buildNextUrl(nextTargetRaw: string | null): string {
  const nextTarget = (nextTargetRaw || "").toLowerCase() as NextTarget;
  switch (nextTarget) {
    case "media-kit":
      return "/media-kit?instagramLinked=true";
    case "instagram-connection":
      return "/dashboard/instagram-connection?instagramLinked=true";
    case "chat":
    default:
      return "/dashboard/chat?instagramLinked=true";
  }
}

export default function InstagramConnectingPage() {
  const { status, update } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const nextTarget = sp.get("next");
  const flowIdFromQuery = sp.get("flowId");
  const [message, setMessage] = useState<string>("A processar retorno do Facebook…");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<InstagramReconnectErrorCode | null>(null);
  const [accountsToSelect, setAccountsToSelect] = useState<AvailableIgAccount[]>([]);
  const [isFinalizingSelection, setIsFinalizingSelection] = useState(false);
  const onceRef = useRef(false);
  const oauthEventTrackedRef = useRef(false);
  const reconnectFlowIdRef = useRef<string | null>(flowIdFromQuery);

  const finalizeSelectedAccount = useCallback(async (instagramAccountId: string) => {
    if (!instagramAccountId) return;
    setIsFinalizingSelection(true);
    setError(null);
    setErrorCode(null);
    setMessage("Finalizando conexão da conta selecionada…");
    try {
      const res = await fetch("/api/instagram/connect-selected-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(reconnectFlowIdRef.current ? { "x-ig-reconnect-flow-id": reconnectFlowIdRef.current } : {}),
        },
        body: JSON.stringify({ instagramAccountId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (payload?.reconnectFlowId && typeof payload.reconnectFlowId === "string") {
        reconnectFlowIdRef.current = payload.reconnectFlowId;
      }
      if (!res.ok || !payload?.success) {
        const code = (payload?.errorCode || IG_RECONNECT_ERROR_CODES.UNKNOWN) as InstagramReconnectErrorCode;
        throw { code, message: payload?.errorMessage || payload?.error || "Falha ao finalizar a conexão." };
      }

      await update();
      track("ig_account_connected", {
        source: "instagram_connecting_page",
        next: nextTarget || "chat",
        flow_id: reconnectFlowIdRef.current,
      });
      router.replace(buildNextUrl(nextTarget));
    } catch (e: any) {
      const code = (e?.code || IG_RECONNECT_ERROR_CODES.UNKNOWN) as InstagramReconnectErrorCode;
      const msg = e?.message || reconnectErrorMessageForCode(code);
      setErrorCode(code);
      setError(msg);
      track("ig_reconnect_failed", {
        source: "instagram_connecting_page",
        error_code: code,
        flow_id: reconnectFlowIdRef.current,
      });
    } finally {
      setIsFinalizingSelection(false);
    }
  }, [nextTarget, router, update]);

  const faqLinkForError = (err: string | null): { href: string; label: string } | null => {
    if (!err) return null;
    const e = err.toLowerCase();
    if (e.includes("#10") || e.includes("#200") || e.includes("permiss")) {
      return { href: "/dashboard/instagram/faq#erros-permissoes", label: "Permissão negada (#10/#200) — abrir solução" };
    }
    if (e.includes("token") || e.includes("expirado") || e.includes("inválido")) {
      return { href: "/dashboard/instagram/faq#token-expirado", label: "Token expirado/ inválido — abrir solução" };
    }
    if (e.includes("já vinculado") || e.includes("alreadylinked") || e.includes("facebookalreadylinked")) {
      return { href: "/dashboard/instagram/faq#conta-vinculada", label: "Conta já vinculada — abrir solução" };
    }
    if (e.includes("não encontramos") || e.includes("sem contas") || e.includes("no_ig_account") || e.includes("no ig account")) {
      return { href: "/dashboard/instagram/faq#ig-profissional", label: "Conta IG não encontrada — abrir solução" };
    }
    return { href: "/dashboard/instagram/faq#ajuda", label: "Ver ajuda — FAQ" };
  };

  useEffect(() => {
    // Limpa o instagramLinked=true da URL
    const params = new URLSearchParams(sp.toString());
    if (params.get("instagramLinked") === "true") {
      params.delete("instagramLinked");
      const next = window.location.pathname + (params.toString() ? `?${params}` : "");
      window.history.replaceState({}, "", next);
    }
  }, [sp]);

  useEffect(() => {
    if (onceRef.current) return;
    if (status === "loading") return;
    onceRef.current = true;

    const run = async () => {
      try {
        setMessage("Atualizando sessão…");
        const updated = await update();
        const u = updated?.user as any;
        if (!u) {
          setError("Não foi possível atualizar sua sessão. Tente novamente.");
          return;
        }
        if (u.instagramReconnectFlowId && typeof u.instagramReconnectFlowId === "string") {
          reconnectFlowIdRef.current = u.instagramReconnectFlowId;
        }

        if (!oauthEventTrackedRef.current) {
          oauthEventTrackedRef.current = true;
          track("ig_oauth_callback_ok", {
            source: "instagram_connecting_page",
            next: nextTarget || "chat",
            flow_id: reconnectFlowIdRef.current,
          });
        }

        if (u.instagramConnected) {
          router.replace(buildNextUrl(nextTarget));
          return;
        }

        const accounts = (Array.isArray(u.availableIgAccounts) ? u.availableIgAccounts : []) as AvailableIgAccount[];

        if (accounts.length === 1 && accounts[0]?.igAccountId) {
          setMessage("Conectando sua única conta disponível…");
          await finalizeSelectedAccount(accounts[0].igAccountId);
          return;
        }

        if (accounts.length > 1) {
          setAccountsToSelect(accounts);
          setMessage("Selecione qual conta do Instagram você quer conectar.");
          track("ig_account_selection_shown", {
            source: "instagram_connecting_page",
            accounts_count: accounts.length,
            next: nextTarget || "chat",
            flow_id: reconnectFlowIdRef.current,
          });
          return;
        }

        const oauthErrorCode = mapNextAuthErrorToReconnectCode(sp.get("error"));
        const backendCode = (u.igConnectionErrorCode || IG_RECONNECT_ERROR_CODES.UNKNOWN) as InstagramReconnectErrorCode;
        const codeToUse = oauthErrorCode !== IG_RECONNECT_ERROR_CODES.UNKNOWN ? oauthErrorCode : backendCode;
        setErrorCode(codeToUse);
        setError(
          u.igConnectionError ||
          reconnectErrorMessageForCode(codeToUse) ||
          "Não encontramos contas Instagram profissionais nesta conta do Facebook. Verifique as permissões e tente novamente."
        );
        track("ig_reconnect_failed", {
          source: "instagram_connecting_page",
          error_code: codeToUse,
          flow_id: reconnectFlowIdRef.current,
        });
      } catch (e: any) {
        setError(e?.message || "Erro inesperado ao finalizar a conexão.");
        setErrorCode(IG_RECONNECT_ERROR_CODES.UNKNOWN);
        track("ig_reconnect_failed", {
          source: "instagram_connecting_page",
          error_code: IG_RECONNECT_ERROR_CODES.UNKNOWN,
          flow_id: reconnectFlowIdRef.current,
        });
      }
    };
    run();
  }, [status, update, router, nextTarget, sp, finalizeSelectedAccount]);

  return (
    <main className="max-w-xl mx-auto px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Conectando Instagram…</h1>
      {!error && accountsToSelect.length === 0 ? (
        <p className="text-gray-600 mt-3">{message}</p>
      ) : !error && accountsToSelect.length > 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
          <p className="text-sm text-slate-700 mb-3">{message}</p>
          <div className="space-y-2">
            {accountsToSelect.map((acc) => (
              <button
                key={acc.igAccountId}
                type="button"
                disabled={isFinalizingSelection}
                onClick={() => finalizeSelectedAccount(acc.igAccountId)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <p className="font-medium text-slate-900">{acc.username ? `@${acc.username}` : "Conta Instagram"}</p>
                <p className="text-xs text-slate-500">{acc.pageName || acc.igAccountId}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 inline-block text-left max-w-lg">
          <p className="font-medium">Não foi possível concluir:</p>
          {errorCode && (
            <p className="text-xs mt-1 font-semibold">Código: {errorCode}</p>
          )}
          <p className="text-sm mt-1">{error}</p>
          {(() => {
            const e = (error || '').toLowerCase();
            const isNoIgDetected =
              e.includes('nenhuma conta profissional do instagram') ||
              e.includes('conta profissional do instagram') ||
              e.includes('não encontramos contas instagram') ||
              e.includes('no_ig_account') ||
              e.includes('no ig account');
            const isNoPageDetected = e.includes('nenhuma página') || e.includes('no pages');
            if (isNoIgDetected || isNoPageDetected) {
              return (
                <div className="text-sm text-red-800 mt-2">
                  <p className="font-medium">Checklist para resolver:</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>
                      Tornar sua conta IG <b>Profissional/Criador</b> e vincular a uma Página do Facebook.
                    </li>
                    <li>
                      Caso não tenha Página, crie uma e vincule seu IG a ela.
                    </li>
                    <li>
                      Refaça a conexão logando no Facebook que administra essa Página.
                    </li>
                  </ul>
                  <p className="mt-2">
                    Ajuda passo a passo:
                    {" "}
                    <a href="/dashboard/instagram/faq#ig-profissional" className="underline text-blue-700 hover:text-blue-800">IG Profissional</a>
                    {" • "}
                    <a href="/dashboard/instagram/faq#criar-pagina" className="underline text-blue-700 hover:text-blue-800">Criar Página</a>
                    {" • "}
                    <a href="/dashboard/instagram/faq#vincular-ig-pagina" className="underline text-blue-700 hover:text-blue-800">Vincular IG à Página</a>
                  </p>
                </div>
              );
            }
            return null;
          })()}
          {faqLinkForError(error) && (
            <p className="text-sm mt-2">
              <a
                href={faqLinkForError(error)!.href}
                className="underline font-medium text-blue-700 hover:text-blue-800"
              >
                {faqLinkForError(error)!.label}
              </a>
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => router.replace("/dashboard/instagram/connect")}
              disabled={isFinalizingSelection}
              className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => router.replace(buildNextUrl(nextTarget))}
              disabled={isFinalizingSelection}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
