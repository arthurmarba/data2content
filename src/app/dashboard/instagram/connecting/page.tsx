"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  IG_RECONNECT_ERROR_CODES,
  inferReconnectErrorCodeFromMessage,
  mapNextAuthErrorToReconnectCode,
  reconnectFaqLinkForCode,
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
type StepStatus = "complete" | "active" | "pending" | "error";
type ConnectingPhase = "oauth_return" | "select_account" | "finalizing" | "success" | "error";
type StepDefinition = {
  label: string;
  status: StepStatus;
};

type ActionPlan = {
  title: string;
  steps: string[];
};

type DiagnosticCopyState = "idle" | "copied" | "failed";
const SUCCESS_REDIRECT_DELAY_MS = 650;

function StepRail({ steps }: { steps: StepDefinition[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-4" aria-label="Etapas da conexão">
      {steps.map((step, idx) => {
        const badgeClass =
          step.status === "complete"
            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : step.status === "active"
            ? "bg-blue-100 text-blue-700 border-blue-200"
            : step.status === "error"
            ? "bg-red-100 text-red-700 border-red-200"
            : "bg-gray-100 text-gray-500 border-gray-200";

        const labelClass =
          step.status === "active"
            ? "text-gray-900"
            : step.status === "complete"
            ? "text-emerald-700"
            : step.status === "error"
            ? "text-red-700"
            : "text-gray-500";

        return (
          <li key={step.label} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${badgeClass}`}
              aria-hidden
            >
              {idx + 1}
            </span>
            <span className={`text-sm font-medium ${labelClass}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function reconnectActionPlanForCode(code: InstagramReconnectErrorCode): ActionPlan | null {
  switch (code) {
    case IG_RECONNECT_ERROR_CODES.NO_FACEBOOK_PAGE:
      return {
        title: "Ação recomendada quando não há Página do Facebook",
        steps: [
          "Crie uma Página no Facebook ou confirme se você é administrador da Página correta.",
          "Na próxima tentativa, selecione essa Página durante a autorização da Meta.",
          "Depois avance para o Business e para a conta Instagram vinculada à Página.",
        ],
      };
    case IG_RECONNECT_ERROR_CODES.NO_BUSINESS_ACCESS:
      return {
        title: "Ação recomendada quando não há acesso ao Business",
        steps: [
          "Refaça o login e aprove as permissões solicitadas pela Meta (incluindo Business).",
          "Selecione o Portfólio Empresarial que contém a Página do Instagram que deseja conectar.",
          "Depois confirme a conta Instagram profissional dessa mesma estrutura.",
        ],
      };
    case IG_RECONNECT_ERROR_CODES.NO_LINKED_IG_ACCOUNT:
      return {
        title: "Ação recomendada quando falta IG vinculado à Página",
        steps: [
          "No Facebook/Meta, vincule sua conta Instagram profissional à Página escolhida.",
          "Refaça a conexão e selecione a mesma Página e o mesmo Business.",
          "Na etapa final, confirme a conta Instagram vinculada e conclua.",
        ],
      };
    case IG_RECONNECT_ERROR_CODES.PERMISSION_DENIED:
      return {
        title: "Ação recomendada para permissão negada",
        steps: [
          "Clique em Tentar novamente e refaça o login no Facebook.",
          "Aprove todas as permissões solicitadas na tela da Meta.",
          "Se usar Business Manager, confirme acesso à Página e ao Instagram.",
        ],
      };
    case IG_RECONNECT_ERROR_CODES.TOKEN_INVALID:
    case IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID:
      return {
        title: "Ação recomendada para token expirado/inválido",
        steps: [
          "Clique em Tentar novamente para gerar uma nova sessão segura.",
          "Evite atualizar/voltar durante o login do Facebook.",
          "Finalize o fluxo até voltar automaticamente ao dashboard.",
        ],
      };
    case IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT:
      return {
        title: "Ação recomendada quando não há conta IG disponível",
        steps: [
          "Torne sua conta Instagram Profissional/Criador.",
          "Vincule o Instagram a uma Página do Facebook.",
          "Refaça a conexão logando no Facebook que administra essa Página.",
        ],
      };
    case IG_RECONNECT_ERROR_CODES.FACEBOOK_ALREADY_LINKED:
      return {
        title: "Ação recomendada para conta já vinculada",
        steps: [
          "Confirme se essa conta Facebook/IG está vinculada a outro usuário da plataforma.",
          "Desvincule na conta antiga ou contate o suporte para migração.",
          "Depois repita a conexão neste usuário.",
        ],
      };
    case IG_RECONNECT_ERROR_CODES.INVALID_IG_ACCOUNT_SELECTION:
      return {
        title: "Ação recomendada para seleção inválida",
        steps: [
          "Reinicie a conexão e aguarde a lista de contas autorizadas.",
          "Selecione apenas a conta exibida na lista oficial.",
          "Se o problema persistir, refaça a autorização no Facebook.",
        ],
      };
    default:
      return null;
  }
}

function unknownReconnectActionPlan(phase: ConnectingPhase): ActionPlan {
  if (phase === "oauth_return") {
    return {
      title: "Ação recomendada para falha na validação",
      steps: [
        "Clique em Tentar novamente para reiniciar sua sessão de conexão.",
        "Confirme que você está logado no Facebook correto da Página vinculada.",
        "Durante a autorização, confirme Página, portfólio Business (se houver) e a conta IG profissional.",
        "Evite voltar/atualizar durante a autorização da Meta.",
      ],
    };
  }
  if (phase === "finalizing" || phase === "success") {
    return {
      title: "Ação recomendada para falha ao concluir",
      steps: [
        "Repita a conexão e finalize até retornar ao dashboard automaticamente.",
        "Na Meta, confirme Página, Business (quando aparecer) e Instagram da mesma estrutura.",
        "Se tiver mais de uma conta, selecione a conta Instagram principal de trabalho.",
        "Se persistir, abra o FAQ e siga o fluxo de token/permissões.",
      ],
    };
  }
  return {
    title: "Ação recomendada para falha inesperada",
    steps: [
      "Clique em Tentar novamente para reiniciar a conexão.",
      "Confira pré-requisitos: IG profissional, Página Facebook, Business e vínculo entre elas.",
      "Se continuar, abra o FAQ para diagnóstico guiado por código de erro.",
    ],
  };
}

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
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [lastSelectionAttempt, setLastSelectionAttempt] = useState<AvailableIgAccount | null>(null);
  const [diagnosticCopyState, setDiagnosticCopyState] = useState<DiagnosticCopyState>("idle");
  const onceRef = useRef(false);
  const oauthEventTrackedRef = useRef(false);
  const reconnectFlowIdRef = useRef<string | null>(flowIdFromQuery);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectFallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (redirectFallbackTimeoutRef.current) {
        clearTimeout(redirectFallbackTimeoutRef.current);
      }
    };
  }, []);

  const scheduleRedirectWithSuccess = useCallback(
    (targetUrl: string, successText: string) => {
      setSuccessNotice(successText);
      setError(null);
      setErrorCode(null);
      setAccountsToSelect([]);
      setMessage(successText);
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (redirectFallbackTimeoutRef.current) {
        clearTimeout(redirectFallbackTimeoutRef.current);
      }
      redirectTimeoutRef.current = setTimeout(() => {
        if (typeof window !== "undefined") {
          const target = new URL(targetUrl, window.location.origin);
          const expected = `${target.pathname}${target.search}`;
          router.replace(targetUrl);
          redirectFallbackTimeoutRef.current = setTimeout(() => {
            const current = `${window.location.pathname}${window.location.search}`;
            if (current !== expected) {
              window.location.assign(expected);
            }
          }, 300);
          return;
        }
        router.replace(targetUrl);
      }, SUCCESS_REDIRECT_DELAY_MS);
    },
    [router]
  );

  const finalizeSelectedAccount = useCallback(async (selection: AvailableIgAccount) => {
    const instagramAccountId = selection.igAccountId;
    if (!instagramAccountId) return;
    setIsFinalizingSelection(true);
    setLastSelectionAttempt(selection);
    setDiagnosticCopyState("idle");
    setSuccessNotice(null);
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
      scheduleRedirectWithSuccess(
        buildNextUrl(nextTarget),
        "Conta conectada com sucesso. Redirecionando…"
      );
    } catch (e: any) {
      const code = (e?.code || IG_RECONNECT_ERROR_CODES.UNKNOWN) as InstagramReconnectErrorCode;
      const msg = e?.message || reconnectErrorMessageForCode(code);
      setSuccessNotice(null);
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
  }, [nextTarget, scheduleRedirectWithSuccess, update]);

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
          scheduleRedirectWithSuccess(
            buildNextUrl(nextTarget),
            "Instagram já conectado. Redirecionando…"
          );
          return;
        }

        const accounts = (Array.isArray(u.availableIgAccounts) ? u.availableIgAccounts : []) as AvailableIgAccount[];

        if (accounts.length === 1 && accounts[0]?.igAccountId) {
          setMessage("Conectando sua única conta disponível…");
          await finalizeSelectedAccount(accounts[0]);
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
        setSuccessNotice(null);
        setDiagnosticCopyState("idle");
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
        setSuccessNotice(null);
        setDiagnosticCopyState("idle");
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
  }, [status, update, nextTarget, sp, finalizeSelectedAccount, scheduleRedirectWithSuccess]);

  const resolvedErrorCode =
    errorCode ??
    (error ? inferReconnectErrorCodeFromMessage(error) : null);
  const faqLink = resolvedErrorCode
    ? reconnectFaqLinkForCode(resolvedErrorCode)
    : null;
  const isFinalizingPhase =
    isFinalizingSelection ||
    message.toLowerCase().includes("finalizando conexão") ||
    message.toLowerCase().includes("conectando sua única conta");
  const phase: ConnectingPhase = error
    ? "error"
    : successNotice
    ? "success"
    : accountsToSelect.length > 0
    ? "select_account"
    : isFinalizingPhase
    ? "finalizing"
    : "oauth_return";
  const steps: StepDefinition[] = [
    { label: "Pré-check", status: "complete" },
    {
      label: "Facebook",
      status: phase === "oauth_return" ? "active" : "complete",
    },
    {
      label: "Selecionar conta",
      status:
        phase === "select_account"
          ? "active"
          : phase === "finalizing" || phase === "success" || phase === "error"
          ? "complete"
          : "pending",
    },
    {
      label: "Concluído",
      status:
        phase === "finalizing"
          ? "active"
          : phase === "success"
          ? "complete"
          : phase === "error"
          ? "error"
          : "pending",
    },
  ];
  const actionPlan = resolvedErrorCode
    ? reconnectActionPlanForCode(resolvedErrorCode) ??
      (resolvedErrorCode === IG_RECONNECT_ERROR_CODES.UNKNOWN
        ? unknownReconnectActionPlan(phase)
        : null)
    : null;
  const phaseGuideText =
    phase === "oauth_return"
      ? "Estamos validando sua sessão e as permissões de Página, Business e Instagram retornadas pela Meta."
      : phase === "select_account"
      ? "Encontramos mais de uma conta válida após a etapa Página/Business. Escolha a conta de trabalho para concluir."
      : phase === "finalizing"
      ? "Estamos finalizando a configuração da conta escolhida."
      : phase === "success"
      ? "Conexão concluída com sucesso. Você será redirecionado automaticamente."
      : null;
  const phaseTitle =
    phase === "oauth_return"
      ? "Validando retorno do Facebook"
      : phase === "select_account"
      ? "Escolha da conta Instagram"
      : phase === "finalizing"
      ? "Concluindo vinculação"
      : phase === "success"
      ? "Conexão concluída"
      : "Falha ao concluir";
  const phaseProgress =
    phase === "oauth_return"
      ? 35
    : phase === "select_account"
      ? 70
    : phase === "finalizing"
      ? 90
    : phase === "success"
      ? 100
      : 100;
  const phaseBadgeClass =
    phase === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : phase === "finalizing" || phase === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-blue-200 bg-blue-50 text-blue-700";
  const metaSelectionPath = lastSelectionAttempt
    ? `Página "${lastSelectionAttempt.pageName || "Página selecionada"}" -> Business que contém essa Página -> Instagram "${lastSelectionAttempt.username ? `@${lastSelectionAttempt.username}` : lastSelectionAttempt.igAccountId}"`
    : `Página administrada -> Business que contém essa Página -> Instagram profissional vinculado`;
  const diagnosticText = [
    `flow_id=${reconnectFlowIdRef.current ?? "none"}`,
    `error_code=${resolvedErrorCode ?? IG_RECONNECT_ERROR_CODES.UNKNOWN}`,
    `phase=${phase}`,
    `phase_title=${phaseTitle}`,
    `next_target=${nextTarget ?? "chat"}`,
    `meta_selection_path=${metaSelectionPath}`,
    `timestamp_utc=${new Date().toISOString()}`,
  ].join("\n");
  const copyDiagnostic = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(diagnosticText);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = diagnosticText;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        throw new Error("clipboard_unavailable");
      }
      setDiagnosticCopyState("copied");
    } catch (copyErr) {
      console.error("Falha ao copiar diagnóstico de reconexão:", copyErr);
      setDiagnosticCopyState("failed");
    }
  };
  const unknownFriendlyMessage =
    "Não foi possível concluir por uma instabilidade temporária. Vamos reiniciar de forma segura.";
  const displayErrorMessage =
    resolvedErrorCode === IG_RECONNECT_ERROR_CODES.UNKNOWN ? unknownFriendlyMessage : error;
  const technicalUnknownMessage =
    resolvedErrorCode === IG_RECONNECT_ERROR_CODES.UNKNOWN &&
    error &&
    error !== unknownFriendlyMessage
      ? error
      : null;

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 pb-24 sm:pb-10">
      <h1 className="text-2xl font-semibold text-gray-900 text-center">Conectando Instagram…</h1>
      <section className="mt-4">
        <StepRail steps={steps} />
      </section>
      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Etapa atual</p>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${phaseBadgeClass}`}>
            {phaseTitle}
          </span>
        </div>
        {phaseGuideText && <p className="mt-2 text-sm text-slate-700">{phaseGuideText}</p>}
        {!error && (
          <>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${phaseProgress}%` }}
                aria-hidden
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">Progresso estimado: {phaseProgress}%</p>
          </>
        )}
      </section>
      {!error && accountsToSelect.length === 0 ? (
        <section
          className={`mt-4 rounded-lg border p-4 text-center ${
            successNotice
              ? "border-emerald-200 bg-emerald-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <p className={`text-sm font-medium ${successNotice ? "text-emerald-800" : "text-slate-800"}`}>
            {message}
          </p>
          <p className={`mt-1 text-xs ${successNotice ? "text-emerald-700" : "text-slate-500"}`}>
            {successNotice
              ? "Redirecionando para sua próxima etapa…"
              : "Esta etapa costuma levar alguns segundos."}
          </p>
        </section>
      ) : !error && accountsToSelect.length > 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm">
          <p className="text-sm font-medium text-slate-800 mb-1">{message}</p>
          <p className="text-xs text-slate-500 mb-3">
            Dica: escolha a conta usada no dia a dia para gerar métricas corretas.
          </p>
          <div className="space-y-2">
            {accountsToSelect.map((acc) => (
              <button
                key={acc.igAccountId}
                type="button"
                disabled={isFinalizingSelection}
                onClick={() => finalizeSelectedAccount(acc)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <p className="font-medium text-slate-900">{acc.username ? `@${acc.username}` : "Conta Instagram"}</p>
                <p className="text-xs text-slate-500">{acc.pageName || acc.igAccountId}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 p-4 rounded bg-red-50 text-red-700 border border-red-200 text-left max-w-2xl mx-auto">
          <p className="font-medium">Não foi possível concluir:</p>
          {resolvedErrorCode && (
            <p className="text-xs mt-1 font-semibold">Código: {resolvedErrorCode}</p>
          )}
          <p className="text-sm mt-1">{displayErrorMessage}</p>
          {technicalUnknownMessage && (
            <details className="mt-2 rounded-md border border-red-200 bg-white/70 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-red-700">
                Ver detalhe técnico
              </summary>
              <p className="mt-1 text-xs text-red-700">{technicalUnknownMessage}</p>
            </details>
          )}
          <div className="mt-3 rounded-md border border-red-200 bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Diagnóstico rápido</p>
            <p className="mt-1 text-sm text-red-800">
              O fluxo foi interrompido antes da confirmação completa de Página, Business e conta Instagram.
            </p>
            <p className="mt-2 text-xs text-red-700">
              Próxima tentativa: <span className="font-semibold">{metaSelectionPath}</span>
            </p>
          </div>
          {actionPlan && (
            <div className="text-sm text-red-800 mt-2">
              <p className="font-medium">{actionPlan.title}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {actionPlan.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}
          {faqLink && (
            <p className="text-sm mt-2">
              <a
                href={faqLink.href}
                className="underline font-medium text-blue-700 hover:text-blue-800"
              >
                {faqLink.label}
              </a>
            </p>
          )}
          <div className="mt-3 rounded-md border border-red-200 bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Suporte técnico</p>
            <p className="mt-1 text-xs text-red-700">
              Se precisar de suporte, copie o diagnóstico e envie junto com o print da tela da Meta.
            </p>
            <button
              onClick={copyDiagnostic}
              type="button"
              className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Copiar diagnóstico
            </button>
            {diagnosticCopyState === "copied" && (
              <p className="mt-1 text-xs font-medium text-emerald-700">Diagnóstico copiado.</p>
            )}
            {diagnosticCopyState === "failed" && (
              <p className="mt-1 text-xs font-medium text-red-700">Não foi possível copiar automaticamente.</p>
            )}
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
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
