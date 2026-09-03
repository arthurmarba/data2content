"use client";

import type { PaywallContext } from "@/types/paywall";
import {
  ACTIVATION_JOURNEY_STORAGE_KEY,
  PAYWALL_CONTEXT_PARAM,
  PAYWALL_INTENT_PARAM,
  PAYWALL_RETURN_PARAM,
  PAYWALL_RETURN_STORAGE_KEY,
  PAYWALL_SOURCE_PARAM,
  PAYWALL_URL_PARAM,
  type PostCheckoutIntent,
} from "@/types/paywall";
import { redirectToGoogleConsentLogin } from "@/lib/auth/googleLogin";

type StartGoogleSignInForPaywallOptions = {
  context: PaywallContext;
  source: string;
  returnTo: string;
  postCheckoutIntent?: PostCheckoutIntent | null;
};

export async function startGoogleSignInForPaywall({
  context,
  source,
  returnTo,
  postCheckoutIntent = null,
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
        postCheckoutIntent,
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
        postCheckoutIntent,
        ts: Date.now(),
      })
    );
  } catch {
    /* non-fatal */
  }

  const callbackUrl = new URL(window.location.href);
  callbackUrl.searchParams.set(PAYWALL_URL_PARAM, "1");
  callbackUrl.searchParams.set(PAYWALL_CONTEXT_PARAM, context);
  callbackUrl.searchParams.set(PAYWALL_SOURCE_PARAM, source);
  callbackUrl.searchParams.set(PAYWALL_RETURN_PARAM, sanitizedReturn);
  if (postCheckoutIntent) {
    callbackUrl.searchParams.set(PAYWALL_INTENT_PARAM, postCheckoutIntent);
  }

  redirectToGoogleConsentLogin(callbackUrl.toString());
}
