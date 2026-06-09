"use client";

import React, { useEffect, useState } from "react";
import { fallbackPubliRange } from "@/app/lib/pricing/narrativePubliModel";

// ─── Valor de publi por narrativa, exibido na hipótese inicial ───────────────
//
// Decisão de produto: o valor precisa ser COERENTE com um entregável concreto —
// "1 Reels + combo de Stories, marca média" — e, quando possível, ancorado em
// criadores REAIS da mesma narrativa.
//
// Dois modos:
//   1. dynamic     — faixa p25–p75 da coorte real de criadores da narrativa
//                    (endpoint /api/dashboard/pricing-stats/narrative-range).
//   2. fallback    — banda determinística (10–50k seguidores) quando a coorte é
//                    pequena, o fetch falha, ou a narrativa é desconhecida.
//
// O valor de publi entra em destaque forte AO LADO da hipótese — nunca dentro do
// texto narrativo dela. A hipótese é autoconhecimento (Etapas 1-2); o R$ é o
// argumento de "por que aprofundar", não de "quem você é".

/** Formata um valor numérico em reais sem casas decimais (ex.: 2400 → "R$ 2.400"). */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Formata seguidores em "X mil" (ex.: 24000 → "24 mil"). */
function formatThousands(value: number): string {
  return `${Math.round(value / 1000)} mil`;
}

interface NarrativeRangeResponse {
  min: number | null;
  max: number | null;
  avgFollowers: number | null;
  label: string | null;
  sample: number;
  scope: "narrative" | "platform" | null;
  source: "dynamic" | "insufficient";
}

interface OnboardingValueBlockProps {
  /** Identidade narrativa do criador (valor de Q1) — define CPM, rótulo e coorte. */
  whyYouCreate?: string;
  className?: string;
}

export function OnboardingValueBlock({ whyYouCreate, className = "" }: OnboardingValueBlockProps) {
  const fallback = fallbackPubliRange(whyYouCreate);
  const [dynamic, setDynamic] = useState<NarrativeRangeResponse | null>(null);

  // Busca a faixa real da coorte. Enquanto não resolve (ou se a amostra for
  // insuficiente / erro), permanece o fallback determinístico — sem layout shift.
  useEffect(() => {
    if (!whyYouCreate) return;
    let cancelled = false;

    fetch(`/api/dashboard/pricing-stats/narrative-range?narrative=${encodeURIComponent(whyYouCreate)}`)
      .then((r) => r.json())
      .then((data: NarrativeRangeResponse) => {
        if (cancelled) return;
        if (data?.source === "dynamic" && data.min != null && data.max != null) {
          setDynamic(data);
        }
      })
      .catch(() => { /* silencioso — fallback já exibido */ });

    return () => { cancelled = true; };
  }, [whyYouCreate]);

  const isDynamic =
    dynamic?.source === "dynamic" && dynamic.min != null && dynamic.max != null;
  const min = isDynamic ? dynamic!.min! : fallback.min;
  const max = isDynamic ? dynamic!.max! : fallback.max;
  const label = (isDynamic ? dynamic!.label : null) ?? fallback.label;

  // Frase de prova social que APRESENTA o número (legível, não rodapé):
  // "criadores [da narrativa / da D2C] com ~X seguidores fecham nesta faixa".
  // Coorte real sempre que possível — o escopo ajusta o sujeito da frase.
  const hasRealCohort = isDynamic && dynamic!.avgFollowers != null;
  const isNarrativeScope = dynamic?.scope === "narrative";
  const followersPhrase = hasRealCohort
    ? `cerca de ${formatThousands(dynamic!.avgFollowers!)} seguidores`
    : "10 a 50 mil seguidores";
  const subject = hasRealCohort && isNarrativeScope ? `de ${label}` : "da D2C";

  const lead = hasRealCohort
    ? `Criadores ${subject} com ${followersPhrase} fecham nesta faixa:`
    : `Criadores de ${label} com ${followersPhrase} costumam fechar nesta faixa:`;

  // Metodologia (de onde vem o número) — aí sim, rodapé discreto.
  const footnote = !hasRealCohort
    ? `Estimativa da calculadora da D2C. Quando ela lê o seu Instagram, calcula o seu número exato.`
    : isNarrativeScope
      ? `Baseado em ${dynamic!.sample} criadores da mesma narrativa na D2C. O valor exato sai quando a D2C lê o seu Instagram.`
      : `Baseado em ${dynamic!.sample} criadores da D2C. O valor exato sai quando a D2C lê o seu Instagram.`;

  return (
    <div className={className}>
      {/* Card de valor — prova social legível + faixa em destaque */}
      <div className="rounded-2xl bg-zinc-50 px-5 py-4 ring-1 ring-zinc-100">
        <p className="text-[13px] leading-relaxed text-zinc-600">{lead}</p>

        <p className="mt-2 text-[24px] font-bold leading-none tracking-tight text-zinc-950">
          {formatBRL(min)} <span className="text-zinc-400">–</span> {formatBRL(max)}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
          por 1 Reels + combo de Stories, com marcas de porte médio.
        </p>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">{footnote}</p>
    </div>
  );
}
