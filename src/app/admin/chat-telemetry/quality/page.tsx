"use client";

import React, { useEffect, useRef, useState } from "react";

import Drawer from "@/components/ui/Drawer";

type CategoryStat = {
  category: string;
  count: number;
  csatAvg: number | null;
  thumbsDown: number;
  thumbsUp: number;
  fixed: number;
  tickets: number;
  auto: number;
  manual: number;
};

type ScriptQualityOverview = {
  totalRuns: number;
  createRuns: number;
  adjustRuns: number;
  reviewAttempted: number;
  reviewRetried: number;
  acceptedAfterRetry: number;
  finalPassCount: number;
  finalFailCount: number;
  lowPerceivedQualityCount: number;
  reviewAttemptRate: number;
  retryRate: number;
  acceptanceAfterRetryRate: number;
  finalPassRate: number;
  avgInitialSemanticScore: number | null;
  avgFinalSemanticScore: number | null;
  avgPerceivedQualityScore: number | null;
};

type ScriptQualityIssue = {
  issue: string;
  count: number;
};

type ScriptQualitySource = {
  source: string;
  count: number;
  reviewAttempted: number;
  reviewRetried: number;
  acceptedAfterRetry: number;
  avgFinalSemanticScore: number | null;
  avgPerceivedQualityScore: number | null;
};

type ScriptQualityRecentCase = {
  id: string;
  createdAt: string;
  title: string;
  strategy: string;
  source: string;
  semanticReviewAcceptedAfterRetry: boolean;
  semanticFinalPasses: boolean | null;
  semanticInitialOverallScore: number | null;
  semanticFinalOverallScore: number | null;
  perceivedQualityScore: number | null;
  semanticRewriteBrief: string | null;
  semanticFinalIssues: string[];
};

type ScriptQualitySummary = {
  windowDays: number;
  from: string;
  overview: ScriptQualityOverview;
  sources: ScriptQualitySource[];
  topInitialIssues: ScriptQualityIssue[];
  topFinalIssues: ScriptQualityIssue[];
  recentCases: ScriptQualityRecentCase[];
};

type ScriptQualityCaseDiagnostics = {
  intelligenceEnabled?: boolean;
  promptMode?: string;
  resolvedCategories?: Record<string, string>;
  styleSimilarityScore?: number;
  linkedSampleSize?: number;
  linkedBlendApplied?: boolean;
  scriptEvidenceConfidence?: string;
  relaxationLevel?: number;
  usedFallbackRules?: boolean;
  adjustMode?: string;
  targetScope?: string;
  perceivedQualityScore?: number;
  hookStrength?: number;
  specificityScore?: number;
  speakabilityScore?: number;
  ctaStrength?: number;
  diversityScore?: number;
  utilityScore?: number;
  semanticReviewAttempted?: boolean;
  semanticReviewRetried?: boolean;
  semanticReviewAcceptedAfterRetry?: boolean;
  semanticInitialOverallScore?: number;
  semanticFinalOverallScore?: number;
  semanticInitialPasses?: boolean;
  semanticFinalPasses?: boolean;
  semanticInitialIssues?: string[];
  semanticFinalIssues?: string[];
  semanticRewriteBrief?: string;
  [key: string]: unknown;
};

type ScriptQualityCaseIntelligence = {
  intelligenceVersion?: string;
  promptMode?: string;
  explicitCategories?: Record<string, string>;
  resolvedCategories?: Record<string, string>;
  metricUsed?: string;
  lookbackDays?: number;
  styleProfileVersion?: string;
  styleSampleSize?: number;
  styleSignalsUsed?: string[];
  dnaEvidence?: {
    sampleSize?: number;
    hasEnoughEvidence?: boolean;
    avgInteractions?: number;
    relaxationLevel?: number;
    usedFallbackRules?: boolean;
  };
  linkedOutcomeSummary?: {
    enabled?: boolean;
    sampleSizeLinked?: number;
    confidence?: string;
    blendedApplied?: boolean;
    topDimensions?: Record<string, string[]>;
  };
  [key: string]: unknown;
};

