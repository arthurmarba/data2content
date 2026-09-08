"use client";

import { useEffect, useState } from "react";
import type { CampaignOpportunity } from "@/app/lib/campaignRadar/types";
import type { ManualIntake } from "@/app/lib/campaignRadar/intake";

type Decision = "pending" | "internal" | "approved" | "rejected" | "recheck";
type Candidate = { _id: string; opportunity: CampaignOpportunity; revision: number; decision: Decision;
  originalOpportunity?: CampaignOpportunity; previousOpportunity?: CampaignOpportunity;
  intake: string; sightings: number; possibleDuplicates: number; distributionAllowed: boolean;
  history: Array<{ actor: string; action: string; at: string; note: string }> };
type Source = { sourceId: string; name: string; blockedReason: string | null; evidence: string; distribution: string };
type Inbox = { items: Candidate[]; total: number; hasMore: boolean; counts: Array<{ _id: Decision; count: number }>; sources: Source[];
  runs: Array<{ day: string; status: string; processed: number; apiCost: number; sources: Array<{ sourcePlatform: string; warnings: string[] }>; error: string | null }> };
const labels: Record<Decision, string> = { pending: "Para revisar", internal: "Somente interno", approved: "Publicadas", rejected: "Rejeitadas", recheck: "Verificar novamente" };
const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
const buttonClass = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";

async function api(url: string, method = "GET", body?: unknown) {
  const response = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
  return result;
}

