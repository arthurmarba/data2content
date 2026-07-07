// scripts/relatorio/lib/reportTemplates.ts
//
// Template HTML do Relatório Semanal do Criador (Galileia) — documento A4
// multipágina, didático e visual. Mesma alma editorial do Galeano (Playfair +
// Poppins, papel off-white, accent violeta), mas formato de relatório.
//
// ESTRUTURA EM 3 ATOS (conta uma história):
//   Ato 1 — Sua semana    : capa + o que você publicou (crítica post a post)
//   Ato 2 — O que isso diz : audiência → cobrança da semana passada → veredito
//   Ato 3 — Seu plano      : pautas da próxima semana
//
// LINGUAGEM VISUAL (eixos separados, sem ambiguidade):
//   COR  = identidade do círculo  → Narrativa=terracota, Audiência=azul, Marca=verde
//   FORMA= julgamento             → preenchido (acertou) / meio (parcial) / vazio (não)
// Cada post é "plotado" num mini-Venn com os mesmos 3 círculos da capa.

import type { ReportData, PostAvaliacao, Selo, Veredito, Mira } from "./types";

// ─── Identidade fixa dos 3 círculos (cor) ───────────────────────────────────
const CIRC = { narrativa: "#C9603F", audiencia: "#2F6F8F", marca: "#4E8D5B" } as const;
// Julgamento → preenchimento (forma), nunca outra cor.
const FILL: Record<Selo, number> = { verde: 0.85, amarelo: 0.4, vermelho: 0.07, fraco: 0.07 };
const SYM: Record<Selo, string> = { verde: "✓", amarelo: "~", vermelho: "✕", fraco: "?" };

const VEREDITO_LABEL: Record<Veredito, string> = {
  repetir: "Repetir",
  ajustar: "Ajustar",
  "nao-repetir": "Não repetir",
};
const VEREDITO_COR: Record<Veredito, string> = {
  repetir: "#2e7d52",
  ajustar: "#c79a2e",
  "nao-repetir": "#b5462f",
};
const MIRA_LABEL: Record<Mira, string> = {
  centro: "mira o centro",
  "narrativa+audiencia": "narrativa + audiência",
  "narrativa+marca": "narrativa + marca",
  narrativa: "reforça a narrativa",
};

const esc = (s: string): string =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeiro = partes[0];
  if (!primeiro) return "·";
  if (partes.length === 1) return primeiro.slice(0, 2).toUpperCase();
  const ultimo = partes[partes.length - 1] ?? primeiro;
  return `${primeiro[0] ?? ""}${ultimo[0] ?? ""}`.toUpperCase();
}

function avatar(nome: string, fotoUrl: string | null, big = false): string {
  const cls = big ? "avatar avatar--lg" : "avatar";
  if (fotoUrl) return `<div class="${cls}" style="background-image:url('${esc(fotoUrl)}')"></div>`;
  return `<div class="${cls} avatar--ini">${esc(iniciais(nome))}</div>`;
}

/** Régua de uma linha (substitui o Venn na capa): nomeia os 3 círculos nas
 *  cores de identidade, ensinando a leitura dos mini-Venns dos posts. */
function reguaLinha(): string {
  return `<div class="cover-regua">A régua da semana —
    <b style="color:${CIRC.narrativa}">Narrativa</b> ·
    <b style="color:${CIRC.audiencia}">Audiência</b> ·
    <b style="color:${CIRC.marca}">Marcas</b>. A narrativa é a âncora.</div>`;
}

/** Mini-Venn do post: mesmos 3 círculos da capa, preenchidos pelo julgamento. */
function miniVenn(p: PostAvaliacao): string {
  const c = (cor: string, selo: Selo, cx: number, cy: number) =>
    `<circle cx="${cx}" cy="${cy}" r="16" fill="${cor}" fill-opacity="${FILL[selo]}" stroke="${cor}" stroke-width="1.5"${
      selo === "fraco" ? ' stroke-dasharray="2 2"' : ""
    }/>`;
  return `<svg viewBox="0 0 72 56" class="mini-venn" role="img" aria-label="posição do post nos três círculos">
    ${c(CIRC.narrativa, p.narrativa, 36, 18)}
    ${c(CIRC.audiencia, p.audiencia, 26, 36)}
    ${c(CIRC.marca, p.marca, 46, 36)}
  </svg>`;
}