type ScriptQualityCaseDetail = {
  id: string;
  createdAt: string | null;
  updatedAt: string | null;
  title: string;
  script: string;
  strategy: string;
  platform: string;
  source: string;
  prompt: string;
  requestId: string | null;
  scriptId: string | null;
  intelligenceSkippedForPartialAdjust: boolean;
  diagnostics: ScriptQualityCaseDiagnostics | null;
  intelligence: ScriptQualityCaseIntelligence | null;
  adminRecommendation: Record<string, unknown> | null;
};

function formatScore(value: number | null | undefined, digits = 2): string {
  return typeof value === "number" ? value.toFixed(digits) : "—";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("pt-BR");
}

function entriesFromRecord(record: Record<string, string> | null | undefined): Array<[string, string]> {
  if (!record) return [];
  return Object.entries(record).filter(([, value]) => typeof value === "string" && value.trim().length > 0);
}

export default function QualityPage() {
  const detailRequestToken = useRef(0);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [scriptsSummary, setScriptsSummary] = useState<ScriptQualitySummary | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<ScriptQualityCaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [chatRes, scriptsRes] = await Promise.all([
        fetch("/api/admin/chat/reviews/summary"),
        fetch("/api/admin/scripts/quality/summary"),
      ]);
      if (!chatRes.ok) throw new Error(`Erro ${chatRes.status}`);
      if (!scriptsRes.ok) throw new Error(`Erro ${scriptsRes.status}`);
      const [chatJson, scriptsJson] = await Promise.all([chatRes.json(), scriptsRes.json()]);
      setCategories(chatJson.categories || []);
      setScriptsSummary(scriptsJson || null);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar categorias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const closeCaseDetail = () => {
    detailRequestToken.current += 1;
    setSelectedCaseId(null);
    setSelectedCase(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  const openCaseDetail = async (caseId: string) => {
    detailRequestToken.current += 1;
    const requestToken = detailRequestToken.current;
    setSelectedCaseId(caseId);
    setSelectedCase(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/scripts/quality/cases/${caseId}`);
      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }
      const json = await response.json();
      if (detailRequestToken.current !== requestToken) return;
      setSelectedCase(json || null);
    } catch (e: any) {
      if (detailRequestToken.current !== requestToken) return;
      setDetailError(e?.message || "Falha ao carregar o caso");
      setSelectedCase(null);
    } finally {
      if (detailRequestToken.current !== requestToken) return;
      setDetailLoading(false);
    }
  };

  const overview = scriptsSummary?.overview;
  const kpis = overview
    ? [
        { label: "Runs", value: overview.totalRuns },
        { label: "Review", value: overview.reviewAttempted },
        { label: "Retries", value: overview.reviewRetried },
        { label: "Accepted retry", value: overview.acceptedAfterRetry },
        { label: "Pass rate", value: `${(overview.finalPassRate * 100).toFixed(0)}%` },
        {
          label: "Semantic score",
          value:
            overview.avgFinalSemanticScore !== null ? overview.avgFinalSemanticScore.toFixed(2) : "—",
        },
        {
          label: "Perceived quality",
          value:
            overview.avgPerceivedQualityScore !== null ? overview.avgPerceivedQualityScore.toFixed(3) : "—",
        },
        { label: "Low quality", value: overview.lowPerceivedQualityCount },
      ]
    : [];

  const detailDiagnostics = selectedCase?.diagnostics;
  const detailIntelligence = selectedCase?.intelligence;
  const explicitCategories = entriesFromRecord(detailIntelligence?.explicitCategories);
  const resolvedCategories = entriesFromRecord(
    detailIntelligence?.resolvedCategories || detailDiagnostics?.resolvedCategories || null
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quality</p>
          <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
        </div>
        <button
          onClick={load}
          className="text-xs font-semibold text-brand-primary rounded-lg border border-brand-primary/20 px-3 py-1 hover:bg-brand-primary/5"
        >
          Atualizar
        </button>
      </div>
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roteirista IA</p>
          <h2 className="text-xl font-bold text-slate-900">Resumo editorial</h2>
          {scriptsSummary ? (
            <p className="text-sm text-slate-500">
              Últimos {scriptsSummary.windowDays} dias desde{" "}
              {new Date(scriptsSummary.from).toLocaleDateString("pt-BR")}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
            </div>
          ))}
          {loading && !kpis.length ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
              Carregando resumo do roteirista...
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="overflow-auto rounded-2xl border border-slate-100 bg-white shadow-sm xl:col-span-1">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Por fluxo</h3>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3">Fluxo</th>
                  <th className="px-4 py-3">Runs</th>
                  <th className="px-4 py-3">Retries</th>
                  <th className="px-4 py-3">Score final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(scriptsSummary?.sources || []).map((row) => (
                  <tr key={row.source}>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.source}</td>
                    <td className="px-4 py-3">{row.count}</td>
                    <td className="px-4 py-3">{row.reviewRetried}</td>
                    <td className="px-4 py-3">{row.avgFinalSemanticScore?.toFixed?.(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-100 bg-white shadow-sm xl:col-span-1">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Issues iniciais</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {(scriptsSummary?.topInitialIssues || []).map((item) => (
                <div key={item.issue} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-700">{item.issue}</span>
                  <span className="font-semibold text-slate-900">{item.count}</span>
                </div>
              ))}
              {!scriptsSummary?.topInitialIssues?.length && !loading ? (
                <div className="px-4 py-3 text-sm text-slate-500">Sem issues mapeadas.</div>
              ) : null}
            </div>
          </div>

          <div className="overflow-auto rounded-2xl border border-slate-100 bg-white shadow-sm xl:col-span-1">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-semibold text-slate-900">Issues finais</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {(scriptsSummary?.topFinalIssues || []).map((item) => (
                <div key={item.issue} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-slate-700">{item.issue}</span>
                  <span className="font-semibold text-slate-900">{item.count}</span>
                </div>
              ))}
              {!scriptsSummary?.topFinalIssues?.length && !loading ? (
                <div className="px-4 py-3 text-sm text-slate-500">Sem issues finais recorrentes.</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="font-semibold text-slate-900">Casos recentes para revisão</h3>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Fluxo</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Semântico</th>
                <th className="px-4 py-3">Quality</th>
                <th className="px-4 py-3">Sinal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(scriptsSummary?.recentCases || []).map((item) => (
                <tr key={item.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">{item.strategy}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.title}</div>
                    {item.semanticRewriteBrief ? (
                      <div className="mt-1 text-xs text-slate-500">{item.semanticRewriteBrief}</div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openCaseDetail(item.id)}
                      className="mt-2 text-xs font-semibold text-brand-primary hover:underline"
                    >
                      Abrir detalhe
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {item.semanticInitialOverallScore !== null ? item.semanticInitialOverallScore.toFixed(1) : "—"}
                    {" → "}
                    {item.semanticFinalOverallScore !== null ? item.semanticFinalOverallScore.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3">{item.perceivedQualityScore?.toFixed?.(3) ?? "—"}</td>
                  <td className="px-4 py-3">
                    {item.semanticReviewAcceptedAfterRetry ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        retry aceito
                      </span>
                    ) : item.semanticFinalPasses === false ? (
                      <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                        ainda falhou
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                        baixa quality
                      </span>
                    )}
                    {item.semanticFinalIssues.length ? (
                      <div className="mt-2 text-xs text-slate-500">
                        {item.semanticFinalIssues.join(" • ")}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr><td className="px-4 py-3 text-slate-500" colSpan={6}>Carregando casos...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="overflow-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600 font-semibold">
            <tr>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Casos</th>
              <th className="px-4 py-3">Auto</th>
              <th className="px-4 py-3">Manual</th>
              <th className="px-4 py-3">CSAT médio</th>
              <th className="px-4 py-3">👎</th>
              <th className="px-4 py-3">👍</th>
              <th className="px-4 py-3">Fixed</th>
              <th className="px-4 py-3">Tickets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categories.map((c) => (
              <tr key={c.category} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800">{c.category}</td>
                <td className="px-4 py-3">{c.count}</td>
                <td className="px-4 py-3">{c.auto}</td>
                <td className="px-4 py-3">{c.manual}</td>
                <td className="px-4 py-3">{c.csatAvg?.toFixed?.(2) ?? "—"}</td>
                <td className="px-4 py-3">{c.thumbsDown}</td>
                <td className="px-4 py-3">{c.thumbsUp}</td>
                <td className="px-4 py-3">{c.fixed}</td>
                <td className="px-4 py-3">{c.tickets}</td>
              </tr>
            ))}
            {loading ? (
              <tr><td className="px-4 py-3 text-slate-500" colSpan={9}>Carregando...</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(selectedCaseId)}
        title={selectedCase?.title || "Detalhe do roteiro"}
        onClose={closeCaseDetail}
      >
        {detailLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Carregando detalhe do caso...
          </div>
        ) : detailError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {detailError}
          </div>
        ) : selectedCase ? (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contexto</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">Criado em:</span>{" "}
                    {formatDateTime(selectedCase.createdAt)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Atualizado em:</span>{" "}
                    {formatDateTime(selectedCase.updatedAt)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Fluxo:</span> {selectedCase.strategy}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Source:</span> {selectedCase.source}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Plataforma:</span> {selectedCase.platform}
                  </div>
                  {selectedCase.requestId ? (
                    <div>
                      <span className="font-semibold text-slate-900">Request id:</span> {selectedCase.requestId}
                    </div>
                  ) : null}
                  {selectedCase.scriptId ? (
                    <div>
                      <span className="font-semibold text-slate-900">Script id:</span> {selectedCase.scriptId}
                    </div>
                  ) : null}
                  {selectedCase.intelligenceSkippedForPartialAdjust ? (
                    <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
                      Ajuste parcial salvo com inteligência pulada.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review editorial</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semântico</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {formatScore(detailDiagnostics?.semanticInitialOverallScore, 1)} {" → "}{" "}
                      {formatScore(detailDiagnostics?.semanticFinalOverallScore, 1)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perceived</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {formatScore(detailDiagnostics?.perceivedQualityScore, 3)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retry</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {detailDiagnostics?.semanticReviewRetried ? "Sim" : "Não"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Passou</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {detailDiagnostics?.semanticFinalPasses === true
                        ? "Sim"
                        : detailDiagnostics?.semanticFinalPasses === false
                          ? "Não"
                          : "—"}
                    </div>
                  </div>
                </div>
                {detailDiagnostics?.semanticRewriteBrief ? (
                  <div className="mt-3 rounded-xl bg-brand-primary/5 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Rewrite brief:</span>{" "}
                    {detailDiagnostics.semanticRewriteBrief}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issues</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Iniciais</h3>
                  {detailDiagnostics?.semanticInitialIssues?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {detailDiagnostics.semanticInitialIssues.map((issue) => (
                        <span
                          key={`initial-${issue}`}
                          className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Sem issues iniciais registradas.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Finais</h3>
                  {detailDiagnostics?.semanticFinalIssues?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {detailDiagnostics.semanticFinalIssues.map((issue) => (
                        <span
                          key={`final-${issue}`}
                          className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800"
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">Sem issues finais registradas.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt</p>
              <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                {selectedCase.prompt || "Prompt não disponível."}
              </pre>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sinais técnicos</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div>
                    <span className="font-semibold text-slate-900">Hook:</span>{" "}
                    {formatScore(detailDiagnostics?.hookStrength, 2)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Specificity:</span>{" "}
                    {formatScore(detailDiagnostics?.specificityScore, 2)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Speakability:</span>{" "}
                    {formatScore(detailDiagnostics?.speakabilityScore, 2)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">CTA:</span>{" "}
                    {formatScore(detailDiagnostics?.ctaStrength, 2)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Diversity:</span>{" "}
                    {formatScore(detailDiagnostics?.diversityScore, 2)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Utility:</span>{" "}
                    {formatScore(detailDiagnostics?.utilityScore, 2)}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div>
                    <span className="font-semibold text-slate-900">Prompt mode:</span>{" "}
                    {detailDiagnostics?.promptMode || detailIntelligence?.promptMode || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Adjust mode:</span>{" "}
                    {detailDiagnostics?.adjustMode || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Target scope:</span>{" "}
                    {detailDiagnostics?.targetScope || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Style similarity:</span>{" "}
                    {formatScore(detailDiagnostics?.styleSimilarityScore, 3)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">Confidence:</span>{" "}
                    {typeof detailDiagnostics?.scriptEvidenceConfidence === "string"
                      ? detailDiagnostics.scriptEvidenceConfidence
                      : "—"}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inteligência</p>
              {detailIntelligence ? (
                <div className="mt-3 space-y-4 text-sm text-slate-700">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div>
                        <span className="font-semibold text-slate-900">Versão:</span>{" "}
                        {detailIntelligence.intelligenceVersion || "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Métrica:</span>{" "}
                        {detailIntelligence.metricUsed || "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Lookback:</span>{" "}
                        {detailIntelligence.lookbackDays ?? "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Style sample:</span>{" "}
                        {detailIntelligence.styleSampleSize ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div>
                        <span className="font-semibold text-slate-900">DNA sample:</span>{" "}
                        {detailIntelligence.dnaEvidence?.sampleSize ?? "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">DNA suficiente:</span>{" "}
                        {detailIntelligence.dnaEvidence?.hasEnoughEvidence === true
                          ? "Sim"
                          : detailIntelligence.dnaEvidence?.hasEnoughEvidence === false
                            ? "Não"
                            : "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Relaxation:</span>{" "}
                        {detailIntelligence.dnaEvidence?.relaxationLevel ?? "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Fallback rules:</span>{" "}
                        {detailIntelligence.dnaEvidence?.usedFallbackRules === true
                          ? "Sim"
                          : detailIntelligence.dnaEvidence?.usedFallbackRules === false
                            ? "Não"
                            : "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Linked sample:</span>{" "}
                        {detailIntelligence.linkedOutcomeSummary?.sampleSizeLinked ?? "—"}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900">Linked confidence:</span>{" "}
                        {detailIntelligence.linkedOutcomeSummary?.confidence || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">Categorias explícitas</h3>
                      {explicitCategories.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {explicitCategories.map(([key, value]) => (
                            <span
                              key={`explicit-${key}`}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                            >
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-slate-500">Sem categorias explícitas.</p>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Categorias resolvidas</h3>
                      {resolvedCategories.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {resolvedCategories.map(([key, value]) => (
                            <span
                              key={`resolved-${key}`}
                              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
                            >
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-slate-500">Sem categorias resolvidas.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Snapshot de inteligência não disponível neste caso.</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roteiro salvo</p>
              <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                {selectedCase.script}
              </pre>
            </section>

            <details className="rounded-2xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">JSON bruto</summary>
              <pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                {JSON.stringify(
                  {
                    diagnostics: selectedCase.diagnostics,
                    intelligence: selectedCase.intelligence,
                    adminRecommendation: selectedCase.adminRecommendation,
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Nenhum caso selecionado.
          </div>
        )}
      </Drawer>
    </div>
  );
}
