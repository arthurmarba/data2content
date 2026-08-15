import { ProfileSettingsPage } from "@/app/dashboard/boards/components/videoUpload/appPreview/ProfileSettingsPage";

export default function ContentAnalysisHistoryLoading() {
  return (
    <ProfileSettingsPage title="Últimas análises" backHref="/dashboard/boards/mobile-strategic-profile">
      <div className="animate-pulse">
        <section className="ds-notebook-section">
        <div className="h-3 w-24 rounded bg-zinc-100" />
        <div className="mt-4 h-16 w-64 rounded-xl bg-zinc-100" />
        </section>
        <section className="ds-notebook-section space-y-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-[104px] rounded-lg bg-zinc-100" />)}
        </section>
      </div>
    </ProfileSettingsPage>
  );
}
