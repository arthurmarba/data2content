"use client";

import React, { useEffect, useState } from "react";

type SessionRow = {
  id: string;
  startedAt: string;
  endedAt?: string | null;
  durationMs: number;
  csat: number | null;
  csatComment?: string | null;
  fallbackCount: number;
  thumbsDown: number;
  thumbsUp: number;
  promptVariant?: string | null;
  experimentId?: string | null;
  modelVersion?: string | null;
  ragEnabled?: boolean | null;
  contextSourcesUsed?: string[];
};

type SessionDetail = {
  session: {
    id: string;
    startedAt: string;
    endedAt?: string | null;
    promptVariant?: string | null;
    experimentId?: string | null;
    modelVersion?: string | null;
    ragEnabled?: boolean | null;
    contextSourcesUsed?: string[];
    csat?: number | null;
    csatComment?: string | null;
    review?: {
      status: string;
      category?: string | null;
      severity?: number | null;
      note?: string | null;
      suggestedAction?: string | null;
      ticketUrl?: string | null;
      isAuto?: boolean | null;
      autoReason?: string | null;
      fixedAt?: string | null;
    } | null;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    intent?: string | null;
    confidence?: number | null;
    fallbackReason?: string | null;
    hadFallback?: boolean;
    rating?: string | null;
    contextSourcesUsed?: string[];
    promptVariant?: string | null;
    modelVersion?: string | null;
    createdAt: string;
  }>;
};

