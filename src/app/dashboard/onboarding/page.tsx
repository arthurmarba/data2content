"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import OnboardingStepper, { StepItem } from "@/components/onboarding/OnboardingStepper";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const instagramConnected = Boolean((session?.user as any)?.instagramConnected);

  const steps = useMemo<StepItem[]>(() => {
    return [
      {
        key: "welcome",
        title: "Boas‑vindas",
        description: "Veja como vamos preparar seu Mídia Kit automático.",
        state: "completed",
      },
      {
        key: "about-permissions",
        title: "Antes de conectar",
        description: "Entenda as permissões do Facebook/Instagram e por que pedimos.",
        state: instagramConnected ? "completed" : "current",
      },
      {
        key: "connect-instagram",
        title: "Conectar Instagram",
        description: instagramConnected
          ? "Conexão ativa. Podemos ler métricas públicas para gerar seu Mídia Kit."
          : "Conecte com o Facebook para localizar sua conta Instagram Profissional/Creator.",
        state: instagramConnected ? "completed" : "pending",
      },
      {
        key: "first-sync",
        title: "Primeira sincronização",
        description: "Importamos métricas recentes para alimentar seus relatórios.",
        state: instagramConnected ? "current" : "pending",
      },
      {
        key: "ready",
        title: "Pronto!",
        description: "Acesse seu Mídia Kit e painel com dados atualizados.",
        state: instagramConnected ? "current" : "pending",
      },
    ];
  }, [instagramConnected]);

  const goToPreConnect = () => router.push("/dashboard/instagram/connect");
  const goToMediaKit = () => router.push("/dashboard/media-kit");

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Começar</h1>
      <p className="text-gray-600 mt-2">Siga estes passos para configurar seu ambiente e conectar seu Instagram com segurança.</p>

      <div className="mt-6">
        <OnboardingStepper steps={steps} />
      </div>

      {/* Contexto: Por que pedimos permissões? */}
      <div className="mt-6 p-4 rounded-lg border border-gray-200 bg-white">
        <h2 className="text-lg font-medium text-gray-900">Por que pedimos isso?</h2>
        <p className="text-sm text-gray-700 mt-1">
          Precisamos de acesso de leitura às suas contas para localizar seu Instagram Profissional/Creator e coletar métricas públicas. 
          Nunca postamos por você e você pode revogar o acesso a qualquer momento.
        </p>
      </div>

      {/* Segurança e Privacidade fixos */}
      <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-white">
        <h2 className="text-lg font-medium text-gray-900">Segurança e Privacidade</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 mt-2 space-y-1">
          <li>Somente leitura: acessamos posts e métricas públicas para gerar relatórios.</li>
          <li>Sem publicações: nunca postamos em seu nome.</li>
          <li>Revogável: você pode remover o acesso pelo Facebook quando quiser.</li>
        </ul>
      </div>

      <div className="mt-6 p-4 rounded-lg border border-gray-200 bg-white">
        {!instagramConnected ? (
          <div>
            <h2 className="text-lg font-medium text-gray-900">Conectar Instagram</h2>
            <p className="text-sm text-gray-600 mt-1">
              Vamos abrir o Facebook para você autorizar o acesso de leitura às suas contas. Nunca postamos por você.
            </p>
            <button
              onClick={goToPreConnect}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Continuar
            </button>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-medium text-gray-900">Tudo certo com a conexão!</h2>
            <p className="text-sm text-gray-600 mt-1">Podemos continuar para o seu Mídia Kit com dados frescos.</p>
            <button
              onClick={goToMediaKit}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Ir para o Mídia Kit
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
