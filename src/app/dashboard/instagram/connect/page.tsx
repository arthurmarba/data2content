"use client";

import React, { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowRight, ChevronDown, Instagram } from "lucide-react";
import {
  mapNextAuthErrorToReconnectCode,
  reconnectErrorMessageForCode,
} from "@/app/lib/instagram/reconnectErrors";
import {
  startInstagramReconnect,
  type InstagramReconnectNextTarget,
} from "@/app/lib/instagram/client/startInstagramReconnect";
import { ProfileSettingsPage } from "@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";

type QuickItem = {
  title: string;
  description: string;
  faqHref?: string;
  essential?: boolean;
};

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
    requestedNextTarget === "chatgpt-plugin" ||
    requestedNextTarget === "instagram-connection" ||
    requestedNextTarget === "narrative-map" ||
    requestedNextTarget === "planner" ||
    requestedNextTarget === "post-creation" ||
    requestedNextTarget === "campaigns"
      ? requestedNextTarget
      : "media-kit";
  const isPostCreationFlow = nextTarget === "post-creation";
  const isNarrativeMapFlow = nextTarget === "narrative-map";
  const isChatGptPluginFlow = nextTarget === "chatgpt-plugin";
  const backTarget = isPostCreationFlow
    ? "/calendar"
    : isChatGptPluginFlow
      ? "/dashboard/chatgpt/ready"
    : nextTarget === "narrative-map"
      ? CREATOR_PROFILE_ROUTE
      : "/dashboard?intent=instagram";
  const connectLabel = isPostCreationFlow
    ? "Autorizar e voltar ao board"
    : isChatGptPluginFlow
      ? "Conectar e voltar ao ChatGPT"
    : isNarrativeMapFlow
      ? "Conectar e voltar ao mapa"
      : "Autorizar Instagram pela Meta";
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
  const essentialChecklist = quickChecklist.filter((item) => item.essential);

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

  const connectCopy = (() => {
    switch (nextTarget) {
      case "chatgpt-plugin":
        return {
          title: "Aprofunde a inteligência no ChatGPT",
          subtitle:
            "Ao conectar, a Data2Content poderá usar o contexto dos seus próprios conteúdos para planejar, criar pautas e roteirizar com mais profundidade. A conexão é opcional e nunca publica nada.",
          backLabel: "Agora não",
          cta: "Conectar e voltar ao ChatGPT",
        };
      case "narrative-map":
        return {
          title: "Traga seus posts para o mapa",
          subtitle:
            "Lemos o que você já publica para alimentar seu mapa. Sem publicações.",
          backLabel: "Voltar ao mapa",
          cta: "Conectar e voltar ao mapa",
        };
      case "calculator":
        return {
          title: "Conecte para calcular seus valores",
          subtitle:
            "Usamos suas métricas reais para sugerir faixas de preço justas. Nada é postado por nós.",
          backLabel: "Voltar",
          cta: "Conectar Instagram",
        };
      case "planner":
        return {
          title: "Conecte para gerar suas pautas",
          subtitle:
            "Lemos o que você já publica para criar ideias na sua voz. Nada é postado por nós.",
          backLabel: "Voltar",
          cta: "Conectar Instagram",
        };
      default:
        return {
          title: "Conecte seu Instagram",
          subtitle:
            "Conectamos com a Meta para ler suas métricas com segurança. Nada é postado por nós.",
          backLabel: "Voltar",
          cta: "Conectar Instagram",
        };
    }
  })();

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
    <ProfileSettingsPage
      title="Conectar Instagram"
      onBack={() => router.push(backTarget)}
      backLabel={connectCopy.backLabel}
      contentClassName="max-w-md"
    >
      <div className="space-y-3">
        <section className="ds-notebook-section ds-notebook-section--first px-6 py-7">
          {/* Ícone */}
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--ds-color-brand-soft)] text-[var(--ds-color-brand-strong)]">
            <Instagram className="h-7 w-7" strokeWidth={1.8} />
          </div>

          {/* Título + subtítulo */}
          <h2 className="mt-5 font-display text-[1.75rem] font-bold leading-[1.02] tracking-[-0.04em] text-[var(--ds-color-ink)]">
            {connectCopy.title}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
            {connectCopy.subtitle}
          </p>

          {/* Trust signals */}
          <div className="mt-5 space-y-2">
            {["Somente leitura", "Não publicamos nada"].map((item) => (
              <p key={item} className="flex items-center gap-2 text-[13px] text-[var(--ds-color-text-secondary)]">
                <span className="font-semibold text-[var(--ds-color-success)]">✓</span>
                {item}
              </p>
            ))}
          </div>

          {/* Erro */}
          {displayError && (
            <div
              className="ds-status-panel ds-status-panel--warning mt-5 text-sm"
              aria-live="polite"
            >
              <p className="font-semibold">Não conseguimos abrir a autorização.</p>
              <p className="mt-1">{displayError}</p>
            </div>
          )}

          {/* CTA — dentro do card */}
          <button
            type="button"
            onClick={startConnect}
            disabled={loading || status === "loading"}
            className="ds-button ds-button--primary ds-button--block mt-6"
          >
            {loading ? loadingLabel : connectCopy.cta}
            {!loading && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
          </button>
        </section>

        {/* Requisitos e permissões — colapsado, separado */}
        <details className="ds-notebook-section group !p-0">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 py-4 text-[14px] font-semibold text-[var(--ds-color-ink)] marker:hidden">
            Requisitos e permissões
            <ChevronDown
              className="h-4 w-4 text-zinc-400 transition group-open:rotate-180"
              strokeWidth={2}
            />
          </summary>
          <div className="border-t border-[var(--ds-color-line)] px-5 pb-5 pt-4">
            <p className="ds-notebook-label">
              Para sua conta aparecer
            </p>
            <ul className="mt-3 space-y-3">
              {essentialChecklist.map((item) => (
                <li key={item.title}>
                  <p className="text-[13px] font-semibold text-[var(--ds-color-ink)]">{item.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--ds-color-text-muted)]">
                    {item.description}
                  </p>
                  {item.faqHref && (
                    <a
                      href={item.faqHref}
                      className="mt-1 inline-block text-[12px] font-semibold text-[var(--ds-color-brand-strong)] underline underline-offset-2"
                    >
                      Ver passo a passo
                    </a>
                  )}
                </li>
              ))}
            </ul>

            <p className="ds-notebook-label mt-5">
              Permissões de leitura
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {permissionsRequested.map((permission) => (
                <span
                  key={permission}
                  className="ds-notebook-tag"
                >
                  {permission}
                </span>
              ))}
            </div>

            <a
              href="/dashboard/instagram/faq"
              className="mt-4 inline-block text-[12px] font-semibold text-[var(--ds-color-brand-strong)] underline underline-offset-2"
            >
              Abrir FAQ do Instagram
            </a>
          </div>
        </details>
      </div>
    </ProfileSettingsPage>
  );
}
