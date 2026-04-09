"use client";

import type { HomeSummaryResponse } from "./types";

type HomeSummaryScope = "all" | "community";

const HOME_SUMMARY_CLIENT_CACHE_TTL_MS = 60_000;

const homeSummaryCache = new Map<
  HomeSummaryScope,
  { data: HomeSummaryResponse | null; expiresAt: number }
>();
const homeSummaryInFlight = new Map<HomeSummaryScope, Promise<HomeSummaryResponse | null>>();

function readCachedHomeSummary(scope: HomeSummaryScope) {
  const cached = homeSummaryCache.get(scope);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    homeSummaryCache.delete(scope);
    return null;
  }
  return cached.data;
}

function writeCachedHomeSummary(scope: HomeSummaryScope, data: HomeSummaryResponse | null) {
  homeSummaryCache.set(scope, {
    data,
    expiresAt: Date.now() + HOME_SUMMARY_CLIENT_CACHE_TTL_MS,
  });
}

export async function fetchHomeSummaryCached(
  scope: HomeSummaryScope,
): Promise<HomeSummaryResponse | null> {
  if (scope === "community") {
    const cachedAll = readCachedHomeSummary("all");
    if (cachedAll) {
      return cachedAll;
    }
  }

  const cached = readCachedHomeSummary(scope);
  if (cached) return cached;

  const inFlight = homeSummaryInFlight.get(scope);
  if (inFlight) return inFlight;

  const request = (async () => {
    const res = await fetch(`/api/dashboard/home/summary?scope=${scope}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Não foi possível carregar o resumo da dashboard.");
    }

    const payload = (await res.json()) as {
      ok?: boolean;
      data?: HomeSummaryResponse | null;
    };

    if (payload?.ok === false) {
      throw new Error("Não foi possível carregar o resumo da dashboard.");
    }

    const data = payload?.data ?? null;
    writeCachedHomeSummary(scope, data);

    if (scope === "all") {
      writeCachedHomeSummary("community", data);
    }

    return data;
  })();

  homeSummaryInFlight.set(scope, request);

  try {
    return await request;
  } finally {
    homeSummaryInFlight.delete(scope);
  }
}
