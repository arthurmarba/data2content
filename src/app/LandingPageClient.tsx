"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { track } from "@/lib/track";
import { useUtmAttribution } from "@/hooks/useUtmAttribution";
import type { UtmContext } from "@/lib/analytics/utm";
import type {
  LandingCommunityStatsResponse,
  LandingCoverageRegion,
  LandingCoverageSegment,
} from "@/types/landing";
import { CASTING_ROUTE, MAIN_DASHBOARD_ROUTE } from "@/constants/routes";

import LandingHeader from "./landing/components/LandingHeader";
import HeroModern from "./landing/components/HeroModern";
import CastingMarketplaceSection from "./landing/components/CastingMarketplaceSection";
import PlansComparisonSection from "./landing/components/PlansComparisonSection";
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
    avgReachPerPost: 35_000,
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
    avgReachPerPost: 35_000,
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
    avgReachPerPost: 36_000,
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
    avgReachPerPost: 24_000,
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
    avgReachPerPost: 26_000,
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
    avgReachPerPost: 21_000,
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
    avgReachPerPost: 27_000,
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
    avgReachPerPost: 22_000,
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
    avgReachPerPost: 23_000,
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
    avgReachPerPost: 25_000,
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
    avgReachPerPost: 21_000,
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
    avgReachPerPost: 22_000,
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
    avgReachPerPost: 24_000,
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
    avgReachPerPost: 22_000,
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
    avgReachPerPost: 23_000,
    rank: 15,
    consistencyScore: 81,
  },
  {
    id: "fallback-creator-16",
    name: "Felipe Andrade",
    username: "@felipeandrade",
    avatarUrl: null,
    followers: 176_000,
    totalInteractions: 220_000,
    postCount: 9,
    avgInteractionsPerPost: 24_000,
    avgReachPerPost: 24_000,
    rank: 16,
    consistencyScore: 80,
  },
];

const CREATOR_GALLERY_LIMIT_MOBILE = 12;
const CREATOR_GALLERY_LIMIT_DESKTOP = 12;
const CREATOR_GALLERY_MAX_LIMIT = Math.max(
  CREATOR_GALLERY_LIMIT_MOBILE,
  CREATOR_GALLERY_LIMIT_DESKTOP,
);

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

const FOOTER_LINKS = [
  { label: "Política de Privacidade", href: "/politica-de-privacidade" },
  { label: "Termos e Condições", href: "/termos-e-condicoes" },
  { label: "Programa de Afiliados", href: "/afiliados" },
  { label: "Central de suporte", href: "/dashboard/instagram/faq" },
];

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function computeNextMentorshipSlot(): { isoDate: string; display: string } {
  const nowUtc = Date.now();
  const nowInBrt = new Date(nowUtc - BRT_OFFSET_MS);
  const targetWeekday = 1; // Monday
  const currentWeekday = nowInBrt.getUTCDay();
  let delta = (targetWeekday - currentWeekday + 7) % 7;
  if (delta === 0 && nowInBrt.getUTCHours() >= 19) {
    delta = 7;
  }

  const nextInBrt = new Date(nowInBrt.getTime());
  nextInBrt.setUTCDate(nextInBrt.getUTCDate() + delta);
  nextInBrt.setUTCHours(19, 0, 0, 0);

  const isoDate = new Date(nextInBrt.getTime() + BRT_OFFSET_MS).toISOString();
  const display = `${WEEKDAYS[nextInBrt.getUTCDay()]} • 19h (BRT)`;

  return { isoDate, display };
}

function buildFallbackStats(): LandingCommunityStatsResponse {
  return {
    metrics: { ...FALLBACK_METRICS },
    ranking: FALLBACK_RANKING,
    categories: [],
    nextMentorship: computeNextMentorshipSlot(),
    lastUpdatedIso: null,
  };
}

