// src/app/billing/success/ProWelcome.tsx
"use client";

import { COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";

export const PRO_WELCOME_INSTAGRAM_HREF = "/dashboard/instagram/connect?next=narrative-map";

interface ProWelcomeProps {
  /** Já conectou o Instagram — nesse caso a etapa de conexão não aparece. */
  instagramConnected: boolean;
  /** Rota interna de volta ao app (mapa/perfil). */
  continueHref: string;
  /** Telemetria de cada passo tocado. */
  onStep?: (step: "community" | "instagram" | "continue") => void;
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[12px] font-semibold text-zinc-500"
    >
      {children}
    </span>
  );
}

/**
 * Boas-vindas Pro (Fase 5).
 *
 * A ordem é deliberada: o grupo vem primeiro porque é lá que o assinante
 * confirma presença e entra na análise da semana. A conexão do Instagram é o
 * segundo passo e só existe depois do pagamento aprovado.
 */
export function ProWelcome({ instagramConnected, continueHref, onStep }: ProWelcomeProps) {
  return (
    // pb generoso: o banner de cookies fica fixo no rodapé e não pode cobrir o último passo.
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center bg-white px-6 pb-32 pt-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 12.5l4 4 10-10"
            stroke="#10b981"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1 className="mt-5 text-[1.55rem] font-bold leading-tight tracking-tight text-zinc-950">
        Bem-vindo ao D2C Pro
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
        Sua assinatura está ativa. Faltam dois passos para você aproveitar a próxima reunião.
      </p>

      <ol className="mt-8 space-y-6">
        <li className="flex gap-3">
          <StepBadge>1</StepBadge>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-zinc-900">Entre no grupo de assinantes</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
              A confirmação de presença acontece lá. Quem confirma é analisado na reunião daquela
              semana. Mudanças e cancelamentos também são avisados primeiro no grupo.
            </p>
            <a
              href={COMMUNITY_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onStep?.("community")}
              className="mt-3 inline-flex items-center justify-center rounded-full bg-zinc-950 px-6 py-3 text-[14px] font-semibold text-white transition-colors active:bg-zinc-800"
            >
              Entrar no grupo de assinantes
            </a>
          </div>
        </li>

        {!instagramConnected ? (
          <li className="flex gap-3">
            <StepBadge>2</StepBadge>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold text-zinc-900">Conecte seu Instagram</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
                É o que deixa o seu Mapa, as pautas e os matches de collab com a sua cara.
              </p>
              <a
                href={PRO_WELCOME_INSTAGRAM_HREF}
                onClick={() => onStep?.("instagram")}
                className="mt-3 inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-[14px] font-semibold text-zinc-900 transition-colors active:bg-zinc-50"
              >
                Conectar meu Instagram
              </a>
            </div>
          </li>
        ) : null}
      </ol>

      <a
        href={continueHref}
        onClick={() => onStep?.("continue")}
        className="mt-10 text-center text-[14px] font-medium text-zinc-500 underline underline-offset-4"
      >
        Continuar no app
      </a>
    </main>
  );
}

export default ProWelcome;
