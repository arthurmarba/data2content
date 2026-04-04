"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type HeaderVariant = "default" | "immersive" | "minimal" | "compact";

export interface HeaderCta {
  label: string;
  href?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export interface HeaderConfig {
  variant: HeaderVariant;
  sticky: boolean;
  mobileDocked: boolean;
  showSidebarToggle: boolean;
  showUserMenu: boolean;
  hideBrandLogoOnMobile: boolean;
  condensedOnScroll: boolean;
  contentTopPadding?: string | number;
  title?: string;
  subtitle?: string;
  mobileTitle?: string | null;
  mobileSubtitle?: string | null;
  mobileAccessory?: ReactNode;
  cta?: HeaderCta | null;
  extraContent?: ReactNode;
}

const defaultConfig: HeaderConfig = {
  variant: "default",
  sticky: true,
  mobileDocked: false,
  showSidebarToggle: true,
  showUserMenu: true,
  hideBrandLogoOnMobile: false,
  condensedOnScroll: false,
  mobileTitle: null,
  mobileSubtitle: null,
  mobileAccessory: null,
  cta: null,
  extraContent: null,
  contentTopPadding: undefined,
};

interface HeaderContextValue {
  config: HeaderConfig;
  setConfig: (config: HeaderConfig) => void;
  updateConfig: (config: Partial<HeaderConfig>) => void;
  resetConfig: () => void;
  defaultConfig: HeaderConfig;
}

const HeaderContext = createContext<HeaderContextValue | undefined>(undefined);

function isConfigEqual(a: HeaderConfig, b: HeaderConfig) {
  if (a === b) return true;
  const keysA = Object.keys(a) as (keyof HeaderConfig)[];
  const keysB = Object.keys(b) as (keyof HeaderConfig)[];
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<HeaderConfig>(defaultConfig);

  const setConfig = useCallback((next: HeaderConfig) => {
    setConfigState((prev) => (isConfigEqual(prev, next) ? prev : next));
  }, []);

  const updateConfig = useCallback((next: Partial<HeaderConfig>) => {
    setConfigState((prev) => {
      const merged = { ...prev, ...next };
      return isConfigEqual(prev, merged) ? prev : merged;
    });
  }, []);

  const resetConfig = useCallback(() => {
    setConfigState(defaultConfig);
  }, []);

  const value = useMemo<HeaderContextValue>(
    () => ({ config, setConfig, updateConfig, resetConfig, defaultConfig }),
    [config, setConfig, updateConfig, resetConfig]
  );

  return <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>;
}

export function useHeaderConfig() {
  const ctx = useContext(HeaderContext);
  if (!ctx) {
    throw new Error("useHeaderConfig deve ser usado dentro de HeaderProvider");
  }
  return ctx;
}

export function useOptionalHeaderConfig() {
  return useContext(HeaderContext);
}

export function useHeaderSetup(config?: Partial<HeaderConfig>, deps: unknown[] = []) {
  const { setConfig, resetConfig, defaultConfig } = useHeaderConfig();

  const memoConfig = useMemo<HeaderConfig | null>(
    () => {
      if (!config) return null;
      return {
        ...defaultConfig,
        ...config,
        cta: Object.prototype.hasOwnProperty.call(config, "cta")
          ? config.cta ?? null
          : defaultConfig.cta,
        extraContent: Object.prototype.hasOwnProperty.call(config, "extraContent")
          ? config.extraContent ?? null
          : defaultConfig.extraContent,
        mobileTitle: Object.prototype.hasOwnProperty.call(config, "mobileTitle")
          ? config.mobileTitle ?? null
          : defaultConfig.mobileTitle,
        mobileSubtitle: Object.prototype.hasOwnProperty.call(config, "mobileSubtitle")
          ? config.mobileSubtitle ?? null
          : defaultConfig.mobileSubtitle,
        mobileAccessory: Object.prototype.hasOwnProperty.call(config, "mobileAccessory")
          ? config.mobileAccessory ?? null
          : defaultConfig.mobileAccessory,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultConfig, config, ...deps]
  );

  React.useEffect(() => {
    if (!memoConfig) return;
    setConfig(memoConfig);
    // Não resetamos mais durante o unmount para evitar loops de atualização.
  }, [memoConfig, setConfig]);
}
