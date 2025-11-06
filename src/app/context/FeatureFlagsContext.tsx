"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_FEATURE_FLAGS, type FeatureFlagKey, parseFeatureFlags } from "@/lib/featureFlags";

type FeatureFlagState = {
  flags: Record<string, boolean>;
  loading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (key: FeatureFlagKey, fallback?: boolean) => boolean;
};

const FeatureFlagContext = createContext<FeatureFlagState | undefined>(undefined);

async function fetchRemoteFlags() {
  try {
    const response = await fetch("/api/feature-flags", { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed with status ${response.status}`);
    const body = await response.json().catch(() => null);
    return parseFeatureFlags(body?.data as Record<string, boolean>);
  } catch {
    return { ...DEFAULT_FEATURE_FLAGS };
  }
}

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<Record<string, boolean>>({ ...DEFAULT_FEATURE_FLAGS });
  const [loading, setLoading] = useState(true);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    const remote = await fetchRemoteFlags();
    setFlags(remote);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const isEnabled = useCallback(
    (key: FeatureFlagKey, fallback?: boolean) => {
      const value = flags[key];
      if (typeof value === "boolean") return value;
      if (typeof fallback === "boolean") return fallback;
      return DEFAULT_FEATURE_FLAGS[key] ?? false;
    },
    [flags]
  );

  const value = useMemo<FeatureFlagState>(
    () => ({
      flags,
      loading,
      refresh: loadFlags,
      isEnabled,
    }),
    [flags, loading, loadFlags, isEnabled]
  );

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}

export const useFeatureFlags = () => {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) {
    throw new Error("useFeatureFlags must be used within a FeatureFlagProvider");
  }
  return ctx;
};

export const useFeatureFlag = (key: FeatureFlagKey, fallback?: boolean) => {
  const { isEnabled, loading } = useFeatureFlags();
  return {
    enabled: isEnabled(key, fallback),
    loading,
  };
};
