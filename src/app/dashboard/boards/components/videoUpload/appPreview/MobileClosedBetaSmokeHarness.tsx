import { getMobileClosedBetaSmokeScenarios } from "../../../videoUpload/mobileClosedBetaSmokeScenarios";

export function MobileClosedBetaSmokeHarness() {
  const scenarios = getMobileClosedBetaSmokeScenarios();

  return (
    <section className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4" aria-label="MM91 smoke harness">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">MM91 smoke harness</p>
          <h2 className="text-base font-semibold text-zinc-950">Beta fechado</h2>
        </div>
        <p className="text-xs text-zinc-500">Preview interno admin/dev, sem upload real automático.</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <a
            key={scenario.id}
            href={scenario.href}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-xs transition hover:border-zinc-300"
          >
            <span className="block font-semibold text-zinc-950">{scenario.label}</span>
            <span className="mt-1 block text-zinc-500">{scenario.expected}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