export default function ChatSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selected, setSelected] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ status: "new", category: "", severity: 2, note: "", suggestedAction: "", ticketUrl: "" });

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chat/sessions?filter=bad&limit=50");
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
      setSessions(json.sessions || []);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar sessões");
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setDetailError(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/admin/chat/sessions/${id}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const json = await res.json();
    setSelected(json);
    if (json?.session?.review) {
      setReviewForm({
        status: json.session.review.status || "new",
        category: json.session.review.category || "",
        severity: json.session.review.severity || 2,
        note: json.session.review.note || "",
        suggestedAction: json.session.review.suggestedAction || "",
        ticketUrl: json.session.review.ticketUrl || "",
      });
    } else {
        setReviewForm({ status: "new", category: "", severity: 2, note: "", suggestedAction: "", ticketUrl: "" });
    }
  } catch (e: any) {
    setDetailError(e?.message || "Falha ao carregar sessão");
  }
};

  useEffect(() => {
    loadSessions();
  }, []);

  const saveReview = async () => {
    if (!selected?.session?.id) return;
    setSavingReview(true);
    try {
      const res = await fetch("/api/admin/chat/reviews/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: selected.session.id, ...reviewForm }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      await loadDetail(selected.session.id);
    } catch (e) {
      setDetailError((e as any)?.message || "Falha ao salvar review");
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Bad Sessions</h2>
          <button
            onClick={loadSessions}
            className="text-xs font-semibold text-brand-primary rounded-lg border border-brand-primary/20 px-3 py-1 hover:bg-brand-primary/5"
          >
            Atualizar
          </button>
        </div>
        {error ? <div className="text-sm text-rose-600">{error}</div> : null}
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-100 bg-white shadow-sm divide-y">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadDetail(s.id)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>{new Date(s.startedAt).toLocaleString()}</span>
                <span className="text-xs text-slate-500">{(s.durationMs / 60000).toFixed(1)} min</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                {s.csat !== null ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">CSAT {s.csat}</span> : null}
                {s.fallbackCount ? <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">Fallback {s.fallbackCount}</span> : null}
                {s.thumbsDown ? <span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700">👎 {s.thumbsDown}</span> : null}
                {s.promptVariant ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{s.promptVariant}</span> : null}
                {s.modelVersion ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{s.modelVersion}</span> : null}
                {s.ragEnabled !== null ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">RAG {s.ragEnabled ? 'on' : 'off'}</span> : null}
              </div>
            </button>
          ))}
          {loading ? <p className="p-3 text-sm text-slate-500">Carregando...</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 min-h-[70vh]">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Session Viewer</h2>
        {detailError ? <div className="text-sm text-rose-600">{detailError}</div> : null}
        {!selected ? <p className="text-sm text-slate-500">Selecione uma sessão para ver detalhes.</p> : null}
        {selected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
              <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{new Date(selected.session.startedAt).toLocaleString()}</span>
              {selected.session.promptVariant ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{selected.session.promptVariant}</span> : null}
              {selected.session.modelVersion ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{selected.session.modelVersion}</span> : null}
              {selected.session.ragEnabled !== null ? <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">RAG {selected.session.ragEnabled ? 'on' : 'off'}</span> : null}
              {selected.session.csat !== null ? <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">CSAT {selected.session.csat}</span> : null}
            </div>
            {selected.session.csatComment ? <p className="text-xs text-slate-600">Comentário: {selected.session.csatComment}</p> : null}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-700 font-semibold">
                <span>Review</span>
                {selected.session.review?.isAuto ? (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 font-semibold">Auto</span>
                ) : selected.session.review ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 font-semibold">Manual</span>
                ) : null}
                {selected.session.review?.autoReason ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{selected.session.review.autoReason}</span>
                ) : null}
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  value={reviewForm.status}
                  onChange={(e) => setReviewForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="new">new</option>
                  <option value="reviewed">reviewed</option>
                  <option value="fixed">fixed</option>
                  <option value="ignored">ignored</option>
                </select>
              <select
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                value={reviewForm.category}
                onChange={(e) => setReviewForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">Categoria</option>
                <option value="resposta_generica">Resposta genérica</option>
                <option value="resposta_errada">Resposta errada</option>
                <option value="nao_usou_contexto">Não usou contexto</option>
                <option value="confuso">Confuso/difícil</option>
                <option value="muito_longo">Muito longo</option>
                <option value="raso">Raso/curto</option>
                <option value="lento">Lento</option>
                <option value="outros">Outros</option>
                <option value="rag_errado">RAG incorreto</option>
                <option value="perguntou_demais">Perguntou demais</option>
                <option value="safety">Safety/recusa</option>
                <option value="bug">Bug/erro</option>
              </select>
                <select
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  value={reviewForm.severity}
                  onChange={(e) => setReviewForm((f) => ({ ...f, severity: Number(e.target.value) }))}
                >
                  <option value={1}>Sev 1</option>
                  <option value={2}>Sev 2</option>
                  <option value={3}>Sev 3</option>
                </select>
              </div>
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="Nota interna"
                value={reviewForm.note}
                onChange={(e) => setReviewForm((f) => ({ ...f, note: e.target.value }))}
              />
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="Ação sugerida"
                value={reviewForm.suggestedAction}
                onChange={(e) => setReviewForm((f) => ({ ...f, suggestedAction: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="URL do ticket (Jira/Linear/GitHub)"
                value={reviewForm.ticketUrl}
                onChange={(e) => setReviewForm((f) => ({ ...f, ticketUrl: e.target.value }))}
              />
              <button
                type="button"
                onClick={saveReview}
                disabled={savingReview}
                className="rounded-lg bg-brand-primary text-white px-3 py-2 text-sm font-semibold hover:bg-brand-primary-dark disabled:opacity-60"
              >
                {savingReview ? "Salvando..." : "Salvar review"}
              </button>
              {selected.session.review?.fixedAt ? (
                <p className="text-[11px] text-slate-500">Marcado como fixed em {new Date(selected.session.review.fixedAt).toLocaleString()}</p>
              ) : null}
            </div>
            <div className="max-h-[60vh] overflow-auto space-y-3">
              {selected.messages.map((m) => (
                <div key={m.id} className={`rounded-xl border px-3 py-2 ${m.role === 'assistant' ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold">{m.role}</span>
                    {m.intent ? <span className="rounded-full bg-slate-100 px-2 py-0.5">{m.intent}</span> : null}
                    {typeof m.confidence === 'number' ? <span className="rounded-full bg-slate-100 px-2 py-0.5">conf {m.confidence.toFixed(2)}</span> : null}
                    {m.fallbackReason ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">fallback: {m.fallbackReason}</span> : null}
                    {m.rating === 'down' ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">👎</span> : null}
                    {m.rating === 'up' ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">👍</span> : null}
                    {m.contextSourcesUsed?.length ? <span className="rounded-full bg-slate-100 px-2 py-0.5">ctx: {m.contextSourcesUsed.join(', ')}</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{m.content}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{new Date(m.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
