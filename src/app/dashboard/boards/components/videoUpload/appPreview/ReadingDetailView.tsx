"use client";

import type { ReadingDetail, EvidenceAnchorsSpeechQuote, EvidenceAnchorsSceneAnchor, NarrativeCoherenceVerdict } from "./useReadingDetail";
import { ReadingDetailAccordion } from "./ReadingDetailAccordion";
import { DIAG_CARD_BODY } from "./diagnosticoTokens";
import {
  refineDiagnosticoCardText,
  refineDiagnosticoNextMove,
  refineDiagnosticoRememberedAs,
  refineDiagnosticoSignal,
} from "./diagnosticoDisplayText";

const QUOTE_ROLE_PT: Record<string, string> = {
  hook: "abertura",
  promise: "promessa",
  turning_point: "virada",
  closing: "encerramento",
  example: "exemplo",
  context: "contexto",
};

const MOMENT_ROLE_PT: Record<string, string> = {
  opening: "abertura",
  conflict: "conflito",
  turning_point: "virada",
  visual_signal: "sinal visual",
  pacing_signal: "ritmo",
  production_signal: "produção",
};

const VERDICT_LABEL: Record<NarrativeCoherenceVerdict, string> = {
  confirms_top_pattern: "Confirma o padrão",
  experiment: "Experimento",
  deviation: "Desvio",
  first_reading: "1ª leitura",
  unknown: "",
};

const VERDICT_STYLE: Record<NarrativeCoherenceVerdict, string> = {
  confirms_top_pattern: "bg-emerald-100 text-emerald-700",
  experiment:           "bg-indigo-100 text-indigo-700",
  deviation:            "bg-amber-100 text-amber-700",
  first_reading:        "bg-zinc-100 text-zinc-600",
  unknown:              "",
};

function SpeechQuoteBlock({ quote }: { quote: EvidenceAnchorsSpeechQuote }) {
  if (quote.source !== "creator_spoken") return null;
  const roleLabel = QUOTE_ROLE_PT[quote.quoteRole];
  return (
    <div className="rounded-[12px] border-l-2 border-zinc-200 bg-zinc-50 py-2.5 pl-3 pr-3">
      <p className="text-[13px] font-medium italic leading-[1.5] text-zinc-800">&quot;{quote.quote}&quot;</p>
      {roleLabel && (
        <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
          {roleLabel}
        </span>
      )}
      {quote.whyItMatters && (
        <p className="mt-1 text-[11px] leading-[1.45] text-zinc-400">{quote.whyItMatters}</p>
      )}
    </div>
  );
}

function SceneAnchorBlock({ anchor }: { anchor: EvidenceAnchorsSceneAnchor }) {
  const roleLabel = MOMENT_ROLE_PT[anchor.momentRole];
  return (
    <div className="rounded-[12px] bg-sky-50 px-3 py-2.5">
      <p className="text-[13px] leading-[1.5] text-zinc-700">{anchor.description}</p>
      {roleLabel && (
        <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-[0.08em] text-sky-400">
          {roleLabel}
        </span>
      )}
      {anchor.whyItMatters && (
        <p className="mt-1 text-[11px] leading-[1.45] text-sky-700/70">{anchor.whyItMatters}</p>
      )}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  const displayValue = refineDiagnosticoCardText(value, "generic", "");
  if (!displayValue.trim()) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-zinc-400 mb-1">{label}</p>
      <p className={DIAG_CARD_BODY}>{displayValue}</p>
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[12px] font-medium text-zinc-600">
      {text}
    </span>
  );
}

