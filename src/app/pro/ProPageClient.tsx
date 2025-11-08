"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Check,
  Sparkles,
  Shield,
  Mail,
  Calculator,
  Calendar,
  ArrowRight,
  ArrowUpRight,
  Compass,
  MessageCircle,
} from "lucide-react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { track } from "@/lib/track";
import { openPaywallModal } from "@/utils/paywallModal";

type PricesShape = {
  monthly: { brl: number; usd: number };
  annual: { brl: number; usd: number };
};

type APIRawPrice = {
  plan?: string | null;
  currency?: string | null;
  unitAmount?: number | null;
};

type ProPageClientProps = {
  creatorId: string | null;
  initialPlanStatus: {
    normalizedStatus: string | null;
    hasProAccess: boolean;
    isTrialActive: boolean;
  };
};

const HERO_COPY = {
  title: "Feche campanhas e planeje com a IA da D2C.",
  subtitle: "Planner PRO, discovery da comunidade, mentorias VIP e oportunidades sem exclusividade em um só lugar.",
  helper: "Conecte seu Instagram, libere o planner completo e receba propostas como um agenciado (sem contrato exclusivo).",
};

const BENEFITS = [
  {
    title: "Negociação com IA",
    description: "Faixa justa automática + recomendações para aceitar, ajustar ou pedir extra em cada proposta.",
    icon: <Sparkles className="h-5 w-5 text-brand-magenta" />,
  },
  {
    title: "Campanhas sem exclusividade",
    description: "Receba oportunidades de publicidade, responda com IA e conduza como um agenciado sem contrato.",
    icon: <Mail className="h-5 w-5 text-brand-magenta" />,
  },
  {
    title: "Calculadora + Diagnóstico",
    description: "Valores estratégicos, justos e premium com base nas suas métricas e histórico em segundos.",
    icon: <Calculator className="h-5 w-5 text-brand-magenta" />,
  },
  {
    title: "Planejamento PRO",
    description: "Descoberta da comunidade, slots com IA e alertas no WhatsApp para executar com foco.",
    icon: <Calendar className="h-5 w-5 text-brand-magenta" />,
  },
  {
    title: "Mentorias + WhatsApp IA",
    description: "Mentorias semanais do Grupo VIP e nudges diários personalizados direto no seu WhatsApp.",
    icon: <MessageCircle className="h-5 w-5 text-brand-magenta" />,
  },
];

const COMPARISON = [
  { feature: "Receber propostas e visualizar detalhes", free: true, pro: true },
  { feature: "Responder com IA e enviar pela plataforma", free: false, pro: true },
  { feature: "Calculadora dinâmica baseada nas suas métricas", free: false, pro: true },
  { feature: "Planejamento PRO (Descoberta/Planner/WhatsApp IA)", free: false, pro: true },
  { feature: "Mentorias semanais e nudges personalizados", free: false, pro: true },
  { feature: "Oportunidades de campanha sem exclusividade", free: false, pro: true },
];

const FAQS = [
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim. Você controla a assinatura dentro do app, sem multas. Se cancelar, mantém o acesso até o fim do ciclo contratado.",
  },
  {
    question: "O que a IA considera na faixa justa?",
    answer:
      "Além das suas métricas, usamos setor, formato, engajamento recente e histórico de campanhas para sugerir valores coerentes.",
  },
  {
    question: "Como funciona o reply-to do e-mail?",
    answer:
      "A marca recebe o e-mail com seu endereço como reply-to. Assim, qualquer resposta cai direto na sua caixa de entrada.",
  },
  {
    question: "Como são feitas as cobranças?",
    answer:
      "Você escolhe mensal ou anual. As cobranças são feitas pelo Stripe com nota fiscal emitida e recibos enviados por e-mail.",
  },
];

const UNLOCKED_SURFACES = [
  {
    title: "Planejamento PRO",
    description: "Slots com IA, previsões de alcance e alertas no WhatsApp para cada entrega.",
    href: "/dashboard/planning",
  },
  {
    title: "Descoberta da Comunidade",
    description: "Biblioteca viva de benchmarks, ideias e referências exclusivas dos creators PRO.",
    href: "/dashboard/discover",
  },
  {
    title: "Inbox de oportunidades",
    description: "Receba campanhas como um agenciado, responda com IA e mantenha sua autonomia.",
    href: "/campaigns",
  },
];

const FLOW_STEPS = [
  {
    title: "Descubra",
    description: "A IA analisa sua conta, cruza com a base comunitária e aponta temas/formats quentes.",
  },
  {
    title: "Planeje",
    description: "Slots prontos no planner PRO, com previsões e alertas para manter a consistência.",
  },
  {
    title: "Negocie",
    description: "Receba campanhas sem exclusividade, use reply com IA e faixa justa para fechar rápido.",
  },
];

