"use client";

import React from "react";

import LandingHeader from "../landing/components/LandingHeader";
import CreatorGallerySection from "../landing/components/CreatorGallerySection";
import ButtonPrimary from "../landing/components/ButtonPrimary";
import { useUtmAttribution } from "@/hooks/useUtmAttribution";
import { track } from "@/lib/track";
import type { UtmContext } from "@/lib/analytics/utm";
import type { LandingCreatorHighlight } from "@/types/landing";
import { BRAND_CAMPAIGN_ROUTE } from "@/constants/routes";

type CastingPageClientProps = {
  initialCreators: LandingCreatorHighlight[];
  initialTotal?: number;
};

const CASTING_API_ROUTE = "/api/landing/casting";
const interactionOptions = [
  { value: "", label: "Todas interações/post" },
  { value: "500", label: "≥ 500" },
  { value: "1000", label: "≥ 1k" },
  { value: "2500", label: "≥ 2,5k" },
  { value: "5000", label: "≥ 5k" },
  { value: "10000", label: "≥ 10k" },
  { value: "20000", label: "≥ 20k" },
];
const followerOptions = [
  { value: "", label: "Todos os seguidores" },
  { value: "5000", label: "≥ 5k seguidores" },
  { value: "10000", label: "≥ 10k seguidores" },
  { value: "25000", label: "≥ 25k seguidores" },
  { value: "50000", label: "≥ 50k seguidores" },
  { value: "100000", label: "≥ 100k seguidores" },
  { value: "250000", label: "≥ 250k seguidores" },
  { value: "500000", label: "≥ 500k seguidores" },
];