/** Legenda do mini-Venn: palavra na COR do círculo + símbolo do julgamento. */
function sealCap(p: PostAvaliacao): string {
  const item = (label: string, selo: Selo, cor: string) =>
    `<span class="sc-item"><span style="color:${cor}">${label}</span> <b class="sc-sym">${SYM[selo]}</b></span>`;
  return `<div class="seal-cap">
    ${item("Narrativa", p.narrativa, CIRC.narrativa)}
    ${item("Audiência", p.audiencia, CIRC.audiencia)}
    ${item("Marca", p.marca, CIRC.marca)}
  </div>`;
}

function postCard(p: PostAvaliacao): string {
  const thumb = p.thumbnailUrl
    ? `<div class="pc-thumb" style="background-image:url('${esc(p.thumbnailUrl)}')"></div>`
    : `<div class="pc-thumb pc-thumb--empty"></div>`;
  const stat = p.stat
    ? `<div class="pc-stat"><b>${esc(p.stat.valor)}</b> ${esc(p.stat.label)}</div>`
    : "";
  return `<div class="post-card">
    ${thumb}
    <div class="pc-body">
      <div class="pc-head">
        <span class="pc-date">${esc(p.postDate)}</span>
        <span class="pc-veredito" style="--vc:${VEREDITO_COR[p.veredito]}">${VEREDITO_LABEL[p.veredito]}</span>
      </div>
      <div class="pc-oque">${esc(p.oQueEra)}</div>
      <div class="pc-seal">${miniVenn(p)}${sealCap(p)}</div>
      ${stat}
      <div class="pc-line pc-up"><b>Funcionou.</b> ${esc(p.funcionou)}</div>
      <div class="pc-line pc-down"><b>Enfraqueceu.</b> ${esc(p.enfraqueceu)}</div>
    </div>
  </div>`;
}

/** Faixa de capa — só sinais que servem ao PLANEJAMENTO (sem vaidade).
 *  Calculada dos dados: nº de posts, quantos caíram no ponto-ouro, território forte. */
function coverStats(r: ReportData): string {
  const posts = r.avaliacoes.length;
  const centro = r.avaliacoes.filter(
    (a) => a.narrativa === "verde" && (a.audiencia === "verde" || a.marca === "verde"),
  ).length;
  const forte = r.audiencia.itens.find((i) => i.sinal === "alto")?.dimensao ?? r.criador.territorios[0] ?? "—";

  const numCell = (valor: string, label: string) =>
    `<div class="num-cell"><div class="num-valor">${esc(valor)}</div><div class="num-label">${esc(label)}</div></div>`;
  const txtCell = (valor: string, label: string) =>
    `<div class="num-cell"><div class="num-valor num-valor--txt">${esc(valor)}</div><div class="num-label">${esc(label)}</div></div>`;

  const cells = [numCell(String(posts), "posts na semana")];
  if (posts > 0) cells.push(numCell(`${centro} de ${posts}`, "no ponto-ouro"));
  cells.push(txtCell(forte, "território mais forte"));
  return `<div class="numeros">${cells.join("")}</div>`;
}

function actDivider(n: number, titulo: string, sub: string): string {
  return `<div class="act"><span class="act-n">Ato ${n}</span><span class="act-t">${esc(titulo)}</span><span class="act-sub">${esc(sub)}</span></div>`;
}

function sectionHeader(kicker: string, titulo: string, lead?: string): string {
  return `<div class="kicker">${esc(kicker)}</div><h2 class="section-title">${esc(titulo)}</h2>${
    lead ? `<p class="block-lead">${esc(lead)}</p>` : ""
  }`;
}

/** Cobrança da semana anterior — vive no Ato 2, colada ao veredito. */
function recapSection(r: ReportData): string {
  if (!r.comparativo) return "";
  const sym = { sim: "✓", parcial: "~", nao: "✕" } as const;
  const col = { sim: "#2e7d52", parcial: "#c79a2e", nao: "#b5462f" } as const;
  const linhas = r.comparativo.prometido
    .map(
      (i) => `<li><span class="cmp-mark" style="color:${col[i.cumpriu]}">${sym[i.cumpriu]}</span>
        <span class="cmp-item">${esc(i.item)}</span>
        <span class="cmp-nota">${esc(i.nota)}</span></li>`,
    )
    .join("");
  return `<section class="block recap">
    <div class="recap-head">↺ Desde a última conversa</div>
    <p class="recap-delta">${esc(r.comparativo.delta)}</p>
    <ul class="cmp-list">${linhas}</ul>
  </section>`;
}

