import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";

export function normalizeInternalCallbackUrl(callbackUrl: unknown) {
  if (typeof callbackUrl !== "string") return MAIN_DASHBOARD_ROUTE;

  const normalizedCallbackUrl = callbackUrl.trim();
  if (!normalizedCallbackUrl.startsWith("/") || normalizedCallbackUrl.startsWith("//")) {
    return MAIN_DASHBOARD_ROUTE;
  }

  return normalizedCallbackUrl;
}

export function buildGoogleConsentLoginUrl(
  callbackUrl: string = MAIN_DASHBOARD_ROUTE,
) {
  const params = new URLSearchParams();
  const normalizedCallbackUrl = normalizeInternalCallbackUrl(callbackUrl);

  params.set("callbackUrl", normalizedCallbackUrl);

  return `/login?${params.toString()}`;
}

export function redirectToGoogleConsentLogin(
  callbackUrl: string = MAIN_DASHBOARD_ROUTE,
) {
  if (typeof window === "undefined") return;
  window.location.assign(buildGoogleConsentLoginUrl(callbackUrl));
}

export async function submitGoogleSignInFallback(
  callbackUrl: string = MAIN_DASHBOARD_ROUTE,
) {
  if (typeof window === "undefined") return;

  const normalizedCallbackUrl = normalizeInternalCallbackUrl(callbackUrl);
  const response = await fetch("/api/auth/csrf", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Unable to prepare Google sign-in (${response.status})`);
  }

  const payload = await response.json() as { csrfToken?: string };
  if (!payload.csrfToken) {
    throw new Error("Unable to prepare Google sign-in (missing CSRF token)");
  }

  const form = document.createElement("form");
  form.method = "post";
  form.action = "/api/auth/signin/google";
  form.hidden = true;

  for (const [name, value] of Object.entries({
    csrfToken: payload.csrfToken,
    callbackUrl: normalizedCallbackUrl,
  })) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
