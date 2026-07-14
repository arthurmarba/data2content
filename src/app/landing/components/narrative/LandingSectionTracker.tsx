"use client";

import { useEffect } from "react";

import { track } from "@/lib/track";

export function LandingSectionTracker() {
  useEffect(() => {
    const seen = new Set<string>();
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-landing-section]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion) document.documentElement.classList.add("d2c-motion-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in-view");
        const section = (entry.target as HTMLElement).dataset.landingSection;
        if (!section || seen.has(section)) return;
        seen.add(section);
        track("landing_section_view", { section });
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -10% 0px" });

    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("d2c-motion-ready");
    };
  }, []);

  return null;
}