export default function LandingPageClient() {
  const headerWrapRef = React.useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const [stats, setStats] = React.useState<LandingCommunityStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = React.useState(true);
  const fallbackStats = React.useMemo(buildFallbackStats, []);
  const { appendUtm, utm } = useUtmAttribution();

  const handleCreatorCta = React.useCallback(() => {
    try {
      track("landing_creator_cta_click");
    } catch { }

    if (session?.user) {
      window.location.assign(MAIN_DASHBOARD_ROUTE);
      return;
    }

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
  }, [session?.user]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/landing/community-stats");
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

  const metrics = stats?.metrics ?? (loadingStats ? null : fallbackStats.metrics);
  const rankingForGallery = React.useMemo(() => {
    const baseRanking = stats?.ranking ?? fallbackStats.ranking ?? [];
    const uniqueBaseRanking = baseRanking.filter(
      (creator, index, list) => list.findIndex((item) => item.id === creator.id) === index,
    );
    return uniqueBaseRanking.slice(0, CREATOR_GALLERY_MAX_LIMIT);
  }, [stats, fallbackStats]);

  return (
    <div
      className="w-full overflow-x-clip bg-white font-sans"
      style={{ "--landing-header-extra": "0rem" } as React.CSSProperties}
    >
      <div ref={headerWrapRef}>
        <LandingHeader showLoginButton onCreatorCta={handleCreatorCta} />
      </div>

      <main
        className="w-full overflow-x-clip md:[--landing-header-extra:0px]"
        style={{
          scrollPaddingTop:
            "calc(var(--landing-header-h, 4.5rem) + var(--landing-header-extra, 0px))",
        }}
      >
        <HeroModern
          onCreatorCta={handleCreatorCta}
          isAuthenticated={Boolean(session?.user)}
          metrics={metrics}
        />

        <CastingMarketplaceSection
          initialCreators={rankingForGallery}
          metrics={metrics}
        />

        <PlansComparisonSection onCreateAccount={handleCreatorCta} />
      </main>

      <footer className="border-t border-[var(--landing-border)] bg-[var(--landing-surface-muted)] text-[var(--landing-text-muted)]">
        <div className="landing-section__inner landing-section__inner--wide flex flex-col gap-8 py-10 md:gap-12">
          <div className="grid gap-8 md:grid-cols-[1.2fr_0.9fr_0.9fr]">
            <div className="flex flex-col gap-4 max-w-md">
              <div className="flex items-center gap-3">
                <div className="relative h-11 w-11 overflow-hidden rounded-full border border-[var(--landing-border)] bg-white">
                  <Image
                    src="/images/Colorido-Simbolo.png"
                    alt="Data2Content"
                    fill
                    className="object-contain object-center saturate-0"
                    priority
                  />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em]">Data2Content</p>
                  <p className="text-sm text-[var(--landing-text)]/80">Inteligência viva para a sua carreira. O parceiro estratégico que revisa conteúdo e conecta marcas.</p>
                </div>
              </div>
              <p className="text-sm text-[var(--landing-text-muted)]/90 leading-relaxed">
                Insights confiáveis, mídia kit vivo, suporte estratégico e oportunidades reais — tudo em um único ecossistema.
              </p>
            </div>

            <nav className="grid grid-cols-2 gap-3 text-sm md:grid-cols-1">
              {FOOTER_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors duration-200 hover:text-brand-primary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-col gap-3 text-sm">
              <p className="text-eyebrow text-[var(--landing-text-muted)]">Contato direto</p>
              <Link
                href="mailto:arthur@data2content.ai"
                className="text-brand-primary underline-offset-4 hover:underline"
              >
                arthur@data2content.ai
              </Link>
              <p className="text-xs">
                Plataforma operada por Mobi Media Produtores de Conteúdo LTDA.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--landing-border)] pt-4 text-[11px] text-[var(--landing-text-muted)] md:flex-row md:items-center md:justify-between">
            <span>© {new Date().getFullYear()} Data2Content. Todos os direitos reservados.</span>
            <span>Construída do Brasil para o mercado criativo.</span>
          </div>
        </div>
      </footer>

      <MobileStickyCta
        label={session?.user ? "Acessar minha conta" : "Quero entrar na D2C"}
        onClick={handleCreatorCta}
        showAfterTargetId="galeria"
        scrollOffset={320}
        intersectionThreshold={0.45}
      />
    </div>
  );
}
