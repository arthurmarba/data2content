"use client";

import React from "react";
import type { LandingCategoryInsight, LandingCreatorHighlight } from "@/types/landing";

type MobileConversionFlowSectionProps = {
  categories?: LandingCategoryInsight[] | null;
  creators?: LandingCreatorHighlight[] | null;
  embedded?: boolean;
};

export default function MobileConversionFlowSection({
  categories: _categories,
  creators: _creators,
  embedded = false,
}: MobileConversionFlowSectionProps) {
  void _categories;
  void _creators;

  const content = (
    <>
      {!embedded && (
        <a
          href="#galeria"
          className="inline-flex items-center gap-2 rounded-full bg-brand-dark px-4 py-2.5 text-[12px] font-black uppercase tracking-[0.08em] text-white"
        >
          Ver membros da comunidade
          <span aria-hidden="true">↓</span>
        </a>
      )}
    </>
  );

  if (embedded) {
    return (
      <div data-testid="mobile-gallery-bridge" className="px-4 pb-2 pt-1">
        {content}
      </div>
    );
  }

  return (
    <section
      id="community-proof"
      className="border-y border-slate-100 bg-[linear-gradient(180deg,#fff_0%,#f8fafc_100%)] py-5 md:hidden"
    >
      <div className="landing-section__inner">
        <div
          data-testid="mobile-gallery-bridge"
          className="rounded-[1.7rem] border border-[#E7EBF6] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.96))] p-4 shadow-[0_18px_38px_rgba(20,33,61,0.05)]"
        >
          {content}
        </div>
      </div>
    </section>
  );
}
