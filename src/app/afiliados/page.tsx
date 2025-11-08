"use client";

import React, { ChangeEvent, useCallback, useMemo, useState } from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { MONTHLY_PRICE } from "@/config/pricing.config";
import { AFFILIATE_TIP_TEMPLATES } from "@/data/affiliateTips";

const heroHighlights = [
  "10% da primeira assinatura indicada",
  "Resgate mínimo de R$ 50,00",
  "Pagamento em até 7 dias úteis",
];

const resgateSteps = [
  'Aceda a "Conversar com IA" no dashboard.',
  'Verifique os seus dados de pagamento (PIX ou conta bancária) na seção "Dados de Pagamento".',
  'Clique no botão "Resgatar Saldo".',
];

const termsList = [
  {
    title: "Alterações do programa",
    content:
      "A Data2Content reserva-se o direito de alterar os termos do programa de afiliados a qualquer momento, com aviso prévio.",
  },
  {
    title: "Conduta e boas práticas",
    content:
      "Práticas consideradas spam, fraudulentas ou que violem os termos de uso da plataforma resultarão na desqualificação do programa e possível perda de comissões.",
  },
  {
    title: "Dados de pagamento",
    content:
      "É responsabilidade do afiliado garantir que os seus dados de pagamento estejam corretos para o recebimento das comissões.",
  },
  {
    title: "Base de cálculo",
    content:
      "A comissão é aplicada sobre o valor líquido da assinatura, após eventuais impostos ou taxas de processamento de pagamento. (Nota: Atualmente o webhook calcula sobre transaction_amount total, podemos refinar isso se necessário).",
  },
  {
    title: "Suporte",
    content: "Dúvidas? Entre em contacto com o nosso suporte.",
  },
];

const AFFILIATE_PLACEHOLDER_CODE = "SEUCODIGO";
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://seusite.com.br";

const formatCurrency = (value: number) =>
  value
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    })
    .replace(/\u00A0/, " ");

