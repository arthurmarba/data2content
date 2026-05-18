import { VideoNarrativeAppPreview } from "../components/videoUpload/VideoNarrativeAppPreview";
import { VideoNarrativeInteractiveAppPreview } from "../components/videoUpload/VideoNarrativeInteractiveAppPreview";
import { buildVideoNarrativeAppPreviewScenario } from "../components/videoUpload/buildVideoNarrativeAppPreviewScenario";
import {
  canAccessInternalPreview,
  getCurrentInternalPreviewUser,
  type InternalPreviewUser,
} from "../internalPreviewAccess";
import { isVideoNarrativeAppPreviewEnabled } from "../videoUpload/videoNarrativeAppPreviewFeatureFlag";

type VideoNarrativeAppPreviewPageProps = {
  searchParams?: {
    scenario?: string | string[];
    stage?: string | string[];
    access?: string | string[];
    instagram?: string | string[];
    mode?: string | string[];
  };
  viewer?: InternalPreviewUser | null;
};

function BlockedInternalPreview({ reason }: { reason: "flag" | "permission" }) {
  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase text-zinc-500">Preview interno bloqueado</p>
        <h1 className="mt-2 text-2xl font-semibold">Análise Guiada de Vídeo</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          {reason === "flag"
            ? "Preview bloqueado por flag. Ative NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED=1 para visualizar esta rota."
            : "Preview interno restrito a usuários admin/dev."}
        </p>
      </section>
    </main>
  );
}

export default async function VideoNarrativeAppPreviewPage({
  searchParams,
  viewer,
}: VideoNarrativeAppPreviewPageProps = {}) {
  if (!isVideoNarrativeAppPreviewEnabled()) {
    return <BlockedInternalPreview reason="flag" />;
  }

  const currentUser = viewer === undefined ? await getCurrentInternalPreviewUser() : viewer;
  if (!canAccessInternalPreview(currentUser)) {
    return <BlockedInternalPreview reason="permission" />;
  }

  const preview = buildVideoNarrativeAppPreviewScenario(searchParams);
  const mode = Array.isArray(searchParams?.mode) ? searchParams?.mode[0] : searchParams?.mode;
  if (mode === "interactive") {
    return <VideoNarrativeInteractiveAppPreview scenarioData={preview} />;
  }

  return <VideoNarrativeAppPreview preview={preview} />;
}
