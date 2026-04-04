"use client";

import type { PaywallContext } from "@/types/paywall";
import {
  ACTIVATION_JOURNEY_STORAGE_KEY,
  PAYWALL_CONTEXT_PARAM,
  PAYWALL_RETURN_STORAGE_KEY,
  PAYWALL_URL_PARAM,
} from "@/types/paywall";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";

type StartGoogleSignInForPaywallOptions = {
  context: PaywallContext;
  source: string;
  returnTo: string;
};

export async function startGoogleSignInForPaywall({
  context,
  source,
  returnTo,
}: StartGoogleSignInForPaywallOptions) {
  if (typeof window === "undefined") return;

  const sanitizedReturn =
    returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";

  try {
    window.sessionStorage.setItem(
      PAYWALL_RETURN_STORAGE_KEY,
      JSON.stringify({
        context,
        source,
        returnTo: sanitizedReturn,
        proposalId: null,
        ts: Date.now(),
      })
    );
  } catch {
    /* non-fatal */
  }

  try {
    window.localStorage.setItem(
      ACTIVATION_JOURNEY_STORAGE_KEY,
      JSON.stringify({
        context,
        source,
        returnTo: sanitizedReturn,
        ts: Date.now(),
      })
    );
  } catch {
    /* non-fatal */
  }

  const callbackUrl = new URL(window.location.href);
  callbackUrl.searchParams.set(PAYWALL_URL_PARAM, "1");
  callbackUrl.searchParams.set(PAYWALL_CONTEXT_PARAM, context);

  redirectToGoogleConsentLogin(callbackUrl.toString());
}
