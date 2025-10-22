"use client";

import React from "react";

import ButtonPrimary from "./ButtonPrimary";

import { formatCompactNumber, formatPlainNumber } from "@/app/landing/utils/format";
import type { LandingCommunityMetrics, LandingNextMentorship } from "@/types/landing";

type HeroProps = {
  onPrimaryCta: () => void;
  metrics?: LandingCommunityMetrics | null;
  nextMentorship?: LandingNextMentorship | null;
};

const CTA_SECONDARY_ID = "como-funciona";

type QuickStatId = "followers" | "views" | "reach" | "interactions";

const STAT_EMOJIS: Record<QuickStatId, string> = {
  followers: "👥",
  views: "👁️",
  reach: "📡",
  interactions: "💬",
};

type QuickStat = {
  id: QuickStatId;
  label: string;
  rawValue: number | null;
  prefix?: string;
  formatter: (value: number) => string;
  descriptionHighlight: string;
  descriptionTail: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const defaultNumberFormatter = (value: number) => value.toLocaleString("pt-BR");

type CountUpNumberProps = {
  value: number | null | undefined;
  prefix?: string;
  formatter?: (value: number) => string;
  duration?: number;
  shouldRound?: boolean;
};

const CountUpNumber: React.FC<CountUpNumberProps> = ({
  value,
  prefix = "",
  formatter = defaultNumberFormatter,
  duration = 900,
  shouldRound = true,
}) => {
  const target = typeof value === "number" && Number.isFinite(value) ? value : null;
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    if (target === null) {
      setDisplayValue(0);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = easeOutCubic(progress);
      const next = target * eased;
      setDisplayValue(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    setDisplayValue(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  if (target === null) {
    return <span>—</span>;
  }

  const numericValue = shouldRound ? Math.round(displayValue) : displayValue;
  const prefixToUse = prefix && target > 0 ? prefix : "";
  return <span>{`${prefixToUse}${formatter(numericValue)}`}</span>;
};

const formatWeekdayFromIso = (iso?: string | null) => {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone: "America/Sao_Paulo",
    });
    const weekday = formatter.format(date).replace("-feira", "");
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  } catch {
    return null;
  }
};

const formatTimeFromIso = (iso?: string | null) => {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
    return formatter.format(date).replace(":", "h");
  } catch {
    return null;
  }
};

type ChatMessage = {
  id: string;
  sender: "mobi" | "user";
  heading: string;
  text: string;
};

const HERO_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    sender: "mobi",
    heading: "Mobi",
    text: "Bom dia! Seu último Reels recebeu 28% mais salvamentos que a média. Sugestão: publique um conteúdo no mesmo formato amanhã às 12h.",
  },
  {
    id: "u1",
    sender: "user",
    heading: "Você",
    text: "Perfeito. Me manda três ideias nesse estilo pra eu manter o ritmo amanhã.",
  },
  {
    id: "m2",
    sender: "mobi",
    heading: "Mobi",
    text: "Separando referências reais da comunidade com foco em salvamentos. Quer priorizar ideias para comentários ou seguimos com salvamentos?",
  },
];

const TypingIndicator: React.FC = () => (
  <span className="typing-indicator" aria-hidden="true">
    <span />
    <span />
    <span />
  </span>
);

type CommunitySection =
  | { title: string; icon: string; emphasis: string; rest: string }
  | { title: string; icon: string; items: Array<{ highlight: string; rest: string }> };

const openCommunityContent: readonly CommunitySection[] = [
  {
    title: "O propósito",
    icon: "🌱",
    emphasis: "Trocar experiências reais",
    rest: ", superar bloqueios e manter a energia criativa ativa.",
  },
  {
    title: "Para quem é",
    icon: "👥",
    emphasis: "Criadores que querem companhia diária",
    rest: " e apoio constante sem complicação.",
  },
  {
    title: "Você encontra",
    icon: "💬",
    items: [
      { highlight: "Conversas francas", rest: " sobre rotina." },
      { highlight: "Referências práticas", rest: " nascidas das métricas coletivas." },
    ],
  },
  {
    title: "Você leva",
    icon: "📚",
    items: [
      { highlight: "Biblioteca viva", rest: " de inspirações." },
      { highlight: "Alertas essenciais", rest: " para manter o foco." },
    ],
  },
];

