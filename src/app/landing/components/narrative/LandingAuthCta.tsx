"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";
import { submitGoogleSignInFallback } from "@/lib/auth/googleLogin";
import { track } from "@/lib/track";

type LandingAuthCtaProps = {
  className: string;
  authenticatedLabel?: string;
  guestLabel: string;
  childrenAfter?: ReactNode;
  onNavigate?: () => void;
  /** Destino de quem já tem conta; por padrão, o perfil estratégico. */
  destination?: string;
  /** Destino de quem acabou de criar a conta; por padrão, o onboarding. */
  guestDestination?: string;
  trackingLocation?: "header" | "hero" | "mapa" | "collabs" | "weekly-community" | "authority" | "pricing" | "final" | "mobile-menu" | "sticky-mobile";
};

export function LandingAuthCta({
  className,
  authenticatedLabel = "Acessar a D2C",
  guestLabel,
  childrenAfter,
  onNavigate,
  destination,
  guestDestination,
  trackingLocation,
}: LandingAuthCtaProps) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const authenticated = Boolean(session?.user);

  const handleGuestSignIn = () => {
    // Quem cria conta entra pelo caminho gratuito normal: o onboarding, onde
    // responde à narrativa e começa a conhecer a plataforma. O `destination`
    // vale apenas para quem já tem conta e passou por essa etapa.
    const callbackUrl =
      searchParams.get("callbackUrl")?.trim() || guestDestination || CREATOR_PROFILE_ROUTE;
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
        data-analytics-name={`landing_creator_cta_${trackingLocation ?? "unknown"}`}
        data-analytics-section={trackingLocation ?? "landing"}
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

  // Quem já tem conta cai no Perfil, ponto de entrada para sua direção de
  // conteúdo e para os recursos liberados conforme o plano.
  return (
    <Link
      href={destination || CREATOR_PROFILE_ROUTE}
      data-analytics-name={`landing_creator_cta_${trackingLocation ?? "unknown"}`}
      data-analytics-section={trackingLocation ?? "landing"}
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