function parsePrices(items: APIRawPrice[] | undefined | null): PricesShape {
  const byPlan: PricesShape = {
    monthly: { brl: 0, usd: 0 },
    annual: { brl: 0, usd: 0 },
  };

  const list = Array.isArray(items) ? items : [];
  for (const item of list) {
    const plan = String(item?.plan ?? "").toLowerCase();
    const currency = String(item?.currency ?? "").toLowerCase();
    const value =
      typeof item?.unitAmount === "number" ? Math.max(item.unitAmount / 100, 0) : 0;

    if ((plan === "monthly" || plan === "annual") && (currency === "brl" || currency === "usd")) {
      (byPlan[plan] as any)[currency] = value;
    }
  }
  return byPlan;
}

function formatCurrency(value: number, currency: "brl" | "usd") {
  return new Intl.NumberFormat(currency === "brl" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(value || 0);
}

const CTA_SURFACE: "flow_checklist" | "proposals_block" | "media_kit_block" | "upsell_block" | "other" = "other";

export default function ProPageClient({
  creatorId,
  initialPlanStatus,
}: ProPageClientProps) {
  const billingStatus = useBillingStatus();
  const [period, setPeriod] = useState<"annual" | "monthly">("annual");
  const [currency, setCurrency] = useState<"brl" | "usd">("brl");
  const [prices, setPrices] = useState<PricesShape | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  const normalizedStatus = billingStatus.normalizedStatus ?? initialPlanStatus.normalizedStatus ?? null;
  const hasProAccess = Boolean(billingStatus.hasPremiumAccess ?? initialPlanStatus.hasProAccess);
  const isTrialActive = Boolean(billingStatus.isTrialActive ?? initialPlanStatus.isTrialActive);

  useEffect(() => {
    track("pro_page_viewed", {
      creator_id: creatorId ?? null,
      plan: normalizedStatus ?? null,
    });
  }, [creatorId, normalizedStatus]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setPricesLoading(true);
      setPricesError(null);
      try {
        const res = await fetch("/api/billing/prices", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || data?.message || "Falha ao buscar preços.");
        }
        if (!isMounted) return;
        setPrices(parsePrices(data?.prices));
      } catch (error: any) {
        if (!isMounted) return;
        setPricesError(error?.message || "Não foi possível carregar os valores.");
        setPrices(null);
      } finally {
        if (isMounted) setPricesLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const activePrice = useMemo(() => {
    if (!prices) return 0;
    return prices[period][currency];
  }, [prices, period, currency]);

  const monthlyEquivalent = useMemo(() => {
    if (!prices) return 0;
    const annual = prices.annual[currency];
    return annual ? annual / 12 : 0;
  }, [prices, currency]);

  const savingsPct = useMemo(() => {
    if (!prices) return 0;
    const monthly = prices.monthly[currency];
    const annual = prices.annual[currency];
    if (!monthly || !annual) return 0;
    const monthlyEq = annual / 12;
    return Math.max(0, Math.round((1 - monthlyEq / monthly) * 100));
  }, [prices, currency]);

  const handleOpenModal = useCallback(
    (origin: string) => {
      track("dashboard_cta_clicked", {
        creator_id: creatorId ?? null,
        target: "activate_pro",
        surface: CTA_SURFACE,
        context: origin,
      });
      openPaywallModal({ context: "default", source: `pro_page_${origin}` });
    },
    [creatorId]
  );

  const handlePeriodToggle = useCallback(
    (nextPeriod: "annual" | "monthly") => {
      setPeriod(nextPeriod);
      track("pro_pricing_toggled", {
        creator_id: creatorId ?? null,
        plan: nextPeriod,
        currency,
      });
    },
    [creatorId, currency]
  );

  const handleCurrencyToggle = useCallback(
    (nextCurrency: "brl" | "usd") => {
      setCurrency(nextCurrency);
      track("pro_pricing_toggled", {
        creator_id: creatorId ?? null,
        plan: period,
        currency: nextCurrency,
      });
    },
    [creatorId, period]
  );

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-16">
        <section className="space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
            <Sparkles className="h-4 w-4" /> Plano PRO
          </div>
          <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">{HERO_COPY.title}</h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">{HERO_COPY.subtitle}</p>
          <p className="mx-auto max-w-3xl text-sm text-slate-500">{HERO_COPY.helper}</p>
          {!hasProAccess && (
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleOpenModal("hero")}
                className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-pink-600/40 transition hover:bg-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              >
                Ativar PRO
                <ArrowRight className="h-5 w-5" />
              </button>
              <Link
                href="#faq"
                className="text-sm font-semibold text-pink-700 underline-offset-4 hover:underline"
              >
                Tirar dúvidas
              </Link>
            </div>
          )}
          {hasProAccess && (
            <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm">
              <p className="font-semibold">Você é PRO ✅</p>
              <p className="mt-1 text-emerald-800">
                Explore as propostas com IA e mantenha seu planejamento atualizado para aproveitar
                cada campanha com segurança.
              </p>
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {UNLOCKED_SURFACES.map((surface) => (
            <article
              key={surface.title}
              className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-pink-50 text-pink-600">
                <Compass className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">{surface.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{surface.description}</p>
              <Link
                href={surface.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-pink-600 hover:text-pink-700"
              >
                Abrir agora
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <article
              key={benefit.title}
              className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-pink-50">
                {benefit.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{benefit.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{benefit.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-inner">
          <header className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-pink-600">Fluxo PRO</p>
            <h2 className="text-2xl font-bold text-slate-900">Como a IA guia sua semana</h2>
            <p className="text-sm text-slate-600">Descubra, planeje e responda como um agenciado — mantendo sua autonomia.</p>
          </header>
          <div className="grid gap-4 md:grid-cols-3">
            {FLOW_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-pink-50 text-pink-600 font-semibold">
                  {index + 1}
                </div>
                <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <header>
            <h2 className="text-2xl font-bold text-slate-900">Compare Free vs PRO</h2>
            <p className="mt-1 text-sm text-slate-600">
              Sem pegadinhas: veja o que é liberado em cada plano.
            </p>
          </header>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Recurso</th>
                  <th className="px-4 py-3 font-semibold text-center">Free</th>
                  <th className="px-4 py-3 font-semibold text-center text-pink-600">PRO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARISON.map((row) => (
                  <tr key={row.feature}>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-800">{row.feature}</td>
                    <td className="px-4 py-4 text-center">
                      {row.free ? (
                        <Check className="mx-auto h-5 w-5 text-emerald-600" />
                      ) : (
                        <span className="text-xs font-medium text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      {row.pro ? (
                        <Check className="mx-auto h-5 w-5 text-pink-600" />
                      ) : (
                        <span className="text-xs font-medium text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-8 md:grid-cols-5 md:items-center" id="pricing">
          <div className="md:col-span-2 space-y-3">
            <h2 className="text-2xl font-bold text-slate-900">Escolha como quer assinar</h2>
            <p className="text-sm text-slate-600">
              Transparência total: você decide mensal ou anual, com economia para quem fica mais
              tempo.
            </p>
            {pricesError && (
              <p className="text-sm font-semibold text-red-600">{pricesError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handlePeriodToggle("monthly")}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                  period === "monthly"
                    ? "border-pink-500 bg-pink-50 text-pink-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                Plano mensal
              </button>
              <button
                type="button"
                onClick={() => handlePeriodToggle("annual")}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                  period === "annual"
                    ? "border-pink-500 bg-pink-50 text-pink-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                Plano anual {savingsPct > 0 && <span className="text-xs text-emerald-600">–{savingsPct}%</span>}
              </button>
              <button
                type="button"
                onClick={() => handleCurrencyToggle("brl")}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                  currency === "brl"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                BRL
              </button>
              <button
                type="button"
                onClick={() => handleCurrencyToggle("usd")}
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                  currency === "usd"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                USD
              </button>
            </div>
          </div>
          <div className="md:col-span-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {pricesLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-10 w-40 rounded-lg bg-slate-100" />
                  <div className="h-6 w-64 rounded bg-slate-100" />
                  <div className="h-6 w-52 rounded bg-slate-100" />
                </div>
              ) : prices ? (
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-900">
                      {formatCurrency(activePrice, currency)}
                    </span>
                    <span className="text-sm text-slate-600">
                      /{period === "annual" ? "ano" : "mês"}
                    </span>
                  </div>
                  {period === "annual" && (
                    <p className="text-sm text-slate-500">
                      Equivale a <strong>{formatCurrency(monthlyEquivalent, currency)}</strong> por
                      mês.
                    </p>
                  )}
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                      Teste gratuito de 48h com tudo liberado.
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                      Cancelamento simples direto no app.
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                      Nota fiscal e recibos automáticos por e-mail.
                    </li>
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Não foi possível carregar os valores agora. Tente novamente mais tarde.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-inner">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-700">Que telas eu libero com o PRO?</p>
              <p className="text-sm text-slate-500">
                Você ganha acesso completo ao planner com IA, à descoberta da comunidade e à caixa de oportunidades dentro da plataforma.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Ver planner", href: "/dashboard/planning" },
                { label: "Ver discovery", href: "/dashboard/discover" },
                { label: "Campanhas", href: "/campaigns" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                >
                  {link.label}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="space-y-6">
          <header>
            <h2 className="text-2xl font-bold text-slate-900">Perguntas frequentes</h2>
            <p className="text-sm text-slate-600">
              Se ainda ficou alguma dúvida, fale com a gente pelo chat ou WhatsApp.
            </p>
          </header>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-left text-base font-semibold text-slate-800 marker:hidden">
                  {faq.question}
                  <span className="text-sm text-pink-600 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {!hasProAccess && (
          <section className="rounded-3xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-pink-100 p-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Pronto para responder com IA e fechar sua próxima campanha?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Ative o PRO para liberar análise, e-mail, calculadora e planejamento em um só clique.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleOpenModal("bottom")}
                className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-pink-600/40 transition hover:bg-pink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              >
                Ativar PRO
                <ArrowRight className="h-5 w-5" />
              </button>
              <a
                href="mailto:arthur@data2content.ai"
                className="text-sm font-semibold text-pink-700 underline-offset-4 hover:underline"
              >
                Falar com vendas
              </a>
            </div>
          </section>
        )}
      </main>

    </>
  );
}
