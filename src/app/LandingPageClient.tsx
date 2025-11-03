"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { track } from "@/lib/track";
import type { LandingCommunityStatsResponse } from "@/types/landing";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";

import LandingHeader from "./landing/components/LandingHeader";
import HeroModern from "./landing/components/HeroModern";
import CreatorGallerySection from "./landing/components/CreatorGallerySection";
import PlansComparisonSection from "./landing/components/PlansComparisonSection";
import BrandsSection from "./landing/components/BrandsSection";
import TestimonialSpotlight from "./landing/components/TestimonialSpotlight";
import MobileStickyCta from "./landing/components/MobileStickyCta";

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

const FALLBACK_RANKING = [
  {
    id: "fallback-creator-1",
    name: "Myllena Costa",
    username: "@myllenacriadora",
    avatarUrl: "/images/IMG_8634.PNG",
    followers: 158_000,
    totalInteractions: 420_000,
    postCount: 12,
    avgInteractionsPerPost: 35_000,
    rank: 1,
    consistencyScore: 92,
  },
  {
    id: "fallback-creator-2",
    name: "Rafa Belli",
    username: "@rafabelli",
    avatarUrl: "/images/Rafa Belli Foto D2C.png",
    followers: 210_000,
    totalInteractions: 315_000,
    postCount: 9,
    avgInteractionsPerPost: 35_000,
    rank: 2,
    consistencyScore: 88,
  },
  {
    id: "fallback-creator-3",
    name: "Lívia Marbá",
    username: "@liviamarba",
    avatarUrl: "/images/Livia Foto D2C.png",
    followers: 320_000,
    totalInteractions: 510_000,
    postCount: 14,
    avgInteractionsPerPost: 36_000,
    rank: 3,
    consistencyScore: 95,
  },
];

const BRAND_CAMPAIGN_URL =
  "/campaigns/new?utm_source=landing&utm_medium=hero_cta&utm_campaign=multi_creator";

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
    ranking: FALLBACK_RANKING,
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

  const handleCreatorCta = React.useCallback(() => {
    try {
      track("landing_creator_cta_click");
    } catch {}

    const fallbackToLogin = () => window.location.assign("/login");

    signIn("google", {
      callbackUrl: MAIN_DASHBOARD_ROUTE,
    })
      .then((result) => {
        if (result?.error) {
          fallbackToLogin();
        }
      })
      .catch(fallbackToLogin);
  }, []);

  const handleBrandsCta = React.useCallback(() => {
    try {
      track("landing_brand_cta_click");
    } catch {}
    window.location.assign(BRAND_CAMPAIGN_URL);
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

  return (
    <div
      className="bg-white font-sans"
      style={{ "--landing-header-extra": "0rem" } as React.CSSProperties}
    >
      <div ref={headerWrapRef}>
        <LandingHeader showLoginButton onCreatorCta={handleCreatorCta} />
      </div>

      <main
        className="md:[--landing-header-extra:0px]"
        style={{
          scrollPaddingTop:
            "calc(var(--landing-header-h, 4.5rem) + var(--landing-header-extra, 0px))",
        }}
      >
        <HeroModern
          onCreatorCta={handleCreatorCta}
          onBrandCta={handleBrandsCta}
          metrics={metrics}
        />
        <CreatorGallerySection
          creators={resolvedStats.ranking}
          loading={loadingStats}
          onRequestMediaKit={handleCreatorCta}
        />
        <PlansComparisonSection onCreateAccount={handleCreatorCta} />
        <BrandsSection onCreateCampaign={handleBrandsCta} />
        <TestimonialSpotlight />
        <section className="bg-gradient-to-r from-[#FCE9F1] via-white to-[#FCE9F1] py-12 text-brand-dark md:py-16">
          <div className="container mx-auto flex max-w-4xl flex-col items-center gap-5 px-6 text-center">
            <p className="text-lg font-semibold md:text-xl">
              Crie sua conta gratuita, conecte o Instagram e receba o primeiro alerta estratégico da Mobi em minutos.
            </p>
            <button
              type="button"
              onClick={handleCreatorCta}
              className="inline-flex items-center justify-center rounded-full bg-brand-magenta px-8 py-4 text-base font-semibold text-white shadow-[0_20px_48px_rgba(231,75,111,0.22)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-brand-magenta-hover"
            >
              Criar conta gratuita →
            </button>
          </div>
        </section>
      </main>

      {/* ======================================================================== */}
      {/* INÍCIO DA ATUALIZAÇÃO DO RODAPÉ */}
      {/* ======================================================================== */}
      <footer className="border-t border-gray-200 bg-white py-10 text-brand-dark">
        <div className="container mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 overflow-hidden rounded-full bg-white shadow-[0_14px_34px_rgba(231,75,111,0.2)]">
              <Image
                src="/images/Colorido-Simbolo.png"
                alt="Data2Content"
                fill
                className="scale-[2.2] object-contain object-center"
                priority
              />
            </div>
            <span className="text-sm font-semibold tracking-[0.28em] text-brand-dark">
              DATA2CONTENT
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600 md:justify-end">
            <Link href="/politica-de-privacidade" className="transition-colors duration-200 hover:text-brand-dark">
              Política de Privacidade
            </Link>
            <Link href="/termos-e-condicoes" className="transition-colors duration-200 hover:text-brand-dark">
              Termos e Condições
            </Link>
            <Link href="/afiliados" className="transition-colors duration-200 hover:text-brand-dark">
              Programa de Afiliados
            </Link>
          </nav>
        </div>
        <div className="mt-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Mobi Media Produtores de Conteúdo LTDA.
        </div>
      </footer>
      {/* ======================================================================== */}
      {/* FIM DA ATUALIZAÇÃO DO RODAPÉ */}
      {/* ======================================================================== */}

      <MobileStickyCta
        label="Criar conta gratuita"
        description="Crie seu mídia kit e atraia campanhas"
        onClick={handleCreatorCta}
      />
    </div>
  );
}
