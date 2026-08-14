"use client";

import { useState } from "react";

import {
  MobileOnboardingFlow,
  type MobileOnboardingCompletePayload,
} from "./MobileOnboardingFlow";

/** Internal-only visual harness used by the protected mobile profile preview. */
export function MobileOnboardingPreviewHarness() {
  const [result, setResult] = useState<MobileOnboardingCompletePayload | null>(null);

  if (result) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[var(--ds-color-paper)] px-6 text-center">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[.1em] text-[var(--ds-color-brand-strong)]">Preview concluído</p>
          <h1 className="mt-3 text-[32px] font-bold tracking-[-.04em] text-[var(--ds-color-ink)]">O app assumiria a tela agora.</h1>
          <button type="button" className="ds-button ds-button--primary mt-6" onClick={() => setResult(null)}>Reabrir onboarding</button>
        </div>
      </main>
    );
  }

  return <MobileOnboardingFlow open onComplete={setResult} />;
}
