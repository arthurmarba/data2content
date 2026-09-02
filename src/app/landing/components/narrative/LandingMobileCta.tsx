"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { LandingAuthCta } from "./LandingAuthCta";

export function LandingMobileCta() {
  const [visible, setVisible] = useState(false);
  const [consentResolved, setConsentResolved] = useState(false);

  useEffect(() => {
    const syncConsent = () => setConsentResolved(document.cookie.includes("cookie_consent="));
    syncConsent();
    window.addEventListener("d2c-cookie-consent-change", syncConsent);
    return () => window.removeEventListener("d2c-cookie-consent-change", syncConsent);
  }, []);

  useEffect(() => {
    /* Seções que já têm CTA próprio à vista: o botão fixo se cala nelas para
       não competir. Os seletores seguem o arco v6 — as classes antigas
       (.d2c-human-hero, .d2c-human-final) não existem mais na página, e sem a
       atualização o botão fixo cobria justamente o CTA do herói e o do
       fechamento. */
    const blockedSections = Array.from(document.querySelectorAll<HTMLElement>([
      ".d2c-v6-hero",
      "[data-landing-section='authority']",
      "[data-landing-section='pricing']",
      ".d2c-v6-close",
    ].join(",")));
    if (blockedSections.length === 0) return;

    const sectionVisibility = new Map<HTMLElement, boolean>();
    blockedSections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      sectionVisibility.set(section, rect.top < window.innerHeight && rect.bottom > 0);
    });
    const sync = () => setVisible(!Array.from(sectionVisibility.values()).some(Boolean));
    sync();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        sectionVisibility.set(entry.target as HTMLElement, entry.isIntersecting);
      });
      sync();
    }, { threshold: 0.01 });

    blockedSections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  if (!visible || !consentResolved) return null;

  return (
    <div className="d2c-mobile-conversion is-visible">
      <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Criar conta grátis" authenticatedLabel="Acessar a D2C" childrenAfter={<ArrowRight size={16} />} trackingLocation="sticky-mobile" />
    </div>
  );
}
