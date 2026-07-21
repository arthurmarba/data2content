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
    const blockedSections = Array.from(document.querySelectorAll<HTMLElement>([
      ".d2c-human-hero",
      "[data-landing-section='data-proof']",
      "[data-landing-section='platform']",
      "[data-landing-section='collabs']",
      "[data-landing-section='community']",
      "[data-landing-section='weekly-community']",
      "[data-landing-section='whatsapp-community']",
      "[data-landing-section='authority']",
      "[data-landing-section='pricing']",
      ".d2c-human-final",
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
      <LandingAuthCta className="d2c-button d2c-button--human" guestLabel="Assistir à próxima reunião" authenticatedLabel="Acessar a D2C" childrenAfter={<ArrowRight size={16} />} trackingLocation="sticky-mobile" />
    </div>
  );
}