export function ReadingDetailView({
  data,
  onClose,
}: {
  data: ReadingDetail;
  onClose: () => void;
}) {
  const { videoReading: vr, speechReading: sr, productionReading: pr, commercialReading: cr, strategicRecommendation: rec, profileContribution: pc, evidenceAnchors: ea, narrativeCoherence: nc } = data;

  const spokenQuotes = (ea?.speechQuotes ?? []).filter((q) => q.source === "creator_spoken");
  const sceneAnchors = ea?.sceneAnchors ?? [];
  const intentAnchor = ea?.creatorIntentAnchor ?? null;
  const igAnchors = ea?.instagramAnchors ?? [];
  const alignedAssets = nc?.alignedAssets ?? [];
  const newAssets = nc?.newAssets ?? [];
  const hasEvidenceSection = spokenQuotes.length > 0 || sceneAnchors.length > 0 || intentAnchor != null || igAnchors.length > 0 || alignedAssets.length > 0 || newAssets.length > 0;
  const evidencePreview = sceneAnchors[0]?.description || spokenQuotes[0]?.quote || undefined;
  const showVerdict = nc != null && nc.verdict !== "unknown" && VERDICT_LABEL[nc.verdict];
  const rememberedAs = refineDiagnosticoRememberedAs(data.rememberedAs, vr.mainNarrative);
  const heroCopy = refineDiagnosticoSignal({
    label: vr.mainNarrative,
    summary: vr.whatVideoReveals || vr.summary,
  }, "narrative");
  const recommendationCopy = refineDiagnosticoNextMove({
    label: rec.mainAdjustment,
    description: rec.nextExperiment,
    reason: rec.successSignal,
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50 overflow-hidden">
      {/* Nav bar */}
      <div className="flex items-center gap-3 px-4 pt-safe-top pb-3 bg-zinc-50 border-b border-zinc-100 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-[14px] font-medium text-zinc-500 -ml-1 px-1 py-1"
          aria-label="Fechar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Voltar
        </button>
        <p className="flex-1 text-center text-[14px] font-semibold text-zinc-800 truncate pr-10">
          {rememberedAs}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
        {/* Hero summary */}
        {(vr.summary || vr.whatVideoReveals || vr.mainNarrative) && (
          <div className="mb-4 rounded-[20px] bg-white border border-zinc-100 shadow-[0_2px_10px_rgba(9,9,11,0.06)] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-zinc-400 mb-2">O que revelou</p>
            <p className="text-[15px] font-semibold text-zinc-900 leading-[1.4]">{heroCopy.summary}</p>
            {heroCopy.label && (
              <p className="mt-2 text-[13px] text-zinc-500 leading-[1.5]">{heroCopy.label}</p>
            )}
            {showVerdict && nc && (
              <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-zinc-100 pt-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${VERDICT_STYLE[nc.verdict]}`}>
                  {VERDICT_LABEL[nc.verdict]}
                </span>
                {nc.topPattern && (
                  <span className="text-[12px] text-zinc-400 leading-[1.6]">padrão: {nc.topPattern}</span>
                )}
                {nc.reasoning && (
                  <p className="w-full text-[12px] text-zinc-400 leading-[1.45] mt-0.5">{nc.reasoning}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Accordion sections */}
        <div className="rounded-[20px] bg-white border border-zinc-100 shadow-[0_2px_10px_rgba(9,9,11,0.06)] divide-y divide-zinc-50 px-4">

          {/* O que este vídeo sugere — open by default */}
          <ReadingDetailAccordion title="O que este vídeo sugere" defaultOpen>
            <FieldRow label="Ajuste principal" value={recommendationCopy.label} />
            <FieldRow label="Próximo passo" value={recommendationCopy.description} />
            <FieldRow label="Repita isso" value={heroCopy.label || rec.whatToRepeat} />
            <FieldRow label="Evite isso" value={rec.whatToAvoid} />
            {recommendationCopy.reason && (
              <div className="rounded-[12px] bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-emerald-700 mb-1">O que observar</p>
                <p className="text-[13px] text-emerald-800 leading-[1.5]">{recommendationCopy.reason}</p>
              </div>
            )}
          </ReadingDetailAccordion>

          {/* Contribuição ao Perfil — visible block, always expanded */}
          {(pc.profileImpactPreview || pc.reason) && (
            <div className="py-4 flex flex-col gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-zinc-400">Contribuição ao Perfil</p>
              {pc.profileImpactPreview && (
                <p className="text-[14px] font-semibold text-zinc-800 leading-[1.4]">
                  {refineDiagnosticoCardText(pc.profileImpactPreview, "narrative", "")}
                </p>
              )}
              {pc.reason && (
                <p className="text-[13px] text-zinc-500 leading-[1.5]">
                  {refineDiagnosticoCardText(pc.reason, "generic", "")}
                </p>
              )}
              {pc.confidence && (
                <span className="self-start inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
                  confiança {pc.confidence}
                </span>
              )}
            </div>
          )}

          {/* Evidências da leitura — closed */}
          {hasEvidenceSection && (
            <ReadingDetailAccordion title="O que a D2C observou" preview={evidencePreview}>
              {sceneAnchors.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[1px] text-zinc-400">Cenas observadas</p>
                  {sceneAnchors.map((anchor, i) => (
                    <SceneAnchorBlock key={i} anchor={anchor} />
                  ))}
                </div>
              )}
              {spokenQuotes.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[1px] text-zinc-400">O que você disse</p>
                  {spokenQuotes.map((q, i) => (
                    <SpeechQuoteBlock key={i} quote={q} />
                  ))}
                </div>
              )}
              {intentAnchor && (
                <div className="rounded-[12px] bg-orange-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[1px] text-orange-400 mb-1.5">Intenção vs. Leitura</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-400">Intenção declarada</p>
                  <p className="text-[13px] text-zinc-700 leading-[1.5] mt-0.5">{intentAnchor.statedGoal}</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-400">Leitura estratégica</p>
                  <p className="text-[13px] text-zinc-700 leading-[1.5] mt-0.5">{intentAnchor.interpretedGoal}</p>
                  {intentAnchor.whyItMatters && (
                    <p className="mt-2 text-[11px] text-orange-700/70 leading-[1.45]">{intentAnchor.whyItMatters}</p>
                  )}
                </div>
              )}
              {alignedAssets.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-zinc-400">Assets confirmados neste vídeo</p>
                  <div className="flex flex-wrap gap-1.5">
                    {alignedAssets.map((asset, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {newAssets.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-zinc-400">Novos sinais detectados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {newAssets.map((asset, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-[12px] font-medium text-indigo-600">
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {igAnchors.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[1px] text-zinc-400">Sinais do Instagram</p>
                  {igAnchors.map((anchor, i) => (
                    <div key={i} className="rounded-[12px] bg-sky-50 px-3 py-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-600">
                          ◉ Instagram
                        </span>
                        <p className="text-[12px] font-semibold text-zinc-700">{anchor.signalLabel}</p>
                      </div>
                      <p className="text-[12px] text-zinc-500 leading-[1.45]">{anchor.evidenceSummary}</p>
                      {anchor.whyItMatters && (
                        <p className="mt-1 text-[11px] text-sky-700/70 leading-[1.45]">{anchor.whyItMatters}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ReadingDetailAccordion>
          )}

          {/* Fala — closed by default; creator can open if they want execution detail */}
          <ReadingDetailAccordion title="Leitura de Fala">
            {sr.summary && <p className={`${DIAG_CARD_BODY} font-medium text-zinc-700`}>{sr.summary}</p>}
            <FieldRow label="Abertura" value={sr.openingRead} />
            <FieldRow label="Clareza" value={sr.clarityRead} />
            <FieldRow label="Ritmo" value={sr.pacingRead} />
          </ReadingDetailAccordion>

          {/* Sugestões de Fala — closed */}
          <ReadingDetailAccordion title="Sugestões de Fala" preview={sr.suggestedLine}>
            <FieldRow label="Linha sugerida" value={sr.suggestedLine} />
            <FieldRow label="Abertura sugerida" value={sr.suggestedOpening} />
            <FieldRow label="Encerramento sugerido" value={sr.suggestedClosing} />
          </ReadingDetailAccordion>

          {/* Produção — closed */}
          <ReadingDetailAccordion title="Leitura de Produção" preview={pr.summary}>
            {pr.summary && <p className={`${DIAG_CARD_BODY} font-medium text-zinc-700`}>{pr.summary}</p>}
            <FieldRow label="Enquadramento" value={pr.framing} />
            <FieldRow label="Luz" value={pr.lighting} />
            <FieldRow label="Áudio" value={pr.audio} />
            <FieldRow label="Ritmo de edição" value={pr.editingRhythm} />
            <FieldRow label="Primeiro frame" value={pr.firstFrame} />
            <FieldRow label="Clareza visual" value={pr.visualClarity} />
          </ReadingDetailAccordion>

          {/* Comercial — closed */}
          <ReadingDetailAccordion title="Leitura Comercial" preview={cr.summary}>
            {cr.summary && <p className={`${DIAG_CARD_BODY} font-medium text-zinc-700`}>{cr.summary}</p>}
            {cr.brandTerritories?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-zinc-400 mb-2">Territórios</p>
                <div className="flex flex-wrap gap-1.5">
                  {cr.brandTerritories.map((t) => (
                    <Chip key={t} text={refineDiagnosticoCardText(t, "commercial", "Território em observação")} />
                  ))}
                </div>
              </div>
            )}
            <FieldRow label="Por que marcas se interessariam" value={cr.whyItCouldFitBrands} />
            <FieldRow label="Adaptação para publi" value={cr.adAdaptationIdea} />
            <FieldRow label="Limitações" value={cr.limitations} />
          </ReadingDetailAccordion>

          {/* Contexto do vídeo — closed */}
          <ReadingDetailAccordion title="Contexto do Vídeo" preview={vr.creatorIntent}>
            <FieldRow label="Intenção do criador" value={vr.creatorIntent} />
            <FieldRow label="Insight dominante" value={vr.dominantInsight} />
          </ReadingDetailAccordion>

        </div>
      </div>
    </div>
  );
}
