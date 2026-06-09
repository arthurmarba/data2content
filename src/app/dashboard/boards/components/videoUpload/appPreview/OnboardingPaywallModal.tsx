"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

// ─── Copy personalizado por identidade narrativa (Q1) ────────────────────────
//
// Cada chave mapeia os três elementos de texto que mudam por narrativa:
//   heading   — o gancho principal (logo abaixo do ícone)
//   tagline   — argumento específico do território narrativo
//   proLabel  — contexto do card de social proof (R$ 2.400)
//
// Regra de copy: nenhum texto usa jargão de growth, pressão de performance
// ou linguagem de "poste mais". Foco em identidade e valor narrativo.

interface NarrativeCopy {
  heading: string;
  tagline: string;
  proLabel: string;
}

const NARRATIVE_COPY: Record<string, NarrativeCopy> = {
  ensino_conhecimento: {
    heading:  "Seu conhecimento tem mais valor do que você imagina.",
    tagline:  "Marcas que investem em educação pagam por confiança — não por alcance.",
    proLabel: "média por publi de criadores educativos com narrativa definida na D2C",
  },
  conto_historias: {
    heading:  "Sua história é um ativo que marcas não conseguem fabricar.",
    tagline:  "Autenticidade é o que mais escasseia no marketing. Você já tem.",
    proLabel: "média por publi de criadores de conteúdo pessoal com narrativa definida na D2C",
  },
  entretenimento: {
    heading:  "Atenção genuína vale mais do que alcance comprado.",
    tagline:  "Marcas precisam de criadores que prendem pessoas — não só que as alcançam.",
    proLabel: "média por publi de criadores de entretenimento com narrativa definida na D2C",
  },
  inspiro_acao: {
    heading:  "Narrativas que movem pessoas movem orçamentos.",
    tagline:  "Marcas de transformação pagam mais por criadores que causam ação real.",
    proLabel: "média por publi de criadores motivacionais com narrativa definida na D2C",
  },
  // Legacy — mapeados para o equivalente atual
  compartilho_aprendizado: {
    heading:  "Seu conhecimento tem mais valor do que você imagina.",
    tagline:  "Marcas que investem em educação pagam por confiança — não por alcance.",
    proLabel: "média por publi de criadores educativos com narrativa definida na D2C",
  },
  ensino_habilidade: {
    heading:  "Seu conhecimento tem mais valor do que você imagina.",
    tagline:  "Marcas que investem em educação pagam por confiança — não por alcance.",
    proLabel: "média por publi de criadores educativos com narrativa definida na D2C",
  },
};

const DEFAULT_COPY: NarrativeCopy = {
  heading:  "Sua narrativa é o que as marcas compram.",
  tagline:  "Marcas não compram audiência — compram narrativa.",
  proLabel: "média cobrada por publi por criadores com narrativa definida na D2C",
};

/** Valor médio de fallback (R$) — usado enquanto o fetch não termina, em erro ou amostra insuficiente. */
const AVG_PRICE_FALLBACK = 2400;

/** Fallback usado enquanto o fetch não termina ou em caso de erro. */
const COMMUNITY_COUNT_FALLBACK = 847;

/** Formata um valor numérico em reais sem casas decimais (ex.: 2400 → "R$ 2.400"). */
function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

interface OnboardingPaywallModalProps {
  open: boolean;
  /**
   * Identidade narrativa do criador (valor de Q1).
   * Quando fornecido, exibe tagline personalizada em vez do texto padrão.
   */
  whyYouCreate?: string;
  onSubscribeNow: () => Promise<void>;
  onExploreFree: () => void;
}

/**
 * PW2 — Tela de decisão no onboarding.
 * Fase 2: communityCount dinâmico · Fase 3: média de precificação real · Fase 4: copy por narrativa.
 *
 * Renderizada como step fullscreen DENTRO do onboarding (não como modal sobreposto).
 * O wrapper fixo foi removido — o onboarding já provê `fixed inset-0`.
 *
 * Ao abrir (`open === true`), faz fetch de `/api/landing/community-stats` para exibir
 * o número real de criadores no disclaimer. Enquanto carrega ou em erro, exibe o
 * fallback estático (847) — a tela não bloqueia para aguardar o dado.
 *
 * Fluxo:
 *   1. "Assinar agora"            → onSubscribeNow() → BillingSubscribeModal (Stripe)
 *   2. "Explorar grátis primeiro" → onExploreFree()  → continua na plataforma
 *
 * Regra do produto: nunca usar "Fechar" ou "Pular". Apenas CTAs nomeados pelo benefício.
 */