const proCommunityContent: readonly CommunitySection[] = [
  {
    title: "O propósito",
    icon: "🎯",
    emphasis: "Transformar constância em estratégia",
    rest: " com inteligência sobre seus dados reais.",
  },
  {
    title: "Para quem é",
    icon: "📊",
    emphasis: "Criadores que já têm ritmo",
    rest: " e querem decisões baseadas em métricas confiáveis.",
  },
  {
    title: "Acontece toda semana",
    icon: "🗓️",
    items: [
      { highlight: "Mentorias com direcionamento individual", rest: "." },
      { highlight: "Planos guiados por IA", rest: " com benchmarks do seu nicho." },
    ],
  },
  {
    title: "Você recebe",
    icon: "⚡",
    items: [
      { highlight: "Diagnósticos personalizados", rest: "." },
      { highlight: "Alertas avançados no WhatsApp", rest: " pra ajustar a estratégia em tempo real." },
    ],
  },
];

export const CommunityHero: React.FC<HeroProps> = ({ onPrimaryCta, metrics, nextMentorship }) => {
  const postsSample = metrics?.postsLast30Days ? formatPlainNumber(metrics.postsLast30Days) : null;

  const mentorshipBadgeText = React.useMemo(() => {
    const weekday = formatWeekdayFromIso(nextMentorship?.isoDate);
    const time = formatTimeFromIso(nextMentorship?.isoDate);
    if (weekday && time) {
      return `Ao vivo ${weekday}, ${time} (BRT)`;
    }
    if (nextMentorship?.display) {
      return `Ao vivo ${nextMentorship.display.replace("•", ",")}`;
    }
    return "Ao vivo Segunda, 19h (BRT)";
  }, [nextMentorship]);

  const handleOpenProUpgrade = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("open-subscribe-modal"));
    }
  }, []);

  const quickStats: QuickStat[] = React.useMemo(
    () => [
      {
        id: "followers" as const,
        label: "Seguidores conquistados",
        rawValue: metrics?.followersGainedLast30Days ?? null,
        prefix: "+",
        formatter: (value: number) => formatCompactNumber(value),
        descriptionHighlight: "Crescimento somado",
        descriptionTail: " de quem está na comunidade.",
      },
      {
        id: "views" as const,
        label: "Visualizações geradas",
        rawValue: metrics?.viewsLast30Days ?? null,
        formatter: (value: number) => formatCompactNumber(value),
        descriptionHighlight: "Base de dados hidratada diariamente",
        descriptionTail: " para orientar decisões.",
      },
      {
        id: "reach" as const,
        label: "Alcance somado",
        rawValue: metrics?.reachLast30Days ?? null,
        formatter: (value: number) => formatCompactNumber(value),
        descriptionHighlight: "Conteúdos da comunidade",
        descriptionTail: " chegando a novos públicos com frequência.",
      },
      {
        id: "interactions" as const,
        label: "Interações registradas",
        rawValue: metrics?.interactionsLast30Days ?? null,
        formatter: (value: number) => formatCompactNumber(value),
        descriptionHighlight: postsSample ? `${postsSample} conteúdos` : "Conteúdos",
        descriptionTail: " analisados para gerar referências práticas.",
      },
    ],
    [metrics, postsSample],
  );

  return (
    <section
      id="hero"
      className="bg-[#FBFBFB] text-[#1A1A1A]"
      style={{
        paddingTop: "calc(var(--landing-header-h, 4.5rem) + var(--landing-header-extra, 0px))",
      }}
    >
      <div className="container mx-auto px-5 pb-12 pt-8 sm:px-6 sm:pb-[4.5rem] sm:pt-24 md:pb-[4.5rem] md:pt-24 lg:pb-20 lg:pt-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-start lg:gap-20">
          <div className="flex-1 space-y-12">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-[#EAEAEA] bg-[#F8F8F8] px-5 py-2 text-sm font-medium text-[#555555] shadow-[0_6px_18px_rgba(0,0,0,0.03)]">
                <span className="animate-[pulseSoft_2s_ease-in-out_infinite] text-[0.85rem]" aria-hidden="true">🔴</span>
                <span>{mentorshipBadgeText}</span>
              </div>

              <div className="space-y-5">
                <h1 className="text-4xl font-bold leading-[1.12] tracking-[0.01em] text-[#1A1A1A] md:text-[3.2rem] md:leading-[1.08]">
                  A comunidade de criadores apoiada por IA.
                </h1>
                <p className="max-w-2xl text-lg text-[#555555] md:text-xl lg:text-[1.28rem] lg:leading-[1.9rem]">
                  <strong className="font-semibold text-[#1A1A1A]">Um lugar para crescer com clareza</strong> — com dados vivos, trocas reais e uma IA que entende o seu ritmo.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <ButtonPrimary onClick={onPrimaryCta} className="px-10 py-5 text-xl">
                Entrar na comunidade gratuita
              </ButtonPrimary>
              <p className="text-sm font-medium text-[#777777]">
                Sem cartão — login via Google.
              </p>
            </div>

            <div className="rounded-3xl border border-[#EAEAEA] bg-white p-6 shadow-[0_12px_36px_rgba(0,0,0,0.04)] md:p-8">
              <h3 className="text-2xl font-semibold text-[#1A1A1A]">Resultados reais da comunidade</h3>
              <p className="mt-3 text-sm text-[#555555]">
                O que a comunidade já conquistou junto — pessoas reais crescendo com apoio da IA da Data2Content.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-6 sm:[&>div:nth-child(odd)]:border-r sm:[&>div:nth-child(odd)]:border-[#EAEAEA] sm:[&>div:nth-child(odd)]:pr-6 sm:[&>div:nth-child(even)]:pl-6">
                {quickStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex transform flex-col gap-3 rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-[0_10px_26px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_16px_32px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-semibold text-[#1A1A1A]">
                        {STAT_EMOJIS[stat.id]} {stat.label}
                      </p>
                      <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-[#999999]">
                        Últimos 30 dias
                      </p>
                    </div>
                    <p className="text-3xl font-semibold tracking-tight text-[#F6007B]">
                      <CountUpNumber
                        value={stat.rawValue}
                        prefix={stat.prefix}
                        formatter={stat.formatter}
                      />
                    </p>
                    <p className="text-[0.82rem] text-[#666666]">
                      <strong className="font-semibold text-[#1A1A1A]">{stat.descriptionHighlight}</strong>
                      {stat.descriptionTail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="hidden max-w-sm flex-1 lg:block">
            <div className="relative mb-12 rounded-[22px] border border-[#EDEDED] bg-[linear-gradient(180deg,#FFFFFF_0%,#FAFAFA_100%)] px-6 pb-12 pt-16 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
              <span className="absolute -top-8 left-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#F6007B] text-lg font-semibold text-white shadow-[inset_0_0_18px_rgba(255,255,255,0.25),0_10px_24px_rgba(246,0,123,0.2)]">
                <span className="sr-only">Mobi, assistente de IA da comunidade</span>
                <span aria-hidden="true">🤖</span>
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A]">
                  <strong className="font-semibold text-[#1A1A1A]">Mobi — IA no WhatsApp</strong> para manter a sua estratégia viva.
                </p>
                <p className="mt-1 text-xs text-[#777777]">
                  <strong className="font-semibold text-[#1A1A1A]">Alertas acionáveis</strong>, leituras de desempenho e <strong className="font-semibold text-[#1A1A1A]">ideias prontas</strong> para publicação.
                </p>
              </div>
              <div className="mt-7 space-y-3 text-sm leading-relaxed text-[#1A1A1A]">
                {HERO_CHAT_MESSAGES.map((message, index) => {
                  const isMobi = message.sender === "mobi";
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMobi ? "justify-start" : "justify-end"} animate-fade-in`}
                      style={{ animationDelay: `${index * 110}ms` }}
                    >
                      <div
                        className={`max-w-[85%] rounded-[16px] px-4 py-[14px] shadow-[0_6px_18px_rgba(0,0,0,0.04)] ${
                          isMobi ? "bg-[#F7F7F7] text-[#1A1A1A]" : "border border-[#EAEAEA] bg-white text-[#1A1A1A]"
                        }`}
                      >
                        <div className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#555555]">
                          {message.heading}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[#444444]">{message.text}</p>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-center gap-2 text-xs text-[#777777]">
                  <TypingIndicator />
                  <span>Mobi está analisando seus resultados…</span>
                </div>
              </div>
              <p className="mt-10 text-center text-[0.7rem] text-[#777777]">
                <em>Conversa ilustrativa. O Mobi envia alertas reais com base nas suas métricas.</em>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-8 sm:mt-16 lg:grid-cols-2 lg:gap-12 xl:mt-20" id={CTA_SECONDARY_ID}>
          <div className="flex h-full flex-col rounded-3xl border border-[#EAEAEA] bg-white p-7 shadow-[0_10px_28px_rgba(0,0,0,0.04)] transition hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(0,0,0,0.06)] md:p-9">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#777777]">🌱 Comunidade Aberta (Grátis)</p>
              <h3 className="text-[1.65rem] font-semibold leading-tight text-[#1A1A1A] md:text-[1.8rem]">
                <strong className="font-semibold text-[#1A1A1A]">Crescimento humano</strong> e apoio real
              </h3>
              <p className="text-sm text-[#555555]">
                <strong className="font-semibold text-[#1A1A1A]">Entre e descubra seu ritmo criativo.</strong> A base gratuita da Data2Content une criadores que crescem juntos, compartilham bastidores e se apoiam diariamente.
              </p>
            </div>
            <div className="mt-6 flex-1 space-y-7 text-sm text-[#555555] md:text-base">
              {openCommunityContent.map((section, index) => (
                <div key={section.title} className={index === 0 ? "" : "border-t border-[#EAEAEA] pt-5"}>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                    <span aria-hidden="true">{section.icon}</span>
                    {section.title}
                  </h4>
                  {"emphasis" in section ? (
                    <p className="mt-2 text-[#555555]">
                      <strong className="font-semibold text-[#1A1A1A]">{section.emphasis}</strong>
                      {section.rest}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-[#555555]">
                      {section.items.map((item) => (
                        <li key={item.highlight} className="flex gap-3 text-sm">
                          <span aria-hidden="true" className="mt-[6px] h-[3px] w-[3px] rounded-full bg-[#999999]" />
                          <span>
                            <strong className="font-semibold text-[#1A1A1A]">{item.highlight}</strong>
                            {item.rest}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-8 space-y-2">
              <button
                onClick={onPrimaryCta}
                className="inline-flex w-full items-center justify-center rounded-lg bg-[#F6007B] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(246,0,123,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d40068] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/30 md:w-auto md:text-base"
              >
                Entrar na comunidade gratuita
              </button>
              <p className="text-xs text-[#777777]">
                <strong className="font-semibold text-[#1A1A1A]">Mentoria aberta</strong> toda segunda-feira, 19h.
              </p>
            </div>
          </div>

          <div className="flex h-full flex-col rounded-3xl border border-[#F6007B20] bg-[linear-gradient(180deg,#FFF6FA_0%,#F9F6FF_100%),linear-gradient(135deg,rgba(246,0,123,0.04)_25%,transparent_25%,transparent_50%,rgba(246,0,123,0.04)_50%,rgba(246,0,123,0.04)_75%,transparent_75%,transparent)] bg-[length:100%_100%,18px_18px] p-7 shadow-[0_6px_20px_rgba(246,0,123,0.08)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(246,0,123,0.1)] md:p-9">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="h-8 w-1 rounded-full bg-[#F6007B]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F6007B]">
                    💎 Comunidade PRO
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#F6007B] drop-shadow-[0_0_12px_rgba(246,0,123,0.35)]">
                  ✨ Premium
                </span>
              </div>
              <h3 className="text-[1.65rem] font-semibold leading-tight text-[#1A1A1A] md:text-[1.8rem]">
                <strong className="font-semibold text-[#1A1A1A]">Crescimento estratégico</strong> guiado por dados reais
              </h3>
              <p className="text-sm text-[#555555]">
                <strong className="font-semibold text-[#1A1A1A]">Quando a constância vira estratégia.</strong> O PRO é a evolução natural de quem já encontrou seu ritmo e quer decisões baseadas em dados reais.
              </p>
            </div>
            <div className="mt-6 flex-1 space-y-7 text-sm text-[#555555] md:text-base">
              {proCommunityContent.map((section, index) => (
                <div key={section.title} className={index === 0 ? "" : "border-t border-[#EAEAEA] pt-5"}>
                  <h4 className="flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                    <span aria-hidden="true">{section.icon}</span>
                    {section.title}
                  </h4>
                  {"emphasis" in section ? (
                    <p className="mt-2 text-[#555555]">
                      <strong className="font-semibold text-[#1A1A1A]">{section.emphasis}</strong>
                      {section.rest}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-[#555555]">
                      {section.items.map((item) => (
                        <li key={item.highlight} className="flex gap-3 text-sm">
                          <span aria-hidden="true" className="mt-[6px] h-[3px] w-[3px] rounded-full bg-[#F6007B]" />
                          <span>
                            <strong className="font-semibold text-[#1A1A1A]">{item.highlight}</strong>
                            {item.rest}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-8 space-y-3 pb-12">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#777777]">
                <strong className="font-semibold text-[#1A1A1A]">Incluído</strong> no trial gratuito ao entrar na comunidade.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommunityHero;
