"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";

import {
  appendUtmToUrl,
  getPersistedUtm,
  persistUtmContext,
  persistUtmFromParams,
  type UtmContext,
} from "@/lib/analytics/utm";

const hasAnyUtm = (params: ReadonlyURLSearchParams | URLSearchParams | null | undefined) => {
  if (!params) return false;
  return (
    params.has("utm_source") ||
    params.has("utm_medium") ||
    params.has("utm_campaign") ||
    params.has("utm_term") ||
    params.has("utm_content")
  );
};

type UseUtmAttributionOptions = {
  captureReferrer?: boolean;
};

export function useUtmAttribution(options: UseUtmAttributionOptions = {}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const referrer = document.referrer || null;
    if (hasAnyUtm(searchParams)) {
      const params = new URLSearchParams(searchParams.toString());
      persistUtmFromParams(params, referrer);
      return;
    }
    if (options.captureReferrer && referrer) {
      persistUtmContext({ referrer });
    }
  }, [options.captureReferrer, searchParams, pathname]);

  const [utm, setUtm] = React.useState<UtmContext>(() => getPersistedUtm());

  React.useEffect(() => {
    setUtm(getPersistedUtm());
  }, [pathname, searchParams]);

  const appendUtm = React.useCallback(
    (url: string, overrides?: Partial<UtmContext>) => appendUtmToUrl(url, overrides ?? {}, utm),
    [utm],
  );

  return React.useMemo(
    () => ({
      utm,
      appendUtm,
      refresh: () => setUtm(getPersistedUtm()),
    }),
    [appendUtm, utm],
  );
}
