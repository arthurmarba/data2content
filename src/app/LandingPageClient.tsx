"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { track } from "@/lib/track";
import type {
  LandingCommunityStatsResponse,
  LandingCoverageRegion,
  LandingCoverageSegment,
} from "@/types/landing";
import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";

import LandingHeader from "./landing/components/LandingHeader";
import HeroModern from "./landing/components/HeroModern";
import CreatorGallerySection from "./landing/components/CreatorGallerySection";
import PlansComparisonSection from "./landing/components/PlansComparisonSection";
import BrandsSection from "./landing/components/BrandsSection";
import TestimonialSpotlight from "./landing/components/TestimonialSpotlight";
import MobileStickyCta from "./landing/components/MobileStickyCta";
import CoverageHighlights from "./landing/components/CoverageHighlights";

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
  {
    id: "fallback-creator-4",
    name: "João Mendes",
    username: "@joaomendes",
    avatarUrl: null,
    followers: 185_000,
    totalInteractions: 260_000,
    postCount: 10,
    avgInteractionsPerPost: 24_000,
    rank: 4,
    consistencyScore: 84,
  },
  {
    id: "fallback-creator-5",
    name: "Bianca Farias",
    username: "@biancafarias",
    avatarUrl: null,
    followers: 142_000,
    totalInteractions: 210_000,
    postCount: 8,
    avgInteractionsPerPost: 26_000,
    rank: 5,
    consistencyScore: 82,
  },
  {
    id: "fallback-creator-6",
    name: "Pedro Albuquerque",
    username: "@pedroalbuquerque",
    avatarUrl: null,
    followers: 198_000,
    totalInteractions: 235_000,
    postCount: 9,
    avgInteractionsPerPost: 21_000,
    rank: 6,
    consistencyScore: 79,
  },
  {
    id: "fallback-creator-7",
    name: "Marina Duarte",
    username: "@marinaduarte",
    avatarUrl: null,
    followers: 265_000,
    totalInteractions: 360_000,
    postCount: 13,
    avgInteractionsPerPost: 27_000,
    rank: 7,
    consistencyScore: 86,
  },
  {
    id: "fallback-creator-8",
    name: "Otávio Ramos",
    username: "@otavioramos",
    avatarUrl: null,
    followers: 156_000,
    totalInteractions: 195_000,
    postCount: 7,
    avgInteractionsPerPost: 22_000,
    rank: 8,
    consistencyScore: 81,
  },
  {
    id: "fallback-creator-9",
    name: "Camila Torres",
    username: "@camilatorres",
    avatarUrl: null,
    followers: 175_000,
    totalInteractions: 205_000,
    postCount: 8,
    avgInteractionsPerPost: 23_000,
    rank: 9,
    consistencyScore: 77,
  },
  {
    id: "fallback-creator-10",
    name: "Thales Nascimento",
    username: "@thalesnasc",
    avatarUrl: null,
    followers: 162_000,
    totalInteractions: 188_000,
    postCount: 6,
    avgInteractionsPerPost: 25_000,
    rank: 10,
    consistencyScore: 80,
  },
  {
    id: "fallback-creator-11",
    name: "Renata Lopes",
    username: "@renatalopes",
    avatarUrl: null,
    followers: 148_000,
    totalInteractions: 176_000,
    postCount: 7,
    avgInteractionsPerPost: 21_000,
    rank: 11,
    consistencyScore: 78,
  },
  {
    id: "fallback-creator-12",
    name: "Gabriel Neri",
    username: "@gabrielneri",
    avatarUrl: null,
    followers: 194_000,
    totalInteractions: 240_000,
    postCount: 11,
    avgInteractionsPerPost: 22_000,
    rank: 12,
    consistencyScore: 83,
  },
  {
    id: "fallback-creator-13",
    name: "Patrícia Silveira",
    username: "@patriciasilveira",
    avatarUrl: null,
    followers: 171_000,
    totalInteractions: 215_000,
    postCount: 9,
    avgInteractionsPerPost: 24_000,
    rank: 13,
    consistencyScore: 82,
  },
  {
    id: "fallback-creator-14",
    name: "Ian Monteiro",
    username: "@ianmonteiro",
    avatarUrl: null,
    followers: 205_000,
    totalInteractions: 265_000,
    postCount: 12,
    avgInteractionsPerPost: 22_000,
    rank: 14,
    consistencyScore: 79,
  },
  {
    id: "fallback-creator-15",
    name: "Laura Furtado",
    username: "@laurafurtado",
    avatarUrl: null,
    followers: 187_000,
    totalInteractions: 232_000,
    postCount: 10,
    avgInteractionsPerPost: 23_000,
    rank: 15,
    consistencyScore: 81,
  },
];

const CREATOR_GALLERY_LIMIT = 15;

