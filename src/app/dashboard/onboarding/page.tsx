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
        key: "connect-instagram",
        title: "Conectar Instagram",
        description: "Autorize no Facebook (somente leitura).",
        state: instagramConnected ? "completed" : "current",
      },
      {
        key: "sync",
        title: "Sincronizar",
        description: "Carregamos suas métricas públicas.",
        state: instagramConnected ? "completed" : "pending",
      },
      {
        key: "done",
        title: "Pronto",
        description: "Veja seu Mídia Kit.",
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

      {/* Mini callout curto */}
      <div className="mt-4 p-3 rounded-lg border border-gray-200 bg-white text-sm text-gray-700">
        Somente leitura • Sem publicações • Revogável a qualquer momento. <a className="underline text-blue-700 hover:text-blue-800" href="/dashboard/instagram/faq">Saiba mais</a>
      </div>

      <div className="mt-6 p-4 rounded-lg border border-gray-200 bg-white">
        {!instagramConnected ? (
          <div>
            <h2 className="text-lg font-medium text-gray-900">Conectar Instagram</h2>
            <p className="text-sm text-gray-600 mt-1">Autorize no Facebook em poucos passos.</p>
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
