"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { MAIN_DASHBOARD_ROUTE } from "@/constants/routes";
import { submitGoogleSignInFallback } from "@/lib/auth/googleLogin";
import { track } from "@/lib/track";

type LandingAuthCtaProps = {
  className: string;
  authenticatedLabel?: string;
  guestLabel: string;
  childrenAfter?: ReactNode;
  onNavigate?: () => void;
  trackingLocation?: "header" | "hero" | "mapa" | "collabs" | "weekly-community" | "authority" | "pricing" | "final" | "mobile-menu" | "sticky-mobile";
};

export function LandingAuthCta({
  className,
  authenticatedLabel = "Acessar minha consultoria",
  guestLabel,
  childrenAfter,
  onNavigate,
  trackingLocation,
}: LandingAuthCtaProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const authenticated = Boolean(session?.user);

  const handleGuestSignIn = () => {
    const callbackUrl = searchParams.get("callbackUrl")?.trim() || MAIN_DASHBOARD_ROUTE;
    track("landing_creator_cta_click", trackingLocation ? { location: trackingLocation } : undefined);
    onNavigate?.();
    setIsLoading(true);
    // O POST com CSRF inicia o OAuth no navegador de forma determinística. O
    // `signIn` client-side pode resolver sem efetuar navegação em alguns
    // navegadores, deixando o CTA preso no estado de carregamento.
    void submitGoogleSignInFallback(callbackUrl).catch(() => {
      setIsLoading(false);
    });
  };

  if (!authenticated) {
    return (
      <button
        type="button"
        className={className}
        onClick={handleGuestSignIn}
        disabled={isLoading}
        aria-label={isLoading ? "Abrindo Google..." : guestLabel}
      >
        {isLoading ? "Abrindo Google..." : guestLabel}
        {!isLoading && childrenAfter}
      </button>
    );
  }

  return (
    <Link
      href={MAIN_DASHBOARD_ROUTE}
      className={className}
      onClick={() => {
        track("landing_creator_cta_click", trackingLocation ? { location: trackingLocation } : undefined);
        onNavigate?.();
      }}
    >
      {authenticatedLabel}
      {childrenAfter}
    </Link>
  );
}