export default function RadarAdmin() {
  const [data, setData] = useState<Inbox | null>(null);
  const [filter, setFilter] = useState<Decision | "all">("pending");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [formVersion, setFormVersion] = useState(0);

  async function refresh() {
    const next = await api(`/api/admin/campaign-radar?decision=${filter}&page=${page}`);
    setData(next);
  }
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    api(`/api/admin/campaign-radar?decision=${filter}&page=${page}`)
      .then((result) => { if (active) setData(result); })
      .catch((cause) => { if (active) { setError(cause.message); setData(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, page]);

  async function perform(work: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await work(); await refresh(); setMessage(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha inesperada."); }
    finally { setBusy(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const str = (key: string) => String(form.get(key) ?? "").trim();
    const lines = (key: string) => str(key).split("\n").map((line) => line.trim()).filter(Boolean);
    const amount = (key: string) => str(key) === "" ? null : Number(str(key));
    const input = { sourceId: str("sourceId"), title: str("title"), text: str("text"), sourceUrl: str("sourceUrl"), applicationUrl: str("applicationUrl"),
      brand: str("brand"), applicationDeadline: str("applicationDeadline"), requirements: lines("requirements"), deliverables: lines("deliverables"),
      opportunityType: str("opportunityType"), compensationType: str("compensationType"), compensationMinimum: amount("compensationMinimum"),
      compensationMaximum: amount("compensationMaximum"), compensationBasis: str("compensationBasis"), compensationText: str("compensationText"),
      compensationConfirmed: form.has("compensationConfirmed"), requiresAccount: form.has("requiresAccount"),
    } as ManualIntake;
    await perform(async () => {
      if (editing) await api(`/api/admin/campaign-radar/${editing._id}`, "PATCH", { action: "edit", revision: editing.revision, input });
      else await api("/api/admin/campaign-radar", "POST", input);
      setEditing(null); setFormVersion((value) => value + 1);
    }, "Registro salvo para revisão. Reenvios idênticos são reunidos no mesmo registro.");
  }

  const current = editing?.opportunity;
  return <div className="mx-auto max-w-6xl space-y-7 text-gray-900">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Oportunidades · Administração</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Radar de campanhas</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">Junte suas descobertas, confira as condições e decida o que pode chegar aos criadores.</p></div>
      <label className={`${buttonClass} cursor-pointer`}>Importar lote JSON
        <input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={async (event) => {
          const file = event.target.files?.[0]; event.target.value = "";
          if (!file) return;
          await perform(async () => {
            if (file.size > 2_000_000) throw new Error("O lote deve ter até 2 MB.");
            await api("/api/admin/campaign-radar/import", "POST", JSON.parse(await file.text()));
          }, "Lote recebido. Todas as entradas passam por revisão nesta caixa.");
        }} /></label>
    </header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    <section aria-label="Resumo" className="flex flex-wrap gap-x-8 gap-y-3 border-y border-gray-200 py-4">
      {Object.entries(labels).map(([key, label]) => <button key={key} className="text-left" onClick={() => { setFilter(key as Decision); setPage(1); }}>
        <span className="block text-2xl font-semibold">{data?.counts.find((item) => item._id === key)?.count ?? "—"}</span>
        <span className="text-xs text-gray-600">{label}</span></button>)}
    </section>

    <details id="radar-capture" className="rounded-xl border border-gray-200 bg-white p-5" open={editing ? true : undefined}>
      <summary className="cursor-pointer font-semibold">{editing ? "Editar oportunidade" : "Adicionar oportunidade manual"}</summary>
      <form key={`${editing?._id ?? "new"}:${formVersion}`} onSubmit={save} className="mt-5 space-y-4">
        <p className="text-sm text-gray-500">Cole as informações que você encontrou. Deixe valores e prazos em branco quando não estiverem confirmados.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Fonte<select name="sourceId" className={inputClass} defaultValue={current?.sourceId ?? "manual-editorial"}>
            {(data?.sources ?? [{ sourceId: "manual-editorial", name: "Captura manual" }]).filter((source) => !["x-search", "threads-search"].includes(source.sourceId)).map((source) => <option key={source.sourceId} value={source.sourceId}>{source.name}</option>)}
          </select></label>
          <label className="space-y-1 text-sm">Marca<input name="brand" className={inputClass} maxLength={160} defaultValue={current?.brand ?? ""} /></label>
        </div>
        <label className="block space-y-1 text-sm">Título<input name="title" className={inputClass} minLength={3} maxLength={300} required defaultValue={current?.title} /></label>
        <label className="block space-y-1 text-sm">Texto da oportunidade<textarea name="text" className={inputClass} rows={4} minLength={10} maxLength={3000} required defaultValue={current?.summary} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Link da origem<input name="sourceUrl" type="url" className={inputClass} required defaultValue={current?.sourceUrl} placeholder="https://…" /></label>
          <label className="space-y-1 text-sm">Link para candidatura<input name="applicationUrl" type="url" className={inputClass} required defaultValue={current?.applicationUrl} placeholder="https://…" /></label>
          <label className="space-y-1 text-sm">Prazo da candidatura<input name="applicationDeadline" type="date" className={inputClass} defaultValue={current?.applicationDeadline ?? ""} /></label>
          <label className="space-y-1 text-sm">Tipo<select name="opportunityType" className={inputClass} defaultValue={current?.opportunityType ?? "unknown"}>
            <option value="unknown">Ainda não definido</option><option value="open_application">Campanha aberta</option><option value="ugc">UGC</option><option value="barter">Permuta</option><option value="invitation_only">Convite fechado</option><option value="challenge">Desafio / concurso</option><option value="creator_program">Programa / banco de creators</option><option value="informational">Sinal de mercado</option>
          </select></label>
          <label className="space-y-1 text-sm">Requisitos (um por linha)<textarea name="requirements" className={inputClass} rows={3} defaultValue={current?.requirements.join("\n")} /></label>
          <label className="space-y-1 text-sm">Entregas (uma por linha)<textarea name="deliverables" className={inputClass} rows={3} defaultValue={current?.deliverables.join("\n")} /></label>
        </div>
        <details className="rounded-lg bg-gray-50 p-3"><summary className="cursor-pointer text-sm font-medium">Remuneração e acesso</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Remuneração<select name="compensationType" className={inputClass} defaultValue={current?.compensation.type ?? "unknown"}>
              <option value="unknown">Não informada</option><option value="fixed">Valor fixo</option><option value="range">Faixa de valor</option><option value="barter">Permuta</option><option value="variable">Variável / comissão</option><option value="prize">Prêmio</option>
            </select></label>
            <label className="space-y-1 text-sm">O valor corresponde a<select name="compensationBasis" className={inputClass} defaultValue={current?.compensation.basis ?? "unknown"}>
              <option value="unknown">Não informado</option><option value="per_creator">Por criador</option><option value="per_delivery">Por entrega</option><option value="per_view">Por visualização</option><option value="per_sale">Por venda</option><option value="total_campaign_budget">Orçamento total da campanha</option>
            </select></label>
            <label className="space-y-1 text-sm">Mínimo (R$)<input type="number" name="compensationMinimum" min={0} max={100000000} step="0.01" className={inputClass} defaultValue={current?.compensation.minimum ?? ""} /></label>
            <label className="space-y-1 text-sm">Máximo (R$)<input type="number" name="compensationMaximum" min={0} max={100000000} step="0.01" className={inputClass} defaultValue={current?.compensation.maximum ?? ""} /></label>
            <label className="space-y-1 text-sm sm:col-span-2">Condição publicada<input name="compensationText" className={inputClass} maxLength={1000} defaultValue={current?.compensation.sourceText ?? ""} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="compensationConfirmed" defaultChecked={current?.compensation.confirmed ?? false} />Conferi a remuneração na origem</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiresAccount" defaultChecked={current?.requiresAccount ?? true} />Candidatura exige conta</label>
          </div>
        </details>
        <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Salvando…" : "Salvar para revisão"}</button>
          {editing && <button type="button" className={buttonClass} onClick={() => setEditing(null)}>Cancelar edição</button>}</div>
      </form>
    </details>

    <section aria-label="Caixa de entrada" className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Caixa de entrada</h2>
        <select aria-label="Filtrar revisão" className="rounded-lg border border-gray-300 bg-white p-2 text-sm" value={filter} onChange={(event) => { setFilter(event.target.value as Decision | "all"); setPage(1); }}>
          {Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="all">Todas</option>
        </select></div>
      {loading ? <p role="status" className="py-8 text-gray-500">Carregando oportunidades…</p> : data?.items.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">Nenhuma oportunidade nesta fila. Adicione uma captura manual ou importe um lote coletado.</p> : data?.items.map((item) => <CandidateCard key={`${item._id}:${item.revision}`} item={item} busy={busy} edit={() => { setEditing(item); document.getElementById("radar-capture")?.scrollIntoView({ behavior: "smooth" }); }} review={(action, note, verifiedOpen) => perform(() => api(`/api/admin/campaign-radar/${item._id}`, "PATCH", { action, revision: item.revision, note, verifiedOpen }), "Decisão registrada.")} />)}
      <div className="flex items-center justify-between text-sm text-gray-500"><span>{data?.total ?? 0} registros · página {page}</span><div className="flex gap-2">
        <button className={buttonClass} disabled={page <= 1 || loading || busy} onClick={() => setPage(page - 1)}>Anterior</button>
        <button className={buttonClass} disabled={!data?.hasMore || loading || busy} onClick={() => setPage(page + 1)}>Próxima</button>
      </div></div>
    </section>

    <details className="rounded-xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer font-semibold">Fontes e coleta gratuita</summary>
      <p className="mt-3 text-sm text-gray-500">A consulta automática só acessa origens revisadas sem cobrança de API. O agendamento depende da configuração operacional do servidor.</p>
      <div className="mt-3 divide-y divide-gray-100">{data?.sources.map((source) => <div key={source.sourceId} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{source.name}</strong><span className={source.blockedReason ? "text-gray-500" : "text-green-700"}>{source.blockedReason ? "Coleta desativada" : "Descoberta interna gratuita"}</span></div><p className="mt-1 text-gray-500">{source.blockedReason ?? source.evidence}</p></div>)}</div>
    </details>
    <details className="rounded-xl border border-gray-200 bg-white p-5"><summary className="cursor-pointer font-semibold">Últimas execuções</summary>
      {data?.runs.length === 0 && <p className="mt-3 text-sm text-gray-500">Nenhuma execução registrada no servidor.</p>}
      {data?.runs.map((run) => <div key={run.day} className="mt-3 border-t border-gray-100 pt-3 text-sm"><p>{run.day} · {({ completed: "Concluída", failed: "Falhou", running: "Em andamento" } as Record<string, string>)[run.status]} · {run.processed} entradas · custo de API: {run.apiCost.toLocaleString("pt-BR")}</p>
        {run.error && <p className="text-red-700">{run.error}</p>}{run.sources.filter((source) => source.warnings.length).map((source) => <p key={source.sourcePlatform} className="mt-1 text-gray-500">{source.sourcePlatform}: {source.warnings.join(" · ")}</p>)}</div>)}
    </details>
  </div>;
}

function CandidateCard({ item, busy, edit, review }: { item: Candidate; busy: boolean; edit: () => void; review: (action: Exclude<Decision, "pending">, note: string, verified: boolean) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [verified, setVerified] = useState(false);
  const opportunity = item.opportunity;
  return <article className="rounded-xl border border-gray-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-gray-500">{opportunity.sourcePlatform} · {item.intake === "manual" ? "Entrada manual" : "Coleta automática"} · {labels[item.decision]}</p>
      <h3 className="mt-1 text-lg font-semibold">{opportunity.title}</h3></div><button className={buttonClass} onClick={edit} disabled={busy}>Editar</button></div>
    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{opportunity.summary}</p>
    <p className="mt-3 text-sm text-gray-500">Prazo: {opportunity.applicationDeadline ?? "não informado"} · Remuneração: {opportunity.compensation.sourceText || "não informada"}</p>
    {item.possibleDuplicates > 0 && <p className="mt-2 text-sm text-amber-800">{item.possibleDuplicates} outro(s) registro(s) usa(m) o mesmo link de candidatura. Confira antes de publicar.</p>}
    <div className="mt-3 flex gap-5 text-sm text-indigo-700"><a href={opportunity.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir origem ↗</a><a href={opportunity.applicationUrl} target="_blank" rel="noopener noreferrer">Conferir candidatura ↗</a></div>
    <details className="mt-4 border-t border-gray-100 pt-3"><summary className="cursor-pointer text-sm font-medium">Revisar e consultar evidências</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-gray-500">Coletada em {new Date(opportunity.discoveredAt).toLocaleString("pt-BR")} · Última verificação: {new Date(opportunity.lastVerifiedAt).toLocaleString("pt-BR")}</p>
        {item.previousOpportunity && <details><summary className="cursor-pointer font-medium">Comparar com a versão anterior</summary>
          <p className="mt-2 whitespace-pre-wrap">{item.previousOpportunity.summary}</p>
          <p className="mt-2">Prazo anterior: {item.previousOpportunity.applicationDeadline ?? "não informado"} · Remuneração anterior: {item.previousOpportunity.compensation.sourceText || "não informada"}</p>
          <p>Requisitos anteriores: {item.previousOpportunity.requirements.join(" · ") || "não informados"}</p>
          <p>Entregas anteriores: {item.previousOpportunity.deliverables.join(" · ") || "não informadas"}</p>
        </details>}
        {item.originalOpportunity && <details><summary className="cursor-pointer text-gray-500">Captura original · uso interno</summary>
          <a href={item.originalOpportunity.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-indigo-700">Abrir origem da primeira captura ↗</a>
          <p className="mt-2 whitespace-pre-wrap">{item.originalOpportunity.summary}</p>
          {item.originalOpportunity.evidence.map((evidence, index) => <blockquote key={index} className="mt-2 border-l-2 border-gray-200 pl-3 text-gray-500">{evidence.excerpt}</blockquote>)}
        </details>}
        {opportunity.requirements.length > 0 && <p>Requisitos: {opportunity.requirements.join(" · ")}</p>}
        {opportunity.deliverables.length > 0 && <p>Entregas: {opportunity.deliverables.join(" · ")}</p>}
        {opportunity.evidence.map((evidence, index) => <blockquote key={index} className="border-l-2 border-gray-200 pl-3 text-gray-500">{evidence.field}: {evidence.excerpt}</blockquote>)}
        <label className="block">Nota da revisão<textarea aria-label={`Nota para ${opportunity.title}`} className={`${inputClass} mt-1`} maxLength={2000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        {item.distributionAllowed ? <label className="flex items-center gap-2"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} />Conferi que a chamada está aberta e o prazo de candidatura está correto.</label> : <p className="text-gray-500">Esta fonte permite apenas revisão interna enquanto a distribuição não estiver liberada.</p>}
        <div className="flex flex-wrap gap-2">{(["internal", "recheck", "rejected", "approved"] as const).map((action) => <button key={action} className={buttonClass} disabled={busy || note.trim().length < 3 || (action === "approved" && (!item.distributionAllowed || !verified))} onClick={() => review(action, note, verified)}>{action === "approved" ? "Aprovar e publicar" : labels[action]}</button>)}</div>
        <details><summary className="cursor-pointer text-gray-500">Histórico · {item.sightings} captura(s)</summary>{item.history.map((entry, index) => <p key={index} className="mt-2 text-xs text-gray-500">{new Date(entry.at).toLocaleString("pt-BR")} · {entry.note}</p>)}</details>
      </div>
    </details>
  </article>;
}
