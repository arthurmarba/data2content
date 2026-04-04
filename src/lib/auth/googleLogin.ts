import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";

export function buildGoogleConsentLoginUrl(
  callbackUrl: string = MAIN_DASHBOARD_ROUTE,
) {
  const params = new URLSearchParams();
  const normalizedCallbackUrl =
    typeof callbackUrl === "string" && callbackUrl.trim().length > 0
      ? callbackUrl
      : MAIN_DASHBOARD_ROUTE;

  params.set("callbackUrl", normalizedCallbackUrl);

  return `/login?${params.toString()}`;
}

export function redirectToGoogleConsentLogin(
  callbackUrl: string = MAIN_DASHBOARD_ROUTE,
) {
  if (typeof window === "undefined") return;
  window.location.assign(buildGoogleConsentLoginUrl(callbackUrl));
}
