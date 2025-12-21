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
  title: "Posicione seu conteúdo para atrair marcas com IA.",
  subtitle:
    "Plano Agência: estratégia guiada, alertas no WhatsApp e mentorias semanais para você negociar direto com as marcas. Dúvidas com IA ficam no Chat AI dentro do app.",
  helper:
    "Você segue dono do relacionamento; as marcas chegam a você. Só assinatura fixa, 0% de comissão nas publis.",
};

const BENEFITS = [
  {
    title: "Negociação com IA",
    description: "Faixa justa automática + recomendações para aceitar, ajustar ou pedir extra em cada proposta.",
    icon: <Sparkles className="h-6 w-6" />,
  },
  {
    title: "Campanhas inbound",
    description: "Inbox direto no seu nome: as marcas chegam, você responde com IA e conduz a negociação.",
    icon: <Mail className="h-6 w-6" />,
  },
  {
    title: "Calculadora + Diagnóstico",
    description: "Valores estratégicos, justos e premium com base nas suas métricas e histórico em segundos.",
    icon: <Calculator className="h-6 w-6" />,
  },
  {
    title: "Planejamento Agência",
    description: "Slots guiados por IA, alertas no WhatsApp e referências da comunidade para subir sua autoridade.",
    icon: <Calendar className="h-6 w-6" />,
  },
  {
    title: "Mentorias + alertas no WhatsApp",
    description: "Mentoria estratégica semanal e alertas pelo WhatsApp; para conversar com a IA, abra o Chat AI na plataforma.",
    icon: <MessageCircle className="h-6 w-6" />,
  },
  {
    title: "Comissão zero",
    description: "Agências cobram 10%–30% e exigem exclusividade; no Plano Agência você paga só a assinatura e fica com todo o valor das publis.",
    icon: <Shield className="h-6 w-6" />,
  },
];

const COMPARISON = [
  { feature: "Receber propostas e visualizar detalhes", free: true, pro: true },
  { feature: "Responder com IA e enviar pela plataforma", free: false, pro: true },
  { feature: "Calculadora dinâmica baseada nas suas métricas", free: false, pro: true },
  { feature: "Planejamento Agência (Descoberta/Planner/alertas no WhatsApp)", free: false, pro: true },
  { feature: "Mentorias semanais e nudges personalizados", free: false, pro: true },
  { feature: "Oportunidades de campanha sem exclusividade", free: false, pro: true },
  { feature: "Posicionamento para atrair marcas (IA + mentoria)", free: false, pro: true },
  { feature: "0% de comissão sobre publis (só assinatura)", free: false, pro: true },
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
  {
    question: "Preciso dar exclusividade ou pagar comissão?",
    answer:
      "Não. O Plano Agência é por assinatura fixa: você mantém 100% dos cachês e negocia direto com as marcas, sem exclusividade.",
  },
  {
    question: "O que entra nas mentorias semanais?",
    answer:
      "Ajustes de posicionamento, pitch, pricing e revisão de deals. É um espaço para dúvidas táticas e acompanhamento contínuo.",
  },
  {
    question: "Os alertas do WhatsApp dependem de integrar o Instagram?",
    answer:
      "Recomendamos conectar o Instagram para diagnósticos mais precisos. Os alertas usam seus dados e qualquer conversa com IA acontece no Chat AI do app.",
  },
  {
    question: "Posso trocar o período (mensal/anual) depois?",
    answer:
      "Sim. Você pode mudar o período na gestão de assinatura. A alteração passa a valer no próximo ciclo de cobrança.",
  },
];

