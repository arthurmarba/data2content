"use client";

import { ProfileSettingsPage } from "@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage";

export default function ContentAnalysisHistoryError({ reset }: { reset: () => void }) {
  return (
    <ProfileSettingsPage title="Últimas análises" backHref="/dashboard/boards/mobile-strategic-profile">
      <section className="ds-notebook-section py-12 text-center">
        <h1 className="font-display text-xl font-bold tracking-[-0.03em] text-zinc-950">Não foi possível abrir suas análises.</h1>
        <p className="mt-2 text-sm text-zinc-500">Sua informação continua salva. Tente carregar novamente.</p>
        <button type="button" onClick={reset} className="ds-button ds-button--secondary mt-5">
          Tentar novamente
        </button>
      </section>
    </ProfileSettingsPage>
  );
}
