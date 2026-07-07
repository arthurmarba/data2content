// scripts/reuniao/lib/deckTemplates.ts
//
// Templates HTML dos slides do Galisteu — deck LANDSCAPE 16:9 (1280×720, render
// em 2× → 2560×1440) que o host projeta e conduz na reunião de grupo.
//
// Herda a alma editorial da Galileia/Galeano: Playfair + Poppins, papel off-white,
// e as cores fixas dos 3 círculos do ponto-ouro (Narrativa=terracota, Audiência=azul,
// Marca=verde). Cada slide é um documento HTML standalone — o renderDeck tira um
// screenshot por slide e os embrulha num .pptx.

import type { CriadorSlide, CollabSugerida, DeckData, Ponto, Selo } from "./types";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

const CIRC = { narrativa: "#C9603F", audiencia: "#2F6F8F", marca: "#4E8D5B" } as const;
const FORTE = "#2e7d52"; // verde — ponto forte
const AJUSTAR = "#b5462f"; // terracota — ponto a ajustar
// Julgamento → preenchimento do círculo (forma), nunca outra cor (igual à Galileia).
const FILL: Record<Selo, number> = { verde: 0.85, amarelo: 0.4, vermelho: 0.07, fraco: 0.07 };

const esc = (s: string): string =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Itálico permitido só em <i>…</i> que o agente escrever (ex.: exemplo de marca). */
const rich = (s: string): string =>
  esc(s).replace(/&lt;i&gt;/g, "<i>").replace(/&lt;\/i&gt;/g, "</i>")
        .replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");

function iniciais(nome: string): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  const primeiro = partes[0];
  if (!primeiro) return "·";
  if (partes.length === 1) return primeiro.slice(0, 2).toUpperCase();
  const ultimo = partes[partes.length - 1] ?? primeiro;
  return `${primeiro[0] ?? ""}${ultimo[0] ?? ""}`.toUpperCase();
}

