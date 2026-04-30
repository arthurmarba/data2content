"use client";

import React, { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  mapNextAuthErrorToReconnectCode,
  reconnectErrorMessageForCode,
} from "@/app/lib/instagram/reconnectErrors";
import {
  startInstagramReconnect,
  type InstagramReconnectNextTarget,
} from "@/app/lib/instagram/client/startInstagramReconnect";

type StepStatus = "complete" | "active" | "pending";

type StepDefinition = {
  label: string;
  status: StepStatus;
};

type QuickItem = {
  title: string;
  description: string;
  faqHref?: string;
  essential?: boolean;
};

function StepRail({ steps }: { steps: StepDefinition[] }) {
  return (
    <ol
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      aria-label="Etapas da conexão"
    >
      {steps.map((step, idx) => {
        const badgeClass =
          step.status === "complete"
            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
            : step.status === "active"
            ? "bg-blue-100 text-blue-700 border-blue-200"
            : "bg-gray-100 text-gray-500 border-gray-200";

        const labelClass =
          step.status === "active"
            ? "text-gray-900"
            : step.status === "complete"
            ? "text-emerald-700"
            : "text-gray-500";

        return (
          <li
            key={step.label}
            className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 sm:p-3"
          >
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

export default function InstagramPreConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const generalDetailsRef = useRef<HTMLElement | null>(null);
  const postCreationDetailsRef = useRef<HTMLDetailsElement | null>(null);
  const requestedNextTarget = searchParams.get("next");
  const nextTarget: InstagramReconnectNextTarget =
    requestedNextTarget === "calculator" ||
    requestedNextTarget === "chat" ||
    requestedNextTarget === "instagram-connection" ||
    requestedNextTarget === "planner" ||
    requestedNextTarget === "post-creation" ||
    requestedNextTarget === "campaigns"
      ? requestedNextTarget
      : "media-kit";
  const isPostCreationFlow = nextTarget === "post-creation";
  const backTarget = isPostCreationFlow ? "/calendar" : "/dashboard?intent=instagram";
  const connectLabel = isPostCreationFlow ? "Autorizar e voltar ao board" : "Autorizar Instagram pela Meta";
  const loadingLabel = "Abrindo Meta…";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quickChecklist: QuickItem[] = [
    {
      title: "Conta IG Profissional/Criador",
      description: "Contas pessoais não são retornadas pela API da Meta.",
      faqHref: "/dashboard/instagram/faq#ig-profissional",
      essential: true,
    },
    {
      title: "Página do Facebook ativa",
      description: "A conta Instagram precisa estar associada a uma Página.",
      faqHref: "/dashboard/instagram/faq#criar-pagina",
      essential: true,
    },
    {
      title: "Instagram vinculado à Página",
      description: "O vínculo deve estar feito dentro do Meta Business Suite.",
      faqHref: "/dashboard/instagram/faq#vincular-ig-pagina",
      essential: true,
    },
    {
      title: "Login no Facebook correto",
      description: "Use o mesmo usuário que administra a Página conectada.",
      essential: false,
    },
  ];
  const permissionsRequested = [
    "Ler perfil profissional",
    "Ler métricas de conteúdo",
    "Ler publicações públicas",
    "Identificar contas IG autorizadas",
  ];
  const trialValueItems = isPostCreationFlow
    ? [
        "Análise do perfil",
        "Pauta inicial",
        "Sugestões de conteúdo",
      ]
    : [];
  const steps: StepDefinition[] = [
    { label: "Preparar", status: "active" },
    { label: "Autorizar", status: "pending" },
    { label: "Escolher conta", status: "pending" },
    { label: isPostCreationFlow ? "Voltar ao board" : "Concluir", status: "pending" },
  ];
  const essentialChecklist = quickChecklist.filter((item) => item.essential);
  const optionalChecklist = quickChecklist.filter((item) => !item.essential);

  const oauthErrorCode = mapNextAuthErrorToReconnectCode(
    searchParams.get("error"),
    searchParams.get("error_description")
  );
  const oauthErrorMessage =
    oauthErrorCode === "UNKNOWN" ? null : reconnectErrorMessageForCode(oauthErrorCode);
  const displayError = error ?? oauthErrorMessage;
  const showAuthorizationDetails = () => {
    if (postCreationDetailsRef.current) {
      postCreationDetailsRef.current.open = true;
      postCreationDetailsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    generalDetailsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const startConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await startInstagramReconnect({
        nextTarget,
        source: "instagram_connect_page",
      });
    } catch (e: any) {
      console.error("Falha ao iniciar fluxo Facebook/Instagram:", e);
      setError(e?.message || "Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  };

  if (isPostCreationFlow) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-4 py-8 pb-36 sm:justify-center sm:pb-8">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] sm:p-8">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Conexão segura
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Autorizar Instagram
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-600">
            A Meta vai pedir permissão de leitura para analisarmos seus posts.
            Depois você volta automaticamente ao board de criação.
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {[
              "Somente leitura",
              "Não publicamos nada",
              "Retorno automático ao board",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800"
              >
                {item}
              </div>
            ))}
          </div>

          {displayError && (
            <div
              className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              aria-live="polite"
            >
              <p className="font-semibold">Não conseguimos abrir a autorização.</p>
              <p className="mt-1">{displayError}</p>
            </div>
          )}

          <div className="mt-7 hidden flex-wrap gap-3 sm:flex">
            <button
              onClick={startConnect}
              disabled={loading || status === "loading"}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? loadingLabel : connectLabel}
            </button>
            <button
              onClick={() => router.push(backTarget)}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Voltar ao board
            </button>
          </div>

          <details
            ref={postCreationDetailsRef}
            className="mt-7 rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Ver requisitos e permissões
            </summary>
            <div className="mt-4 grid gap-5 text-sm text-slate-700 sm:grid-cols-[1fr_.9fr]">
              <div>
                <p className="font-semibold text-slate-950">Para a conta aparecer</p>
                <ul className="mt-2 space-y-2">
                  {essentialChecklist.map((item) => (
                    <li key={item.title} className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                      <p className="font-medium text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                        {item.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-950">Permissões de leitura</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {permissionsRequested.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
                <a
                  href="/dashboard/instagram/faq"
                  className="mt-3 inline-block text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
                >
                  Abrir FAQ do Instagram
                </a>
              </div>
            </div>
          </details>
        </section>

        <div
          className="fixed inset-x-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
          style={{ bottom: "var(--cookie-consent-offset, 0px)" }}
        >
          <button
            onClick={startConnect}
            disabled={loading || status === "loading"}
            className="min-h-11 w-full rounded-full bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? loadingLabel : connectLabel}
          </button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => router.push(backTarget)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Voltar
            </button>
            <button
              onClick={showAuthorizationDetails}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            >
              Detalhes
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-36 sm:pb-8">
      <h1 className="text-2xl font-semibold text-gray-900">Conectar Instagram</h1>
      <p className="text-gray-600 mt-2">
        {isPostCreationFlow
          ? "Autorize pela Meta para liberar a análise e a pauta de teste. Não publicamos nada."
          : "Autorize pela Meta para validar sua conta com segurança. Não publicamos nada."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {isPostCreationFlow && (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
            Teste inicial
          </span>
        )}
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
          Somente leitura
        </span>
        {!isPostCreationFlow && (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
            Retorno automático
          </span>
        )}
      </div>

      <div className="mt-5 hidden sm:flex gap-3 flex-wrap">
        <button
          onClick={startConnect}
          disabled={loading || status === "loading"}
          className={`inline-flex items-center px-4 py-2 rounded-md text-white ${loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? loadingLabel : connectLabel}
        </button>
        <button
          onClick={() => router.push(backTarget)}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
        >
          {isPostCreationFlow ? "Voltar ao board" : "Conectar depois"}
        </button>
        <button
          onClick={showAuthorizationDetails}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
        >
          Ver detalhes
        </button>
      </div>

      <section className="mt-6">
        <StepRail steps={steps} />
        {isPostCreationFlow && (
          <p className="mt-2 text-sm text-slate-500">
            Após autorizar, você retorna ao board para continuar de onde parou.
          </p>
        )}
      </section>

      <section className="mt-5 border-y border-slate-200 py-4">
        <h2 className="text-sm font-semibold text-slate-900">
          {isPostCreationFlow ? "Incluído no teste" : "Como funciona"}
        </h2>
        {isPostCreationFlow ? (
          <ul className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
            {trialValueItems.map((item) => (
              <li key={item} className="border-t border-slate-200 pt-3 font-medium first:border-t-0 first:pt-0 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 sm:first:border-l-0 sm:first:pl-0">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <ol className="mt-2 grid gap-2 text-sm text-blue-900 sm:grid-cols-2">
            <li>1. Validamos seus pré-requisitos.</li>
            <li>2. Você autoriza pela Meta (Página + Business, se solicitado).</li>
            <li>3. Escolhe a conta IG correta (se houver mais de uma).</li>
            <li>4. Finalizamos e você volta ao dashboard já conectado.</li>
          </ol>
        )}
      </section>

      {!isPostCreationFlow && (
        <section ref={generalDetailsRef} className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_.95fr]">
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <h2 className="font-medium text-gray-900">Essencial antes de continuar</h2>
              <ul className="mt-3 space-y-3">
                {essentialChecklist.map((item) => (
                  <li key={item.title} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.description}</p>
                    {item.faqHref && (
                      <a className="mt-1 inline-block text-xs font-medium underline text-blue-700 hover:text-blue-800" href={item.faqHref}>
                        Ver passo a passo
                      </a>
                    )}
                  </li>
                ))}
              </ul>

              {optionalChecklist.length > 0 && (
                <details className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">
                    Ver checagens adicionais (opcional)
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {optionalChecklist.map((item) => (
                      <li key={item.title} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{item.description}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <h2 className="font-medium text-gray-900">O que você normalmente seleciona na Meta</h2>
              <ol className="mt-2 space-y-2 text-sm text-gray-700">
                <li>1. Página da Meta/Facebook que administra o Instagram.</li>
                <li>2. Portfólio empresarial (Business Manager), quando exibido.</li>
                <li>3. Conta Instagram profissional vinculada à Página.</li>
              </ol>
              <p className="mt-2 text-xs text-slate-500">
                Se algum desses itens não aparecer, a conta IG pode não ser encontrada no passo final.
              </p>
            </div>

            <details className="p-4 bg-white rounded-lg border border-gray-200">
              <summary className="cursor-pointer font-medium text-gray-900">
                Ver permissões solicitadas pela Meta
              </summary>
              <p className="mt-2 text-sm text-gray-600">
                Todas as permissões são usadas para leitura de dados do Instagram profissional.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {permissionsRequested.map((permission) => (
                  <span
                    key={permission}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </details>
          </div>

          <aside className="space-y-4">
            <details className="p-4 bg-white rounded-lg border border-gray-200" open>
              <summary className="cursor-pointer font-medium text-gray-900">
                Se algo falhar, como você será guiado
              </summary>
              <ol className="mt-2 space-y-2 text-sm text-gray-700">
                <li>1. Exibimos o código do erro de conexão.</li>
                <li>2. Mostramos ações práticas para resolver.</li>
                <li>3. Direcionamos para o FAQ no ponto exato do problema.</li>
              </ol>
            </details>

            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <h2 className="font-medium text-gray-900">Segurança</h2>
              <p className="text-sm text-gray-700 mt-2">
                Plataforma credenciada pela Meta, com acesso de leitura às métricas.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Quer detalhes?{" "}
                <a href="/dashboard/instagram/faq" className="underline text-blue-700 hover:text-blue-800">
                  Veja o FAQ
                </a>.
              </p>
            </div>
          </aside>
        </section>
      )}

      {isPostCreationFlow && (
        <details ref={postCreationDetailsRef} className="mt-5 rounded-lg border border-slate-200 bg-white/70 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-900">
            Detalhes da autorização
          </summary>
          <div className="mt-4 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Antes de autorizar</h2>
                <ul className="mt-3 space-y-3">
                  {essentialChecklist.map((item) => (
                    <li key={item.title} className="border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{item.description}</p>
                      {item.faqHref && (
                        <a className="mt-1 inline-block text-xs font-medium underline text-blue-700 hover:text-blue-800" href={item.faqHref}>
                          Ver passo a passo
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-900">Na Meta</h2>
                <ol className="mt-2 space-y-2 text-sm text-gray-700">
                  <li>1. Escolha a Página vinculada ao Instagram.</li>
                  <li>2. Confirme o Business, se aparecer.</li>
                  <li>3. Selecione a conta Instagram correta.</li>
                </ol>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Permissões</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {permissionsRequested.map((permission) => (
                    <span
                      key={permission}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-sm font-semibold text-gray-900">Ajuda</h2>
                <p className="mt-2 text-sm text-gray-700">
                  Se a conta não aparecer, mostramos o motivo e o próximo passo.
                </p>
                <a href="/dashboard/instagram/faq" className="mt-2 inline-block text-sm font-medium underline text-blue-700 hover:text-blue-800">
                  Abrir FAQ do Instagram
                </a>
              </div>
            </div>
          </div>
        </details>
      )}

      {displayError && (
        <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm" aria-live="polite">
          <p className="font-medium">Não foi possível iniciar a conexão.</p>
          <p className="mt-1">{displayError}</p>
        </div>
      )}

      <div
        className="fixed inset-x-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"
        style={{ bottom: "var(--cookie-consent-offset, 0px)" }}
      >
        <button
          onClick={startConnect}
          disabled={loading || status === "loading"}
          className={`w-full rounded-md px-4 py-2.5 text-sm font-medium text-white ${loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? loadingLabel : connectLabel}
        </button>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => router.push(backTarget)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            {isPostCreationFlow ? "Voltar ao board" : "Conectar depois"}
          </button>
          <button
            onClick={showAuthorizationDetails}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            Detalhes
          </button>
        </div>
      </div>
    </main>
  );
}
