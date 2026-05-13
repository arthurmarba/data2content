import type { PostCreationStrategicPlan } from "../../postCreationAdaptiveTypes";

type AdaptiveV2PlanPreviewProps = {
  plan: PostCreationStrategicPlan;
};

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <dt className="text-xs font-semibold uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-zinc-800">{value}</dd>
    </div>
  );
}

export function AdaptiveV2PlanPreview({ plan }: AdaptiveV2PlanPreviewProps) {
  const fiveW2HItems = [
    ["Quem", plan.fiveW2H.who],
    ["O que", plan.fiveW2H.what],
    ["Onde", plan.fiveW2H.where],
    ["Quando", plan.fiveW2H.when],
    ["Por que", plan.fiveW2H.why],
    ["Como", plan.fiveW2H.how],
    ["Esforço", plan.fiveW2H.howMuch],
  ] as const;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Plano estratégico</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Roteiro de decisão</h2>
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <Detail label="Pauta" value={plan.pauta} />
        <Detail label="Objetivo" value={plan.objective} />
        <Detail label="Narrativa" value={plan.narrative} />
        <Detail label="Formato" value={plan.format} />
        <Detail label="Gancho" value={plan.hook} />
        <Detail label="Convite" value={plan.cta} />
      </dl>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-zinc-950">5W2H resumido</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fiveW2HItems.map(([label, value]) =>
            value ? (
              <div key={label} className="rounded-lg bg-zinc-50 p-3">
                <dt className="text-xs font-semibold text-zinc-500">{label}</dt>
                <dd className="mt-1 text-sm leading-6 text-zinc-700">{value}</dd>
              </div>
            ) : null
          )}
        </dl>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-zinc-950">Cenas sugeridas</h3>
        <div className="mt-2 grid gap-2">
          {plan.scenes.map((scene) => (
            <article key={scene.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <h4 className="text-sm font-semibold text-zinc-950">{scene.title}</h4>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{scene.visual}</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{scene.message}</p>
              {scene.direction ? <p className="mt-1 text-sm leading-6 text-zinc-600">{scene.direction}</p> : null}
            </article>
          ))}
        </div>
      </div>

      {plan.brandMatch ? (
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <h3 className="text-sm font-semibold text-emerald-950">Encaixe com marca</h3>
          {plan.brandMatch.category ? (
            <p className="mt-1 text-sm leading-6 text-emerald-900">Categoria: {plan.brandMatch.category}</p>
          ) : null}
          {plan.brandMatch.angle ? (
            <p className="mt-1 text-sm leading-6 text-emerald-900">Direção: {plan.brandMatch.angle}</p>
          ) : null}
          {plan.brandMatch.desiredBrandSignals?.length ? (
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Sinais: {plan.brandMatch.desiredBrandSignals.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {plan.collabMatch ? (
        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
          <h3 className="text-sm font-semibold text-indigo-950">Encaixe com collab</h3>
          {plan.collabMatch.creatorProfile ? (
            <p className="mt-1 text-sm leading-6 text-indigo-900">Perfil: {plan.collabMatch.creatorProfile}</p>
          ) : null}
          {plan.collabMatch.collaborationAngle ? (
            <p className="mt-1 text-sm leading-6 text-indigo-900">
              Direção: {plan.collabMatch.collaborationAngle}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-zinc-950">Próximos passos</h3>
        <ol className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
          {plan.nextActions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