function avatar(nome: string, fotoUrl: string | null | undefined, cls = ""): string {
  const base = `avatar ${cls}`.trim();
  if (fotoUrl) return `<div class="${base}" style="background-image:url('${esc(fotoUrl)}')"></div>`;
  return `<div class="${base} avatar--ini">${esc(iniciais(nome))}</div>`;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** "2026-06-23" → "23 de junho" (humaniza a data crua na capa). */
function formatData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return iso;
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1] ?? ""}`;
}

function chips(arr: string[], n = 3): string {
  return arr
    .slice(0, n)
    .map((t) => `<span class="chip">${esc(t)}</span>`)
    .join("");
}

function statPill(p: Ponto): string {
  return p.stat ? `<span class="stat"><b>${esc(p.stat.valor)}</b> ${esc(p.stat.label)}</span>` : "";
}

/** Mini-Venn do ponto-ouro: 3 círculos (narrativa/audiência/marca) preenchidos
 *  pelo julgamento. Mostra POR QUE o ponto é forte/fraco — reusa a régua da Galileia. */
function miniVenn(p: Ponto): string {
  const s = p.selos;
  if (!s) return "";
  const c = (cor: string, selo: Selo, cx: number, cy: number) =>
    `<circle cx="${cx}" cy="${cy}" r="15" fill="${cor}" fill-opacity="${FILL[selo]}" stroke="${cor}" stroke-width="1.5"${
      selo === "fraco" ? ' stroke-dasharray="2 2"' : ""
    }/>`;
  return `<svg viewBox="0 0 72 54" class="venn" role="img" aria-label="posição nos três círculos">
    ${c(CIRC.narrativa, s.narrativa, 36, 17)}
    ${c(CIRC.audiencia, s.audiencia, 25, 35)}
    ${c(CIRC.marca, s.marca, 47, 35)}
  </svg>`;
}

/** Faixa curta de números da semana (relativos/traduzidos) — opcional. */
function numerosStrip(c: CriadorSlide): string {
  if (!c.numeros || c.numeros.length === 0) return "";
  const cells = c.numeros
    .slice(0, 4)
    .map(
      (n) => `<div class="num-cell"><div class="num-val">${esc(n.valor)}</div><div class="num-lab">${esc(n.label)}</div></div>`,
    )
    .join("");
  return `<div class="numeros">${cells}</div>`;
}

// ─── CSS compartilhado por todos os slides ──────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700&family=Poppins:wght@300;400;500;600;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --paper:#f6f6fa; --card:#fff; --ink:#1a1426; --muted:#7c798c; --hair:#e6e4ee;
    --serif:'Playfair Display',serif; --accent:#6c2db5;
    --narr:${CIRC.narrativa}; --aud:${CIRC.audiencia}; --marca:${CIRC.marca};
    --forte:${FORTE}; --ajustar:${AJUSTAR};
  }
  html,body { width:${SLIDE_W}px; height:${SLIDE_H}px; }
  body { font-family:'Poppins',system-ui,sans-serif; color:var(--ink); background:var(--paper);
    overflow:hidden; position:relative; }
  .slide { width:${SLIDE_W}px; height:${SLIDE_H}px; padding:64px 72px; display:flex; flex-direction:column; }
  .avatar { border-radius:50%; background-size:cover; background-position:center; background-color:#ece9f3;
    border:2px solid #fff; box-shadow:0 0 0 1px var(--hair); flex:none; }
  .avatar--ini { display:flex; align-items:center; justify-content:center; font-family:var(--serif);
    font-weight:700; color:var(--accent); }
  .eyebrow { font-size:13px; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); font-weight:700; }
  .chip { display:inline-block; font-size:13px; font-weight:600; color:#3a362d; background:#efeaf8;
    border-radius:20px; padding:4px 12px; margin:0 6px 6px 0; }
  .stat { font-size:14px; color:#3a362d; } .stat b { color:var(--ink); font-family:var(--serif); }
  .foot { position:absolute; left:72px; right:72px; bottom:30px; display:flex; justify-content:space-between;
    font-size:12px; color:var(--muted); letter-spacing:.06em; }
  i { font-style:italic; } b { font-weight:700; }

  /* ── CAPA ── */
  .cover { justify-content:center; }
  .cover .eyebrow { text-align:center; }
  .cover-title { font-family:var(--serif); font-weight:800; font-size:58px; line-height:1.1; text-align:center;
    margin:14px auto 6px; max-width:22ch; }
  .cover-period { text-align:center; font-size:15px; color:var(--muted); letter-spacing:.05em; margin-bottom:34px; }
  .roster { display:flex; flex-wrap:wrap; justify-content:center; gap:22px 30px; max-width:980px; margin:0 auto; }
  .roster--lg { gap:30px 48px; }
  .person { display:flex; flex-direction:column; align-items:center; width:120px; }
  .person .avatar { width:74px; height:74px; }
  .roster--lg .person .avatar { width:104px; height:104px; }
  .person-name { margin-top:9px; font-size:13px; font-weight:600; text-align:center; line-height:1.25; }
  .person-handle { font-size:11px; color:var(--muted); }

  /* ── SLIDE DE CRIADOR ── */
  .head { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:22px; }
  .head .idx { font-family:var(--serif); font-style:italic; font-weight:700; color:var(--accent); font-size:18px; }
  .head .kick { font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--muted); font-weight:600; }
  .cr { display:grid; grid-template-columns:300px 1fr; gap:34px; flex:1; min-height:0; }
  .cr--reel { grid-template-columns:280px 1fr 212px; gap:26px; }
  .cr-id { display:flex; flex-direction:column; justify-content:center; }
  .cr-id .avatar { width:104px; height:104px; margin-bottom:16px; }
  .cr-name { font-family:var(--serif); font-weight:800; font-size:30px; line-height:1.1; }
  .cr-handle { font-size:14px; color:var(--muted); margin-top:3px; }
  .cr-narr { font-family:var(--serif); font-style:italic; font-size:18px; line-height:1.45; color:#2a2435;
    margin:18px 0 18px; }
  .cr-terr { margin-bottom:4px; }
  .numeros { display:flex; margin-top:14px; border:1px solid var(--hair); border-radius:10px; overflow:hidden;
    background:var(--card); }
  .num-cell { flex:1; padding:9px 8px; text-align:center; border-right:1px solid var(--hair); }
  .num-cell:last-child { border-right:0; }
  .num-val { font-family:var(--serif); font-weight:800; font-size:20px; line-height:1.05; }
  .num-lab { margin-top:3px; font-size:9px; letter-spacing:.03em; color:var(--muted); text-transform:uppercase; }
  /* Mini-gráfico da semana (saves × shares por post) */
  .grafico { margin-top:14px; }
  .g-legend { font-size:9px; letter-spacing:.02em; color:var(--muted); text-transform:uppercase; margin-bottom:5px; display:flex; align-items:center; gap:4px; }
  .g-legend .g-dot { width:8px; height:8px; border-radius:2px; display:inline-block; }
  .g-legend .g-dot.g-shares { margin-left:8px; }
  .g-dot.g-saves, .g-bar.g-saves { background:var(--narr); }
  .g-dot.g-shares, .g-bar.g-shares { background:var(--aud); }
  .g-plot { display:flex; align-items:flex-end; gap:10px; height:64px; }
  .g-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; }
  .g-bars { flex:1; display:flex; align-items:flex-end; gap:3px; }
  .g-bar { width:7px; border-radius:3px 3px 0 0; min-height:2px; }
  .g-lab { margin-top:4px; font-size:8.5px; color:var(--muted); white-space:nowrap; }

  .cr-body { display:flex; flex-direction:column; gap:9px; min-width:0; }
  /* Leitura de audiência (topo do corpo) */
  .audiencia { font-size:12.5px; line-height:1.4; color:#2a2435; padding:7px 13px; border-radius:10px;
    background:#eaf1f5; border-left:4px solid var(--aud); }
  .audiencia .aud-lab { font-weight:700; color:var(--aud); letter-spacing:.02em; }
  /* Comparativo vs. semana passada */
  .comp { font-size:12.5px; line-height:1.45; color:#3a362d; }
  .comp .comp-lab { font-weight:700; color:var(--accent); }
  /* Próximos passos — a cadeia narrativa→pauta (o payoff) */
  .passos { padding:9px 14px 10px; border-radius:11px; background:#f3eefb; border-left:4px solid var(--accent); }
  .passos-head { font-size:11px; font-weight:700; letter-spacing:.04em; color:var(--accent); margin-bottom:6px; text-transform:uppercase; }
  .passos-head .passos-lac { font-weight:500; text-transform:none; letter-spacing:0; color:#5a5470; }
  .passos-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:5px; }
  .passos-list li { font-size:12.5px; line-height:1.35; }
  .pauta-t { font-family:var(--serif); font-weight:700; color:var(--ink); }
  .pauta-p { color:var(--muted); }

  /* Constelação da comunidade */
  .const-grid { display:flex; flex-wrap:wrap; justify-content:center; gap:18px 22px; margin-top:18px; }
  .const-node { width:200px; background:var(--card); border:1px solid var(--hair); border-radius:14px; padding:14px 16px; display:flex; flex-direction:column; align-items:center; text-align:center; }
  .const-node .avatar { width:60px; height:60px; }
  .const-name { margin-top:8px; font-size:14px; font-weight:600; }
  .const-terr { margin-top:6px; display:flex; flex-wrap:wrap; gap:5px; justify-content:center; }
  .const-terr .chip { font-size:11px; padding:2px 9px; margin:0; }
  .const-links { margin-top:20px; display:flex; flex-direction:column; gap:7px; }
  .const-link { font-size:13.5px; color:#3a362d; }
  .const-link b { color:var(--narr); } .const-link .lk-terr { font-family:var(--serif); font-style:italic; color:var(--ink); }
  /* Coluna do veredito (Tempo A) — coerência + os 2 pontos, centrados com ar. */
  .cr-verdict { display:flex; flex-direction:column; gap:14px; justify-content:center; min-width:0; }
  .coer { font-size:13px; line-height:1.5; color:#3a362d; padding:10px 16px; border-radius:10px; }
  .coer .coer-dot { width:9px; height:9px; border-radius:50%; display:inline-block; margin-right:8px; vertical-align:middle; }
  .coer b { font-weight:700; white-space:nowrap; }
  .coer--ok { background:#eaf5ee; } .coer--ok b { color:#2e7d52; } .coer--ok .coer-dot { background:#2e7d52; }
  .coer--mid { background:#fbf3e4; } .coer--mid b { color:#9a7212; } .coer--mid .coer-dot { background:#c79a2e; }
  .coer--alert { background:#fbecea; } .coer--alert b { color:#b5462f; } .coer--alert .coer-dot { background:#b5462f; }
  .pt { border-radius:13px; padding:16px 20px; background:var(--card); border:1px solid var(--hair); }
  .pt--forte { border-left:5px solid var(--forte); }
  .pt--ajustar { border-left:5px solid var(--ajustar); }
  .pt-label { font-size:11.5px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; }
  .pt--forte .pt-label { color:var(--forte); }
  .pt--ajustar .pt-label { color:var(--ajustar); }
  .pt-head { display:flex; align-items:center; gap:12px; margin-bottom:7px; }
  .pt-head .stat { margin-left:auto; font-size:14px; }
  .venn { width:46px; height:35px; flex:0 0 46px; }
  .pt-texto { font-family:var(--serif); font-weight:700; font-size:21px; line-height:1.3; }
  .pt-evid { font-size:13.5px; color:var(--muted); line-height:1.5; margin-top:7px; }

  /* Corpo do Tempo B — hierarquia clara: lead leve → card-herói → rodapé fino. */
  .crB { flex:1; display:flex; flex-direction:column; gap:22px; justify-content:center; max-width:1040px; }
  /* Lead (audiência): texto, sem caixa — leve, não compete com o herói. */
  .crB .audiencia { background:transparent; border-left:0; padding:0; font-size:16px; line-height:1.5; color:#2a2435; }
  .crB .audiencia .aud-lab { color:var(--aud); }
  /* Herói (o que postar): o card que domina o slide. */
  .crB .passos { padding:22px 28px; border-left-width:5px; }
  .crB .passos-head { font-size:15px; letter-spacing:.06em; margin-bottom:3px; }
  .crB .passos-lac { font-size:13px; color:#6a6480; line-height:1.45; margin-bottom:16px; }
  .crB .passos-list { gap:14px; }
  .crB .passos-list li { font-size:15px; line-height:1.35; display:flex; flex-direction:column; gap:3px; }
  .crB .pauta-t { font-size:20px; line-height:1.28; }
  .crB .pauta-p { font-size:13.5px; }
  /* Rodapé (marca): linha fina, secundária. */
  .crB .marca { background:transparent; border-radius:0; border-top:1px solid var(--hair); padding:14px 2px 0;
    font-size:14px; color:#3a362d; }
  /* Janela do reel (coluna direita) */
  .cr-reel { display:flex; align-items:center; }
  .reel { width:212px; height:377px; border-radius:14px; background-size:cover; background-position:center;
    background-color:#1a1426; position:relative; box-shadow:0 8px 28px rgba(26,20,38,.18); overflow:hidden; }
  .reel::after { content:""; position:absolute; inset:0; background:radial-gradient(circle at 50% 46%,
    rgba(255,255,255,.16) 0 34px, rgba(0,0,0,.18) 120px, rgba(0,0,0,.30)); }
  .reel-badge { position:absolute; top:12px; left:12px; z-index:2; font-size:11px; font-weight:700;
    letter-spacing:.08em; color:#fff; background:rgba(0,0,0,.45); border-radius:20px; padding:4px 11px; }
  .marca { font-size:12.5px; color:#3a362d; padding:8px 14px; background:#efeaf8;
    border-radius:10px; line-height:1.4; }
  .marca .mlabel { font-weight:700; color:var(--accent); }
  .fala { font-size:13px; color:var(--muted); font-style:italic; margin-top:2px; }
  .sem-sinal { font-size:14px; color:var(--ajustar); font-weight:600; }

  /* ── COLLABS ── */
  .sec-title { font-family:var(--serif); font-weight:800; font-size:34px; margin:4px 0 4px; }
  .sec-lead { font-size:15px; color:var(--muted); margin-bottom:26px; }
  .collab-grid { display:flex; flex-direction:column; gap:16px; flex:1; }
  .collab-terr { display:inline-block; font-size:12px; font-weight:700; letter-spacing:.04em; color:var(--narr);
    background:#f6e7e1; border-radius:20px; padding:4px 13px; }
  /* Slide rico de UMA collab */
  .collabX { display:grid; grid-template-columns:1fr 1fr; gap:48px; flex:1; min-height:0; align-items:center; }
  .cx-left { display:flex; flex-direction:column; align-items:flex-start; }
  .cx-pair { display:flex; align-items:flex-start; gap:18px; margin-bottom:18px; }
  .cx-person { width:150px; }
  .cx-person .avatar { width:72px; height:72px; }
  .cx-name { margin-top:9px; font-family:var(--serif); font-weight:700; font-size:18px; line-height:1.15; }
  .cx-handle { font-size:12px; color:var(--muted); }
  .cx-traz { margin-top:7px; font-size:13px; line-height:1.45; color:#3a362d; }
  .cx-x { font-family:var(--serif); font-size:26px; color:var(--muted); align-self:center; padding-top:18px; }
  .cx-pauta { font-family:var(--serif); font-style:italic; font-weight:700; font-size:25px; line-height:1.32;
    color:var(--ink); margin:16px 0; }
  .cx-pq { font-size:13.5px; line-height:1.5; color:#3a362d; } .cx-pq b { color:var(--accent); }
  .cx-right { background:var(--card); border:1px solid var(--hair); border-left:5px solid var(--narr);
    border-radius:14px; padding:24px 28px; align-self:stretch; display:flex; flex-direction:column; justify-content:center; }
  .cx-grava-lab { font-size:15px; font-weight:700; letter-spacing:.04em; color:var(--narr); }
  .cx-grava-sub { font-size:13px; color:var(--muted); margin:4px 0 16px; line-height:1.4; }
  .cx-steps { margin:0; padding:0; list-style:none; counter-reset:cx; display:flex; flex-direction:column; gap:13px; }
  .cx-steps li { counter-increment:cx; position:relative; padding-left:40px; font-size:14.5px; line-height:1.45; color:#2a2435; }
  .cx-steps li::before { content:counter(cx); position:absolute; left:0; top:-1px; width:26px; height:26px;
    border-radius:50%; background:#f6e7e1; color:var(--narr); font-weight:700; font-size:13px;
    display:flex; align-items:center; justify-content:center; }
  .cx-grava-txt { font-size:14.5px; line-height:1.55; color:#2a2435; }

  /* ── RESPIRO (registro nu — dá ritmo entre os atos densos) ── */
  .respiro { justify-content:center; align-items:center; text-align:center; }
  .slide--dark { background:var(--ink); }
  .slide--accent { background:var(--accent); }
  .slide--paper { background:var(--paper); }
  .r-kicker { font-size:13px; letter-spacing:.24em; text-transform:uppercase; font-weight:700; margin-bottom:22px; }
  .slide--dark .r-kicker { color:#e6b8a6; }
  .slide--accent .r-kicker { color:rgba(255,255,255,.82); }
  .slide--paper .r-kicker { color:var(--accent); }
  .r-title { font-family:var(--serif); font-weight:800; font-size:52px; line-height:1.16; max-width:20ch; }
  .slide--dark .r-title, .slide--accent .r-title { color:#fbf7f4; }
  .slide--paper .r-title { color:var(--ink); }
  .r-sub { margin-top:22px; font-size:17px; line-height:1.6; max-width:44ch; }
  .slide--dark .r-sub, .slide--accent .r-sub { color:#c9c4d6; }
  .slide--paper .r-sub { color:#3a362d; }
  .r-tag { margin-top:30px; font-size:13px; letter-spacing:.2em; text-transform:uppercase; font-weight:700; }
  .slide--dark .r-tag { color:#e6b8a6; } .slide--accent .r-tag { color:#fff; }
  /* Legenda do Venn (uma vez, na abertura escura) */
  .venn-leg { margin-top:40px; display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:8px 16px;
    font-size:13px; color:#c9c4d6; }
  .venn-leg .vl-pre { color:#9690a8; }
  .vl-item { display:inline-flex; align-items:center; gap:7px; font-weight:600; color:#fbf7f4; }
  .vl-dot { width:12px; height:12px; border-radius:50%; display:inline-block; }
  .venn-leg .vl-note { color:#9690a8; }
`;