const UNLOCKED_SURFACES = [
  {
    title: "Planejamento Agência",
    description: "Slots com IA, previsões de alcance e alertas no WhatsApp para cada entrega (dúvidas no Chat AI).",
    href: "/dashboard/planning",
  },
  {
    title: "Descoberta da Comunidade",
    description:
      "Biblioteca viva de benchmarks, ideias e referências exclusivas dos creators do Plano Agência.",
    href: "/dashboard/discover",
  },
  {
    title: "Inbox de oportunidades",
    description: "Marcas chegam direto para você; responda com IA e mantenha autonomia total.",
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
    description: "Slots prontos no planner Agência, com previsões e alertas para manter a consistência.",
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
  const needsPaymentAction = Boolean(billingStatus.needsPaymentAction);
  const canSubscribe = !hasProAccess && !needsPaymentAction;

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
      <main className="dashboard-page-shell py-10 space-y-16">
        <section className="space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#F6007B]/20 bg-[#F6007B]/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#F6007B]">
            <Sparkles className="h-4 w-4" /> Plano Agência
          </div>
          <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">{HERO_COPY.title}</h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">{HERO_COPY.subtitle}</p>
          <p className="mx-auto max-w-3xl text-sm text-slate-500">{HERO_COPY.helper}</p>
          {canSubscribe && (
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleOpenModal("hero")}
                className="inline-flex items-center gap-2 rounded-full bg-[#F6007B] px-6 py-3 text-base font-semibold text-white shadow-lg shadow-[#F6007B]/30 transition hover:bg-[#e2006f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40"
              >
                Ativar Plano Agência
                <ArrowRight className="h-5 w-5" />
              </button>
              <Link
                href="#faq"
                className="text-sm font-semibold text-[#F6007B] underline-offset-4 hover:underline"
              >
                Tirar dúvidas
              </Link>
            </div>
          )}
          {!hasProAccess && needsPaymentAction && (
            <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
              <p className="font-semibold">Pagamento pendente</p>
              <p className="mt-1 text-amber-800">
                Atualize o método de pagamento em Billing para liberar novas assinaturas.
              </p>
              <Link
                href="/dashboard/billing"
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
              >
                Ir para Billing
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          )}
          {hasProAccess && (
            <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm">
              <p className="font-semibold">Plano Agência ativo ✅</p>
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
              className="group flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6007B]/10 text-[#F6007B] transition-colors group-hover:bg-[#F6007B] group-hover:text-white">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{surface.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{surface.description}</p>
              <Link
                href={surface.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#F6007B] hover:text-[#e2006f]"
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
              className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-[#F6007B]">
                {benefit.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{benefit.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{benefit.description}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-slate-50/50 p-8 shadow-sm">
          <header className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#F6007B]">Fluxo Plano Agência</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">Como a IA guia sua semana</h2>
            <p className="mt-2 text-sm text-slate-600">Descubra, planeje e responda como um agenciado — mantendo sua autonomia.</p>
          </header>
          <div className="grid gap-4 md:grid-cols-3">
            {FLOW_STEPS.map((step, index) => (
              <div key={step.title} className="relative rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F6007B]/10 text-lg font-bold text-[#F6007B]">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-8">
          <header className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-slate-900">Compare Free vs Plano Agência</h2>
            <p className="mt-2 text-sm text-slate-600">
              Sem pegadinhas: veja o que é liberado em cada plano.
            </p>
          </header>
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm text-slate-700">
              <thead className="bg-slate-50/50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Recurso</th>
                  <th className="px-6 py-4 font-semibold text-center">Free</th>
                  <th className="px-6 py-4 font-semibold text-center text-[#F6007B]">Plano Agência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.feature}</td>
                    <td className="px-6 py-4 text-center">
                      {row.free ? (
                        <Check className="mx-auto h-5 w-5 text-emerald-500" />
                      ) : (
                        <span className="text-xs font-medium text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.pro ? (
                        <Check className="mx-auto h-5 w-5 text-[#F6007B]" />
                      ) : (
                        <span className="text-xs font-medium text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {!hasProAccess && (
          <section className="grid gap-8 md:grid-cols-5 md:items-start" id="pricing">
            <div className="md:col-span-2 space-y-4">
              <h2 className="text-2xl font-bold text-slate-900">Escolha como quer assinar</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Defina período e moeda. Annual traz economia; mensal mantém flexibilidade.
              </p>
              {pricesError && (
                <p className="text-sm font-semibold text-red-600">{pricesError}</p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:flex-col md:items-start">
                <div className="inline-flex rounded-full border border-slate-200 p-1">
                  <button
                    type="button"
                    onClick={() => handlePeriodToggle("monthly")}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${period === "monthly" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePeriodToggle("annual")}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${period === "annual" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    Anual {savingsPct > 0 && <span className={`ml-1 text-xs ${period === "annual" ? "text-emerald-300" : "text-emerald-600"}`}>-{savingsPct}%</span>}
                  </button>
                </div>
                <div className="inline-flex rounded-full border border-slate-200 p-1">
                  <button
                    type="button"
                    onClick={() => handleCurrencyToggle("brl")}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${currency === "brl" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    BRL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurrencyToggle("usd")}
                    className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${currency === "usd" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                      }`}
                  >
                    USD
                  </button>
                </div>
              </div>
            </div>
            <div className="md:col-span-3">
              <div className="relative overflow-hidden rounded-3xl border border-[#F6007B]/20 bg-white p-8 shadow-lg shadow-[#F6007B]/5">
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#F6007B]/5 blur-3xl" />
                <div className="relative">
                  {pricesLoading ? (
                    <div className="animate-pulse space-y-6">
                      <div className="h-12 w-48 rounded-xl bg-slate-100" />
                      <div className="h-6 w-64 rounded bg-slate-100" />
                      <div className="space-y-3 pt-4">
                        <div className="h-5 w-full rounded bg-slate-100" />
                        <div className="h-5 w-full rounded bg-slate-100" />
                        <div className="h-5 w-3/4 rounded bg-slate-100" />
                      </div>
                    </div>
                  ) : prices ? (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-bold text-slate-900 tracking-tight">
                            {formatCurrency(activePrice, currency)}
                          </span>
                          <span className="text-lg font-medium text-slate-500">
                            /{period === "annual" ? "ano" : "mês"}
                          </span>
                        </div>
                        {period === "annual" && (
                          <p className="mt-2 text-sm font-medium text-emerald-600">
                            Equivale a <strong>{formatCurrency(monthlyEquivalent, currency)}</strong> por
                            mês.
                          </p>
                        )}
                      </div>

                      <div className="h-px w-full bg-slate-100" />

                      <ul className="space-y-4">
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span>Acesso imediato ao Planner, alertas no WhatsApp e discovery da comunidade (dúvidas no Chat AI).</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span>Mentorias semanais do Grupo VIP para ajustar conteúdo, pricing e pitch.</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span>Inbox de oportunidades e respostas com IA para negociar direto com as marcas.</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span>Cancelamento simples direto no app.</span>
                        </li>
                        <li className="flex items-start gap-3 text-sm text-slate-600">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <Check className="h-3.5 w-3.5" />
                          </div>
                          <span>Nota fiscal e recibos automáticos por e-mail.</span>
                        </li>
                      </ul>

                      {!needsPaymentAction ? (
                        <button
                          type="button"
                          onClick={() => handleOpenModal("pricing_card")}
                          className="w-full rounded-xl bg-[#F6007B] px-6 py-4 text-base font-bold text-white shadow-lg shadow-[#F6007B]/25 transition hover:bg-[#e2006f] hover:shadow-[#F6007B]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40 focus-visible:ring-offset-2"
                        >
                          Assinar agora
                        </button>
                      ) : (
                        <Link
                          href="/dashboard/billing"
                          className="inline-flex w-full items-center justify-center rounded-xl border border-amber-200 bg-white px-6 py-4 text-base font-bold text-amber-900 shadow-sm transition hover:bg-amber-50"
                        >
                          Atualizar pagamento
                        </Link>
                      )}
                      {needsPaymentAction && (
                        <p className="text-sm text-amber-700">
                          Existe um pagamento pendente. Atualize o método de pagamento em Billing.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Não foi possível carregar os valores agora. Tente novamente mais tarde.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-slate-100 bg-slate-50/50 p-8 shadow-sm">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Que telas eu libero com o Plano Agência?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Planejamento com IA, descoberta da comunidade e inbox de oportunidades — tudo pronto para você negociar direto.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Ver planner", href: "/dashboard/planning" },
                { label: "Ver discovery", href: "/dashboard/discover" },
                { label: "Campanhas", href: "/campaigns" },
                { label: "Calculadora de Publi", href: "/dashboard/calculator" },
                { label: "Chat IA", href: "/dashboard/chat" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
                >
                  {link.label}
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="space-y-8">
          <header className="text-center">
            <h2 className="text-2xl font-bold text-slate-900">Perguntas frequentes</h2>
            <p className="mt-2 text-sm text-slate-600">
              Se ainda ficou alguma dúvida, fale com a gente pelo chat ou WhatsApp.
            </p>
          </header>
          <div className="mx-auto max-w-3xl space-y-4">
            {FAQS.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-base font-semibold text-slate-800 marker:hidden">
                  {faq.question}
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-open:rotate-45 group-open:bg-[#F6007B]/10 group-open:text-[#F6007B]">+</span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {!hasProAccess && (
          <section className="rounded-3xl border border-[#F6007B]/20 bg-gradient-to-br from-[#F6007B]/5 via-white to-[#F6007B]/10 p-10 text-center shadow-sm">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold text-slate-900">
              Pronto para responder com IA e fechar sua próxima campanha?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-600">
              Ative o Plano Agência para liberar análise, e-mail, calculadora e planejamento em um só clique.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {!needsPaymentAction ? (
                <button
                  type="button"
                  onClick={() => handleOpenModal("bottom")}
                  className="inline-flex items-center gap-2 rounded-full bg-[#F6007B] px-8 py-4 text-base font-bold text-white shadow-lg shadow-[#F6007B]/30 transition hover:bg-[#e2006f] hover:shadow-[#F6007B]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/40"
                >
                  Ativar Plano Agência
                  <ArrowRight className="h-5 w-5" />
                </button>
              ) : (
                <Link
                  href="/dashboard/billing"
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-8 py-4 text-base font-bold text-amber-900 shadow-sm transition hover:bg-amber-50"
                >
                  Atualizar pagamento
                  <ArrowUpRight className="h-5 w-5" />
                </Link>
              )}
              <a
                href="mailto:arthur@data2content.ai"
                className="text-sm font-semibold text-[#F6007B] underline-offset-4 hover:underline"
              >
                Falar com vendas
              </a>
            </div>
            {needsPaymentAction && (
              <p className="mt-4 text-sm text-amber-700">
                Existe um pagamento pendente. Atualize o método de pagamento em Billing.
              </p>
            )}
          </section>
        )}
      </main>
    </>
  );
}
