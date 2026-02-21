"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  mapNextAuthErrorToReconnectCode,
  reconnectErrorMessageForCode,
} from "@/app/lib/instagram/reconnectErrors";
import { startInstagramReconnect } from "@/app/lib/instagram/client/startInstagramReconnect";

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
    <ol className="grid gap-3 sm:grid-cols-4" aria-label="Etapas da conexão">
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

export default function InstagramPreConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
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
  const steps: StepDefinition[] = [
    { label: "Pré-check", status: "active" },
    { label: "Facebook", status: "pending" },
    { label: "Selecionar conta", status: "pending" },
    { label: "Concluído", status: "pending" },
  ];
  const essentialChecklist = quickChecklist.filter((item) => item.essential);
  const optionalChecklist = quickChecklist.filter((item) => !item.essential);

  const oauthErrorCode = mapNextAuthErrorToReconnectCode(searchParams.get("error"));
  const oauthErrorMessage =
    oauthErrorCode === "UNKNOWN" ? null : reconnectErrorMessageForCode(oauthErrorCode);
  const displayError = error ?? oauthErrorMessage;

  const startConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await startInstagramReconnect({
        nextTarget: "media-kit",
        source: "instagram_connect_page",
      });
    } catch (e: any) {
      console.error("Falha ao iniciar fluxo Facebook/Instagram:", e);
      setError(e?.message || "Erro inesperado. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-28 sm:pb-8">
      <h1 className="text-2xl font-semibold text-gray-900">Conectar Instagram</h1>
      <p className="text-gray-600 mt-2">
        Vamos abrir a autenticação da Meta para validar sua conta de forma segura e didática.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
          Tempo médio: 1 a 2 minutos
        </span>
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          Somente leitura (não publica nada)
        </span>
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
          Você volta automaticamente ao dashboard
        </span>
      </div>

      <section className="mt-6">
        <StepRail steps={steps} />
      </section>

      <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h2 className="text-sm font-semibold text-blue-900">Como funciona em 4 passos</h2>
        <ol className="mt-2 grid gap-2 text-sm text-blue-900 sm:grid-cols-2">
          <li>1. Validamos seus pré-requisitos.</li>
          <li>2. Você autoriza no Facebook (Página + Business, se solicitado).</li>
          <li>3. Escolhe a conta IG correta (se houver mais de uma).</li>
          <li>4. Finalizamos e você volta ao dashboard já conectado.</li>
        </ol>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_.95fr]">
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
              <li>1. Página do Facebook que administra o Instagram.</li>
              <li>2. Portfólio empresarial (Business Manager), quando exibido.</li>
              <li>3. Conta Instagram profissional vinculada à Página.</li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              Se algum desses itens não aparecer, a conta IG pode não ser encontrada no passo final.
            </p>
          </div>

          <details className="p-4 bg-white rounded-lg border border-gray-200">
            <summary className="cursor-pointer font-medium text-gray-900">
              Ver permissões solicitadas no Facebook
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

      {displayError && (
        <div className="mt-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm" aria-live="polite">
          <p className="font-medium">Não foi possível iniciar a conexão.</p>
          <p className="mt-1">{displayError}</p>
        </div>
      )}

      <div className="mt-6 hidden sm:flex gap-3 flex-wrap">
        <button
          onClick={startConnect}
          disabled={loading || status === "loading"}
          className={`inline-flex items-center px-4 py-2 rounded-md text-white ${loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? "Abrindo Facebook…" : "Entendi, conectar com Facebook"}
        </button>
        <button
          onClick={() => router.push("/dashboard?intent=instagram")}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
        >
          Conectar depois
        </button>
        <button
          onClick={() => router.push("/dashboard/instagram/faq")}
          className="inline-flex items-center px-4 py-2 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
        >
          Preciso de ajuda (FAQ)
        </button>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <button
          onClick={startConnect}
          disabled={loading || status === "loading"}
          className={`w-full rounded-md px-4 py-2.5 text-sm font-medium text-white ${loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          {loading ? "Abrindo Facebook…" : "Entendi, conectar com Facebook"}
        </button>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => router.push("/dashboard?intent=instagram")}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            Conectar depois
          </button>
          <button
            onClick={() => router.push("/dashboard/instagram/faq")}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            FAQ
          </button>
        </div>
      </div>
    </main>
  );
}