function shell(inner: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${inner}</body></html>`;
}

function ponto(p: Ponto, kind: "forte" | "ajustar"): string {
  const label = kind === "forte" ? "Ponto forte" : "Ponto a ajustar";
  return `<div class="pt pt--${kind}">
    <div class="pt-head"><span class="pt-label">${label}</span>${miniVenn(p)}${statPill(p)}</div>
    <div class="pt-texto">${rich(p.texto)}</div>
    <div class="pt-evid">${rich(p.evidencia)}</div>
  </div>`;
}

/** Janela do reel (poster + selo ▶). Marcada com data-vbox: o render mede a
 *  geometria e embute o mp4 tocável exatamente aqui no .pptx. */
function videoWindow(c: CriadorSlide): string {
  const poster = c.reel?.posterUrl ?? c.pontoForte?.thumbnailUrl ?? null;
  const style = poster ? ` style="background-image:url('${esc(poster)}')"` : "";
  return `<div class="reel" data-vbox${style}>
    <div class="reel-badge">▶ REEL</div>
  </div>`;
}

// ─── Slides ─────────────────────────────────────────────────────────────────

export function coverSlide(d: DeckData): string {
  const ps = d.criadores;
  const big = ps.length <= 6;
  const people = ps
    .map(
      (c) => `<div class="person">${avatar(c.nome, c.profilePictureUrl)}
        <div class="person-name">${esc(c.nome)}</div>
        ${c.handle ? `<div class="person-handle">${esc(c.handle)}</div>` : ""}</div>`,
    )
    .join("");
  return shell(`<div class="slide cover">
    <div class="eyebrow">Reunião da comunidade · Conteúdo do nosso jeito</div>
    <h1 class="cover-title">${esc(d.reuniao.titulo)}</h1>
    <div class="cover-period">${esc(formatData(d.reuniao.data))} · ${ps.length} criador${ps.length === 1 ? "" : "es"}</div>
    <div class="roster ${big ? "roster--lg" : ""}">${people}</div>
  </div>`);
}

/** Banner de coerência da semana (Tempo A) — a lente-assinatura do D2C, 1 linha calma. */
function coerenciaBanner(c: CriadorSlide): string {
  if (!c.coerencia) return "";
  const m: Record<string, [string, string]> = {
    "no-mapa": ["Dentro do mapa", "ok"],
    parcial: ["Parcial", "mid"],
    automatico: ["Sinais de automático", "alert"],
  };
  const [label, cls] = m[c.coerencia.status] ?? ["", "mid"];
  return `<div class="coer coer--${cls}"><span class="coer-dot"></span><b>${label}</b> — ${rich(c.coerencia.resumo)}</div>`;
}

function crHead(c: CriadorSlide, idx: number, total: number, kick: string): string {
  return `<div class="head">
    <span class="idx">${String(idx).padStart(2, "0")} / ${String(total).padStart(2, "0")} · ${esc(c.nome)}</span>
    <span class="kick">${esc(kick)}</span>
  </div>`;
}

/** Tempo A — "A semana": quem é + 1 ponto forte + 1 ponto a ajustar + o reel.
 *  Só o diagnóstico, objetivo. Sem pautas, sem marca, sem gráfico (vão no Tempo B). */
export function criadorSlideA(c: CriadorSlide, idx: number, total: number): string {
  const narr = c.narrativaCentral
    ? `<div class="cr-narr">“${esc(c.narrativaCentral)}”</div>`
    : `<div class="cr-narr">Mapa ainda sem narrativa central definida.</div>`;
  const coer = coerenciaBanner(c);
  const verdict = c.semSinal
    ? `<div class="pt pt--ajustar"><div class="pt-label" style="color:var(--ajustar)">Sem sinal esta semana</div>
        <div class="pt-texto" style="font-size:17px">Nenhum post no período — partimos do mapa.</div></div>`
    : `${coer}${ponto(c.pontoForte, "forte")}${ponto(c.pontoAjustar, "ajustar")}`;
  const temReel = !!(c.reel && c.reel.postId);
  return shell(`<div class="slide">
    ${crHead(c, idx, total, "A semana")}
    <div class="cr ${temReel ? "cr--reel" : ""}">
      <div class="cr-id">
        ${avatar(c.nome, c.profilePictureUrl)}
        <div class="cr-name">${esc(c.nome)}</div>
        ${c.handle ? `<div class="cr-handle">${esc(c.handle)}</div>` : ""}
        ${narr}
        <div class="cr-terr">${chips(c.territorios)}</div>
        ${numerosStrip(c)}
      </div>
      <div class="cr-verdict">${verdict}</div>
      ${temReel ? `<div class="cr-reel">${videoWindow(c)}</div>` : ""}
    </div>
  </div>`);
}

/** Tempo B — "O que vem": o que a audiência pediu → próximos passos → a marca.
 *  A direção, com ar. O gráfico da semana entra discreto no rodapé como contexto. */
export function criadorSlideB(c: CriadorSlide, idx: number, total: number): string {
  const audiencia = c.audienciaPede
    ? `<div class="audiencia"><span class="aud-lab">A audiência pediu</span> ${rich(c.audienciaPede)}</div>`
    : "";
  const passos = c.proximosPassos
    ? `<div class="passos">
        <div class="passos-head">O que postar agora</div>
        ${c.proximosPassos.lacuna ? `<div class="passos-lac">Porque ${rich(c.proximosPassos.lacuna)}.</div>` : ""}
        <ul class="passos-list">${c.proximosPassos.pautas
          .slice(0, 3)
          .map((p) => `<li><span class="pauta-t">${rich(p.titulo)}</span><span class="pauta-p">${rich(p.porque)}</span></li>`)
          .join("")}</ul>
      </div>`
    : c.falaSugerida
      ? `<div class="passos"><div class="passos-head">Pra conduzir</div><div class="passos-lac">${rich(c.falaSugerida)}</div></div>`
      : "";
  const marca = c.ganchoMarca
    ? `<div class="marca"><span class="mlabel">Marca que encaixa:</span> ${rich(c.ganchoMarca.categoria)}${
        c.ganchoMarca.porque ? ` — entra por <b>${esc(c.ganchoMarca.porque)}</b>` : ""
      }${c.ganchoMarca.exemplo ? ` (ex.: <i>${esc(c.ganchoMarca.exemplo)}</i>)` : ""}</div>`
    : "";
  const comparativo = c.comparativo
    ? `<div class="comp">↺ <span class="comp-lab">Desde a última:</span> ${rich(c.comparativo)}</div>`
    : "";
  return shell(`<div class="slide">
    ${crHead(c, idx, total, "O que vem")}
    <div class="crB">
      ${audiencia}
      ${passos}
      ${marca}
      ${comparativo}
    </div>
  </div>`);
}

/** UM slide rico por collab: o par (com o que cada um traz), o território, a
 *  pauta em destaque, como gravar à distância em passos, e por que funciona. */
export function collabSlide(c: CollabSugerida, idx: number, total: number, criadores: CriadorSlide[] = []): string {
  const norm = (h: string) => h.replace(/^@/, "").toLowerCase();
  const fotoDe = new Map<string, string | null>();
  const nomeDe = new Map<string, string>();
  for (const cr of criadores) {
    if (cr.handle) {
      fotoDe.set(norm(cr.handle), cr.profilePictureUrl);
      nomeDe.set(norm(cr.handle), cr.nome);
    }
  }
  const nomeDe2 = (h: string) => nomeDe.get(norm(h)) ?? h.replace(/^@/, "");
  const person = (h: string, traz?: string) => `<div class="cx-person">
      ${avatar(nomeDe2(h), fotoDe.get(norm(h)) ?? null)}
      <div class="cx-name">${esc(nomeDe2(h))}</div>
      <div class="cx-handle">${esc(h)}</div>
      ${traz ? `<div class="cx-traz">${rich(traz)}</div>` : ""}
    </div>`;
  const passos = c.gravarPassos && c.gravarPassos.length
    ? `<ol class="cx-steps">${c.gravarPassos.map((p) => `<li>${rich(p)}</li>`).join("")}</ol>`
    : c.comoGravar
      ? `<div class="cx-grava-txt">${rich(c.comoGravar)}</div>`
      : "";
  return shell(`<div class="slide">
    <div class="head">
      <span class="idx">Collab ${idx} / ${total}</span>
      <span class="kick">Quem combina com quem</span>
    </div>
    <div class="collabX">
      <div class="cx-left">
        <div class="cx-pair">${person(c.a, c.aTraz)}<div class="cx-x">×</div>${person(c.b, c.bTraz)}</div>
        <span class="collab-terr">${esc(c.territorioComum)}</span>
        <div class="cx-pauta">${rich(c.pautaIdeia)}</div>
        ${c.porQueFunciona ? `<div class="cx-pq"><b>Por que funciona pros dois:</b> ${rich(c.porQueFunciona)}</div>` : ""}
      </div>
      <div class="cx-right">
        <div class="cx-grava-lab">🎥 Como gravar à distância</div>
        <div class="cx-grava-sub">A maioria não mora na mesma cidade — então funciona assim:</div>
        ${passos}
      </div>
    </div>
  </div>`);
}

/** Constelação da comunidade: quem ocupa qual território + as collabs como
 *  Só o MAPA de territórios (os pares detalhados vivem no slide de Collabs). */
export function constelacaoSlide(d: DeckData): string {
  if (d.criadores.length === 0) return "";
  const nodes = d.criadores
    .map(
      (c) => `<div class="const-node">
        ${avatar(c.nome, c.profilePictureUrl)}
        <div class="const-name">${esc(c.nome)}</div>
        <div class="const-terr">${chips(c.territorios, 2)}</div>
      </div>`,
    )
    .join("");
  return shell(`<div class="slide">
    <div class="eyebrow">A comunidade da semana</div>
    <h2 class="sec-title">Quem ocupa qual território</h2>
    <div class="sec-lead">Vendo o mapa de todos juntos, as pontes aparecem — você não cria sozinho.</div>
    <div class="const-grid">${nodes}</div>
  </div>`);
}

/** Respiro: slide NU (uma ideia isolada em escala, campo vazio) — reseta o olho
 *  entre os atos densos. O contraste denso↔vazio É o que dá ritmo (registro do Galeano). */
/** Escala do título do respiro pelo comprimento — frase curta fica gigante,
 *  frase longa encolhe pra caber com ar (o respiro só "respira" se for equilibrado). */
function autoEscala(t: string): number {
  const n = (t ?? "").replace(/<[^>]+>/g, "").length;
  if (n <= 28) return 72;
  if (n <= 50) return 60;
  if (n <= 90) return 48;
  if (n <= 140) return 40;
  return 34;
}

export function respiroSlide(o: {
  fundo?: "dark" | "accent" | "paper";
  kicker?: string;
  titulo: string;
  sub?: string;
  tag?: string;
  escala?: number;
}): string {
  const f = o.fundo ?? "dark";
  const px = o.escala ?? autoEscala(o.titulo);
  return shell(`<div class="slide respiro slide--${f}">
    ${o.kicker ? `<div class="r-kicker">${esc(o.kicker)}</div>` : ""}
    <div class="r-title" style="font-size:${px}px">${rich(o.titulo)}</div>
    ${o.sub ? `<div class="r-sub">${rich(o.sub)}</div>` : ""}
    ${o.tag ? `<div class="r-tag">${esc(o.tag)}</div>` : ""}
  </div>`);
}

/** Legenda única dos 3 círculos do ponto-ouro — explica o mini-Venn uma vez só
 *  (na abertura), em vez de repetir uma chave em cada slide de criador. */
function vennLegenda(): string {
  const item = (cor: string, label: string) =>
    `<span class="vl-item"><i class="vl-dot" style="background:${cor}"></i>${label}</span>`;
  return `<div class="venn-leg">
    <span class="vl-pre">Como ler o sinal de cada post:</span>
    ${item(CIRC.narrativa, "Narrativa")} ${item(CIRC.audiencia, "Audiência")} ${item(CIRC.marca, "Marca")}
    <span class="vl-note">— círculo cheio = acertou · vazio = não</span>
  </div>`;
}

/** Abertura: o fio da semana, em escala, fundo escuro + a legenda do Venn. */
export function aberturaSlide(d: DeckData): string {
  const fio = d.fechamento.fioComum;
  return shell(`<div class="slide respiro slide--dark">
    <div class="r-kicker">O fio da semana</div>
    <div class="r-title" style="font-size:${autoEscala(fio)}px">${rich(fio)}</div>
    ${vennLegenda()}
  </div>`);
}

/** Fechamento: a virada pra comunidade — fecha o arco aberto pela abertura. */
export function fechamentoSlide(d: DeckData): string {
  return respiroSlide({
    fundo: "dark",
    kicker: "A comunidade",
    titulo: d.fechamento.lembreteComunidade,
    tag: "Você não cria sozinho",
  });
}
