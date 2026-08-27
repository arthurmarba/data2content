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
import { PAYWALL_RETURN_STORAGE_KEY } from "@/types/paywall";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";
import { ProfileSettingsPage } from "@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage";

type NextTarget =
  | "calculator"
  | "chat"
  | "media-kit"
  | "instagram-connection"
  | "narrative-map"
  | "planner"
  | "post-creation"
  | "campaigns"
  | "chatgpt-plugin";
type AvailableIgAccount = {
  igAccountId: string;
  username?: string;
  pageName?: string;
};
type StepStatus = "complete" | "active" | "pending" | "error";
type ConnectingPhase =
  | "oauth_return"
  | "select_account"
  | "finalizing"
  | "success"
  | "error";
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
    <ol
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      aria-label="Etapas da conexão"
    >
      {steps.map((step, idx) => {
        const badgeClass =
          step.status === "complete"
            ? "bg-[var(--ds-color-success-soft)] text-[var(--ds-color-success)]"
            : step.status === "active"
              ? "bg-[var(--ds-color-brand-soft)] text-[var(--ds-color-brand-strong)]"
              : step.status === "error"
                ? "bg-[var(--ds-color-warning-soft)] text-[var(--ds-color-warning)]"
                : "bg-[var(--ds-color-neutral)] text-[var(--ds-color-text-muted)]";

        const labelClass =
          step.status === "active"
            ? "text-[var(--ds-color-ink)]"
            : step.status === "complete"
              ? "text-[var(--ds-color-success)]"
              : step.status === "error"
                ? "text-[var(--ds-color-warning)]"
                : "text-[var(--ds-color-text-muted)]";

        return (
          <li
            key={step.label}
            className="flex min-w-0 items-center gap-2 rounded-lg bg-[var(--ds-color-neutral)] px-3 py-2 sm:p-3"
          >
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold ${badgeClass}`}
              aria-hidden
            >
              {idx + 1}
            </span>
            <span className={`text-sm font-medium ${labelClass}`}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function reconnectActionPlanForCode(
  code: InstagramReconnectErrorCode,
): ActionPlan | null {
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
    case IG_RECONNECT_ERROR_CODES.ACCOUNT_RESTRICTED:
      return {
        title: "Ação recomendada para conta temporariamente restringida",
        steps: [
          "Abra o Instagram/Facebook e conclua as verificações de segurança solicitadas pela Meta.",
          "Aguarde o fim da restrição temporária e só então tente conectar novamente.",
          "Ao retomar, use a mesma conta Facebook que administra a Página vinculada ao Instagram.",
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
    case IG_RECONNECT_ERROR_CODES.POST_CREATION_TRIAL_ALREADY_USED:
      return {
        title: "Este Instagram já usou o teste gratuito",
        steps: [
          "Entre com a conta usada anteriormente para recuperar o teste.",
          "Se for a mesma conta, avance para a assinatura para continuar usando o board.",
          "Contate o suporte se precisar migrar esse Instagram para outro usuário.",
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

function consumeStoredReturnTo(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(PAYWALL_RETURN_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { returnTo?: string | null } | null;
    const returnTo =
      typeof parsed?.returnTo === "string" &&
      parsed.returnTo.startsWith("/") &&
      !parsed.returnTo.startsWith("//")
        ? parsed.returnTo
        : null;

    window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
    return returnTo;
  } catch {
    window.sessionStorage.removeItem(PAYWALL_RETURN_STORAGE_KEY);
    return null;
  }
}

export function buildNextUrl(nextTargetRaw: string | null): string {
  const storedReturnTo = consumeStoredReturnTo();
  const nextTarget = (nextTargetRaw || "").toLowerCase() as NextTarget;
  if (storedReturnTo) {
    if (nextTarget === "post-creation" || nextTarget === "narrative-map") {
      try {
        const target = new URL(storedReturnTo, window.location.origin);
        target.searchParams.set("instagramLinked", "true");
        if (nextTarget === "post-creation") {
          target.searchParams.set("postCreationConnected", "1");
        }
        return `${target.pathname}${target.search}${target.hash}`;
      } catch {
        return nextTarget === "post-creation"
          ? "/calendar?instagramLinked=true&postCreationConnected=1"
          : `${CREATOR_PROFILE_ROUTE}?instagramLinked=true`;
      }
    }
    return storedReturnTo;
  }

  switch (nextTarget) {
    case "calculator":
      return "/dashboard/calculator?instagramLinked=true";
    case "media-kit":
      return "/media-kit?instagramLinked=true";
    case "planner":
      return "/planning/planner?instagramLinked=true";
    case "post-creation":
      return "/calendar?instagramLinked=true&postCreationConnected=1";
    case "campaigns":
      return "/campaigns?instagramLinked=true";
    case "chatgpt-plugin":
      return "/dashboard/chatgpt/ready?instagramLinked=true";
    case "instagram-connection":
      return "/dashboard/instagram-connection?instagramLinked=true";
    case "narrative-map":
      return `${CREATOR_PROFILE_ROUTE}?instagramLinked=true`;
    case "chat":
    default:
      return "/dashboard/chat?instagramLinked=true";
  }
}

function buildRetryUrl(nextTargetRaw: string | null): string {
  const nextTarget = (nextTargetRaw || "").toLowerCase();
  return nextTarget
    ? `/dashboard/instagram/connect?next=${encodeURIComponent(nextTarget)}`
    : "/dashboard/instagram/connect";
}

export default function InstagramConnectingPage() {
  const { status, update } = useSession();
  const router = useRouter();
  const sp = useSearchParams();
  const nextTarget = sp.get("next");
  const flowIdFromQuery = sp.get("flowId");
  const [message, setMessage] = useState<string>(
    "Processando retorno da Meta…",
  );
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] =
    useState<InstagramReconnectErrorCode | null>(null);
  const [accountsToSelect, setAccountsToSelect] = useState<
    AvailableIgAccount[]
  >([]);
  const [isFinalizingSelection, setIsFinalizingSelection] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [lastSelectionAttempt, setLastSelectionAttempt] =
    useState<AvailableIgAccount | null>(null);
  const [diagnosticCopyState, setDiagnosticCopyState] =
    useState<DiagnosticCopyState>("idle");
  const onceRef = useRef(false);
  const oauthEventTrackedRef = useRef(false);
  const reconnectFlowIdRef = useRef<string | null>(flowIdFromQuery);
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectFallbackTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

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
          // Hard reload via window.location.replace para garantir que o Next.js
          // busque dados frescos do servidor (bypassa o router cache do App Router).
          // Crítico após conectar Instagram: isInstagramConnected muda no DB e o
          // RSC payload em cache ainda reflete o estado antigo (sem dados de audiência,
          // shell desatualizado). router.replace() usaria o cache; window.location
          // força um round-trip completo ao servidor.
          window.location.replace(targetUrl);
          return;
        }
        router.replace(targetUrl);
      }, SUCCESS_REDIRECT_DELAY_MS);
    },
    [router],
  );

  const prepareNarrativeMapReport = useCallback(async () => {
    if ((nextTarget || "").toLowerCase() !== "narrative-map") return;
    setMessage("Organizando os seus últimos 90 dias…");
    // O refresh do Instagram continua no worker. Esta chamada materializa já o
    // que estiver disponível e evita que contas com histórico sincronizado
    // cheguem ao Perfil sem o primeiro relatório.
    await fetch("/api/dashboard/mobile-strategic-profile/weekly-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    }).catch(() => null);
  }, [nextTarget]);

  const finalizeSelectedAccount = useCallback(
    async (selection: AvailableIgAccount) => {
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
            ...(reconnectFlowIdRef.current
              ? { "x-ig-reconnect-flow-id": reconnectFlowIdRef.current }
              : {}),
          },
          body: JSON.stringify({ instagramAccountId }),
        });
        const payload = await res.json().catch(() => ({}));
        if (
          payload?.reconnectFlowId &&
          typeof payload.reconnectFlowId === "string"
        ) {
          reconnectFlowIdRef.current = payload.reconnectFlowId;
        }
        if (!res.ok || !payload?.success) {
          const code = (payload?.errorCode ||
            IG_RECONNECT_ERROR_CODES.UNKNOWN) as InstagramReconnectErrorCode;
          throw {
            code,
            message:
              payload?.errorMessage ||
              payload?.error ||
              "Falha ao finalizar a conexão.",
          };
        }

        await update();
        await prepareNarrativeMapReport();
        track("ig_account_connected", {
          source: "instagram_connecting_page",
          next: nextTarget || "chat",
          flow_id: reconnectFlowIdRef.current,
        });
        scheduleRedirectWithSuccess(
          buildNextUrl(nextTarget),
          nextTarget === "post-creation"
            ? "Instagram conectado. Voltando ao board…"
            : "Conta conectada com sucesso. Redirecionando…",
        );
      } catch (e: any) {
        const code = (e?.code ||
          IG_RECONNECT_ERROR_CODES.UNKNOWN) as InstagramReconnectErrorCode;
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
    },
    [nextTarget, prepareNarrativeMapReport, scheduleRedirectWithSuccess, update],
  );

  useEffect(() => {
    // Limpa o instagramLinked=true da URL
    const params = new URLSearchParams(sp.toString());
    if (params.get("instagramLinked") === "true") {
      params.delete("instagramLinked");
      const next =
        window.location.pathname + (params.toString() ? `?${params}` : "");
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
        if (
          u.instagramReconnectFlowId &&
          typeof u.instagramReconnectFlowId === "string"
        ) {
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
          await prepareNarrativeMapReport();
          scheduleRedirectWithSuccess(
            buildNextUrl(nextTarget),
            nextTarget === "post-creation"
              ? "Instagram já conectado. Voltando ao board…"
              : "Instagram já conectado. Redirecionando…",
          );
          return;
        }

        const accounts = (
          Array.isArray(u.availableIgAccounts) ? u.availableIgAccounts : []
        ) as AvailableIgAccount[];

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

        const oauthErrorCode = mapNextAuthErrorToReconnectCode(
          sp.get("error"),
          sp.get("error_description"),
        );
        const backendCode = (u.igConnectionErrorCode ||
          IG_RECONNECT_ERROR_CODES.UNKNOWN) as InstagramReconnectErrorCode;
        const codeToUse =
          oauthErrorCode !== IG_RECONNECT_ERROR_CODES.UNKNOWN
            ? oauthErrorCode
            : backendCode;
        setSuccessNotice(null);
        setDiagnosticCopyState("idle");
        setErrorCode(codeToUse);
        setError(
          u.igConnectionError ||
            reconnectErrorMessageForCode(codeToUse) ||
            "Não encontramos contas Instagram profissionais nesta conta do Facebook. Verifique as permissões e tente novamente.",
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
  }, [
    status,
    update,
    nextTarget,
    sp,
    finalizeSelectedAccount,
    prepareNarrativeMapReport,
    scheduleRedirectWithSuccess,
  ]);

  const resolvedErrorCode =
    errorCode ?? (error ? inferReconnectErrorCodeFromMessage(error) : null);
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
    { label: "Preparar", status: "complete" },
    {
      label: "Autorizar",
      status: phase === "oauth_return" ? "active" : "complete",
    },
    {
      label: "Escolher conta",
      status:
        phase === "select_account"
          ? "active"
          : phase === "finalizing" || phase === "success" || phase === "error"
            ? "complete"
            : "pending",
    },
    {
      label: nextTarget === "post-creation" ? "Voltar ao board" : "Concluir",
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
    ? (reconnectActionPlanForCode(resolvedErrorCode) ??
      (resolvedErrorCode === IG_RECONNECT_ERROR_CODES.UNKNOWN
        ? unknownReconnectActionPlan(phase)
        : null))
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
      ? "Validando retorno da Meta"
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
      ? "ds-badge--warning"
      : phase === "finalizing" || phase === "success"
        ? "ds-badge--success"
        : "";
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
    "Não foi possível concluir agora.";
  const displayErrorMessage =
    resolvedErrorCode === IG_RECONNECT_ERROR_CODES.UNKNOWN
      ? null
      : error;
  const technicalUnknownMessage =
    resolvedErrorCode === IG_RECONNECT_ERROR_CODES.UNKNOWN &&
    error &&
    error !== unknownFriendlyMessage
      ? error
      : null;
  const errorTitle =
    resolvedErrorCode === IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT ||
    resolvedErrorCode === IG_RECONNECT_ERROR_CODES.NO_LINKED_IG_ACCOUNT
      ? "Não encontramos seu Instagram profissional"
      : resolvedErrorCode === IG_RECONNECT_ERROR_CODES.PERMISSION_DENIED
        ? "A autorização não foi concluída"
        : resolvedErrorCode === IG_RECONNECT_ERROR_CODES.POST_CREATION_TRIAL_ALREADY_USED
          ? "Este Instagram já usou o teste gratuito"
          : "Conexão não concluída";
  const errorIntro =
    resolvedErrorCode === IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT ||
    resolvedErrorCode === IG_RECONNECT_ERROR_CODES.NO_LINKED_IG_ACCOUNT
      ? "Isso geralmente acontece quando o Instagram não está como Profissional/Criador ou não está vinculado à Página da Meta selecionada."
      : resolvedErrorCode === IG_RECONNECT_ERROR_CODES.PERMISSION_DENIED
        ? "Isso geralmente acontece quando alguma permissão não foi aprovada na tela da Meta."
        : resolvedErrorCode === IG_RECONNECT_ERROR_CODES.POST_CREATION_TRIAL_ALREADY_USED
          ? "Para continuar, entre na conta usada anteriormente ou avance para a assinatura."
          : "Tente novamente. O retorno ao board será mantido.";

  return (
    <ProfileSettingsPage title="Conectar Instagram" contentClassName="max-w-3xl">
      <section className="ds-notebook-section ds-notebook-section--first">
        <p className="ds-notebook-label mb-3">Etapas da conexão</p>
        <StepRail steps={steps} />
      </section>
      <section className="ds-notebook-section text-left">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="ds-notebook-label">
            Etapa atual
          </p>
          <span
            className={`ds-badge ${phaseBadgeClass}`}
          >
            {phaseTitle}
          </span>
        </div>
        {phaseGuideText && (
          <p className="mt-2 text-sm text-[var(--ds-color-text-secondary)]">{phaseGuideText}</p>
        )}
        {!error && (
          <>
            <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--ds-color-neutral)]">
              <div
                className="h-1.5 rounded-full bg-[var(--ds-color-brand)] transition-all duration-300"
                style={{ width: `${phaseProgress}%` }}
                aria-hidden
              />
            </div>
            <p className="mt-2 text-xs text-[var(--ds-color-text-muted)]">
              Progresso estimado: {phaseProgress}%
            </p>
          </>
        )}
      </section>
      {!error && accountsToSelect.length === 0 ? (
        <section
          className={`ds-notebook-section text-center ${
            successNotice
              ? "!bg-[var(--ds-color-success-soft)]"
              : ""
          }`}
        >
          <p
            className={`text-sm font-semibold ${successNotice ? "text-[var(--ds-color-success)]" : "text-[var(--ds-color-ink)]"}`}
          >
            {message}
          </p>
          <p
            className={`mt-1 text-xs ${successNotice ? "text-[var(--ds-color-success)]" : "text-[var(--ds-color-text-muted)]"}`}
          >
            {successNotice
              ? "Redirecionando para sua próxima etapa…"
              : "Esta etapa costuma levar alguns segundos."}
          </p>
        </section>
      ) : !error && accountsToSelect.length > 0 ? (
        <section className="ds-notebook-section text-left">
          <p className="mb-1 text-sm font-semibold text-[var(--ds-color-ink)]">{message}</p>
          <p className="mb-3 text-xs text-[var(--ds-color-text-muted)]">
            Dica: escolha a conta usada no dia a dia para gerar métricas
            corretas.
          </p>
          <div className="space-y-2">
            {accountsToSelect.map((acc) => (
              <button
                key={acc.igAccountId}
                type="button"
                disabled={isFinalizingSelection}
                onClick={() => finalizeSelectedAccount(acc)}
                className="ds-notebook-action border-t border-[var(--ds-color-line)] px-2 first:border-t-0 disabled:opacity-60"
              >
                <p className="font-semibold text-[var(--ds-color-ink)]">
                  {acc.username ? `@${acc.username}` : "Conta Instagram"}
                </p>
                <p className="text-xs text-[var(--ds-color-text-muted)]">
                  {acc.pageName || acc.igAccountId}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="ds-notebook-section mx-auto max-w-2xl text-left">
          <p className="font-display text-lg font-bold tracking-[-0.025em] text-[var(--ds-color-ink)]">{errorTitle}</p>
          <p className="mt-1 text-sm text-[var(--ds-color-text-secondary)]">{errorIntro}</p>
          {displayErrorMessage && (
            <p className="mt-2 text-sm text-[var(--ds-color-text-secondary)]">{displayErrorMessage}</p>
          )}
          {actionPlan && (
            <div className="ds-notebook-note mt-4 text-sm">
              <p className="font-medium">O que fazer agora</p>
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
                className="font-semibold text-[var(--ds-color-brand-strong)] underline underline-offset-2"
              >
                {faqLink.label}
              </a>
            </p>
          )}
          <div
            className="fixed inset-x-0 z-30 flex gap-2 border-t border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]/95 p-3 backdrop-blur sm:static sm:mt-4 sm:grid sm:grid-cols-2 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
            style={{ bottom: "var(--cookie-consent-offset, 0px)" }}
          >
            <button
              onClick={() => router.replace(buildRetryUrl(nextTarget))}
              disabled={isFinalizingSelection}
              className="ds-button ds-button--primary ds-button--block flex-1"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => router.replace(buildNextUrl(nextTarget))}
              disabled={isFinalizingSelection}
              className="ds-button ds-button--secondary ds-button--block flex-1"
            >
              {nextTarget === "post-creation" ? "Voltar ao board" : "Voltar"}
            </button>
          </div>
          <details className="mt-4 rounded-lg bg-[var(--ds-color-neutral)] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--ds-color-text-secondary)]">
              Diagnóstico rápido
            </summary>
            {resolvedErrorCode && (
              <p className="mt-2 text-xs font-semibold text-[var(--ds-color-text-secondary)]">
                Código: {resolvedErrorCode}
              </p>
            )}
            {technicalUnknownMessage && (
              <p className="mt-2 text-xs text-[var(--ds-color-text-muted)]">
                Detalhe técnico: {technicalUnknownMessage}
              </p>
            )}
            <p className="mt-2 text-sm text-[var(--ds-color-text-secondary)]">
              O fluxo foi interrompido antes da confirmação completa de Página,
              Business e conta Instagram.
            </p>
            <p className="mt-2 text-xs text-[var(--ds-color-text-muted)]">
              Próxima tentativa:{" "}
              <span className="font-semibold">{metaSelectionPath}</span>
            </p>
          </details>
          <details className="mt-3 rounded-lg bg-[var(--ds-color-neutral)] p-3">
            <summary className="cursor-pointer text-xs font-semibold text-[var(--ds-color-text-secondary)]">
              Suporte técnico
            </summary>
            <p className="mt-2 text-xs text-[var(--ds-color-text-muted)]">
              Se precisar de suporte, copie o diagnóstico e envie junto com o
              print da tela da Meta.
            </p>
            <button
              onClick={copyDiagnostic}
              type="button"
              className="ds-button ds-button--quiet ds-button--small mt-2"
            >
              Copiar diagnóstico
            </button>
            {diagnosticCopyState === "copied" && (
              <p className="mt-1 text-xs font-medium text-[var(--ds-color-success)]">
                Diagnóstico copiado.
              </p>
            )}
            {diagnosticCopyState === "failed" && (
              <p className="mt-1 text-xs font-medium text-[var(--ds-color-text-muted)]">
                Não foi possível copiar automaticamente.
              </p>
            )}
          </details>
        </section>
      )}
    </ProfileSettingsPage>
  );
}