export default function CastingPageClient({ initialCreators, initialTotal = 0 }: CastingPageClientProps) {
  const [creators, setCreators] = React.useState(initialCreators ?? []);
  const [loading, setLoading] = React.useState(!initialCreators || initialCreators.length === 0);
  const [error, setError] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState<number>(initialTotal || initialCreators?.length || 0);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [minFollowers, setMinFollowers] = React.useState<string>("");
  const [minAvgInteractions, setMinAvgInteractions] = React.useState<string>("");
  const headerWrapRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [showStickyBar, setShowStickyBar] = React.useState(false);
  const { appendUtm, utm } = useUtmAttribution();

  React.useEffect(() => {
    const root = document.documentElement;
    const header = headerWrapRef.current?.querySelector("header");
    if (!header) return;

    const apply = () => {
      const h = header.getBoundingClientRect().height;
      root.style.setProperty("--landing-header-h", `${h}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 280);
    return () => window.clearTimeout(handle);
  }, [search]);

  React.useEffect(() => {
    const MIN_SCROLL = 280;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setShowStickyBar(window.scrollY > MIN_SCROLL);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fetchCreators = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const minFollowersNumber = Number(minFollowers);
      if (Number.isFinite(minFollowersNumber) && minFollowersNumber > 0) {
        params.set("minFollowers", String(Math.floor(minFollowersNumber)));
      }
      const minAvgNumber = Number(minAvgInteractions);
      if (Number.isFinite(minAvgNumber) && minAvgNumber > 0) {
        params.set("minAvgInteractions", String(Math.floor(minAvgNumber)));
      }

      try {
        const res = await fetch(`${CASTING_API_ROUTE}?${params.toString()}`, {
          cache: "no-store",
          signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch casting creators (${res.status})`);
        const data = (await res.json()) as { creators?: LandingCreatorHighlight[]; total?: number };
        setCreators(data.creators ?? []);
        setTotal(data.total ?? data.creators?.length ?? 0);
      } catch (err) {
        if (signal?.aborted) return;
        setError("Não foi possível carregar o casting agora. Tente novamente em instantes.");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [debouncedSearch, minAvgInteractions, minFollowers],
  );

  React.useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    fetchCreators(controller.signal);
    return () => {
      controller.abort();
    };
  }, [fetchCreators]);

  const handleBrandForm = React.useCallback(() => {
    try {
      track("casting_brand_request_click");
    } catch {
      // non-blocking telemetry
    }
    const overrides: Partial<UtmContext> = { utm_content: "casting_brand_button" };
    if (!utm.utm_source) overrides.utm_source = "casting";
    if (!utm.utm_medium) overrides.utm_medium = "casting_page";
    if (!utm.utm_campaign) overrides.utm_campaign = "casting_overview";
    const destination = appendUtm(BRAND_CAMPAIGN_ROUTE, overrides) ?? BRAND_CAMPAIGN_ROUTE;
    window.location.assign(destination);
  }, [appendUtm, utm]);

  return (
    <div className="bg-white font-sans">
      <div ref={headerWrapRef}>
        <LandingHeader showLoginButton hideBrandCta />
      </div>

      <main
        className="md:[--landing-header-extra:0px]"
        style={{
          scrollPaddingTop: "calc(var(--landing-header-h, 4.5rem) + 12px)",
        }}
      >
        <section
          className="sticky top-[calc(var(--landing-header-h,4.5rem))] z-30 border-b border-brand-glass/80 bg-white/90 backdrop-blur-lg"
          style={{ "--sat": "0px" } as React.CSSProperties}
        >
          <div className="landing-section__inner landing-section__inner--wide flex flex-col gap-2.5 py-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nome ou @"
                aria-label="Buscar criador por nome ou usuário"
                className="w-full rounded-lg border border-brand-glass bg-white px-3 py-2.5 text-sm text-brand-dark shadow-sm outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15"
              />
              <select
                value={minFollowers}
                onChange={(event) => setMinFollowers(event.target.value)}
                aria-label="Filtrar por seguidores totais"
                className="w-full rounded-lg border border-brand-glass bg-white px-3 py-2.5 text-sm text-brand-dark shadow-sm outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15"
              >
                {followerOptions.map((option) => (
                  <option key={option.value || "all-followers"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={minAvgInteractions}
                onChange={(event) => setMinAvgInteractions(event.target.value)}
                aria-label="Filtrar por interações por post"
                className="w-full rounded-lg border border-brand-glass bg-white px-3 py-2.5 text-sm text-brand-dark shadow-sm outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15"
              >
                {interactionOptions.map((option) => (
                  <option key={option.value || "all-interactions"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <CreatorGallerySection
          creators={creators}
          loading={loading}
          onRequestMediaKit={handleBrandForm}
          maxVisible={creators.length || 16}
          maxVisibleDesktop={creators.length || 24}
          sectionId="casting-galeria"
          headingEyebrow=""
          headingTitle=""
          headingDescription=""
          showHeader={false}
          containerClassName="max-w-6xl pt-6"
          gridClassName="grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 xl:gap-6"
          showAll
          topContent={
            error ? (
              <div className="w-full rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-sm">
                {error}
              </div>
            ) : null
          }
        />

        <div
          className={[
            "pointer-events-none fixed inset-x-0 bottom-3 z-40 transition-all duration-300 ease-out md:bottom-5",
            showStickyBar ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
          ].join(" ")}
          aria-hidden={!showStickyBar}
        >
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 rounded-2xl border border-brand-glass/80 bg-white/95 px-4 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.18)] backdrop-blur-md md:rounded-full md:px-6">
            <div className="hidden text-sm font-semibold text-brand-dark md:block">
              Pronto para selecionar criadores?
            </div>
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              <ButtonPrimary
                href="/login"
                size="sm"
                variant="outline"
                className="pointer-events-auto border-brand-primary/40 bg-white text-sm"
              >
                Entrar no casting da D2C
              </ButtonPrimary>
              <ButtonPrimary
                onClick={handleBrandForm}
                size="sm"
                variant="brand"
                className="pointer-events-auto text-sm shadow-md shadow-brand-primary/25"
              >
                Solicitar campanha
              </ButtonPrimary>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