export default function AffiliateProgramPage() {
  const [manualCode, setManualCode] = useState("");
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const resolvedBaseUrl = DEFAULT_BASE_URL;
  const normalizedCode = useMemo(
    () => manualCode.replace(/\s+/g, "").toUpperCase(),
    [manualCode]
  );
  const previewCode = normalizedCode || AFFILIATE_PLACEHOLDER_CODE;
  const monthlyPrice = formatCurrency(MONTHLY_PRICE);
  const commissionValue = formatCurrency(MONTHLY_PRICE * 0.1);
  const referralLinkExample = useMemo(
    () => `${resolvedBaseUrl}/?ref=${previewCode}`,
    [previewCode, resolvedBaseUrl]
  );

  const flowCards = [
    {
      title: "Como Funciona?",
      lines: [
        "Ao registar-se na Data2Content, recebe automaticamente um código de afiliado e um link exclusivo.",
        "Compartilhe esse código ou link com criadores de conteúdo e acompanhe quando ativarem o Mobi.",
      ],
    },
    {
      title: "Código e Link",
      lines: [
        'Encontra os dois diretamente em "Conversar com IA". Seu indicado pode digitar o código (ex.: JOAO123) ou acessar um link completo como',
        `${resolvedBaseUrl}/?ref=JOAO123`,
      ],
    },
    {
      title: "Sua Comissão",
      lines: [
        `Você recebe 10% sobre o valor da primeira assinatura de cada indicado. Se o plano mensal custa ${monthlyPrice}, você ganha ${commissionValue}.`,
        "Após a confirmação do pagamento, o valor cai no seu saldo e fica pronto para resgate quando atingir R$ 50,00.",
      ],
    },
  ];

  const quickTips = useMemo(
    () =>
      AFFILIATE_TIP_TEMPLATES.map((tip) => ({
        ...tip,
        copy: tip.buildCopy(referralLinkExample, previewCode),
      })),
    [previewCode, referralLinkExample]
  );

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      let copied = false;

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        copied = true;
      }

      if (!copied) return;

      setCopiedItemId(id);
      window.setTimeout(() => {
        setCopiedItemId((current) => (current === id ? null : current));
      }, 2000);
    } catch {
      setCopiedItemId(null);
    }
  }, []);

  const handleCodeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setManualCode(event.target.value);
  }, []);

  return (
    <>
      <Head>
        <title>Programa de Afiliados - Data2Content</title>
        <meta
          name="description"
          content="Entenda como funciona o programa de afiliados da Data2Content e comece a ganhar indicando novos criadores para o Mobi."
        />
      </Head>

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-magenta to-brand-purple text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-y-0 left-1/2 w-[60%] blur-[150px] bg-white/30" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:py-20">
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              Programa de afiliados Data2Content
            </p>
            <h1 className="mt-4 text-4xl font-bold sm:text-5xl">Transforme seu alcance em receita</h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
              Indique o Mobi para outros criadores de conteúdo e seja recompensado. Transforme sua rede de contactos em
              uma fonte de renda.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/dashboard/chat"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-brand-purple shadow-sm transition hover:bg-white/90 sm:w-auto"
              >
                Participar agora
              </a>
            </div>
          </motion.div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {heroHighlights.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/90 backdrop-blur sm:text-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <header className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-text-secondary">Como funciona</p>
          <h2 className="mt-2 text-3xl font-semibold text-brand-dark">Tudo o que precisa para indicar criadores</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-brand-text-secondary sm:text-base">
            Três blocos para organizar o programa do início ao saque, sem perder tempo com ações paralelas.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {flowCards.map((card) => (
            <motion.article
              key={card.title}
              className="flex flex-col rounded-3xl border border-brand-glass-border bg-white/80 p-6 shadow-glass-md"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.35 }}
            >
              <h3 className="text-base font-semibold text-brand-dark sm:text-lg">{card.title}</h3>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-brand-text-secondary">
                {card.lines.map((line, index) =>
                  card.title === "Código e Link" && index === 1 ? (
                    <p
                      key={line}
                      className="break-all rounded-2xl bg-brand-glass-100 px-3 py-2 text-xs font-semibold text-brand-dark/80"
                    >
                      {line}
                    </p>
                  ) : (
                    <p key={line}>{line}</p>
                  )
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="bg-neutral-50/70">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <div className="rounded-3xl border border-brand-glass-border bg-white/90 p-6 shadow-glass-md sm:p-8">
            <header className="mb-8 text-center sm:text-left">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-text-secondary">
                Ganhos & Progresso
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-brand-dark">Ranking e Resgate em um só lugar</h2>
            </header>

            <div className="grid gap-8 md:grid-cols-2 md:divide-x md:divide-brand-glass-border">
              <div className="space-y-4 pr-0 md:pr-6">
                <h3 className="text-base font-semibold text-brand-dark sm:text-lg">Ranking de Afiliados</h3>
                <p className="text-sm leading-relaxed text-brand-text-secondary">
                  A cada <strong>5 indicações convertidas</strong> (novos assinantes), o seu{" "}
                  <strong>Rank de Afiliado</strong> aumenta em 1 nível. Atualmente, o sistema serve para acompanhar o
                  seu progresso e destacar os afiliados mais empenhados.
                </p>
                <p className="text-sm italic text-brand-text-secondary">
                  Estamos a planear benefícios e recompensas exclusivas para os diferentes níveis de rank no futuro.
                  Fique atento às novidades.
                </p>
              </div>

              <div className="space-y-4 pl-0 md:pl-6">
                <h3 className="text-base font-semibold text-brand-dark sm:text-lg">Resgate dos Ganhos</h3>
                <p className="text-sm text-brand-text-secondary">
                  Pode solicitar o resgate do seu saldo acumulado assim que atingir <strong>R$ 50,00</strong>. As
                  solicitações são processadas em até <strong>7 dias úteis</strong>, diretamente na conta informada.
                </p>
                <ol className="list-decimal space-y-2 pl-4 text-sm text-brand-text-secondary">
                  {resgateSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="rounded-3xl border border-brand-glass-border bg-white/90 p-6 shadow-glass-md">
            <header>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-text-secondary">
                Dicas rápidas de divulgação
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-brand-dark">Copie, personalize e compartilhe</h2>
              <p className="mt-3 text-sm text-brand-text-secondary">
                Use os roteiros abaixo como ponto de partida nos seus canais e apenas substitua o código/link pelo seu.
              </p>
            </header>
            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.2em] text-brand-text-secondary">
              Personalize com o seu código
              <input
                type="text"
                value={manualCode}
                onChange={handleCodeChange}
                placeholder="Ex.: JOAO123"
                className="mt-2 w-full rounded-2xl border border-brand-glass-border bg-white px-4 py-2 text-sm font-semibold uppercase tracking-wide text-brand-dark outline-none focus:ring-2 focus:ring-brand-magenta"
              />
            </label>
            <div className="mt-4 rounded-2xl border border-brand-glass-border bg-brand-glass-100 px-4 py-3 text-xs text-brand-text-secondary">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-brand-dark">Link pronto para compartilhar</p>
                  <p className="mt-1 break-all font-mono text-[13px] text-brand-dark">{referralLinkExample}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(referralLinkExample, "link-example")}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-purple px-4 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
                >
                  {copiedItemId === "link-example" ? (
                    <>
                      <Check className="h-4 w-4" />
                      Link copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar link
                    </>
                  )}
                </button>
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-brand-text-secondary">
                O link e os roteiros atualizam automaticamente com o código informado.
              </p>
            </div>
            <div className="mt-6 space-y-4">
              {quickTips.map((tip) => (
                <article key={tip.id} className="rounded-2xl border border-brand-glass-border bg-white/80 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-magenta/10 text-lg">
                        {tip.emoji}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-brand-dark">{tip.title}</p>
                        <p className="text-sm text-brand-text-secondary">{tip.description}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(tip.copy, tip.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-brand-purple px-4 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
                    >
                      {copiedItemId === tip.id ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar roteiro
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-3 rounded-2xl bg-brand-glass-100 px-4 py-3 text-sm leading-relaxed text-brand-dark/80">
                    {tip.copy}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-text-secondary">Termos</p>
            <h2 className="mt-2 text-3xl font-semibold text-brand-dark">Transparência sempre</h2>
            <div className="mt-6 space-y-3">
              {termsList.map((term) => (
                <details
                  key={term.title}
                  className="rounded-2xl border border-brand-glass-border bg-white/80 p-4 text-sm text-brand-text-secondary"
                >
                  <summary className="cursor-pointer text-base font-semibold text-brand-dark">
                    {term.title}
                  </summary>
                  <p className="mt-3 leading-relaxed">{term.content}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-brand-glass-border bg-white/90 px-6 py-6 text-center shadow-glass-md sm:flex-row sm:text-left">
          <div>
            <h3 className="text-xl font-semibold text-brand-dark">Precisa de ajuda?</h3>
            <p className="mt-1 text-sm text-brand-text-secondary">
              Dúvidas? Entre em contacto com o nosso suporte diretamente pelo chat.
            </p>
          </div>
          <a
            href="/dashboard/chat"
            className="inline-flex items-center justify-center rounded-full border border-brand-purple px-6 py-2.5 text-sm font-semibold text-brand-purple transition hover:bg-brand-purple hover:text-white"
          >
            Conversar com IA
          </a>
        </div>
      </section>
    </>
  );
}
