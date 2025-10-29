"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";

import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { track } from "@/lib/track";
import type { LandingCommunityStatsResponse } from "@/types/landing";

import LandingHeader from "./landing/components/LandingHeader";
import CommunityHero from "./landing/components/CommunityHero";
import TopCreatorsSection from "./landing/components/TopCreatorsSection";
import CategoryInsightsSection from "./landing/components/CategoryInsightsSection";
import HowItWorksSection from "./landing/components/HowItWorksSection";
import FinalCTASection from "./landing/components/FinalCTASection";

const FALLBACK_METRICS = {
  activeCreators: 130,
  combinedFollowers: 2_400_000,
  totalPostsAnalyzed: 42_000,
  postsLast30Days: 1_200,
  newMembersLast7Days: 37,
  viewsLast30Days: 1_900_000,
  viewsAllTime: 45_000_000,
  reachLast30Days: 2_500_000,
  reachAllTime: 64_000_000,
  followersGainedLast30Days: 18_500,
  followersGainedAllTime: 320_000,
  interactionsLast30Days: 820_000,
  interactionsAllTime: 14_500_000,
};

function computeNextMentorshipSlot(): { isoDate: string; display: string } {
  const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const now = new Date();
  const target = 1; // Monday
  const currentDay = now.getDay();
  let delta = (target - currentDay + 7) % 7;
  if (delta === 0 && now.getHours() >= 19) {
    delta = 7;
  }
  const next = new Date(now.getTime());
  next.setDate(now.getDate() + delta);
  next.setHours(19, 0, 0, 0);
  return {
    isoDate: next.toISOString(),
    display: `${WEEKDAYS[next.getDay()]} • 19h (BRT)`,
  };
}

function buildFallbackStats(): LandingCommunityStatsResponse {
  return {
    metrics: { ...FALLBACK_METRICS },
    ranking: [],
    categories: [],
    nextMentorship: computeNextMentorshipSlot(),
    lastUpdatedIso: new Date().toISOString(),
  };
}

