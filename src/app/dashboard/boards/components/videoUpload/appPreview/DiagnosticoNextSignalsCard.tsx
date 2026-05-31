"use client";

import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { CARD_P } from "./diagnosticoTokens";

interface Props {
  status: string | null;
  narrativeEvidenceCount: number;
  hasTension: boolean;
  hasCommercialSignal: boolean;
}

/** Drive-of-engagement card: what should you analyze next to advance the profile */
export function DiagnosticoNextSignalsCard({
  status,
  narrativeEvidenceCount,
  hasTension,
  hasCommercialSignal,
}: Props) {
  const signals = getNextSignals({
    status,
    narrativeEvidenceCount,
    hasTension,
    hasCommercialSignal,
  });

  if (signals.length === 0) return null;

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg="bg-violet-500"
          iconSlot={<RadarIcon />}
          category="O QUE VOCÊ AINDA PODE DESCOBRIR"
          catColor="text-violet-600"
        />

        <p className="text-[20px] font-bold leading-tight tracking-tight text-zinc-950">
          Perguntas em aberto
        </p>

        <ul className="mt-4 flex flex-col gap-3">
          {signals.map((signal, i) => (
            <li key={i} className="flex gap-2.5">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100">
                <div className="h-2 w-2 rounded-full bg-violet-500" />
              </div>
              <p className="flex-1 text-[15px] font-medium leading-snug text-zinc-700">{signal}</p>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-[12px] font-medium leading-snug text-zinc-400">
          Cada nova análise responde uma dessas perguntas
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function getNextSignals(params: {
  status: string | null;
  narrativeEvidenceCount: number;
  hasTension: boolean;
  hasCommercialSignal: boolean;
}): string[] {
  const { status, narrativeEvidenceCount, hasTension, hasCommercialSignal } = params;

  if (status === "profile_consistent") {
    return [
      "O que acontece com minha narrativa quando o tema sai do padrão?",
      "A leitura muda se eu usar um formato diferente do meu habitual?",
    ];
  }

  if (status === "pattern_in_formation") {
    const signals = [
      "Esse padrão aparece mesmo quando o tema muda?",
    ];
    if (!hasCommercialSignal) {
      signals.push("Marcas ou produtos aparecem naturalmente no meu conteúdo — ou isso é forçado?");
    } else {
      signals.push("Uma abertura diferente muda a leitura da narrativa ou ela se mantém?");
    }
    return signals;
  }

  if (status === "signals_emerging") {
    const signals = [
      narrativeEvidenceCount >= 2
        ? "Esse sinal se repete — ou foi um vídeo isolado?"
        : "O que esses primeiros vídeos têm em comum além do tema?",
    ];
    if (!hasTension) {
      signals.push("Existe um ponto que aparece como ajuste em vídeos diferentes?");
    }
    return signals;
  }

  if (status === "first_reading") {
    return [
      "O que se repete quando eu faço conteúdo do jeito que mais gosto?",
      "Qual vídeo representa melhor meu estilo atual?",
    ];
  }

  // empty
  return [
    "Qual vídeo meu representa melhor quem sou como criador hoje?",
  ];
}

function RadarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.5" fill="white" />
      <path d="M12 3v6M21 12h-6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