const FALLBACK_COVERAGE_SEGMENTS: LandingCoverageSegment[] = [
  {
    id: "beauty_personal_care",
    label: "Beleza e cuidados pessoais",
    reach: 780_000,
    interactions: 112_000,
    postCount: 145,
    avgInteractionsPerPost: 772.4,
    share: 0.27,
    engagementRate: 14.3,
  },
  {
    id: "fashion_style",
    label: "Moda e estilo",
    reach: 620_000,
    interactions: 86_000,
    postCount: 132,
    avgInteractionsPerPost: 651.5,
    share: 0.21,
    engagementRate: 13.9,
  },
  {
    id: "food_culinary",
    label: "Gastronomia",
    reach: 510_000,
    interactions: 74_500,
    postCount: 118,
    avgInteractionsPerPost: 631.4,
    share: 0.18,
    engagementRate: 14.6,
  },
  {
    id: "fitness_sports",
    label: "Fitness e bem-estar",
    reach: 442_000,
    interactions: 59_200,
    postCount: 96,
    avgInteractionsPerPost: 616.7,
    share: 0.15,
    engagementRate: 13.4,
  },
  {
    id: "technology_digital",
    label: "Tech & negócios digitais",
    reach: 318_000,
    interactions: 41_400,
    postCount: 84,
    avgInteractionsPerPost: 492.9,
    share: 0.11,
    engagementRate: 13.0,
  },
  {
    id: "travel_tourism",
    label: "Viagens e turismo",
    reach: 236_000,
    interactions: 28_500,
    postCount: 65,
    avgInteractionsPerPost: 438.5,
    share: 0.08,
    engagementRate: 12.1,
  },
];

const FALLBACK_COVERAGE_REGIONS: LandingCoverageRegion[] = [
  {
    code: "SP",
    label: "São Paulo",
    region: "Sudeste",
    followers: 1_240_000,
    share: 0.26,
    engagedFollowers: 320_000,
    engagedShare: 0.28,
  },
  {
    code: "RJ",
    label: "Rio de Janeiro",
    region: "Sudeste",
    followers: 740_000,
    share: 0.16,
    engagedFollowers: 175_000,
    engagedShare: 0.15,
  },
  {
    code: "MG",
    label: "Minas Gerais",
    region: "Sudeste",
    followers: 520_000,
    share: 0.11,
    engagedFollowers: 126_000,
    engagedShare: 0.11,
  },
  {
    code: "BA",
    label: "Bahia",
    region: "Nordeste",
    followers: 418_000,
    share: 0.09,
    engagedFollowers: 102_000,
    engagedShare: 0.09,
  },
  {
    code: "PR",
    label: "Paraná",
    region: "Sul",
    followers: 364_000,
    share: 0.08,
    engagedFollowers: 84_000,
    engagedShare: 0.07,
  },
  {
    code: "PE",
    label: "Pernambuco",
    region: "Nordeste",
    followers: 298_000,
    share: 0.06,
    engagedFollowers: 71_000,
    engagedShare: 0.06,
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
  const [coverageSegments, setCoverageSegments] =
    React.useState<LandingCoverageSegment[] | null>(null);
  const [coverageRegions, setCoverageRegions] =
    React.useState<LandingCoverageRegion[] | null>(null);
  const [loadingCoverage, setLoadingCoverage] = React.useState(true);
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

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [segmentsRes, regionsRes] = await Promise.all([
          fetch("/api/landing/coverage/segments?limit=6", { cache: "no-store" }),
          fetch("/api/landing/coverage/geography?limit=6", { cache: "no-store" }),
        ]);

        if (segmentsRes.ok) {
          const segmentsPayload = (await segmentsRes.json()) as { items?: LandingCoverageSegment[] };
          if (!cancelled && Array.isArray(segmentsPayload.items)) {
            setCoverageSegments(segmentsPayload.items);
          }
        }

        if (regionsRes.ok) {
          const regionsPayload = (await regionsRes.json()) as { items?: LandingCoverageRegion[] };
          if (!cancelled && Array.isArray(regionsPayload.items)) {
            setCoverageRegions(regionsPayload.items);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[landing] Failed to fetch coverage data", error);
        }
      } finally {
        if (!cancelled) setLoadingCoverage(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
  const segmentsForCoverage = coverageSegments?.length
    ? coverageSegments
    : FALLBACK_COVERAGE_SEGMENTS;
  const regionsForCoverage = coverageRegions?.length
    ? coverageRegions
    : FALLBACK_COVERAGE_REGIONS;
  const rankingForGallery = React.useMemo(() => {
    const baseRanking = resolvedStats.ranking ?? [];
    const uniqueBaseRanking = baseRanking.filter(
      (creator, index, list) => list.findIndex((item) => item.id === creator.id) === index,
    );
    if (uniqueBaseRanking.length >= CREATOR_GALLERY_LIMIT) {
      return uniqueBaseRanking.slice(0, CREATOR_GALLERY_LIMIT);
    }
    const fallbackExtras = fallbackStats.ranking
      .filter((fallbackCreator) =>
        !uniqueBaseRanking.some((baseCreator) => baseCreator.id === fallbackCreator.id),
      )
      .slice(0, CREATOR_GALLERY_LIMIT - uniqueBaseRanking.length);
    return [...uniqueBaseRanking, ...fallbackExtras];
  }, [resolvedStats, fallbackStats]);

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
        <CoverageHighlights
          segments={segmentsForCoverage}
          regions={regionsForCoverage}
          loading={loadingCoverage}
        />
        <CreatorGallerySection
          creators={rankingForGallery}
          loading={loadingStats}
          onRequestMediaKit={handleCreatorCta}
          maxVisible={CREATOR_GALLERY_LIMIT}
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
