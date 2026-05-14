import type { NarrativeAsset } from "../../narrativeSource/narrativeSourceTypes";

type NarrativeAssetsPreviewProps = {
  assets: NarrativeAsset[];
  summary: string;
  suggestedNextStep: string;
};

function groupAssetsByType(assets: NarrativeAsset[]) {
  return assets.reduce<Record<string, NarrativeAsset[]>>((groups, asset) => {
    groups[asset.type] = [...(groups[asset.type] || []), asset];
    return groups;
  }, {});
}

export function NarrativeAssetsPreview({ assets, summary, suggestedNextStep }: NarrativeAssetsPreviewProps) {
  const groupedAssets = groupAssetsByType(assets);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Assets narrativos</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Material extraído da fonte</h2>
      </div>

      <div className="mt-4 rounded-lg bg-zinc-50 p-3">
        <p className="text-sm leading-6 text-zinc-800">{summary}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{suggestedNextStep}</p>
      </div>

      <div className="mt-4 grid gap-3">
        {Object.entries(groupedAssets).map(([type, typeAssets]) => (
          <article key={type} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
            <h3 className="text-sm font-semibold text-zinc-950">{type}</h3>
            <ul className="mt-2 space-y-2">
              {typeAssets.map((asset) => (
                <li key={asset.id} className="text-sm leading-6 text-zinc-700">
                  <span className="font-medium text-zinc-900">{asset.value}</span>
                  {asset.evidence ? <span className="block text-zinc-600">{asset.evidence}</span> : null}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
