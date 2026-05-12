"use client";

import { Sparkles, Info } from "lucide-react";
import type { CreatorNarrativeMap, CreatorNarrativeAsset, NarrativeAssetType } from "../narrativeAssets/postCreationNarrativeAssets";

type PostCreationNarrativeMapCardProps = {
  narrativeMap: CreatorNarrativeMap | null | undefined;
};

const ASSET_GROUP_LABELS: Partial<Record<NarrativeAssetType, string>> = {
  theme: "Temas fortes",
  language: "Linguagem",
  scenario: "Cenários",
  commercial_proof: "Prova comercial",
  tension: "Tensões narrativas",
  narrative_limit: "Limites narrativos",
};

const ALLOWED_ASSET_TYPES = new Set<NarrativeAssetType>([
  "theme",
  "language",
  "scenario",
  "commercial_proof",
  "tension",
  "narrative_limit",
]);

const MAX_ASSETS_PER_GROUP = 3;

const PROHIBITED_TERMS = [
  "comprovado",
  "garantido",
  "certeza",
  "sua narrativa e",
  "sua identidade e",
];

const normalizeForSafetyCheck = (value: string): string => {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const isStatementSafe = (statement: string): boolean => {
  const normalized = normalizeForSafetyCheck(statement);
  return !PROHIBITED_TERMS.some((term) => normalized.includes(term));
};

export default function PostCreationNarrativeMapCard({ narrativeMap }: PostCreationNarrativeMapCardProps) {
  if (!narrativeMap) return null;

  const { assets = [], centralNarrative } = narrativeMap;

  const safeCentralNarrative = centralNarrative
    && (centralNarrative.status === "suggested" || centralNarrative.status === "confirmed")
    && centralNarrative.statement
    && isStatementSafe(centralNarrative.statement)
    ? centralNarrative
    : null;

  // Filter safe and visible assets
  const safeAssets = assets.filter((asset) => {
    if (!asset.type || !ALLOWED_ASSET_TYPES.has(asset.type)) return false;
    if (asset.isSensitive) return false;
    if (asset.status !== "suggested" && asset.status !== "confirmed") return false;
    return true;
  });

  const hasVisibleAssets = safeAssets.length > 0;

  if (!hasVisibleAssets && !safeCentralNarrative) return null;

  // Group assets
  const groupedAssets = safeAssets.reduce((acc, asset) => {
    const type = asset.type!;
    if (!acc[type]) acc[type] = [];
    if (acc[type]!.length < MAX_ASSETS_PER_GROUP) {
      acc[type]!.push(asset);
    }
    return acc;
  }, {} as Partial<Record<NarrativeAssetType, CreatorNarrativeAsset[]>>);

  const finalHasVisibleAssets = Object.keys(groupedAssets).length > 0;

  if (!finalHasVisibleAssets && !safeCentralNarrative) return null;

  return (
    <section className="w-full rounded-[28px] border border-zinc-200/80 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-950 text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
          DNA narrativo sugerido
        </h3>
      </div>

      {safeCentralNarrative && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-400">
            Parece que sua narrativa caminha para:
          </p>
          <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-zinc-950 leading-relaxed">
            {safeCentralNarrative.statement}
          </p>
          {safeCentralNarrative.confidence && (
            <p className="mt-2 text-[11px] font-medium text-zinc-400">
              {safeCentralNarrative.confidence === "high" && "Baseado em sinais recorrentes do seu conteúdo"}
              {safeCentralNarrative.confidence === "medium" && "Confiança da leitura: média"}
              {safeCentralNarrative.confidence === "low" && "Hipótese baseada em sinais iniciais"}
            </p>
          )}
        </div>
      )}

      {finalHasVisibleAssets && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(Object.keys(groupedAssets) as NarrativeAssetType[]).map((type) => {
            const groupAssets = groupedAssets[type]!;
            return (
              <div key={type} className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  {ASSET_GROUP_LABELS[type]}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {groupAssets.map((asset) => (
                    <span
                      key={asset.id}
                      className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                    >
                      {asset.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex gap-3 rounded-2xl bg-zinc-50 p-3.5 border border-zinc-100">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <p className="text-[11px] leading-5 text-zinc-500">
          Isto é uma hipótese estratégica criada a partir dos seus sinais de conteúdo. Você poderá confirmar, editar ou rejeitar isso em uma próxima etapa.
        </p>
      </div>
    </section>
  );
}
