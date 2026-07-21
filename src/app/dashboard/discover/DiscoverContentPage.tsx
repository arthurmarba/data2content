import React from "react";
import { headers } from "next/headers";
import {
  buildDiscoverSearchParams,
  buildDiscoverSelectedFromParams,
} from "@/app/discover/components/discoverFilterState";
import Board from "@/app/dashboard/components/Board";
import CommunityConversionSection from "./CommunityConversionSection";
import type { DiscoverSection } from "./discoverFeedUtils";
import { DISCOVER_MAX_POST_AGE_DAYS } from "./discoverFeedUtils";
import { prepareDiscoverSections } from "./discoverFeedUtils";
import PlanningDiscoverBoard from "./PlanningDiscoverBoard";
import DiscoverViewTracker from "../../discover/components/DiscoverViewTracker";
import DiscoverHeaderConfigurator from "./DiscoverHeaderConfigurator";
export const dynamic = "force-dynamic";
const LIST_SAMPLE_SIZE = 24;

type FeedOk = {
  ok: true;
  sections: DiscoverSection[];
  allowedPersonalized: boolean;
  capabilities?: { hasReels?: boolean; hasDuration?: boolean; hasSaved?: boolean };
};
type FeedErr = { ok: false; status: number };

function buildBaseUrl(hdrs: Awaited<ReturnType<typeof headers>>) {
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

async function fetchFeed(
  requestHeaders: Awaited<ReturnType<typeof headers>>,
  qs?: string,
): Promise<FeedOk | FeedErr> {
  try {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL.trim()
        ? process.env.NEXT_PUBLIC_BASE_URL
        : buildBaseUrl(requestHeaders);
    const url = `${base}/api/discover/feed${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        cookie: requestHeaders.get("cookie") || "",
      },
    });
    if (!res.ok) return { ok: false as const, status: res.status } as FeedErr;
    const data = await res.json();
    if (!data?.ok) return { ok: false as const, status: 500 } as FeedErr;
    return {
      ok: true as const,
      sections: (data.sections || []) as DiscoverSection[],
      allowedPersonalized: Boolean(data.allowedPersonalized),
    } as FeedOk;
  } catch {
    return { ok: false as const, status: 500 } as FeedErr;
  }
}

export default async function DiscoverContentPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [resolvedSearchParams, requestHeaders] = await Promise.all([
    searchParams,
    headers(),
  ]);
  const rawParams = new URLSearchParams();
  const keys = [
    "format",
    "contentIntent",
    "context",
    "narrativeForm",
    "contentSignals",
    "stance",
    "proofStyle",
    "commercialMode",
    "references",
    "proposal",
    "tone",
  ] as const;
  for (const k of keys) {
    const v = resolvedSearchParams?.[k];
    if (!v) continue;
    if (Array.isArray(v)) rawParams.set(k, v.join(","));
    else rawParams.set(k, String(v));
  }
  const params = buildDiscoverSearchParams(
    rawParams,
    buildDiscoverSelectedFromParams(rawParams)
  );
  const videoOnlyParam = resolvedSearchParams?.videoOnly;
  if (videoOnlyParam && (Array.isArray(videoOnlyParam) ? videoOnlyParam[0] : videoOnlyParam)) {
    params.set("videoOnly", "1");
  }
  params.set("limitPerRow", String(LIST_SAMPLE_SIZE));
  params.set("days", String(DISCOVER_MAX_POST_AGE_DAYS));
  const qs = params.toString();

  const result = await fetchFeed(requestHeaders, qs).catch(
    () => ({ ok: false as const, status: 500 } as FeedErr)
  );

  if (!result.ok) {
    const status = result.status;
    let title = "Não foi possível carregar o feed de descoberta.";
    let hint: React.ReactNode = null;
    if (status === 401) {
      title = "Faça login para ver a Comunidade.";
      hint = (
        <a href="/login" className="text-brand-pink underline">
          Entrar
        </a>
      );
    } else if (status === 403) {
      return (
        <main className="mx-auto flex h-full min-h-0 w-full flex-col bg-[radial-gradient(120%_36%_at_50%_0%,rgba(255,255,255,0.95),rgba(243,244,246,0.98)_52%,rgba(243,244,246,1)_100%)] px-0 sm:px-6 lg:bg-none lg:px-8 lg:pb-5 lg:pt-[2.75rem]">
          <DiscoverHeaderConfigurator />
          <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1640px] flex-col overflow-hidden">
            <Board
              title="Comunidade"
              promoteHeaderOnMobile
              mobilePresentation="flat"
              variant="card"
              desktopWidthClassName="lg:max-w-[1640px]"
              showChevron={false}
              showOptions={false}
              className="h-full"
              contentClassName="bg-transparent lg:bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(248,248,249,0.72))]"
            >
              <div className="space-y-4 p-4 sm:p-5">
                <CommunityConversionSection teaserMode />
                <div className="dashboard-empty-state rounded-[1.35rem] border border-dashed border-zinc-200/80 px-4 py-5 text-sm text-zinc-500">
                  Ative seu plano para liberar as coleções completas da Comunidade e usar as referências em tempo real no board.
                </div>
              </div>
            </Board>
          </div>
        </main>
      );
    }
    return (
      <main className="dashboard-page-shell py-4 lg:h-full lg:min-h-0">
        <h1 className="text-2xl font-semibold text-gray-900">Comunidade</h1>
        <p className="mt-2 text-gray-600">
          {title} {hint}
        </p>
      </main>
    );
  }

  const { featuredSection, secondarySections } = prepareDiscoverSections(result.sections);
  const boardSections = featuredSection
    ? [featuredSection, ...secondarySections]
    : secondarySections;

  return (
    <main className="mx-auto flex h-full min-h-0 w-full flex-col bg-[radial-gradient(120%_36%_at_50%_0%,rgba(255,255,255,0.95),rgba(243,244,246,0.98)_52%,rgba(243,244,246,1)_100%)] px-0 sm:px-6 lg:bg-none lg:px-8 lg:pb-5 lg:pt-[2.75rem]">
      <DiscoverHeaderConfigurator />
      <DiscoverViewTracker />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1640px] flex-col overflow-hidden">
        <PlanningDiscoverBoard
          initialSections={boardSections}
          initialAllowedPersonalized={result.allowedPersonalized}
        />
      </div>
    </main>
  );
}
