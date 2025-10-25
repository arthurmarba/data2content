// src/app/planner/demo/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { idsToLabels } from "@/app/lib/classification";

type SlotCategories = { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };

const DAYS_PT = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const blockLabel = (start: number) => `${String(start).padStart(2, "0")}–${String((start + 3) % 24).padStart(2, "0")}`;

function startOfWeekISO(d = new Date()) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // segunda=0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

// --- CÓDIGO CORRIGIDO AQUI ---
// Definição dos tipos para as propriedades do componente
type ChipProps = {
  children: React.ReactNode;
  color?: "purple" | "magenta" | "teal" | "orange" | "gray";
};

// Componente com os tipos aplicados
const Chip = ({ children, color = "gray" }: ChipProps) => {
  const styles: Record<string, string> = {
    purple: "bg-brand-purple/10 text-brand-purple ring-1 ring-brand-purple/30",
    magenta: "bg-brand-magenta/10 text-brand-magenta ring-1 ring-brand-magenta/30",
    teal: "bg-brand-teal/10 text-brand-teal ring-1 ring-brand-teal/30",
    orange: "bg-brand-orange/10 text-brand-orange ring-1 ring-brand-orange/30",
    gray: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
  };
  return <span className={`text-xs md:text-sm px-2.5 py-1 rounded-full whitespace-nowrap ${styles[color]}`}>{children}</span>;
};
// --- FIM DA CORREÇÃO ---