export default function LandingPageClient() {
  const headerWrapRef = React.useRef<HTMLDivElement>(null);
  const [stats, setStats] = React.useState<LandingCommunityStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = React.useState(true);
  const fallbackStats = React.useMemo(buildFallbackStats, []);

  const handleSignIn = React.useCallback(() => {
    try {
      track("landing_community_cta_click", { location: "landing_page" });
    } catch {}
    signIn("google", { callbackUrl: MAIN_DASHBOARD_ROUTE });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/landing/community-stats", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load stats: ${res.status}`);
        const data = (await res.json()) as LandingCommunityStatsResponse;
        if (!cancelled) setStats(data);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[landing] Failed to fetch community stats", error);
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    const findHeader = () =>
      (headerWrapRef.current?.querySelector("header") ??
        document.querySelector("header")) as HTMLElement | null;

    const apply = () => {
      const header = findHeader();
      if (!header) return;
      const h = header.getBoundingClientRect().height;
      root.style.setProperty("--landing-header-h", `${h}px`);
    };

    apply();

    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    const observeHeader = (header: HTMLElement) => {
      ro = new ResizeObserver(apply);
      ro.observe(header);
    };

    const hdr = findHeader();
    if (hdr) {
      observeHeader(hdr);
    } else {
      const target = headerWrapRef.current ?? document;
      mo = new MutationObserver(() => {
        const found = findHeader();
        if (!found) return;
        apply();
        observeHeader(found);
        mo?.disconnect();
        mo = null;
      });
      target && mo.observe(target, { childList: true, subtree: true });
    }

    window.addEventListener("load", apply);
    return () => {
      window.removeEventListener("load", apply);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, []);

  const resolvedStats = stats ?? fallbackStats;
  const metrics = resolvedStats.metrics;
  const nextMentorship = resolvedStats.nextMentorship;

  return (
    <div
      className="bg-white font-sans"
      style={{ "--landing-header-extra": "0rem" } as React.CSSProperties}
    >
      <div ref={headerWrapRef}>
        <LandingHeader showLoginButton />
      </div>

      <main
        className="md:[--landing-header-extra:0px]"
        style={{
          scrollPaddingTop:
            "calc(var(--landing-header-h, 4.5rem) + var(--landing-header-extra, 0px))",
        }}
      >
        <CommunityHero onPrimaryCta={handleSignIn} metrics={metrics} nextMentorship={nextMentorship} />
        <section className="bg-white py-12 text-[#1A1A1A] md:py-16 lg:py-20">
          <div className="container mx-auto px-6">
            <div className="rounded-3xl bg-[linear-gradient(180deg,#FFFFFF_0%,#F4F1FF_100%)] p-10 text-center shadow-[0_6px_24px_rgba(0,0,0,0.04)] md:p-12 lg:p-14">
              <div className="mx-auto max-w-2xl space-y-6 text-[#1A1A1A]">
                <p className="inline-flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-[#476DFF]">
                  <span aria-hidden="true">📅</span>
                  Próxima mentoria aberta
                </p>
                <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl lg:text-[2.2rem]">
                  {nextMentorship?.display ?? "Segunda, 19h (BRT)"}
                </h2>
                <p className="text-base text-[#555555] md:text-lg">
                  Encontro leve e prático com criadores reais: <strong className="font-semibold text-[#1A1A1A]">hotseats</strong>, <strong className="font-semibold text-[#1A1A1A]">trocas sinceras</strong> e <strong className="font-semibold text-[#1A1A1A]">estratégias que estão funcionando agora</strong>.
                </p>
                <div className="space-y-2 text-sm text-[#333333] md:text-base">
                  <p className="font-semibold text-[#F6007B]">💭 Criar conteúdo é humano.</p>
                  <p>
                    <strong className="font-semibold text-[#1A1A1A]">Constância, dúvidas, bloqueios</strong> — e a vontade de continuar.
                  </p>
                  <p>
                    A Data2Content te conecta com quem entende e <strong className="font-semibold text-[#1A1A1A]">transforma isso em estratégia</strong>.
                  </p>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={handleSignIn}
                    className="inline-flex items-center justify-center rounded-lg bg-[#F6007B] px-8 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(246,0,123,0.2)] transition hover:bg-[#d40068] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/30 md:text-base"
                  >
                    Entrar na comunidade gratuita
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
        <TopCreatorsSection creators={resolvedStats.ranking} />
        <CategoryInsightsSection categories={resolvedStats.categories} />
        <HowItWorksSection />
        <FinalCTASection onPrimaryCta={handleSignIn} />
      </main>

      <footer className="border-t border-[#EAEAEA] bg-white py-14 text-[#1A1A1A]">
        <div className="container mx-auto px-6">
          <div className="mb-10 flex items-center gap-3 text-[#555555]">
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-white shadow-[0_14px_34px_rgba(231,59,124,0.15)]">
              <Image
                src="/images/Colorido-Simbolo.png"
                alt="Data2Content"
                fill
                className="scale-[2.2] object-contain object-center"
                priority
              />
            </div>
            <div>
              <span className="block text-sm font-semibold tracking-[0.28em] text-[#1A1A1A]">
                DATA2CONTENT
              </span>
              <p className="text-xs text-[#777777]">Clareza para transformar dados em criatividade viva.</p>
            </div>
          </div>

          <div className="grid gap-10 text-left text-[#555555] lg:grid-cols-[1.4fr,1fr,1fr] lg:items-start">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-[#1A1A1A] sm:text-2xl">
                Cresça com dados vivos e uma comunidade que te entende.
              </h3>
              <button
                type="button"
                onClick={handleSignIn}
                className="inline-flex items-center justify-center rounded-lg bg-[#F6007B] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(246,0,123,0.24)] transition hover:bg-[#d40068] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/30 sm:text-base"
              >
                Entrar na comunidade gratuita
              </button>
              <p className="text-xs text-[#777777]">
                Login via Google. Nenhum cartão necessário.
              </p>
              <div className="flex justify-center gap-4 text-sm text-[#666666] md:justify-start">
                <Link
                  href="https://instagram.com/data2content"
                  target="_blank"
                  className="font-medium transition hover:text-[#F6007B]"
                >
                  Instagram
                </Link>
                <Link
                  href="https://wa.me/552120380975"
                  target="_blank"
                  className="font-medium transition hover:text-[#F6007B]"
                >
                  WhatsApp
                </Link>
                <Link
                  href="https://discord.gg/"
                  target="_blank"
                  className="font-medium transition hover:text-[#F6007B]"
                >
                  Discord
                </Link>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-[#777777]">Links úteis</h4>
              <nav className="flex flex-col gap-2 text-sm text-[#777777]">
                <Link href="/politica-de-privacidade" className="transition hover:text-[#F6007B]">
                  Política de Privacidade
                </Link>
                <Link href="/termos-e-condicoes" className="transition hover:text-[#F6007B]">
                  Termos e Condições
                </Link>
                <Link href="/afiliados" className="transition hover:text-[#F6007B]">
                  Programa de Afiliados
                </Link>
              </nav>
            </div>

            <div className="space-y-4 text-sm">
              <h4 className="text-xs font-semibold uppercase tracking-[0.22em] text-[#777777]">Junte-se à comunidade</h4>
              <p>
                Entre para receber mentorias semanais, roteiros orientados por dados e alertas personalizados direto no WhatsApp.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-[#F6007B]">
                    •
                  </span>
                  Planner guiado por IA com benchmarks do seu nicho.
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-[#F6007B]">
                    •
                  </span>
                  Mentoria aberta toda segunda às 19h (BRT).
                </li>
                <li className="flex gap-2">
                  <span aria-hidden="true" className="text-[#F6007B]">
                    •
                  </span>
                  Comunidade ativa pra trocar bastidores e vitórias.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 space-y-3 text-center text-xs text-[#777777]">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-[#333333]">
              <span aria-hidden="true" className="text-2xl text-[#F6007B]">
                ❤️
              </span>
              <span>Data2Content é sobre clareza, comunidade e constância criativa.</span>
            </p>
            <p className="text-[#555555]">© {new Date().getFullYear()} Mobi Media Produtores de Conteúdo LTDA.</p>
            {loadingStats ? <p>Carregando dados da comunidade…</p> : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