export function OnboardingPaywallModal({
  open,
  whyYouCreate,
  onSubscribeNow,
  onExploreFree,
}: OnboardingPaywallModalProps) {
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [communityCount, setCommunityCount] = useState<number>(COMMUNITY_COUNT_FALLBACK);
  const [avgPrice, setAvgPrice] = useState<number>(AVG_PRICE_FALLBACK);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Fase 4 — foco automático no heading ao montar o step de paywall.
  useEffect(() => { if (open) headingRef.current?.focus(); }, [open]);

  // Fetch dinâmico ao abrir o paywall — duas fontes, ambas com fallback silencioso:
  //   Fase 2 — total de criadores (/api/landing/community-stats).
  //   Fase 3 — média de precificação real dos Pro (/api/dashboard/pricing-stats/community-average).
  // Os fallbacks estáticos já garantem uma leitura coerente caso qualquer fetch falhe
  // ou a amostra seja insuficiente — a tela nunca bloqueia para aguardar.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    fetch("/api/landing/community-stats")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const count = data?.metrics?.totalSubscribers;
        if (typeof count === "number" && count > 0) {
          setCommunityCount(count);
        }
      })
      .catch(() => { /* silencioso — fallback já exibido */ });

    fetch("/api/dashboard/pricing-stats/community-average")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        // averageJusto é null quando a amostra é insuficiente → mantém fallback.
        const avg = data?.averageJusto;
        if (typeof avg === "number" && avg > 0) {
          setAvgPrice(avg);
        }
      })
      .catch(() => { /* silencioso — fallback já exibido */ });

    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const copy =
    (whyYouCreate ? NARRATIVE_COPY[whyYouCreate] : undefined) ?? DEFAULT_COPY;

  const handleSubscribeClick = async () => {
    setIsSubscribing(true);
    try {
      await onSubscribeNow();
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div
      className="flex min-h-full flex-col bg-white px-5"
      style={{
        paddingTop:    "1.5rem",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4rem)",
      }}
    >
      <div className="my-auto mx-auto w-full max-w-sm">

        {/* Icon */}
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="4" fill="#f97316" />
          </svg>
        </div>

        {/* Heading — personalizado por identidade narrativa */}
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mb-2 text-[21px] font-bold leading-tight tracking-tight text-zinc-950 focus:outline-none"
        >
          {copy.heading}
        </h2>

        {/* Tagline — argumento específico do território narrativo */}
        <p className="mb-6 text-[14.5px] leading-relaxed text-zinc-500">
          {copy.tagline}
        </p>

        {/* Social proof card — label contextualizado por narrativa */}
        <div className="mb-8 rounded-2xl bg-zinc-50 px-5 py-4 ring-1 ring-zinc-100">
          <p className="text-[26px] font-bold tracking-tight text-zinc-950">
            {formatBRL(avgPrice)}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">
            {copy.proLabel}
            <sup className="ml-0.5 text-[10px]">¹</sup>
          </p>
        </div>

        {/* CTA 1: Subscribe — pill filled, com seta (ação forte) */}
        <button
          type="button"
          onClick={handleSubscribeClick}
          disabled={isSubscribing}
          className="mb-3 flex w-full items-center justify-between rounded-full bg-zinc-950 px-6 py-4 text-white transition-all disabled:opacity-50 active:bg-zinc-900"
        >
          <p className="text-[15px] font-semibold">Assinar agora</p>
          {isSubscribing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowRight className="h-5 w-5" />
          )}
        </button>

        {/* CTA 2: Explore free — pill outlined, sem seta (peso visual menor, ainda nomeado pelo benefício) */}
        <button
          type="button"
          onClick={onExploreFree}
          disabled={isSubscribing}
          className="w-full rounded-full border border-zinc-200 px-6 py-4 text-[15px] font-semibold text-zinc-700 transition-colors disabled:opacity-50 active:bg-zinc-50"
        >
          Explorar grátis primeiro
        </button>

        {/* Reassurance + disclaimer */}
        <p className="mt-6 text-center text-[12px] text-zinc-400">
          A assinatura não pula etapas — só aprofunda o que você descobre.
        </p>
        <p className="mt-2 text-center text-[11px] text-zinc-300">
          ¹ Média dos assinantes Pro da comunidade de{" "}
          {communityCount.toLocaleString("pt-BR")} criadores.
        </p>

      </div>
    </div>
  );
}
