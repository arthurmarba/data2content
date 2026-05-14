import type { PostCreationStrategicPlan } from "../../postCreationAdaptiveTypes";

type NarrativeSourcePlanPreviewProps = {
  plan?: PostCreationStrategicPlan | null;
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

export function NarrativeSourcePlanPreview({ plan = null }: NarrativeSourcePlanPreviewProps) {
  if (!plan) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase text-zinc-500">Plano gerado</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Plano ainda não gerado nesta prévia.</h2>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Plano gerado</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Leitura adaptativa final</h2>
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <Detail label="Pauta" value={plan.pauta} />
        <Detail label="Objetivo" value={plan.objective} />
        <Detail label="Narrativa" value={plan.narrative} />
        <Detail label="Formato" value={plan.format} />
        <Detail label="Gancho" value={plan.hook} />
        <Detail label="Convite" value={plan.cta} />
      </dl>

      {plan.brandMatch ? (
        <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <h3 className="text-sm font-semibold text-emerald-950">Encaixe com marca</h3>
          {plan.brandMatch.category ? (
            <p className="mt-1 text-sm leading-6 text-emerald-900">Categoria: {plan.brandMatch.category}</p>
          ) : null}
          {plan.brandMatch.angle ? (
            <p className="mt-1 text-sm leading-6 text-emerald-900">Direção: {plan.brandMatch.angle}</p>
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
