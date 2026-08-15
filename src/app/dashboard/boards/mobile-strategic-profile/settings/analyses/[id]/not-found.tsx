import Link from "next/link";
import { ProfileSettingsPage } from "@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage";

export default function AnalysisNotFound() {
  return (
    <ProfileSettingsPage title="Análise de conteúdo" backHref="/dashboard/boards/mobile-strategic-profile/settings/analyses">
      <section className="ds-notebook-section py-12 text-center">
        <h1 className="font-display text-xl font-bold tracking-[-0.03em] text-zinc-950">Análise não encontrada.</h1>
        <p className="mt-2 text-sm text-zinc-500">Ela pode não pertencer a esta conta ou não estar mais disponível.</p>
        <Link href="/dashboard/boards/mobile-strategic-profile/settings/analyses" className="ds-button ds-button--secondary mt-5">
          Ver últimas análises
        </Link>
      </section>
    </ProfileSettingsPage>
  );
}
