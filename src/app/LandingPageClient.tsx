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
  reachLast30Days: 2_500_000,
  followersGainedLast30Days: 18_500,
  interactionsLast30Days: 820_000,
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
      style={{ "--landing-header-extra": "1.5rem" } as React.CSSProperties}
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
        <TopCreatorsSection creators={resolvedStats.ranking} />
        <CategoryInsightsSection categories={resolvedStats.categories} />
        <HowItWorksSection />
        <FinalCTASection onPrimaryCta={handleSignIn} />
      </main>

      <footer className="border-t border-gray-800 bg-black py-8 text-center text-white">
        <div className="mb-4 flex items-center justify-center gap-2">
          <div className="relative h-6 w-6 overflow-hidden">
            <Image
              src="/images/Colorido-Simbolo.png"
              alt="Data2Content"
              fill
              className="scale-[2.4] object-contain object-center"
              priority
            />
          </div>
        </div>
        <p className="mb-4 text-sm text-gray-400">
          © {new Date().getFullYear()} Mobi Media Produtores de Conteúdo LTDA.
        </p>
        <div className="flex justify-center gap-6 text-sm">
          <Link href="/politica-de-privacidade" className="text-gray-400 transition-colors hover:text-brand-magenta">
            Política de Privacidade
          </Link>
          <Link href="/termos-e-condicoes" className="text-gray-400 transition-colors hover:text-brand-magenta">
            Termos e Condições
          </Link>
        </div>
        {loadingStats ? (
          <p className="mt-6 text-xs text-gray-500">Carregando dados da comunidade…</p>
        ) : null}
      </footer>
    </div>
  );
}