export default function PlannerDemoPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState<string>("");
  const [script, setScript] = useState<string>("");
  const [themes, setThemes] = useState<string[]>([
    "3 dicas rápidas de skincare noturno",
    "Review honesto: hidratante X vale a pena?",
    "Rotina de beleza em 5 minutos (sem filtro)",
    "Truque para reduzir oleosidade antes da maquiagem",
    "Como escolher seu protetor solar ideal",
  ]);
  const [beats, setBeats] = useState<string[]>([]);
  const [insp, setInsp] = useState<any[]>([]);
  const [comm, setComm] = useState<any[]>([]);
  const [loadingGen, setLoadingGen] = useState(false);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [loadingInsp, setLoadingInsp] = useState(false);
  const [loadingComm, setLoadingComm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Slot demo: terça 19h, foco beleza/educacional
  const dayOfWeek = 2; // terça
  const blockStartHour = 19;
  const weekStartISO = useMemo(() => startOfWeekISO(), []);
  const categories: SlotCategories = useMemo(
    () => ({
      proposal: ["review", "tips"],
      context: ["beauty_personal_care"],
      tone: "educational",
      reference: ["pop_culture_internet"],
    }),
    []
  );

  const headerText = `${DAYS_PT[dayOfWeek]} • ${blockLabel(blockStartHour)}`;
  const altStrongBlocks = [
    { blockStartHour: 12, score: 0.82 },
    { blockStartHour: 21, score: 0.76 },
  ];

  async function handleRegenerateThemes() {
    setLoadingThemes(true);
    setError(null);
    try {
      const res = await fetch("/api/planner/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek, blockStartHour, categories, includeCaptions: true }),
      });
      if (!res.ok) throw new Error("Falha ao gerar pautas");
      const data = await res.json();
      setThemes(Array.isArray(data?.themes) ? data.themes : []);
    } catch (e: any) {
      setError(e?.message || "Erro ao gerar pautas");
    } finally {
      setLoadingThemes(false);
    }
  }

  async function handleGenerate() {
    setLoadingGen(true);
    setError(null);
    try {
      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: weekStartISO,
          slot: { dayOfWeek, blockStartHour, format: "reel", categories, themeKeyword: themes?.[0] || "skincare" },
          strategy: "default",
          noSignals: false,
        }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Faça login para gerar roteiros." : "Falha ao gerar roteiro");
      const data = await res.json();
      const gen = data?.generated;
      if (gen?.title) setTitle(gen.title);
      if (gen?.script) setScript(gen.script);
      const genBeats = Array.isArray(gen?.beats) ? gen.beats.filter((s: any) => typeof s === "string") : [];
      setBeats(genBeats);
    } catch (e: any) {
      setError(e?.message || "Erro inesperado");
    } finally {
      setLoadingGen(false);
    }
  }

  const handleLoadInspirations = useCallback(async () => {
    setLoadingInsp(true);
    setError(null);
    try {
      const res = await fetch("/api/planner/inspirations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo", dayOfWeek, blockStartHour, categories, limit: 6 }), // eslint-disable-line react-hooks/exhaustive-deps
      });
      if (!res.ok) throw new Error("Falha ao buscar conteúdos");
      const data = await res.json();
      setInsp(Array.isArray(data?.posts) ? data.posts : []);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar conteúdos"); // eslint-disable-line react-hooks/exhaustive-deps
    } finally {
      setLoadingInsp(false);
    }
  }, [blockStartHour, categories, dayOfWeek]);

  async function handleLoadCommunity() {
    setLoadingComm(true);
    setError(null);
    try {
      const res = await fetch("/api/planner/inspirations/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "demo",
          categories,
          script: script || "",
          themeKeyword: themes?.[0] || "skincare",
          limit: 6,
        }),
      });
      if (!res.ok) throw new Error("Falha ao buscar conteúdos da comunidade");
      const data = await res.json();
      setComm(Array.isArray(data?.posts) ? data.posts : []);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar comunidade");
    } finally {
      setLoadingComm(false);
    }
  }

  useEffect(() => {
    // Pré-carregar inspirações levemente
    handleLoadInspirations().catch(() => {});
  }, [handleLoadInspirations]);

  // Emite a altura do conteúdo para o parent (landing) ajustar o iframe
  useEffect(() => {
    let lastSent = 0;
    let rafId: number | null = null;

    const measure = () => {
      try {
        const h = Math.ceil((containerRef.current?.offsetHeight ?? document.body.scrollHeight) + 24);
        if (Math.abs(h - lastSent) < 8) return; // evita loops por variações mínimas
        lastSent = h;
        window.parent?.postMessage({ type: "planner-demo:height", height: h }, window.location.origin);
      } catch {}
    };

    const post = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };

    // Observa mudanças de layout (✅ corrigido null check do ResizeObserver)
    let ro: ResizeObserver | null = null;
    try {
      if (typeof window !== "undefined" && "ResizeObserver" in window) {
        ro = new (window as any).ResizeObserver(() => post());
        const el = containerRef.current;
        if (ro && el) ro.observe(el);
      }
    } catch {}

    // Dispara inicialmente e em eventos comuns
    post();
    const onLoad = () => post();
    const onResize = () => post();
    window.addEventListener("load", onLoad);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("resize", onResize);
      try {
        ro?.disconnect();
      } catch {}
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  // Neutraliza classes globais do layout (min-h-svh e bg da raiz) dentro do iframe
  useEffect(() => {
    const prevMinH = document.body.style.minHeight;
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    try {
      document.body.style.minHeight = "auto"; // evita feedback loop de altura
      document.body.style.backgroundColor = "#ffffff";
      document.documentElement.style.backgroundColor = "#ffffff";
    } catch {}
    return () => {
      document.body.style.minHeight = prevMinH;
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, []);

  const label = (ids?: string[], type?: "proposal" | "context" | "reference") => idsToLabels(ids, type as any).join(", ");
  const toneLabel = (t?: string) => idsToLabels(t ? [t] : [], "tone")[0] || "";
  const handleConnectInstagram = useCallback(() => {
    router.push("/dashboard/instagram/connect");
  }, [router]);

  const handleOpenDiscover = useCallback(() => {
    router.push("/dashboard/discover");
  }, [router]);

  return (
    <div className="bg-white">
      <div ref={containerRef} className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Experimente o Planner IA na prática</p>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Este é um exemplo gerado com dados fictícios. Conecte seu Instagram para que o Mobi calcule horários
            quentes, temas e roteiros com base no seu histórico real.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleConnectInstagram}
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand-red px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:w-auto"
            >
              Conectar Instagram e gerar meus horários
            </button>
            <button
              type="button"
              onClick={handleOpenDiscover}
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:w-auto"
            >
              Ver ideias na Comunidade
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500">Slot demo sugerido</div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{headerText}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Quando a IA lê o seu perfil, ela adapta este painel com base nos horários e formatos que performam melhor
              nos seus últimos posts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Chip color="teal">Formato: Reel</Chip>
            <Chip color="gray">Confiança: Média</Chip>
            <Chip color="gray">Esforço: Rápido</Chip>
          </div>
        </div>

        {/* Categorias */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-gray-500">Proposta</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {idsToLabels(categories.proposal || [], "proposal").map((t) => (
                <Chip key={`p-${t}`} color="purple">
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Contexto</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {idsToLabels(categories.context || [], "context").map((t) => (
                <Chip key={`c-${t}`} color="magenta">
                  {t}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Tom</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Chip color="teal">{toneLabel(categories.tone)}</Chip>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Referência</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {idsToLabels(categories.reference || [], "reference").map((t) => (
                <Chip key={`r-${t}`} color="orange">
                  {t}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Pautas e geração */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Pautas sugeridas</h2>
              <button className="text-sm px-3 py-1.5 rounded-md border text-gray-700 hover:bg-gray-50" onClick={handleRegenerateThemes} disabled={loadingThemes}>
                {loadingThemes ? "Gerando…" : "Regenerar pautas"}
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {(themes || []).slice(0, 6).map((t, i) => (
                <button key={`th-${i}`} className="w-full text-left border rounded-md px-3 py-2 text-sm hover:bg-rose-50" onClick={() => setTitle(t)}>
                  {t}
                </button>
              ))}
              {(!themes || themes.length === 0) && <div className="text-xs text-gray-500">Sem sugestões para este horário.</div>}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-900" htmlFor="title">
                  Título
                </label>
                <button
                  type="button"
                  className="text-xs text-gray-600 hover:text-gray-800"
                  onClick={() => navigator.clipboard?.writeText(title || "")}
                  disabled={!title}
                >
                  Copiar
                </button>
              </div>
              <input
                id="title"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Ex.: 3 truques para ..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-900" htmlFor="script">
                  Roteiro curto
                </label>
                <button
                  type="button"
                  className="text-xs text-gray-600 hover:text-gray-800"
                  onClick={() => navigator.clipboard?.writeText(script || "")}
                  disabled={!script}
                >
                  Copiar
                </button>
              </div>
              <textarea
                id="script"
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px]"
                placeholder="Estrutura de fala, ganchos e CTA..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md overflow-hidden border">
                {[
                  { id: "default", label: "Padrão" },
                  { id: "strong_hook", label: "Gancho forte" },
                  { id: "more_humor", label: "Mais humor" },
                  { id: "practical_imperative", label: "Mais prático" },
                ].map((opt) => (
                  <span
                    key={opt.id}
                    className={`px-3 py-1.5 text-xs bg-white text-gray-700 ${opt.id === "default" ? "bg-pink-600 text-white" : ""} ${
                      opt.id === "default" ? "" : "border-l"
                    } border-gray-200`}
                  >
                    {opt.label}
                  </span>
                ))}
              </div>
              <button className="px-3 py-1.5 text-sm rounded-md border text-gray-700 hover:bg-gray-50" onClick={handleGenerate} disabled={loadingGen}>
                {loadingGen ? "Gerando…" : "Gerar roteiro"}
              </button>
            </div>

            {beats.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-900 mb-1">Plano de cena</div>
                <ol className="list-decimal ml-5 text-xs text-gray-700 space-y-1">
                  {beats.map((b, i) => (
                    <li key={`b-${i}`}>{b}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Outros horários fortes hoje</div>
              <div className="flex flex-wrap gap-2 mt-1">
                {altStrongBlocks.map((h, i) => (
                  <span key={`alt-${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    {blockLabel(h.blockStartHour)} • {(h.score * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>

            {/* Inspirações */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Conteúdos que inspiraram</div>
                <button className="px-3 py-1.5 text-sm rounded-md border text-gray-700 hover:bg-gray-50" onClick={handleLoadInspirations} disabled={loadingInsp}>
                  {loadingInsp ? "Carregando…" : insp.length ? "Atualizar" : "Ver conteúdos"}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insp.map((p, idx) => (
                  <a
                    key={`i-${idx}`}
                    href={p.postLink || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block border rounded-md overflow-hidden hover:shadow-sm bg-white"
                  >
                    {p.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnailUrl} alt="thumb" className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">sem imagem</div>
                    )}
                    <div className="p-2">
                      <div className="text[11px] text-gray-600 line-clamp-2">{p.caption}</div>
                      <div className="mt-1 text-[10px] text-gray-500">
                        {new Date(p.date).toLocaleDateString("pt-BR")} • {(p.views || 0).toLocaleString("pt-BR")} views
                      </div>
                    </div>
                  </a>
                ))}
                {loadingInsp && !insp.length && [...Array(2)].map((_, i) => <div key={`sk-in-${i}`} className="h-28 bg-gray-100 rounded-md animate-pulse" />)}
              </div>
              {!loadingInsp && !insp.length && <div className="text-[11px] text-gray-500 mt-1">Sem conteúdos suficientes para este horário.</div>}
            </div>

            {/* Inspiração da comunidade */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Inspiração da comunidade</div>
                <button className="px-3 py-1.5 text-sm rounded-md border text-gray-700 hover:bg-gray-50" onClick={handleLoadCommunity} disabled={loadingComm}>
                  {loadingComm ? "Carregando…" : comm.length ? "Atualizar" : "Ver conteúdos da comunidade"}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {comm.map((p, idx) => (
                  <a
                    key={`c-${idx}`}
                    href={p.postLink || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block border rounded-md overflow-hidden hover:shadow-sm bg-white"
                  >
                    {p.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.coverUrl} alt="thumb" className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">sem imagem</div>
                    )}
                    <div className="p-2">
                      <div className="text-[11px] text-gray-600 line-clamp-2">{p.caption}</div>
                      <div className="mt-1 text-[10px] text-gray-500">
                        {new Date(p.date).toLocaleDateString("pt-BR")} • {(p.views || 0).toLocaleString("pt-BR")} views
                      </div>
                      {Array.isArray(p.reason) && p.reason.length > 0 && (
                        <div className="mt-1 text-[10px] text-gray-500 truncate">Por que: {p.reason.slice(0, 2).join(", ")}</div>
                      )}
                    </div>
                  </a>
                ))}
                {loadingComm && !comm.length && [...Array(2)].map((_, i) => <div key={`sk-co-${i}`} className="h-28 bg-gray-100 rounded-md animate-pulse" />)}
              </div>
              {!loadingComm && !comm.length && <div className="text-[11px] text-gray-500 mt-1">Sem recomendações da comunidade no momento.</div>}
            </div>
          </div>
        </div>

        {error && <div className="mt-6 text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
}