function audienciaSection(r: ReportData): string {
  const w = { alto: 100, medio: 60, baixo: 28 } as const;
  const barras = r.audiencia.itens
    .map(
      (i) => `<div class="aud-row">
        <span class="aud-dim">${esc(i.dimensao)}</span>
        <span class="aud-bw"><span class="aud-bar"><span class="aud-fill" style="width:${w[i.sinal]}%"></span></span></span>
        <span class="aud-nota">${esc(i.nota)}</span>
      </div>`,
    )
    .join("");
  return `<section class="block">
    ${sectionHeader("A demanda", "O que sua audiência está pedindo", r.audiencia.resumo)}
    <div class="aud-grid">${barras}</div>
    <p class="block-foot">Lido por <b>salvamentos e compartilhamentos</b> — pedido real, não alcance.</p>
  </section>`;
}

function facaSection(r: ReportData): string {
  const li = (arr: string[]) => arr.map((x) => `<li>${esc(x)}</li>`).join("");
  return `<section class="block">
    ${sectionHeader("O veredito", "Faça mais, faça menos")}
    <div class="faca-grid">
      <div class="faca faca--mais"><div class="faca-head">✅ Faça mais</div><ul>${li(r.facaMais)}</ul></div>
      <div class="faca faca--menos"><div class="faca-head">⛔ Faça menos</div><ul>${li(r.facaMenos)}</ul></div>
    </div>
  </section>`;
}

function planoSection(r: ReportData): string {
  const cards = r.plano
    .map(
      (p) => `<div class="plano-card">
        <div class="plano-titulo">${esc(p.titulo)}</div>
        <div class="plano-porque">${esc(p.porque)}</div>
        <div class="plano-mira">${MIRA_LABEL[p.mira]}</div>
      </div>`,
    )
    .join("");
  return `<section class="block">
    ${sectionHeader("O caminho", "Seu plano para a próxima semana")}
    <div class="plano-grid">${cards}</div>
  </section>`;
}

