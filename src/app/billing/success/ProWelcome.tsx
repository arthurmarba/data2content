// src/app/billing/success/ProWelcome.tsx
"use client";

import { COMMUNITY_PRO_JOIN_ROUTE } from "@/app/lib/communityLinks";
import { buildNextChargeNotice } from "@/app/lib/billing/firstCharge";

export const PRO_WELCOME_INSTAGRAM_HREF = "/dashboard/instagram/connect?next=narrative-map";

interface ProWelcomeProps {
  /** Já conectou o Instagram — nesse caso a etapa de conexão não aparece. */
  instagramConnected: boolean;
  /** Rota interna de volta ao app (mapa/perfil). */
  continueHref: string;
  /** Data real da próxima cobrança, quando o Stripe já respondeu. */
  nextChargeAt?: Date | null;
  /** Telemetria de cada passo tocado. */
  onStep?: (step: "community" | "instagram" | "continue") => void;
}

/**
 * Boas-vindas Pro (Fase 5).
 *
 * As ações são independentes: o assinante escolhe por onde continuar.
 */
export function ProWelcome({
  instagramConnected,
  continueHref,
  nextChargeAt,
  onStep,
}: ProWelcomeProps) {
  // Quem entrou com o mês grátis não recebe nenhum aviso do Stripe antes da
  // primeira cobrança. Esta é a última superfície onde a data aparece.
  const chargeNotice = buildNextChargeNotice(nextChargeAt ?? null);

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
        Sua assinatura está ativa. Entre na comunidade ou continue configurando seu perfil no seu ritmo.
      </p>

      <div className="mt-8 space-y-7">
        <section>
          <h2 className="text-[15px] font-semibold text-zinc-900">Comunidade D2C no WhatsApp</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
            Networking, conversa diária e avisos das reuniões semanais.
          </p>
          <a
            href={COMMUNITY_PRO_JOIN_ROUTE}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onStep?.("community")}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-zinc-950 px-6 py-3 text-[14px] font-semibold text-white transition-colors active:bg-zinc-800"
          >
            Entrar na Comunidade D2C
          </a>
        </section>

        {!instagramConnected ? (
          <section>
            <h2 className="text-[15px] font-semibold text-zinc-900">Conecte seu Instagram</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
              Ative seu relatório semanal e aprofunde o mapa com dados reais.
            </p>
            <a
              href={PRO_WELCOME_INSTAGRAM_HREF}
              onClick={() => onStep?.("instagram")}
              className="mt-3 inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-[14px] font-semibold text-zinc-900 transition-colors active:bg-zinc-50"
            >
              Conectar meu Instagram
            </a>
          </section>
        ) : null}
      </div>

      {chargeNotice ? (
        <p className="mt-10 text-[12px] leading-relaxed text-zinc-400">
          {chargeNotice} Você pode cancelar quando quiser em Assinatura.
        </p>
      ) : null}

      <a
        href={continueHref}
        onClick={() => onStep?.("continue")}
        className={`${chargeNotice ? "mt-6" : "mt-10"} text-center text-[14px] font-medium text-zinc-500 underline underline-offset-4`}
      >
        Continuar no app
      </a>
    </main>
  );
}

export default ProWelcome;
