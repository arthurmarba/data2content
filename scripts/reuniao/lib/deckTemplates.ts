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
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SLIDE_W = 1280;
export const SLIDE_H = 720;

const CIRC = { narrativa: "#E90F4F", audiencia: "#FF8438", marca: "#167A55" } as const;
const FORTE = "#167A55"; // verde — ponto forte
const AJUSTAR = "#B4233D"; // vermelho — ponto a ajustar
const BRAND_MARK = pathToFileURL(path.resolve("public/images/Colorido-Simbolo.png")).href;
// Julgamento → preenchimento do círculo (forma), nunca outra cor (igual à Galileia).
const FILL: Record<Selo, number> = { verde: 0.85, amarelo: 0.4, vermelho: 0.07, fraco: 0.07 };

const esc = (s: string): string =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Itálico permitido só em <i>…</i> que o agente escrever (ex.: exemplo de marca). */
const rich = (s: string): string =>
  esc(s).replace(/&lt;i&gt;/g, "<i>").replace(/&lt;\/i&gt;/g, "</i>")
        .replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");

function iniciais(nome: string): string {
  const partes = (nome ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !/^(dr|dra)\.?$/i.test(p));
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

function splitCoverTitle(title: string): [string, string] {
  const clean = (title ?? "").trim();
  const explicit = clean.split(" — ");
  if (explicit.length > 1) return [explicit[0] ?? clean, explicit.slice(1).join(" — ")];
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 4) return [clean, ""];
  const pivot = Math.max(2, Math.min(words.length - 2, Math.round(words.length * 0.52)));
  return [words.slice(0, pivot).join(" "), words.slice(pivot).join(" ")];
}

/** O mapa guarda território com case livre ("Maternidade" ao lado de "cotidiano")
 *  — normaliza pra Title Case só na exibição, sem alterar o dado de origem. */
function tituleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Une nomes equivalentes vindos de mapas escritos em épocas diferentes.
 *  A constelação deve revelar afinidades da sala, não a taxonomia do banco. */
function territorioCanonico(raw: string): string {
  const s = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/matern|patern|criacao dos filhos/.test(s)) return "Maternidade & paternidade";
  if (/famil|casamento|conjugal|relacionamento/.test(s)) return "Vida em família";
  if (/humor|iron/.test(s)) return "Humor";
  if (/fe\b|espiritual|crista/.test(s)) return "Fé";
  if (/moda|estilo|vestuario|roupa|promoc/.test(s)) return "Moda & estilo";
  if (/autocuidado|bem-estar|saude|exercicio|treino|nutri|alimentacao/.test(s)) return "Saúde & bem-estar";
  if (/culin|cozinha|casa|domestic|decor|reforma|organizacao/.test(s)) return "Casa & culinária";
  if (/cotidiano|lifestyle|vida real/.test(s)) return "Cotidiano";
  return tituleCase(raw.trim());
}

function chips(arr: string[], n = 3): string {
  return arr
    .slice(0, n)
    .map((t) => `<span class="chip">${esc(tituleCase(t))}</span>`)
    .join("");
}

/** Agrupa uma lista em linhas de tamanho parecido (nunca uma linha órfã sozinha
 *  no fim) — ex.: 11 itens com maxPorLinha=6 vira [6,5], não [6,5] deslocado. */
function linhasBalanceadas<T>(itens: T[], maxPorLinha: number): T[][] {
  const n = itens.length;
  if (n <= maxPorLinha) return [itens];
  const linhas = Math.ceil(n / maxPorLinha);
  const porLinha = Math.ceil(n / linhas);
  const out: T[][] = [];
  for (let i = 0; i < n; i += porLinha) out.push(itens.slice(i, i + porLinha));
  return out;
}

/** Cresce um bloco de conteúdo (via zoom) quando o texto é curto — o slide sempre
 *  ocupa a altura toda, sem sobra vazia embaixo. Nunca encolhe abaixo de 1×. */
