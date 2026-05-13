import { AdaptiveV2Preview } from "../components/adaptiveV2";
import {
  adaptiveV2PreviewAnswerKeyFixture,
  adaptiveV2PreviewAnswersFixture,
  adaptiveV2PreviewDetectionFixture,
  adaptiveV2PreviewPlanFixture,
  adaptiveV2PreviewQuestionsFixture,
} from "../components/adaptiveV2/adaptiveV2PreviewFixture";
import { isPostCreationAdaptiveEnvEnabled } from "../postCreationAdaptiveFeatureFlag";

export default function AdaptiveV2PreviewPage() {
  const isEnabled = isPostCreationAdaptiveEnvEnabled();

  if (!isEnabled) {
    return (
      <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
        <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna bloqueada</p>
          <h1 className="mt-2 text-2xl font-semibold">Preview interno — Board Adaptativo V2</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Esta tela usa dados fixture e permanece bloqueada enquanto a flag interna da experiência adaptativa estiver
            desligada.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-zinc-500">Prévia interna</p>
          <h1 className="mt-2 text-2xl font-semibold">Preview interno — Board Adaptativo V2</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Esta tela usa dados fixture e não está conectada ao fluxo real.
          </p>
        </header>

        <AdaptiveV2Preview
          detection={adaptiveV2PreviewDetectionFixture}
          questions={adaptiveV2PreviewQuestionsFixture}
          answers={adaptiveV2PreviewAnswersFixture}
          answerKey={adaptiveV2PreviewAnswerKeyFixture}
          plan={adaptiveV2PreviewPlanFixture}
        />
      </div>
    </main>
  );
}