export function renderReportHtml(r: ReportData): string {
  const c = r.criador;
  const avaliacoes = r.avaliacoes.map(postCard).join("");
  const semPosts =
    r.avaliacoes.length === 0
      ? `<p class="block-lead">Nenhum conteúdo publicado neste período. Tudo bem — o plano abaixo é o ponto de partida.</p>`
      : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,800;0,900;1,600;1,700&family=Poppins:wght@300;400;500;600;700&display=swap');
  @page { size: A4; margin: 0; }
  :root {
    --paper:#f6f6fa; --card:#fff; --ink:#1a1426; --muted:#7c798c; --hair:#e6e4ee;
    --serif:'Playfair Display',serif; --accent:#6c2db5;
  }
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { margin:0; font-family:'Poppins',system-ui,sans-serif; color:var(--ink); background:var(--paper); }
  .page { width:210mm; height:290mm; padding:18mm 16mm; page-break-after:always; overflow:hidden; }
  .content { padding:16mm 16mm 0; }

  /* Capa — foto + narrativa em destaque */
  .cover { display:flex; flex-direction:column; }
  .cover-hero { text-align:center; flex:1 1 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4mm 0; }
  .avatar { width:60px; height:60px; flex:0 0 60px; border-radius:50%; background-size:cover; background-position:center; background-color:#ece9f3; border:2px solid #fff; }
  .cover-photo { position:relative; display:flex; align-items:center; justify-content:center; margin:26px 0 30px; }
  .avatar--lg { position:relative; width:200px; height:200px; flex:0 0 200px; border:5px solid #fff; box-shadow:0 0 0 1px var(--hair); }
  .avatar--ini { display:flex; align-items:center; justify-content:center; font-family:var(--serif); font-weight:700; color:var(--accent); }
  .avatar.avatar--lg.avatar--ini { font-size:74px; }
  .cover-eyebrow { font-size:11.5px; letter-spacing:.28em; text-transform:uppercase; color:var(--accent); font-weight:700; }
  .cover-creator { margin-top:16px; font-size:15.5px; color:var(--ink); font-weight:600; letter-spacing:.01em; }
  .cover-orn { width:40px; height:2px; background:var(--accent); border-radius:2px; margin:22px 0 4px; opacity:.55; }
  .cover-narr-hero { font-family:var(--serif); font-weight:800; font-size:46px; line-height:1.14; margin:16px 0 0; max-width:19ch; color:var(--ink); }
  .cover-period { margin-top:20px; font-size:12px; color:var(--muted); letter-spacing:.14em; text-transform:uppercase; }
  .cover-regua { margin-top:22px; font-size:12.5px; color:var(--muted); letter-spacing:.01em; background:var(--card); border:1px solid var(--hair); border-radius:24px; padding:9px 20px; }
  .cover-regua b { font-weight:700; }
  .numeros { display:flex; margin:0; border:1px solid var(--hair); border-radius:14px; overflow:hidden; background:var(--card); }
  .num-cell { flex:1; padding:18px 12px; text-align:center; border-right:1px solid var(--hair); display:flex; flex-direction:column; justify-content:center; }
  .num-cell:last-child { border-right:0; }
  .num-valor { font-family:var(--serif); font-weight:800; font-size:29px; line-height:1.05; color:var(--ink); }
  .num-valor--txt { font-size:16px; line-height:1.25; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .num-label { margin-top:6px; font-size:10px; letter-spacing:.08em; color:var(--muted); text-transform:uppercase; }
  .cover-resumo { margin-top:20px; padding-top:18px; border-top:1px solid var(--hair); font-size:15px; line-height:1.62; color:#3a362d; }

  /* Atos */
  .act { display:flex; align-items:baseline; gap:12px; margin:4px 0 22px; padding-bottom:8px; border-bottom:2px solid var(--ink); page-break-after:avoid; }
  .act:not(:first-child) { margin-top:40px; }
  .act-n { font-family:var(--serif); font-style:italic; font-weight:700; font-size:14px; color:var(--accent); }
  .act-t { font-family:var(--serif); font-weight:800; font-size:21px; }
  .act-sub { margin-left:auto; font-size:11px; color:var(--muted); letter-spacing:.03em; }

  /* Blocos */
  .block { margin-bottom:30px; }
  .block:last-of-type { margin-bottom:0; }
  .aud-grid, .faca-grid { page-break-inside:avoid; }
  .kicker { font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); font-weight:700; margin-bottom:6px; page-break-after:avoid; }
  .section-title { font-family:var(--serif); font-weight:800; font-size:23px; margin:0 0 6px; page-break-after:avoid; }
  .block-lead { font-family:var(--serif); font-size:18px; line-height:1.45; margin:0 0 18px; color:#2a2435; page-break-after:avoid; }
  .block-foot { font-size:11px; color:var(--muted); margin-top:12px; }

  /* Post cards — lista, um por linha */
  .post-list { display:flex; flex-direction:column; gap:14px; }
  .post-card { display:flex; gap:20px; background:var(--card); border:1px solid var(--hair); border-radius:14px; padding:18px 22px; page-break-inside:avoid; break-inside:avoid; }
  .pc-thumb { width:98px; height:122px; flex:0 0 98px; border-radius:10px; background-size:cover; background-position:center; background-color:#ece9f3; border:1px solid var(--hair); }
  .pc-thumb--empty { background:repeating-linear-gradient(45deg,#ece9f3,#ece9f3 8px,#f3f1f8 8px,#f3f1f8 16px); box-shadow:none; }
  .pc-body { flex:1; min-width:0; }
  .pc-head { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:3px; }
  .pc-date { font-size:11px; color:var(--muted); letter-spacing:.06em; font-weight:500; white-space:nowrap; }
  .pc-veredito { flex:0 0 auto; font-size:10.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--vc); border:1.4px solid var(--vc); border-radius:20px; padding:2px 12px; white-space:nowrap; }
  .pc-oque { font-size:12.5px; line-height:1.45; color:var(--muted); margin:0 0 11px; }
  .pc-seal { display:flex; align-items:center; gap:16px; margin-bottom:12px; padding-bottom:13px; border-bottom:1px solid var(--hair); }
  .mini-venn { width:54px; height:42px; flex:0 0 54px; }
  .seal-cap { display:flex; flex-wrap:wrap; gap:5px 18px; }
  .sc-item { font-size:12px; font-weight:600; }
  .sc-sym { color:var(--ink); font-weight:800; margin-left:2px; }
  .pc-stat { display:inline-block; font-size:12px; line-height:1.45; color:#3a362d; background:#f7f3fc; border:1px solid #ebe1f7; border-radius:7px; padding:4px 11px; margin-bottom:11px; }
  .pc-stat b { color:var(--accent); font-weight:700; }
  .pc-line { font-size:13px; line-height:1.55; margin-bottom:7px; color:#3a362d; }
  .pc-line:last-child { margin-bottom:0; }
  .pc-line b { color:var(--ink); }
  .pc-up b { color:#2e7d52; } .pc-down b { color:#b5462f; }

  /* Recap (cobrança) */
  .recap { background:#f3f0fa; border:1px solid #e3d9f5; border-radius:12px; padding:18px 20px; }
  .recap-head { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--accent); font-weight:700; margin-bottom:8px; }
  .recap-delta { font-family:var(--serif); font-size:16px; line-height:1.45; margin:0 0 12px; color:#2a2435; }
  .cmp-list { list-style:none; margin:0; padding:0; }
  .cmp-list li { display:grid; grid-template-columns:18px 1fr; gap:8px; align-items:baseline; padding:8px 0; border-bottom:1px solid #e3d9f5; }
  .cmp-list li:last-child { border-bottom:0; }
  .cmp-mark { font-weight:800; font-size:14px; }
  .cmp-item { font-size:13px; font-weight:600; }
  .cmp-nota { grid-column:2; font-size:11.5px; color:var(--muted); }

  /* Audiência */
  .aud-grid { display:flex; flex-direction:column; gap:14px; }
  .aud-row { display:grid; grid-template-columns:150px 90px 1fr; align-items:start; gap:14px; }
  .aud-dim { font-size:12.5px; font-weight:600; line-height:1.35; }
  .aud-bw { display:block; padding-top:4px; }
  .aud-bar { display:block; width:100%; height:8px; background:var(--hair); border-radius:6px; overflow:hidden; }
  .aud-fill { display:block; height:100%; background:var(--accent); border-radius:6px; }
  .aud-nota { font-size:11.5px; line-height:1.4; color:var(--muted); padding-top:1px; }

  /* Faça mais / menos */
  .faca-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .faca { border-radius:12px; padding:16px 18px; }
  .faca--mais { background:#eaf5ee; border:1px solid #cbe6d5; }
  .faca--menos { background:#fbecea; border:1px solid #f1d3cd; }
  .faca-head { font-weight:700; font-size:14px; margin-bottom:10px; }
  .faca ul { margin:0; padding-left:18px; } .faca li { font-size:13px; line-height:1.55; margin-bottom:8px; }
  .faca li:last-child { margin-bottom:0; }

  /* Plano */
  .plano-grid { display:flex; flex-direction:column; gap:13px; }
  .plano-card { background:var(--card); border:1px solid var(--hair); border-left:3px solid var(--accent); border-radius:12px; padding:14px 16px; page-break-inside:avoid; }
  .plano-titulo { font-family:var(--serif); font-weight:700; font-size:17px; line-height:1.3; }
  .plano-porque { font-size:12.5px; color:var(--muted); margin:4px 0 6px; line-height:1.45; }
  .plano-mira { display:inline-block; font-size:10.5px; font-weight:600; letter-spacing:.04em; color:var(--accent); background:#f0e9fa; border-radius:20px; padding:2px 10px; }

  .footer { margin-top:26px; padding:12px 0 0; border-top:1px solid var(--hair); font-size:10px; color:var(--muted); display:flex; justify-content:space-between; letter-spacing:.04em; }
</style></head>
<body>
  <!-- CAPA — foto + narrativa em destaque; abre o Ato 1 -->
  <div class="page cover">
    <div class="cover-hero">
      <div class="cover-eyebrow">Relatório semanal · Conteúdo do seu jeito</div>
      <div class="cover-photo">${avatar(c.nome, c.profilePictureUrl, true)}</div>
      <div class="cover-creator">${esc(c.nome)}${c.handle ? " · " + esc(c.handle) : ""}</div>
      <div class="cover-orn"></div>
      ${
        c.narrativaCentral
          ? `<h1 class="cover-narr-hero">“${esc(c.narrativaCentral)}”</h1>`
          : `<h1 class="cover-narr-hero">A sua semana de conteúdo</h1>`
      }
      <div class="cover-period">${esc(r.periodo.de)} → ${esc(r.periodo.ate)}</div>
      ${reguaLinha()}
    </div>
    ${coverStats(r)}
    <div class="cover-resumo">${esc(r.resumoSemana)}</div>
  </div>

  <div class="content">
    <!-- ATO 1 — SUA SEMANA -->
    ${actDivider(1, "Sua semana", "o que você publicou e como aterrissou")}
    <section class="block">
      ${sectionHeader("Conteúdo a conteúdo", "O que você publicou", "Cada post plotado nos três círculos. Cor = qual círculo; preenchido = acertou.")}
      ${semPosts}
      <div class="post-list">${avaliacoes}</div>
    </section>

    <!-- ATO 2 — O QUE ISSO DIZ -->
    ${actDivider(2, "O que isso diz", "a leitura da semana")}
    ${audienciaSection(r)}
    ${recapSection(r)}
    ${facaSection(r)}

    <!-- ATO 3 — SEU PLANO -->
    ${actDivider(3, "Seu plano", "para a próxima semana")}
    ${planoSection(r)}

    <div class="footer"><span>Galileia · análise Data2Content · ${esc(c.nome)}</span><span>${esc(r.periodo.ate)}</span></div>
  </div>
</body></html>`;
}