function escalaPorConteudo(blocos: (string | null | undefined)[], refChars = 480, max = 1.3): number {
  const n = blocos.filter(Boolean).join(" ").replace(/<[^>]+>/g, "").length;
  if (n <= 0) return 1;
  return Math.round(Math.min(max, Math.max(1, refChars / n)) * 100) / 100;
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
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap');
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
  .roster { display:flex; flex-direction:column; align-items:center; gap:22px; max-width:1120px; margin:0 auto; }
  .roster-linha { display:flex; flex-wrap:nowrap; justify-content:center; gap:22px 30px; }
  .roster--lg .roster-linha { gap:30px 48px; }
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
  .const-grid { display:flex; flex-direction:column; align-items:center; gap:18px; margin-top:18px; }
  .const-linha { display:flex; flex-wrap:nowrap; justify-content:center; gap:18px 22px; }
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
  .mv-legenda { font-size:9px; color:var(--muted); display:flex; gap:6px; margin-top:2px; }
  .pt-texto { font-family:var(--serif); font-weight:700; font-size:21px; line-height:1.3; }
  .pt-evid { font-size:13.5px; color:var(--muted); line-height:1.5; margin-top:7px; }
  /* Card único do "sem sinal esta semana" — maior que um pt normal, pra não sobrar vazio. */
  .pt--semsinal { padding:34px 40px; }
  .pt--semsinal .pt-label { font-size:14px; }
  .pt--semsinal .pt-texto { font-size:26px; margin-top:8px; }

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
  .r-title { font-family:var(--serif); font-weight:800; font-size:52px; line-height:1.32; letter-spacing:-0.01em; max-width:20ch; }
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

  /* ── D2C HUMAN LANDING — sistema visual compartilhado ─────────────── */
  :root {
    --paper:#fff9f5; --card:#fffdfa; --ink:#121014; --muted:rgba(18,16,20,.62);
    --hair:rgba(18,16,20,.15); --serif:'Bricolage Grotesque',Arial,sans-serif;
    --sans:'Instrument Sans',Arial,sans-serif; --accent:#e90f4f; --accent-strong:#c9083e;
    --map:#ff8438; --coral:#ff4e58; --neutral:#f5f0eb;
  }
  body { font-family:var(--sans); background:var(--paper); color:var(--ink); }
  .slide { padding:48px 58px; }
  .eyebrow, .r-kicker, .head .kick { color:var(--accent); letter-spacing:.09em; }
  .avatar { border:4px solid var(--paper); box-shadow:0 14px 34px rgba(18,16,20,.12); }
  .avatar--ini { color:var(--accent); font-family:var(--serif); }
  .chip { background:var(--neutral); border:1px solid var(--hair); color:rgba(18,16,20,.72); }
  .head { margin-bottom:18px; padding-top:2px; border-top:1px solid var(--hair); padding-top:12px; }
  .head .idx { color:var(--accent); font-family:var(--sans); font-size:15px; font-style:normal; font-weight:760; letter-spacing:.02em; }
  .head .kick { font-size:11px; font-weight:760; }

  /* Capa com a mesma lógica poster + retrato da landing. */
  .cover { justify-content:flex-start; position:relative; overflow:hidden; }
  .cover-brand { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:760; }
  .cover-brand img { width:30px; height:30px; border-radius:9px; }
  .cover-layout { display:grid; grid-template-columns:1.04fr .96fr; gap:48px; align-items:center; flex:1; min-height:0; }
  .cover-copy { position:relative; z-index:2; }
  .cover .eyebrow { text-align:left; margin-bottom:18px; }
  .cover-title { max-width:10ch; margin:0; text-align:left; font-family:var(--serif); font-size:64px; font-weight:760; line-height:.91; letter-spacing:-.06em; }
  .cover-title span { display:block; color:var(--accent); font-weight:610; }
  .cover-period { margin:22px 0 0; text-align:left; font-size:15px; color:var(--muted); }
  .cover-visual { position:relative; height:500px; overflow:hidden; border-radius:24px; background:var(--neutral); background-size:cover; background-position:center; box-shadow:0 24px 70px rgba(18,16,20,.14); }
  .cover-visual::after { content:''; position:absolute; inset:45% 0 0; background:linear-gradient(transparent,rgba(18,16,20,.72)); }
  .cover-visual-note { position:absolute; z-index:2; right:24px; bottom:22px; left:24px; color:#fff9f5; font-family:var(--serif); font-size:24px; font-weight:680; line-height:1.02; letter-spacing:-.035em; }
  .roster { position:absolute; z-index:4; right:58px; bottom:23px; left:58px; flex-direction:row; justify-content:flex-start; gap:0; max-width:none; padding-top:12px; border-top:1px solid rgba(18,16,20,.15); }
  .roster-linha { display:contents; }
  .person { width:auto; flex-direction:row; gap:5px; margin-right:14px; }
  .person .avatar, .roster--lg .person .avatar { width:24px; height:24px; border-width:1px; box-shadow:none; }
  .person-name { margin:0; font-size:10px; white-space:nowrap; }
  .person-handle { display:none; }

  /* Tempo A: o reel vira âncora e a descoberta domina a leitura. */
  .cr { grid-template-columns:280px 1fr; gap:38px; }
  .cr--reel { grid-template-columns:320px 1fr; grid-template-rows:auto 1fr; gap:18px 42px; }
  .cr--reel .cr-reel { grid-column:1; grid-row:1 / 3; }
  .cr--reel .cr-id { grid-column:2; grid-row:1; }
  .cr--reel .cr-verdict { grid-column:2; grid-row:2; }
  .cr-id { justify-content:center; }
  .cr--reel .cr-id { display:grid; grid-template-columns:72px 1fr; column-gap:16px; align-content:start; justify-content:stretch; }
  .cr--reel .cr-id .avatar { grid-row:1 / 4; width:72px; height:72px; margin:0; }
  .cr-id .avatar { width:96px; height:96px; }
  .cr-name { font-family:var(--serif); font-size:31px; font-weight:730; letter-spacing:-.045em; }
  .cr-handle { color:var(--muted); }
  .cr-narr { font-family:var(--sans); font-size:15px; font-style:normal; line-height:1.42; color:rgba(18,16,20,.66); margin:14px 0; }
  .cr--reel .cr-narr { grid-column:1 / 3; margin:12px 0 8px; }
  .cr--reel .cr-terr { grid-column:1 / 3; }
  .cr--reel .numeros { display:none; }
  .numeros { background:transparent; border:0; border-top:1px solid var(--hair); border-radius:0; }
  .num-cell { border-right:0; padding:10px 4px; text-align:left; }
  .num-val { font-family:var(--serif); font-size:22px; }
  .num-lab { font-size:9px; }
  .cr-verdict { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-content:center; }
  .coer { grid-column:1 / 3; background:transparent !important; border-top:1px solid var(--hair); border-bottom:1px solid var(--hair); border-radius:0; padding:10px 0; font-size:13px; }
  .pt { min-width:0; padding:17px 18px; border:0; border-radius:18px; background:var(--card); box-shadow:0 12px 32px rgba(18,16,20,.055); }
  .pt--forte { border-top:5px solid var(--forte); }
  .pt--ajustar { border-top:5px solid var(--ajustar); }
  .pt-head { gap:8px; }
  .pt-head .stat { font-size:12px; }
  .pt-texto { font-family:var(--serif); font-size:20px; line-height:1.14; letter-spacing:-.035em; }
  .pt-evid { font-size:12.5px; line-height:1.42; }
  .mv-legenda { display:none; }
  .venn { width:40px; height:30px; flex-basis:40px; }
  .reel { width:320px; height:520px; border-radius:22px; box-shadow:0 24px 65px rgba(18,16,20,.18); }
  .reel::after { background:linear-gradient(180deg,rgba(18,16,20,.03),rgba(18,16,20,.38)); }
  .reel-badge { top:16px; left:16px; background:var(--accent); }

  /* Tempo B: duas pautas como linhas editoriais, sem painel lilás. */
  .crB { max-width:none; gap:22px; justify-content:flex-start; padding-top:72px; }
  .crB .audiencia { max-width:1050px; font-size:20px; line-height:1.35; }
  .crB .audiencia .aud-lab { display:block; margin-bottom:6px; color:var(--map); font-size:12px; font-weight:760; letter-spacing:.08em; text-transform:uppercase; }
  .crB .passos { padding:20px 0; border:0; border-top:1px solid var(--hair); border-bottom:1px solid var(--hair); border-radius:0; background:transparent; }
  .crB .passos-head { color:var(--accent); font-size:12px; letter-spacing:.08em; }
  .crB .passos-lac { max-width:880px; margin-bottom:18px; font-size:13px; }
  .crB .passos-list { display:grid; grid-template-columns:1fr 1fr; gap:34px; counter-reset:pauta; }
  .crB .passos-list li { position:relative; counter-increment:pauta; gap:7px; padding-left:42px; }
  .crB .passos-list li::before { content:'0' counter(pauta); position:absolute; left:0; top:1px; color:var(--accent); font-size:12px; font-weight:780; letter-spacing:.06em; }
  .crB .pauta-t { font-family:var(--serif); font-size:26px; line-height:1.02; letter-spacing:-.045em; }
  .crB .pauta-p { font-size:13px; line-height:1.45; }
  .crB .marca { padding:18px 20px; border:0; border-radius:16px; background:linear-gradient(110deg,var(--accent),var(--coral) 62%,var(--map)); color:#fff9f5; font-size:14px; }
  .crB .marca .mlabel { color:#fff9f5; }
  .crB .marca b { color:#fff9f5; }

  /* Sem sinal: mapa + retomada em um único slide. */
  .cr--sem-sinal { grid-template-columns:320px 1fr; gap:56px; }
  .cr--sem-sinal .cr-verdict { display:flex; flex-direction:column; justify-content:center; }
  .pt--semsinal { padding:0 0 22px; border:0; border-bottom:1px solid var(--hair); border-radius:0; background:transparent; box-shadow:none; }
  .pt--semsinal .pt-texto { max-width:20ch; font-family:var(--serif); font-size:38px; line-height:.98; letter-spacing:-.05em; }
  .sem-pautas { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; }
  .sem-pautas--2 { grid-template-columns:1fr 1fr; gap:24px; }
  .sem-pauta { padding-top:12px; border-top:3px solid var(--map); }
  .sem-pauta b { display:block; font-family:var(--serif); font-size:18px; line-height:1.06; letter-spacing:-.035em; }
  .sem-pauta span { display:block; margin-top:7px; color:var(--muted); font-size:11.5px; line-height:1.38; }

  /* Collab: duas pessoas, uma ideia central, execução enxuta. */
  .collabX { grid-template-columns:1.05fr .95fr; gap:42px; }
  .cx-pair { width:100%; justify-content:space-between; margin-bottom:14px; }
  .cx-person { width:190px; }
  .cx-person .avatar { width:86px; height:86px; }
  .cx-name { font-family:var(--serif); font-size:22px; letter-spacing:-.04em; }
  .cx-traz { font-size:12.5px; }
  .collab-terr { background:var(--neutral); color:var(--map); border:1px solid var(--hair); }
  .cx-pauta { width:100%; margin:14px 0; padding:22px 24px; border-radius:20px; background:linear-gradient(135deg,var(--accent),var(--coral) 58%,var(--map)); color:#fff9f5; font-family:var(--serif); font-size:27px; font-style:normal; line-height:1.04; letter-spacing:-.045em; box-shadow:0 22px 55px rgba(233,15,79,.2); }
  .cx-pq { font-size:12.5px; }
  .cx-pq b { color:var(--accent); }
  .cx-right { border:0; border-radius:20px; background:var(--ink); color:#fff9f5; padding:26px 30px; }
  .cx-grava-lab { color:#ffb07f; }
  .cx-grava-sub { color:rgba(255,249,245,.62); }
  .cx-steps li { color:#fff9f5; font-size:14px; }
  .cx-steps li::before { background:var(--accent); color:#fff; }

  /* Mapa coletivo por territórios, em vez de catálogo de cards. */
  .sec-title { max-width:13ch; font-family:var(--serif); font-size:48px; line-height:.92; letter-spacing:-.055em; }
  .sec-lead { max-width:48ch; font-size:15px; }
  .territory-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; flex:1; margin-top:10px; }
  .territory-cluster { padding:18px; border-top:4px solid var(--map); background:var(--card); border-radius:0 0 18px 18px; }
  .territory-cluster h3 { font-family:var(--serif); font-size:20px; letter-spacing:-.035em; }
  .territory-people { display:flex; flex-wrap:wrap; gap:10px; margin-top:13px; }
  .territory-person { display:flex; align-items:center; gap:7px; color:rgba(18,16,20,.72); font-size:11px; font-weight:650; }
  .territory-person .avatar { width:30px; height:30px; border-width:2px; box-shadow:none; }
  .territory-links { grid-column:1 / 4; display:flex; gap:14px; padding-top:12px; border-top:1px solid var(--hair); }
  .territory-link { flex:1; color:rgba(18,16,20,.66); font-size:11px; }
  .territory-link b { color:var(--accent); }

  /* Respiros: contraste e calor da landing. */
  .slide--dark { background:var(--ink); }
  .slide--accent { background:linear-gradient(125deg,var(--accent),var(--coral) 60%,var(--map) 125%); }
  .slide--paper { background:var(--paper); }
  .r-kicker { letter-spacing:.09em; }
  .slide--dark .r-kicker, .slide--accent .r-kicker { color:#ffb07f; }
  .slide--paper .r-kicker { color:var(--accent); }
  .r-title { max-width:13ch; font-family:var(--serif); font-weight:730; line-height:.9; letter-spacing:-.06em; }
  .r-sub { max-width:38ch; font-size:16px; }
  .r-tag { letter-spacing:.09em; }
  .abertura-photo { position:absolute; inset:0; background-size:cover; background-position:center; opacity:.42; filter:saturate(.82); }
  .abertura-shade { position:absolute; inset:0; background:linear-gradient(90deg,rgba(18,16,20,.92),rgba(18,16,20,.58)); }
  .abertura-content { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; }
  .venn-leg { margin-top:30px; font-size:12px; }

  /* ── GALISTEU MINIMAL — caderno editorial, não dashboard ──────────── */
  .slide { padding:52px 64px; }
  .head { margin-bottom:22px; padding-top:11px; }
  .head .idx { font-size:15px; }
  .head .kick { font-size:13px; }

  /* Uma capa-pôster: marca, tese, data e uma única imagem. */
  .cover-layout { grid-template-columns:1.08fr .92fr; gap:64px; }
  .cover-title { max-width:9ch; font-size:72px; line-height:.88; }
  .cover-period { font-size:18px; line-height:1.4; }
  .cover-visual { height:520px; border-radius:20px; box-shadow:0 18px 48px rgba(18,16,20,.1); }
  .cover-visual::after, .cover-visual-note, .roster { display:none; }

  /* Tempo A: mídia + identidade compacta + duas leituras editoriais planas. */
  .cr { grid-template-columns:280px 1fr; gap:48px; }
  .cr--reel { grid-template-columns:300px 1fr; grid-template-rows:auto 1fr; gap:18px 48px; }
  .cr--reel .cr-id { grid-template-columns:64px 1fr; column-gap:16px; }
  .cr--reel .cr-id .avatar { width:64px; height:64px; border-width:2px; box-shadow:none; }
  .cr-id .avatar { border-width:2px; box-shadow:none; }
  .cr-name { font-size:34px; line-height:1; }
  .cr-handle { font-size:14px; }
  .cr-narr { margin:12px 0 7px; font-size:18px; line-height:1.35; }
  .cr-terr { color:var(--accent); font-size:14px; font-weight:700; letter-spacing:.01em; }
  .cr-verdict { grid-template-columns:1fr 1fr; gap:0; align-content:center; }
  .coer { grid-column:1 / 3; padding:13px 0; border-top:1px solid var(--hair); border-bottom:1px solid var(--hair); font-size:16px; line-height:1.4; }
  .coer .coer-dot { display:none; }
  .coer b { color:var(--accent) !important; }
  .pt { padding:22px 28px 8px 0; border:0; border-radius:0; background:transparent; box-shadow:none; }
  .pt + .pt { padding-right:0; padding-left:28px; border-left:1px solid var(--hair); }
  .pt--forte, .pt--ajustar { border-top:0; }
  .pt-label, .pt--forte .pt-label, .pt--ajustar .pt-label { color:var(--accent); font-size:13px; }
  .pt-head { min-height:20px; margin-bottom:11px; }
  .pt-head .stat { margin-left:auto; color:var(--muted); font-size:14px; }
  .pt-texto { font-size:25px; line-height:1.08; }
  .pt-evid { margin-top:12px; color:var(--muted); font-size:17px; line-height:1.42; }
  .venn, .mv-legenda { display:none; }
  .reel { width:300px; height:500px; border-radius:18px; box-shadow:0 18px 48px rgba(18,16,20,.14); }
  .reel-badge { top:14px; left:14px; padding:5px 10px; background:var(--ink); font-size:11px; }

  /* Tempo B: uma conclusão, duas pautas e um rodapé de marca. */
  .crB { gap:25px; padding-top:30px; }
  .crB .audiencia { max-width:34ch; padding:0; color:var(--ink); background:transparent; font-family:var(--serif); font-size:32px; line-height:1.08; letter-spacing:-.035em; }
  .crB .audiencia .aud-lab { margin-bottom:9px; color:var(--accent); font-family:var(--sans); font-size:13px; }
  .crB .passos { padding:22px 0; }
  .crB .passos-head { font-size:13px; }
  .crB .passos-lac { max-width:68ch; margin:8px 0 20px; font-size:17px; line-height:1.4; }
  .crB .passos-list { gap:48px; }
  .crB .passos-list li { padding-left:42px; }
  .crB .passos-list li::before { font-size:14px; }
  .crB .pauta-t { font-size:28px; line-height:1.04; }
  .crB .pauta-p { margin-top:9px; font-size:17px; line-height:1.42; }
  .crB .marca { padding:14px 0 0; border:0; border-top:2px solid var(--accent); border-radius:0; background:transparent; color:var(--ink); font-size:17px; line-height:1.42; }
  .crB .marca .mlabel { color:var(--accent); }
  .crB .marca b { color:var(--ink); }
  .comp { font-size:16px; }

  /* Sem-sinal continua calmo e usa o mapa como ponto de retomada. */
  .pt--semsinal { padding:0 0 24px; }
  .pt--semsinal .pt-texto { font-size:42px; }
  .sem-pauta { border-top:1px solid var(--hair); }
  .sem-pauta b { font-size:25px; }
  .sem-pauta span { font-size:17px; }

  /* Collab: sem banner, sem card escuro, sem ícone ornamental. */
  .collabX { grid-template-columns:1fr 1fr; gap:54px; }
  .cx-pair { justify-content:flex-start; gap:24px; }
  .cx-person { width:190px; }
  .cx-person .avatar { width:74px; height:74px; border-width:2px; box-shadow:none; }
  .cx-name { font-size:24px; }
  .cx-handle { font-size:13px; }
  .cx-traz { font-size:16px; line-height:1.38; }
  .cx-x { color:var(--accent); font-size:30px; }
  .collab-terr { padding:0; border:0; border-radius:0; background:transparent; color:var(--accent); font-size:13px; letter-spacing:.07em; text-transform:uppercase; }
  .cx-pauta { margin:18px 0 14px; padding:19px 0 0; border-top:2px solid var(--accent); border-radius:0; background:transparent; box-shadow:none; color:var(--ink); font-size:32px; line-height:1.02; }
  .cx-pq { font-size:17px; line-height:1.42; }
  .cx-right { padding:8px 0 0 34px; border:0; border-left:1px solid var(--hair); border-radius:0; background:transparent; color:var(--ink); }
  .cx-grava-lab { color:var(--accent); font-size:14px; }
  .cx-grava-sub { color:var(--muted); font-size:16px; }
  .cx-steps { margin-top:24px; }
  .cx-steps li { color:var(--ink); font-size:18px; line-height:1.4; }
  .cx-steps li::before { background:var(--accent); color:var(--paper); }

  /* Constelação como índice editorial — linhas, não mosaico de cartões. */
  .sec-title { font-size:48px; }
  .sec-lead { margin-top:13px; font-size:18px; }
  .territory-grid { gap:0 32px; margin-top:24px; }
  .territory-cluster { padding:17px 0; border-top:1px solid var(--hair); border-radius:0; background:transparent; }
  .territory-cluster h3 { font-size:23px; }
  .territory-people { gap:12px 16px; }
  .territory-person { font-size:14px; }
  .territory-person .avatar { width:28px; height:28px; border-width:1px; }
  .territory-links { gap:30px; padding-top:15px; }
  .territory-link { font-size:14px; line-height:1.4; }

  /* Respiros monocromáticos: o contraste vem da escala, não do gradiente. */
  .slide--accent { background:var(--ink); }
  .slide--dark .r-kicker, .slide--accent .r-kicker { color:var(--accent); }
  .r-title { max-width:14ch; }
  .r-sub { font-size:18px; }
  .abertura-photo { opacity:.34; filter:saturate(.72); }
  .abertura-shade { background:rgba(18,16,20,.72); }
  .abertura-content { align-items:flex-start; }
  .venn-leg { display:none; }

  /* ── GALISTEU V4 — identidade institucional + narrativa em três tempos ── */
  .cover-v4 { position:relative; justify-content:center; align-items:center; overflow:hidden; text-align:center; }
  .cover-v4-copy { width:100%; max-width:1080px; display:flex; flex-direction:column; align-items:center; }
  .cover-v4 .eyebrow { font-size:15px; letter-spacing:.12em; }
  .cover-v4-title { max-width:11ch; margin-top:20px; font-family:var(--serif); font-size:116px; font-weight:780; line-height:.82; letter-spacing:-.078em; text-align:center; }
  .cover-v4-sub { max-width:44ch; margin-top:34px; color:var(--muted); font-size:24px; line-height:1.36; text-align:center; }
  .cover-v4-meta { margin-top:27px; color:var(--accent); font-size:14px; font-weight:760; letter-spacing:.1em; text-transform:uppercase; text-align:center; }

  .opening-v4 { position:relative; justify-content:center; overflow:hidden; }
  .opening-v4::after { content:''; position:absolute; right:-140px; bottom:-280px; width:720px; height:720px; border:2px solid rgba(233,15,79,.22); border-radius:50%; }
  .opening-v4 .abertura-content { width:100%; max-width:none; display:grid; grid-template-columns:1.08fr .92fr; gap:92px; align-items:center; }
  .opening-v4 .r-title { max-width:10ch; font-size:72px !important; line-height:.88; }
  .opening-left { position:relative; z-index:2; }
  .opening-proofs { position:relative; z-index:2; border-top:1px solid rgba(255,255,255,.2); }
  .opening-proof { display:grid; grid-template-columns:142px 1fr; gap:22px; align-items:center; padding:20px 0; border-bottom:1px solid rgba(255,255,255,.2); }
  .opening-proof strong { color:#fff9f5; font-family:var(--serif); font-size:45px; line-height:1; letter-spacing:-.05em; }
  .opening-proof-meta { color:rgba(255,249,245,.67); font-size:15px; line-height:1.3; }
  .opening-proof-meta b { display:block; color:#ff3f75; font-size:14px; letter-spacing:.04em; text-transform:uppercase; }
  .opening-owner { display:block; margin-top:4px; color:#fff9f5; font-size:18px; font-weight:760; }
  .opening-case { display:block; color:rgba(255,249,245,.58); }
  .opening-counts { display:flex; gap:34px; margin-top:42px; padding-top:22px; border-top:1px solid rgba(255,255,255,.18); }
  .opening-count { color:rgba(255,249,245,.66); font-size:16px; }
  .opening-count b { display:block; color:#fff9f5; font-family:var(--serif); font-size:34px; line-height:1; }

  /* Tempo 1: evidência. O reel e o acerto são os únicos protagonistas. */
  .beatA { display:grid; grid-template-columns:340px 1fr; gap:58px; flex:1; min-height:0; }
  .beatA-media { display:flex; align-items:flex-start; }
  .beatA .reel { width:340px; height:510px; }
  .beatA-main { display:flex; flex-direction:column; justify-content:center; min-width:0; padding:18px 0 16px; }
  .beatA-id { display:grid; grid-template-columns:60px 1fr; gap:15px; align-items:center; }
  .beatA-id .avatar { width:60px; height:60px; box-shadow:none; }
  .beatA-id .cr-name { font-size:31px; }
  .beatA-id .cr-handle { margin-top:4px; }
  .beatA-narr { max-width:34ch; margin-top:22px; color:var(--muted); font-size:18px; line-height:1.4; }
  .beatA-terr { margin-top:9px; color:var(--accent); font-size:14px; font-weight:760; }
  .beatA-strong { margin-top:38px; padding-top:24px; border-top:1px solid var(--hair); }
  .beat-label { color:var(--accent); font-size:13px; font-weight:780; letter-spacing:.09em; text-transform:uppercase; }
  .beat-stat { margin-left:18px; color:var(--muted); font-size:15px; }
  .beat-stat b { color:var(--ink); }
  .beat-claim { max-width:20ch; margin-top:13px; font-family:var(--serif); font-weight:760; line-height:.98; letter-spacing:-.048em; }
  .beat-evidence { max-width:52ch; margin-top:15px; color:var(--muted); font-size:18px; line-height:1.45; }

  /* Tempo 2: interpretação. Coerência, ajuste e pedido da audiência. */
  .beatB { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:minmax(0,1fr) auto; gap:28px 54px; flex:1; min-height:0; padding:28px 0 10px; }
  .learn-coer { max-width:none; padding-right:20px; }
  .learn-coer .learn-title { margin-top:10px; font-family:var(--serif); font-size:35px; font-weight:730; line-height:1.02; letter-spacing:-.043em; }
  .learn-adjust { max-width:none; margin:0; padding:0 0 0 54px; border:0; border-left:1px solid var(--hair); }
  .learn-adjust .beat-claim { max-width:none; }
  .learn-adjust .beat-evidence { max-width:40ch; font-size:16px; }
  .learn-audience { grid-column:1 / 3; display:grid; grid-template-columns:185px 1fr; gap:30px; align-items:start; margin:0; padding-top:18px; border-top:2px solid var(--accent); }
  .learn-audience p { max-width:64ch; font-family:var(--serif); font-size:23px; line-height:1.08; letter-spacing:-.03em; }
  .learn-comp { display:none; }

  /* Tempo 3: duas pautas reais para a próxima semana; marca vira rodapé. */
  .beatC { display:grid; grid-template-columns:1.08fr .92fr; grid-template-rows:minmax(0,1fr) auto; gap:38px 64px; flex:1; min-height:0; padding:36px 0 12px; }
  .next-main { min-width:0; padding-right:18px; }
  .next-main h2 { max-width:13ch; margin-top:16px; font-family:var(--serif); font-weight:770; line-height:.94; letter-spacing:-.056em; }
  .next-main p { max-width:46ch; margin-top:20px; color:var(--muted); font-size:19px; line-height:1.43; }
  .next-alts { display:flex; flex-direction:column; justify-content:center; min-width:0; padding-left:54px; border-left:1px solid var(--hair); }
  .next-alt { padding:22px 0; border-top:1px solid var(--hair); }
  .next-alt:first-child { border-top:2px solid var(--accent); }
  .next-alt h3 { max-width:18ch; margin-top:10px; font-family:var(--serif); font-size:33px; line-height:1.02; letter-spacing:-.042em; }
  .next-alt p { max-width:36ch; margin-top:14px; color:var(--muted); font-size:17px; line-height:1.4; }
  .next-brand { grid-column:1 / 3; display:grid; grid-template-columns:180px 1fr; gap:28px; align-items:start; padding-top:18px; border-top:1px solid var(--hair); color:var(--muted); font-size:16px; line-height:1.4; }
  .next-brand b { color:var(--ink); }

  /* Collabs e mapa coletivo sem metadados repetidos. */
  .cx-handle { display:none; }
  .cx-traz { max-width:18ch; }
  .cx-steps li:nth-child(n+4) { display:none; }
  .territory-cluster { background:transparent; }
  .territory-names { margin-top:13px; color:var(--muted); font-size:15px; line-height:1.45; }
  .territory-links { display:none; }
`;

function shell(inner: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${inner}</body></html>`;
}

/** Rótulo minúsculo junto do mini-Venn, lembrando o que os círculos significam —
 *  só na primeira ocorrência (ponto forte) do slide, pra não duplicar no ajustar. */
function miniVennLegendaInline(): string {
  return `<div class="mv-legenda">
    <span style="color:${CIRC.narrativa}">●</span> Narrativa
    <span style="color:${CIRC.audiencia}">●</span> Audiência
    <span style="color:${CIRC.marca}">●</span> Marca
  </div>`;
}

function ponto(p: Ponto, kind: "forte" | "ajustar"): string {
  const label = kind === "forte" ? "Ponto forte" : "Ponto a ajustar";
  return `<div class="pt pt--${kind}">
    <div class="pt-head"><span class="pt-label">${label}</span>${statPill(p)}</div>
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
  return shell(`<div class="slide cover-v4">
    <div class="cover-v4-copy">
      <div class="eyebrow">Reunião da comunidade · ${esc(formatData(d.reuniao.data))}</div>
      <h1 class="cover-v4-title">A pauta forte tem dono.</h1>
      <div class="cover-v4-sub">${esc(d.reuniao.titulo ?? "Uma semana lida em conjunto")}</div>
      <div class="cover-v4-meta">${ps.length} criador${ps.length === 1 ? "" : "es"} · leitura editorial data2content</div>
    </div>
  </div>`);
}

/** Banner de coerência da semana (Tempo A) — a lente-assinatura do D2C, 1 linha calma. */
function coerenciaBanner(c: CriadorSlide): string {
  if (!c.coerencia) return "";
  const m: Record<string, [string, string]> = {
    "no-mapa": ["A história apareceu", "ok"],
    parcial: ["Mistura de assuntos", "mid"],
    automatico: ["A voz ficou em segundo plano", "alert"],
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
    : `<div class="cr-narr">Mapa em construção: primeiro vamos definir a história que só este perfil pode contar.</div>`;
  const semPautas = c.semSinal && c.proximosPassos?.pautas?.length
    ? `<div class="sem-pautas ${c.proximosPassos.pautas.length < 3 ? "sem-pautas--2" : ""}">${c.proximosPassos.pautas.slice(0, 3).map((p) =>
        `<div class="sem-pauta"><b>${rich(p.titulo)}</b><span>${rich(p.porque)}</span></div>`).join("")}</div>`
    : "";
  const verdict = c.semSinal
    ? `<div class="pt pt--ajustar pt--semsinal"><div class="pt-label" style="color:var(--ajustar)">Situação dos dados</div>
        <div class="pt-texto">${rich(c.falaSugerida ?? "Não houve publicação nesta semana. A retomada começa pelo mapa.")}</div></div>${semPautas}`
    : "";
  const temReel = !!(c.reel && c.reel.postId);
  // Handle às vezes vem preenchido com o próprio nome (criador sem @ real, ex.: sem Instagram
  // conectado) — mostrar os dois empilhados parece duplicidade/bug, não informação nova.
  const normaliza = (s: string) => s.toLowerCase().replace(/^dra?\.?\s+/, "").replace(/[^a-z0-9]/g, "");
  const handleRedundante = !c.handle || normaliza(c.handle) === normaliza(c.nome);
  const retomadaKick = c.retomadaFonte === "historico"
    ? "Retomada pelo histórico"
    : c.retomadaFonte === "cadastro"
      ? "Ponto de partida"
      : "Retomada pelo mapa";
  if (c.semSinal) return shell(`<div class="slide">
    ${crHead(c, idx, total, retomadaKick)}
    <div class="cr cr--sem-sinal">
      <div class="cr-id">
        ${avatar(c.nome, c.profilePictureUrl)}
        <div class="cr-name">${esc(c.nome)}</div>
        ${handleRedundante ? "" : `<div class="cr-handle">${esc(c.handle)}</div>`}
        ${narr}
        <div class="cr-terr">${c.territorios.slice(0, 3).map(tituleCase).map(esc).join(" · ")}</div>
        ${numerosStrip(c)}
      </div>
      <div class="cr-verdict">${verdict}</div>
    </div>
  </div>`);
  const stat = c.pontoForte.stat
    ? `<span class="beat-stat"><b>${esc(c.pontoForte.stat.valor)}</b> ${esc(c.pontoForte.stat.label)}</span>`
    : "";
  return shell(`<div class="slide">
    ${crHead(c, idx, total, "O que funcionou")}
    <div class="beatA">
      <div class="beatA-media">${temReel ? videoWindow(c) : ""}</div>
      <div class="beatA-main">
        <div class="beatA-id">
          ${avatar(c.nome, c.profilePictureUrl)}
          <div><div class="cr-name">${esc(c.nome)}</div>${handleRedundante ? "" : `<div class="cr-handle">${esc(c.handle)}</div>`}</div>
        </div>
        <div class="beatA-narr">${c.narrativaCentral ? `“${esc(c.narrativaCentral)}”` : "Mapa ainda sem narrativa central definida."}</div>
        <div class="beatA-terr">${c.territorios.slice(0, 3).map(tituleCase).map(esc).join(" · ")}</div>
        <div class="beatA-strong">
          <span class="beat-label">Ponto forte</span>${stat}
          <div class="beat-claim" style="font-size:${claimEscala(c.pontoForte.texto, 44, 38, 33)}px">${rich(c.pontoForte.texto)}</div>
          <div class="beat-evidence">${rich(c.pontoForte.evidencia)}</div>
        </div>
      </div>
    </div>
  </div>`);
}

/** Tempo B — "O que vem": o que a audiência pediu → próximos passos → a marca.
 *  A direção, com ar. O gráfico da semana entra discreto no rodapé como contexto. */
export function criadorSlideB(c: CriadorSlide, idx: number, total: number): string {
  const coerTexto = c.coerencia?.resumo ?? "";
  const coer = c.coerencia
    ? `<div class="learn-coer"><span class="beat-label">O que os posts mostraram</span><div class="learn-title" style="font-size:${claimEscala(coerTexto, 36, 31, 27)}px">${rich(coerTexto)}</div></div>`
    : "";
  const comparativo = c.comparativo
    ? `<div class="learn-comp">↺ Desde a última: ${rich(c.comparativo)}</div>`
    : "";
  return shell(`<div class="slide">
    ${crHead(c, idx, total, "O que aprendemos")}
    <div class="beatB">
      ${coer}
      <div class="learn-adjust">
        <span class="beat-label">Como melhorar</span>
        <div class="beat-claim" style="font-size:${claimEscala(c.pontoAjustar.texto, 35, 31, 27)}px">${rich(c.pontoAjustar.texto)}</div>
        <div class="beat-evidence">${rich(c.pontoAjustar.evidencia)}</div>
      </div>
      ${c.audienciaPede ? `<div class="learn-audience"><span class="beat-label">Primeira ação</span><p>${rich(c.audienciaPede)}</p></div>` : ""}
      ${comparativo}
    </div>
  </div>`);
}

/** Tempo C — uma decisão editorial clara, com alternativa e encaixe de marca discretos. */
export function criadorSlideC(c: CriadorSlide, idx: number, total: number): string {
  const pautas = c.proximosPassos?.pautas ?? [];
  const principal = pautas[0];
  const alternativas = pautas.slice(1, 3);
  const marca = c.ganchoMarca;
  const fallback = c.falaSugerida ?? "Transformar o aprendizado da semana em uma nova publicação.";
  return shell(`<div class="slide">
    ${crHead(c, idx, total, "Pautas para a próxima semana")}
    <div class="beatC">
      <div class="next-main">
        <span class="beat-label">01 · Começar por aqui</span>
        <h2 style="font-size:${claimEscala(principal?.titulo ?? fallback, 52, 46, 39)}px">${rich(principal?.titulo ?? fallback)}</h2>
        ${principal?.porque ? `<p>${rich(principal.porque)}</p>` : ""}
      </div>
      <div class="next-alts">${(alternativas.length ? alternativas : [{ titulo: "Outra forma de contar a mesma verdade", porque: "" }]).map((p, i) => `<div class="next-alt"><span class="beat-label">${String(i + 2).padStart(2, "0")} · Outra pauta</span><h3>${rich(p.titulo)}</h3>${p.porque ? `<p>${rich(p.porque)}</p>` : ""}</div>`).join("")}</div>
      <div class="next-brand"><span class="beat-label">Marca que pode entrar</span><div><b>${marca?.exemplo ? esc(marca.exemplo) : "Categoria aderente ao território"}</b>${marca?.categoria ? ` · ${rich(marca.categoria)}` : ""}</div></div>
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
    ? `<ol class="cx-steps">${c.gravarPassos.slice(0, 3).map((p) => `<li>${rich(p)}</li>`).join("")}</ol>`
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
        <div class="cx-grava-lab">Como gravar à distância</div>
        <div class="cx-grava-sub">Cada pessoa grava a sua parte; o formato conecta as duas casas.</div>
        ${passos}
      </div>
    </div>
  </div>`);
}

/** Constelação da comunidade: quem ocupa qual território + as collabs como
 *  Só o MAPA de territórios (os pares detalhados vivem no slide de Collabs). */
export function constelacaoSlide(d: DeckData): string {
  if (d.criadores.length === 0) return "";
  const grupos = new Map<string, CriadorSlide[]>();
  for (const c of d.criadores) {
    const territorios = c.territorios.length
      ? [...new Set(c.territorios.map(territorioCanonico))]
      : ["Mapa em construção"];
    for (const territorio of territorios) {
      const key = territorio.trim() || "Mapa em construção";
      const bucket = grupos.get(key) ?? [];
      if (!bucket.includes(c)) bucket.push(c);
      grupos.set(key, bucket);
    }
  }
  const clusters = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const clusterHtml = clusters.map(([key, people]) => `<article class="territory-cluster">
    <h3>${esc(key)}</h3>
    <div class="territory-names">${people.map((c) => esc(c.nome)).join(" · ")}</div>
  </article>`).join("");
  return shell(`<div class="slide">
    <div class="eyebrow">A comunidade da semana</div>
    <h2 class="sec-title">Quem ocupa qual território</h2>
    <div class="sec-lead">Quando alguém domina um assunto, outra pessoa da sala já sabe quem chamar.</div>
    <div class="territory-grid">${clusterHtml}</div>
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

function claimEscala(t: string, curta: number, media: number, longa: number): number {
  const n = (t ?? "").replace(/<[^>]+>/g, "").length;
  if (n <= 58) return curta;
  if (n <= 105) return media;
  return longa;
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
  const regra = "A pauta forte tem dono reconhecível.";
  const normaliza = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const numero = (s: string): number => {
    const limpo = s.replace(/\./g, "").replace(",", ".");
    return Number(limpo.match(/[\d.]+/)?.[0] ?? 0);
  };
  const casoDe = (texto: string): string => {
    const corpus = normaliza(texto);
    const casos: [RegExp, string][] = [
      [/goya|prova/, "Prova da Goya"],
      [/feriado/, "Vlog de feriado"],
      [/decisao.*casa|casa.*decisao/, "Decisão da casa"],
      [/tanabata/, "Tanabata"],
      [/core/, "Treino de core"],
      [/sexta/, "Sexta em família"],
      [/caipirinha/, "Caipirinha"],
    ];
    return casos.find(([rx]) => rx.test(corpus))?.[1] ?? "Post mais forte";
  };
  const provas = d.criadores
    .filter((c) => !c.semSinal && c.pontoForte?.stat?.valor)
    .map((c) => ({
      valor: c.pontoForte.stat!.valor,
      metrica: c.pontoForte.stat!.label,
      dono: c.nome,
      caso: casoDe(`${c.pontoForte.texto} ${c.pontoForte.evidencia}`),
      ordem: numero(c.pontoForte.stat!.valor),
    }))
    .sort((a, b) => b.ordem - a.ordem)
    .slice(0, 3);
  return shell(`<div class="slide respiro slide--dark opening-v4">
    <div class="abertura-content">
      <div class="opening-left"><div class="r-kicker">O fio da semana</div><div class="r-title">${regra}</div></div>
      <div class="opening-proofs">${provas.map((p) => `<div class="opening-proof"><strong>${esc(p.valor)}</strong><div class="opening-proof-meta"><b>${esc(p.metrica)}</b><span class="opening-owner">${esc(p.dono)}</span><span class="opening-case">“${esc(p.caso)}”</span></div></div>`).join("")}</div>
    </div>
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
