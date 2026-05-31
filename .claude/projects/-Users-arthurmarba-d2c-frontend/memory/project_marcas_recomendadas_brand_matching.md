---
name: project-marcas-recomendadas-brand-matching
description: Brand matching feature connected to Marcas Recomendadas card and detail page in Diagnostico mobile experience
metadata:
  type: project
---

Feature connecting the existing `buildBrandMatchesFromSynthesis` engine to the Diagnostico mobile home card and detail page.

**Why:** The brand matching engine (`brandNarrativeMatcher.ts`) already existed and was called in the server selector, but the results never reached the Diagnostico V2 shell (`DiagnosticoRealShellClient`).

**Files changed (all in this branch):**
- `narrativeMapMobileViewModelServerSelector.ts` — exposes `brandMatches: BrandNarrativeMatchResult[]` in selector result
- `diagnosticoPageData.ts` — added `brandMatches: BrandNarrativeMatchResult[]` to `DiagnosticoPageData`
- `mobile-strategic-profile/page.tsx` — passes `selectorResult.brandMatches` to `diagnosticoPageData`
- `DiagnosticoCategoriesSection.tsx` — tile #5 logic: when `brandMatches.length > 0`, shows "N marcas com fit" + brand names as subtitle
- `DiagnosticoRealShellClient.tsx` — passes `brandMatches` prop to `DiagnosticoBrandsDetailView`
- `DiagnosticoBrandsDetailView.tsx` — rebuilt with expandable `BrandMatchCard` accordion (rationale, matchedSignals, insertionAngle, suggestedDeliverables, suggestedApproachMessage, CTA to /dashboard/proposals)

**How to apply:** When editing brand matching flow, remember brand matches arrive server-side via `buildBrandMatchesFromSynthesis(synthesis)` which calls `matchBrandsForNarrative()`. Only `alto` and `medio` level matches surface.

**Gate:** Only active when `DIAGNOSTICO_V2_ENABLED=1`.
