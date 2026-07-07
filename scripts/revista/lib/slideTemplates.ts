// scripts/revista/lib/slideTemplates.ts
// Converte um SlideBrief em um documento HTML completo, pronto para o Playwright
// renderizar como PNG 1080×1350. Estilo editorial inspirado na @blankschoolbr:
// serif de display (Playfair), grão de papel, kickers de seção, fotos
// emolduradas, hairlines, numeração. Cada batida ganha um kicker automático.
//
// Sem dependências externas: o CSS é embutido e as fontes vêm do Google Fonts
// (renderSlides aguarda document.fonts.ready antes de capturar).

import type { SlideBrief, CarouselBrief, BatidaSlide, ComparacaoLado } from "./types";

export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

function escapeAttr(url: string): string {
  return url.replace(/"/g, "%22").replace(/'/g, "%27");
}

/** Kicker editorial automático por batida (overscritão de seção). */
const KICKER: Record<BatidaSlide, string> = {
  gancho: "REPORTAGEM",
  "quem-e": "O CRIADOR",
  tensao: "A QUESTÃO",
  revelacao: "A LEITURA · DATA2CONTENT",
  twist: "A LEITURA · DATA2CONTENT",
  porque: "A LEITURA · DATA2CONTENT",
  prova: "AS EVIDÊNCIAS",
  payoff: "O QUE FICA",
  convite: "PARTICIPE",
};

function kickerFor(slide: SlideBrief): string {
  // Override explícito (pilar de notícias) tem precedência sobre o kicker da batida.
  return slide.kicker ?? KICKER[slide.batida] ?? "REVISTA D2C";
}

/** Overlay de grão de papel — dá textura editorial e tira o "flat" digital. */
const GRAIN =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>",
  );

function grain(): string {
  return `<div class="grain"></div>`;
}

// Total de slides do carrossel atual (p/ o índice "08/16"). Setado em renderSlideHtml.
let SLIDE_TOTAL = 0;
function slideIndex(slide: SlideBrief): string {
  const n = String(slide.n).padStart(2, "0");
  return SLIDE_TOTAL > 1 ? `${n}/${String(SLIDE_TOTAL).padStart(2, "0")}` : n;
}

function header(slide: SlideBrief, light = false): string {
  const cls = light ? "header light" : "header";
  return `
    <div class="${cls}">
      <span class="hdr-ix">${slideIndex(slide)}</span>
      <span class="brand">REVISTA D2C</span>
      <span class="header-rule"></span>
      <span class="kicker">${kickerFor(slide)}</span>
    </div>`;
}

function layoutRespiro(slide: SlideBrief): string {
  // Slide-respiro (Apple-minimal): NU, sem header/rodapé. Uma ideia isolada em
  // escala máxima, num campo vazio. Índice minúsculo no canto. Para os
  // hero-moments (revelação, número, ponte, síntese).
  const fundo = slide.fundo ?? "dark";
  const ix = `<span class="resp-ix">${slideIndex(slide)}</span>`;
  if (slide.stat) {
    return `
    <section class="slide respiro respiro--${fundo}">
      ${grain()}
      <div class="resp-num">${slide.stat}</div>
      ${slide.statLabel ? `<div class="resp-numlabel">${slide.statLabel}</div>` : ""}
      ${slide.corpo ? `<p class="resp-sub">${slide.corpo}</p>` : ""}
      ${ix}
    </section>`;
  }
  const size = slide.escala ?? 96;
  return `
    <section class="slide respiro respiro--${fundo}">
      ${grain()}
      ${slide.kicker ? `<span class="resp-eye">${slide.kicker}</span>` : ""}
      ${slide.sup ? `<p class="resp-sup">${slide.sup}</p>` : ""}
      <h1 class="resp-h" style="font-size:${size}px">${slide.headline}</h1>
      ${slide.corpo ? `<p class="resp-sub">${slide.corpo}</p>` : ""}
      ${ix}
    </section>`;
}

function footer(slide: SlideBrief): string {
  const n = String(slide.n).padStart(2, "0");
  return `
    <div class="footer">
      <span class="footer-mark">◆ DATA2CONTENT</span>
      <span class="footer-page">${n}</span>
    </div>`;
}

function body(html?: string, light = false): string {
  if (!html) return "";
  const paras = html
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div class="body${light ? " light" : ""}">${paras}</div>`;
}

// ─── Layouts ────────────────────────────────────────────────────────────────

/** Gradiente da capa de notícia, casado ao tom e à posição do texto.
 *  - dark=false (texto branco): escurece a faixa do texto.
 *  - dark=true  (texto preto):  clareia a faixa do texto.
 *  - style "soft": fade longo (foto com zona limpa). "strong": faixa bem
 *    contrastada (default). "band": faixa quase sólida — lê em QUALQUER fundo
 *    (foto ocupada, clara ou branca). */
function newsScrimStyle(pos: "top" | "bottom", dark: boolean, style: "soft" | "strong" | "band"): string {
  const c = dark ? "245,243,236" : "8,6,3"; // papel claro vs tinta escura
  const a = style === "band" ? 0.92 : style === "strong" ? 0.82 : 0.6;
  const dir = pos === "top" ? "to top" : "to bottom";
  // start = onde o gradiente começa a aparecer; full = onde atinge o pico (e segura).
  const stops =
    style === "band"
      ? `rgba(${c},0) 40%, rgba(${c},${a}) 58%, rgba(${c},${a}) 100%`
      : style === "strong"
        ? `rgba(${c},0) 30%, rgba(${c},${a}) 72%, rgba(${c},${Math.min(a + 0.08, 0.96)}) 100%`
        : `rgba(${c},0.06) 0%, rgba(${c},0) 42%, rgba(${c},${a}) 100%`;
  return `background: linear-gradient(${dir}, ${stops});`;
}

function layoutCoverNews(slide: SlideBrief, brief?: CarouselBrief): string {
  // Capa do pilar de NOTÍCIAS · coluna "O SINAL". Foto-first (padrão): foto
  // full-bleed do ASSUNTO + masthead O SINAL + manchete já traduzida pro criador.
  // Fallback tipográfico escuro só quando não há foto (tema abstrato).
  const categoria = slide.kicker ?? "NOTÍCIA";
  const fonte = brief?.fonte ?? null;
  const img = slide.imagem?.url ?? "";
  const credito = slide.imagem?.credito ?? null;
  // Manchete adapta à foto: escolhe a zona limpa (topo/base) e o tom (branco
  // sobre escuro / preto sobre claro). O scrim acompanha — escurece p/ texto
  // branco, clareia p/ texto preto. À la Blank.
  const pos = slide.coverHeadline ?? "bottom";
  const dark = (slide.coverTone ?? "light") === "dark"; // texto preto
  const masthead = `
      <div class="cover-top">
        <div class="cover-top-left">
          <span class="brand light">REVISTA D2C</span>
          <span class="cover-eyebrow">O SINAL</span>
        </div>
        <span class="kicker light">${categoria}</span>
      </div>`;
  const dek = slide.corpo ? `<p class="cover-dek">${slide.corpo}</p>` : "";
  const headline = `
      <div class="cover-headline">
        <h1>${slide.headline}</h1>
        ${dek}
        ${fonte ? `<span class="cover-news-source">${fonte}</span>` : ""}
      </div>`;

  if (img) {
    const scrimStyle = newsScrimStyle(pos, dark, slide.coverScrim ?? "strong");
    const cls = [
      "slide cover cover--news-photo",
      `cover--head-${pos}`,
      dark ? "cover--ink" : "",
    ].filter(Boolean).join(" ");
    // Ordem dos blocos: no topo, manchete logo após o masthead; na base, masthead
    // em cima e manchete embaixo (space-between cuida do resto).
    const inner = pos === "top"
      ? `${masthead}${headline}<span class="cover-spacer"></span>`
      : `${masthead}${headline}`;
    return `
    <section class="${cls}" style="background-image:url('${escapeAttr(img)}')">
      <div class="cover-scrim" style="${scrimStyle}"></div>
      ${grain()}
      ${inner}
      ${credito ? `<span class="cover-credito">${credito}</span>` : ""}
    </section>`;
  }
  return `
    <section class="slide cover cover--news">
      ${grain()}
      ${masthead}
      ${headline}
    </section>`;
}

function layoutCover(slide: SlideBrief, video = false, brief?: CarouselBrief): string {
  if (brief?.angulo === "noticias") return layoutCoverNews(slide, brief);
  const img = slide.imagem?.url ?? "";
  const handle = brief?.criadores?.[0]?.handle ?? null;
  // Modo vídeo: sem background-image — o frame fica transparente e o reel entra
  // por baixo (composição em videoCover.ts via omitBackground). O scrim e o texto
  // continuam por cima, garantindo legibilidade da headline sobre o vídeo.
  const bg = video ? "" : ` style="background-image:url('${escapeAttr(img)}')"`;
  // Badge ▶ aparece quando o CARROSSEL tem vídeo dentro (mesmo que a capa seja foto).
  // A promessa do vídeo existe; ela se cumpre nos slides de prova, não na capa.
  const hasVideo = brief?.slides?.some((s) => s.imagem?.video) ?? false;
  // Capa à la Blank: bloco de texto CENTRALIZADO no terço inferior — selo da marca
  // acima, manchete grande no centro, dek (standfirst) abaixo, handle discreto no pé.
  // O badge ▶ VÍDEO fica solto no topo (sinal de formato), sem masthead de canto.
  return `
    <section class="slide cover cover--center${video ? " cover--video" : ""}"${bg}>
      <div class="cover-scrim"></div>
      ${grain()}
      <div class="cover-top">
        <span class="cover-top-spacer"></span>
        ${hasVideo ? `<span class="cover-video-badge">▶ VÍDEO</span>` : ""}
      </div>
      <div class="cover-headline cover-headline--center">
        <span class="cover-wordmark">ANÁLISE D2C</span>
        <h1>${slide.headline}</h1>
        ${slide.corpo ? `<p class="cover-dek">${slide.corpo}</p>` : ""}
        ${handle ? `<span class="cover-handle-c">${handle}</span>` : ""}
      </div>
    </section>`;
}

function layoutTwoColumn(slide: SlideBrief, video = false): string {
  const img = slide.imagem?.url ?? "";
  const nome = slide.imagem?.credito ?? "";
  // Modo vídeo: a janela da foto vira chroma-key verde (sem imagem). videoCover.ts
  // mede o boundingRect de .tc-img, encaixa o reel ali e remove o verde (colorkey).
  const inner = video
    ? `<div class="tc-img tc-img--key" data-vbox="1"></div>`
    : `<div class="tc-img" style="background-image:url('${escapeAttr(img)}')"></div>`;
  const photo = video || img
    ? `<figure class="tc-photo">${inner}<figcaption>${nome}</figcaption></figure>`
    : "";
  return `
    <section class="slide white">
      ${grain()}
      ${header(slide)}
      <div class="tc-grid">
        <div class="tc-text">
          <h2>${slide.headline}</h2>
          ${body(slide.corpo)}
        </div>
        ${photo}
      </div>
      ${footer(slide)}
    </section>`;
}

function layoutVideoProof(slide: SlideBrief, video = false): string {
  const img = slide.imagem?.url ?? "";
  // A janela do reel: chroma-key no modo vídeo (o reel toca aqui), thumbnail no estático.
  const inner = video
    ? `<div class="vp-img tc-img--key" data-vbox="1"></div>`
    : `<div class="vp-img" style="background-image:url('${escapeAttr(img)}')"></div>`;
  const stat = slide.stat
    ? `<div class="vp-stat"><span class="vp-num">${slide.stat}</span><span class="vp-num-label">${slide.statLabel ?? "interações"}</span></div>`
    : "";
  return `
    <section class="slide white">
      ${grain()}
      ${header(slide)}
      <div class="vp-grid">
        <div class="vp-text">
          ${stat}
          <p class="vp-quote">${slide.headline}</p>
          ${slide.corpo ? `<p class="vp-read">${slide.corpo}</p>` : ""}
        </div>
        <figure class="vp-photo">
          ${inner}
          <figcaption class="vp-tag">▶ REEL</figcaption>
        </figure>
      </div>
      ${footer(slide)}
    </section>`;
}

function layoutFullBleedText(slide: SlideBrief): string {
  const img = slide.imagem?.url ?? "";
  const credito = slide.imagem?.credito ?? null;
  return `
    <section class="slide full-bleed" style="background-image:url('${escapeAttr(img)}')">
      <div class="fb-scrim"></div>
      ${grain()}
      ${header(slide, true)}
      <div class="fb-content">
        <h2 class="light">${slide.headline}</h2>
        ${body(slide.corpo, true)}
      </div>
      ${credito ? `<span class="fb-credito">${credito}</span>` : ""}
      ${footer(slide)}
    </section>`;
}

function layoutPhotoTop(slide: SlideBrief): string {
  // Pilar notícias: foto grande no topo, manchete + corpo embaixo (variedade
  // de grid à la Blank). A foto é do assunto da notícia.
  const img = slide.imagem?.url ?? "";
  const credito = slide.imagem?.credito ?? null;
  return `
    <section class="slide white pt-slide">
      ${grain()}
      ${header(slide)}
      <figure class="pt-photo" style="background-image:url('${escapeAttr(img)}')">
        ${credito ? `<figcaption class="pt-credito">${credito}</figcaption>` : ""}
      </figure>
      <div class="pt-text">
        <h2>${slide.headline}</h2>
        ${body(slide.corpo)}
      </div>
      ${footer(slide)}
    </section>`;
}

function layoutList(slide: SlideBrief): string {
  const items = (slide.lista ?? [])
    .map(
      (i, idx) =>
        `<li class="list-row"><span class="list-num">${String(idx + 1).padStart(2, "0")}</span><span class="list-text">${i}</span></li>`,
    )
    .join("");
  return `
    <section class="slide white">
      ${grain()}
      ${header(slide)}
      <div class="list-wrap">
        <h2>${slide.headline}</h2>
        <ol class="list-items">${items}</ol>
        ${body(slide.corpo)}
      </div>
      ${footer(slide)}
    </section>`;
}

function layoutTextOnly(slide: SlideBrief): string {
  return `
    <section class="slide white">
      ${grain()}
      ${header(slide)}
      <div class="text-only">
        <span class="to-rule"></span>
        <h1 class="serif-xl">${slide.headline}</h1>
        ${body(slide.corpo)}
      </div>
      ${footer(slide)}
    </section>`;
}

function layoutReasoning(slide: SlideBrief): string {
  const labels = ["NARRATIVA", "TERRITÓRIO", "PAUTA", "ASSET", "TEMA"];
  const steps = slide.cadeia ?? [];
  const chain = steps
    .map((s, idx) => {
      // Permite "Rótulo: valor" — separa o rótulo em small-caps.
      const m = s.match(/^([^:]{2,18}):\s*(.+)$/);
      const label = m ? m[1].toUpperCase() : labels[idx] ?? "CAMADA";
      const value = m ? m[2] : s;
      return `<div class="chain-node"><span class="chain-dot"></span><div class="chain-rt"><span class="chain-label">${label}</span><span class="chain-value">${value}</span></div></div>` +
        (idx < steps.length - 1 ? `<div class="chain-arrow">↓</div>` : "");
    })
    .join("");
  return `
    <section class="slide white">
      ${grain()}
      ${header(slide)}
      <div class="reasoning">
        <h2>${slide.headline}</h2>
        ${body(slide.corpo)}
        <div class="chain">${chain}</div>
      </div>
      ${footer(slide)}
    </section>`;
}

function layoutStatCard(slide: SlideBrief): string {
  // Número-herói: um dado dramático isolado. Sobre imagem atmosférica escurecida
  // quando houver `imagem`; senão, fundo preto sólido. À la Blank.
  const stat = slide.stat ?? "";
  const label = slide.statLabel ?? "";
  const img = slide.imagem?.url ?? "";
  const hasImg = !!img && slide.imagem?.fonte !== "none";
  const bg = hasImg ? ` style="background-image:url('${escapeAttr(img)}')"` : "";
  return `
    <section class="slide stat-card${hasImg ? " stat-card--img" : ""}"${bg}>
      ${hasImg ? `<div class="sc-scrim"></div>` : ""}
      ${grain()}
      ${header(slide, true)}
      <div class="sc-wrap">
        <div class="sc-num">${stat}</div>
        ${label ? `<div class="sc-label">${label}</div>` : ""}
        ${slide.headline ? `<h2 class="sc-headline">${slide.headline}</h2>` : ""}
        ${slide.corpo ? `<p class="sc-body">${slide.corpo}</p>` : ""}
        ${slide.fonte ? `<span class="sc-fonte">${slide.fonte}</span>` : ""}
      </div>
      ${footer(slide)}
    </section>`;
}

function layoutComparison(slide: SlideBrief): string {
  // X vs Y: dois mundos lado a lado, com hairline central e "vs".
  const c = slide.comparacao;
  const col = (lado: ComparacaoLado | undefined) => {
    if (!lado) return `<div class="cmp-col"></div>`;
    const arrow =
      lado.tendencia === "up"
        ? `<span class="cmp-trend up">↑</span>`
        : lado.tendencia === "down"
          ? `<span class="cmp-trend down">↓</span>`
          : "";
    const bar =
      typeof lado.barra === "number"
        ? `<div class="cmp-bar"><span style="width:${Math.max(0, Math.min(100, lado.barra))}%"></span></div>`
        : "";
    return `<div class="cmp-col">
          <span class="cmp-rotulo">${lado.rotulo}${arrow}</span>
          ${bar}
          <ul class="cmp-itens">${lado.itens.map((i) => `<li>${i}</li>`).join("")}</ul>
        </div>`;
  };
  return `
    <section class="slide white">
      ${grain()}
      ${header(slide)}
      <h2 class="cmp-headline">${slide.headline}</h2>
      <div class="cmp-grid">
        ${col(c?.esquerda)}
        <div class="cmp-divider"><span>vs</span></div>
        ${col(c?.direita)}
      </div>
      ${slide.fonte ? `<span class="cmp-fonte">${slide.fonte}</span>` : ""}
      ${footer(slide)}
    </section>`;
}

function layoutDiagram(slide: SlideBrief): string {
  // Fluxo/esquema: nós conectados por seta, representando a narrativa.
  const nodes = slide.fluxo ?? [];
  const flow = nodes
    .map(
      (n, i) =>
        `<div class="diag-node"><span class="diag-n">${String(i + 1).padStart(2, "0")}</span><span class="diag-t">${n}</span></div>` +
        (i < nodes.length - 1 ? `<div class="diag-arrow">↓</div>` : ""),
    )
    .join("");
  return `
    <section class="slide white">
      ${grain()}
      ${header(slide)}
      <h2 class="diag-headline">${slide.headline}</h2>
      <div class="diag-flow">${flow}</div>
      ${slide.corpo ? `<p class="diag-body">${slide.corpo}</p>` : ""}
      ${slide.fonte ? `<span class="cmp-fonte">${slide.fonte}</span>` : ""}
      ${footer(slide)}
    </section>`;
}

function layoutPautaCard(slide: SlideBrief): string {
  // Ficha de pauta de publi (ato comercial): um briefing editorial emoldurado,
  // que lê como documento/entregável — não como slide de mídia kit.
  const rows = (slide.ficha ?? [])
    .map(
      (r) =>
        `<div class="ficha-row"><span class="ficha-rot">${r.rotulo}</span><span class="ficha-txt">${r.texto}</span></div>`,
    )
    .join("");
  return `
    <section class="slide white">
      ${grain()}
      ${header(slide)}
      <div class="ficha-card">
        <span class="ficha-selo">Pauta de publi</span>
        <h2 class="ficha-titulo">${slide.headline}</h2>
        <div class="ficha-rows">${rows}</div>
      </div>
      ${footer(slide)}
    </section>`;
}

function layoutCta(slide: SlideBrief): string {
  return `
    <section class="slide cta-dark">
      ${grain()}
      <div class="cta-top">
        <div class="cta-seal"><span>MAPEADO PELA</span><strong>DATA2CONTENT</strong></div>
      </div>
      <div class="cta-mid">
        <h1 class="serif-xl cta-h1">${slide.headline}</h1>
        ${slide.corpo ? `<p class="cta-body">${slide.corpo}</p>` : ""}
        ${
          (slide.lista ?? []).length
            ? `<div class="cta-benefits">${slide
                .lista!.map((b) => `<div class="cta-benefit"><span class="cta-bullet">◆</span><span>${b}</span></div>`)
                .join("")}</div>`
            : ""
        }
      </div>
      <div class="cta-bot">
        <div class="cta-action">Comente <strong>MAPA</strong> →</div>
        <p class="cta-sub">e a gente te manda o acesso no directo</p>
      </div>
      ${footer(slide)}
    </section>`;
}

function renderSection(slide: SlideBrief, brief: CarouselBrief | undefined, video = false): string {
  switch (slide.layout) {
    case "cover":
      return layoutCover(slide, video, brief);
    case "two-column":
      return layoutTwoColumn(slide, video);
    case "full-bleed-text":
      return layoutFullBleedText(slide);
    case "photo-top":
      return layoutPhotoTop(slide);
    case "stat-card":
      return layoutStatCard(slide);
    case "comparison":
      return layoutComparison(slide);
    case "diagram":
      return layoutDiagram(slide);
    case "pauta-card":
      return layoutPautaCard(slide);
    case "respiro":
      return layoutRespiro(slide);
    case "list":
      return layoutList(slide);
    case "text-only":
      return layoutTextOnly(slide);
    case "reasoning":
      return layoutReasoning(slide);
    case "video-proof":
      return layoutVideoProof(slide, video);
    case "cta":
      return layoutCta(slide);
    default:
      return layoutTextOnly(slide);
  }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;0,900;1,500;1,600;1,700&family=Poppins:wght@300;400;500;600&display=swap');
  :root {
    /* Identidade PREMIUM alinhada ao app (jun/2026): branco + preto-violeta +
       violeta cirúrgico. Branco é o luxo; cor é tempero. */
    --paper: #f6f6fa;      /* off-white frio: a "página" */
    --card: #ffffff;       /* branco puro: cartões (pop sobre o off-white) */
    --ink: #1a1426;        /* quase-preto com alma violeta — brand sem usar cor */
    --muted: #7c798c;      /* cinza frio */
    --hair: #e6e4ee;       /* filete frio */
    --serif: 'Playfair Display', serif;   /* a alma editorial */
    /* Cor-assinatura: violeta da marca (o 💜). Entra com disciplina cirúrgica:
       kicker, bolinha, botão, um acento. Rosa = pop raro. Nunca decoração. */
    --accent: #6c2db5;     /* violeta — sobre branco */
    --accent-lt: #a274d8;  /* violeta claro — sobre fundo escuro */
    --pink: #ff2c7e;       /* pop raro de energia */
    --shadow: 0 1px 2px rgba(26,20,38,0.04), 0 20px 46px rgba(26,20,38,0.06);
  }
  /* Grade leve e unificado das fotos do miolo — o grid lê como uma revista só. */
  .tc-img, .pt-photo, .vp-img { filter: saturate(0.9) contrast(1.04); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px; }
  body { font-family: 'Poppins', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  .slide { width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px; position: relative; overflow: hidden;
    display: flex; flex-direction: column; }
  .slide.white { background: var(--paper); color: var(--ink); padding: 72px 80px; }

  /* Grão de papel */
  .grain { position: absolute; inset: 0; pointer-events: none; z-index: 5;
    background-image: url("${GRAIN}"); background-size: 360px 360px;
    opacity: 0.03; mix-blend-mode: multiply; }
  .slide > *:not(.grain):not(.cover-scrim):not(.fb-scrim):not(.sc-scrim):not(.resp-ix) { position: relative; z-index: 6; }

  /* Header editorial */
  .header { display: flex; align-items: center; gap: 22px; margin-bottom: 64px; }
  .hdr-ix { font-size: 16px; font-weight: 500; letter-spacing: 0.06em; color: var(--accent); }
  .header.light .hdr-ix { color: var(--accent-lt); }
  .brand { font-size: 19px; font-weight: 700; letter-spacing: 0.22em; color: var(--ink); }
  .kicker { font-size: 17px; font-weight: 600; letter-spacing: 0.26em; color: var(--accent); }
  .header-rule { flex: 1; height: 1px; background: var(--hair); }
  .header.light .brand, .header.light .kicker { color: rgba(255,255,255,0.92); }
  .header.light .header-rule { background: rgba(255,255,255,0.4); }
  .light { color: #fff !important; }

  /* Footer */
  .footer { margin-top: auto; width: 100%; display: flex; justify-content: space-between;
    align-items: center; font-size: 16px; letter-spacing: 0.18em; color: var(--muted); padding-top: 44px; }
  .footer-mark { font-weight: 600; color: var(--accent); }
  .footer-page { font-family: var(--serif); font-style: italic; font-size: 22px; letter-spacing: 0; }

  /* Tipografia */
  h1 { font-family: var(--serif); font-weight: 800; line-height: 1.04; letter-spacing: -0.01em; }
  h2 { font-family: var(--serif); font-weight: 700; font-size: 66px; line-height: 1.08;
    letter-spacing: -0.01em; margin-bottom: 34px; }
  .serif-xl { font-size: 98px; line-height: 1.03; }
  .body { font-size: 32px; line-height: 1.52; color: #3a362d; max-width: 30ch; }
  .body p { margin-bottom: 24px; }
  .body p:last-child { margin-bottom: 0; }
  .body.light { color: rgba(255,255,255,0.9); }
  b { font-weight: 700; color: var(--ink); }
  .body.light b { color: #fff; }
  i { font-style: italic; }

  /* Cover */
  .cover { background-size: cover; background-position: center; justify-content: space-between; }
  /* Gradiente mais denso: topo escurecido para o topo não "flutuar", base bem fechada para a headline respirar */
  .cover-scrim { position: absolute; inset: 0; z-index: 2;
    background: linear-gradient(to bottom,
      rgba(8,6,3,0.72) 0%,
      rgba(8,6,3,0.10) 28%,
      rgba(8,6,3,0.05) 48%,
      rgba(8,6,3,0.78) 72%,
      rgba(8,6,3,0.96) 100%); }
  .cover-top { position: relative; z-index: 6; display: flex; justify-content: space-between;
    align-items: flex-start; padding: 64px 72px 0; }
  .cover-top-left { display: flex; flex-direction: column; gap: 10px; }
  .cover-top .brand { font-size: 21px; letter-spacing: 0.24em; }
  .cover-top .kicker { font-size: 18px; }
  /* Handle do criador — identifica de quem é antes de qualquer arraste */
  .cover-handle { font-size: 18px; letter-spacing: 0.08em; color: rgba(255,255,255,0.65);
    font-weight: 500; font-family: 'Poppins', sans-serif; }
  /* Badge ▶ VÍDEO — sinaliza formato sem poluir */
  .cover-video-badge { font-size: 15px; font-weight: 600; letter-spacing: 0.14em;
    color: rgba(255,255,255,0.9); background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.28); border-radius: 999px;
    padding: 10px 22px; backdrop-filter: blur(4px); white-space: nowrap; }
  .cover-headline { position: relative; z-index: 6; padding: 0 72px 96px; }
  .cover-rule { display: block; width: 44px; height: 2px; background: #fff; margin-bottom: 26px; }
  /* Manchete à la Blank: serif de peso MÉDIO, alto contraste, GRANDE e dominante —
     a manchete é o herói tipográfico (não uma legenda tímida). Itálico nos realces.
     Vale para perfil E notícia. */
  .cover-headline h1 { font-size: 88px; font-weight: 600; line-height: 1.04; color: #fff;
    letter-spacing: -0.015em; text-shadow: 0 1px 18px rgba(0,0,0,0.32); }
  .cover-headline h1 i { font-weight: 600; }
  /* Subtítulo da capa (perfil e notícia) — dá hierarquia editorial à la Blank. */
  .cover-dek { font-family: 'Poppins', sans-serif; font-size: 24px; line-height: 1.42;
    color: rgba(255,255,255,0.84); margin-top: 22px; max-width: 34ch; font-weight: 400; }
  .cover--ink .cover-dek { color: rgba(0,0,0,0.7); }
  /* Capa centralizada à la Blank: selo da marca acima + manchete grande + dek, tudo
     no centro do terço inferior. A foto domina o quadro; o texto pousa por cima. */
  .cover--center { justify-content: space-between; }
  .cover-top-spacer { display: block; }
  .cover-headline--center { display: flex; flex-direction: column; align-items: center;
    text-align: center; padding: 0 64px 108px; }
  .cover-wordmark { font-family: 'Poppins', sans-serif; font-size: 21px; font-weight: 600;
    letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.92);
    margin-bottom: 30px; text-shadow: 0 1px 12px rgba(0,0,0,0.4); }
  .cover-headline--center h1 { max-width: 18ch; }
  .cover-headline--center .cover-dek { max-width: 30ch; margin-left: auto; margin-right: auto;
    text-align: center; }
  .cover-handle-c { font-family: 'Poppins', sans-serif; font-size: 19px; letter-spacing: 0.06em;
    color: rgba(255,255,255,0.66); font-weight: 500; margin-top: 26px;
    text-shadow: 0 1px 12px rgba(0,0,0,0.4); }
  .cover--center .cover-wordmark, .cover--center .cover-handle-c { white-space: nowrap; }

  /* Cover — pilar NOTÍCIAS · coluna "O SINAL". */
  /* Masthead da coluna: selo "O SINAL" (vale na capa-foto e na tipográfica). */
  .cover-eyebrow { font-family: 'Poppins', sans-serif; font-size: 17px; font-weight: 700;
    letter-spacing: 0.28em; color: var(--paper);
    border: 1px solid rgba(255,255,255,0.4); border-radius: 999px;
    padding: 8px 18px; align-self: flex-start; }
  .cover-news-source { display: block; margin-top: 36px; font-family: 'Poppins', sans-serif;
    font-size: 19px; letter-spacing: 0.04em; color: rgba(255,255,255,0.62); font-weight: 500; }
  .cover-credito { position: absolute; bottom: 22px; right: 28px; z-index: 6;
    font-family: 'Poppins', sans-serif; font-size: 13px; letter-spacing: 0.04em;
    color: rgba(255,255,255,0.55); }
  /* Manchete adaptativa: posição (topo/base) + scrim casado ao tom. */
  .cover--head-top { justify-content: flex-start; }
  .cover--head-top .cover-headline { padding-top: 18px; padding-bottom: 0; }
  .cover-spacer { flex: 1; }
  /* O gradiente da capa de notícia é inline (newsScrimStyle) — casa tom × posição × estilo. */
  /* Tom escuro (texto preto): vira todo o masthead/manchete para tinta. */
  .cover--ink .brand, .cover--ink .cover-eyebrow, .cover--ink .kicker,
  .cover--ink .cover-headline h1, .cover--ink .cover-news-source,
  .cover--ink .cover-credito { color: var(--ink); }
  .cover--ink .cover-headline h1 { text-shadow: none; }
  .cover--ink .cover-eyebrow { border-color: rgba(0,0,0,0.45); }
  .cover--ink .cover-rule { background: var(--ink); }
  .cover--ink .cover-credito { color: rgba(0,0,0,0.5); }
  /* Fallback tipográfico (tema abstrato sem foto). */
  .cover--news { background: var(--ink); }
  .cover--news .cover-headline { padding-bottom: 72px; }
  /* Dek (linha-resumo) um pouco menor nas capas de notícia. */
  .cover--news .cover-dek,
  .cover--news-photo .cover-dek { font-size: 20px; margin-top: 22px; }

  /* Número-herói (stat-card): um dado dramático isolado, fundo escuro. */
  .slide.stat-card { background: var(--ink); color: var(--paper); padding: 72px 80px;
    display: flex; flex-direction: column; }
  .stat-card--img { background-size: cover; background-position: center; }
  .sc-scrim { position: absolute; inset: 0; z-index: 2; background: linear-gradient(to bottom,
    rgba(10,9,6,0.72) 0%, rgba(10,9,6,0.52) 45%, rgba(10,9,6,0.78) 100%); }
  .sc-wrap { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .sc-num { font-family: var(--serif); font-weight: 900; font-size: 172px;
    line-height: 1.0; color: #fff; letter-spacing: -0.02em; }
  .sc-label { display: block; font-family: 'Poppins', sans-serif; font-size: 20px; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--accent-lt); margin-top: 26px;
    padding-bottom: 30px; border-bottom: 1px solid rgba(255,255,255,0.16); max-width: 34ch; }
  .sc-headline { font-size: 50px; line-height: 1.1; color: #fff; margin-top: 34px; max-width: 22ch; }
  .sc-body { font-size: 27px; line-height: 1.5; color: rgba(255,255,255,0.82); margin-top: 22px; max-width: 33ch; }
  .sc-fonte { display: block; font-family: 'Poppins', sans-serif; font-size: 15px; letter-spacing: 0.03em;
    color: rgba(255,255,255,0.42); margin-top: 36px; }
  /* Comparação — data-viz: seta de tendência + barra de share. */
  .cmp-rotulo { display: flex; align-items: center; gap: 12px; }
  .cmp-trend { font-family: 'Poppins', sans-serif; font-weight: 700; }
  .cmp-trend.up { color: #2e7d52; }
  .cmp-trend.down { color: #b5462f; }
  .cmp-bar { height: 8px; background: var(--hair); border-radius: 999px; margin: 6px 0 26px;
    overflow: hidden; }
  .cmp-bar span { display: block; height: 100%; background: var(--ink); border-radius: 999px; }

  /* Comparação (X vs Y): dois mundos lado a lado. */
  .cmp-headline { font-size: 52px; line-height: 1.08; margin-bottom: 8px; max-width: 26ch; }
  .cmp-grid { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0; flex: 1; align-items: center; }
  .cmp-col { padding: 8px 0; }
  .cmp-rotulo { display: block; font-family: 'Poppins', sans-serif; font-size: 26px; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink); padding-bottom: 22px;
    margin-bottom: 22px; border-bottom: 2px solid var(--ink); }
  .cmp-itens { list-style: none; }
  .cmp-itens li { font-family: var(--serif); font-size: 31px; line-height: 1.3;
    color: var(--ink); padding: 18px 0; border-top: 1px solid var(--hair); }
  .cmp-itens li:first-child { border-top: none; }
  .cmp-divider { width: 1px; align-self: stretch; background: var(--hair); margin: 0 48px;
    position: relative; display: flex; align-items: center; justify-content: center; }
  .cmp-divider span { position: absolute; background: var(--paper); font-family: var(--serif);
    font-style: italic; font-size: 30px; color: var(--muted); padding: 12px 0; }
  .cmp-fonte { font-family: 'Poppins', sans-serif; font-size: 15px; letter-spacing: 0.03em;
    color: var(--muted); margin-top: 24px; }

  /* Diagrama / fluxo: nós conectados representando a narrativa. */
  .diag-headline { font-size: 50px; line-height: 1.08; margin-bottom: 36px; max-width: 24ch; }
  .diag-flow { display: flex; flex-direction: column; align-items: stretch; }
  .diag-node { display: flex; align-items: center; gap: 26px; border: 1.5px solid var(--ink);
    border-radius: 6px; padding: 26px 32px; background: #fbfaf6; }
  .diag-n { font-family: 'Poppins', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 0.08em;
    color: var(--accent); }
  .diag-t { font-family: var(--serif); font-size: 33px; line-height: 1.22; color: var(--ink); }
  .diag-arrow { text-align: center; font-size: 30px; color: var(--accent); padding: 12px 0; }
  .diag-body { font-size: 28px; line-height: 1.5; color: #3a362d; max-width: 34ch; margin-top: 34px; }

  /* Ficha de pauta de publi (ato comercial) — briefing emoldurado, cara de documento. */
  /* Ficha = cartão branco premium (mesma linguagem do card do app). */
  .ficha-card { flex: 1; display: flex; flex-direction: column; justify-content: center;
    border: none; border-radius: 30px; box-shadow: var(--shadow); padding: 46px 52px; background: var(--card); }
  .ficha-selo { font-family: 'Poppins', sans-serif; font-size: 15px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); margin-bottom: 20px; }
  .ficha-titulo { font-family: var(--serif); font-style: italic; font-size: 50px;
    line-height: 1.08; color: var(--ink); margin-bottom: 30px; }
  .ficha-row { padding: 22px 0; border-top: 1px solid var(--hair); display: flex;
    flex-direction: column; gap: 9px; }
  .ficha-row:first-child { border-top: none; padding-top: 0; }
  .ficha-rot { font-family: 'Poppins', sans-serif; font-size: 15px; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); }
  .ficha-txt { font-family: var(--serif); font-size: 26px; line-height: 1.34; color: var(--ink); }

  /* Photo-top: foto grande no topo, texto embaixo (variedade de grid). */
  .pt-slide { display: flex; flex-direction: column; }
  .pt-photo { margin: 28px 0 0; width: 100%; height: 600px; border-radius: 4px;
    background-size: cover; background-position: center; position: relative;
    border: 1px solid rgba(0,0,0,0.06); }
  .pt-credito { position: absolute; bottom: 12px; right: 14px; font-family: 'Poppins', sans-serif;
    font-size: 13px; color: rgba(255,255,255,0.92); background: rgba(0,0,0,0.45);
    padding: 4px 9px; border-radius: 3px; letter-spacing: 0.02em; }
  .pt-text { margin-top: 40px; }
  .pt-text h2 { font-size: 52px; line-height: 1.08; margin-bottom: 22px; }
  /* Crédito da foto no two-column e no full-bleed. */
  .tc-photo figcaption { margin-top: 12px; font-family: 'Poppins', sans-serif; font-size: 14px;
    letter-spacing: 0.02em; color: #8a8475; text-align: right; }
  .fb-credito { position: absolute; bottom: 96px; right: 28px; z-index: 6;
    font-family: 'Poppins', sans-serif; font-size: 13px; letter-spacing: 0.04em;
    color: rgba(255,255,255,0.55); }

  /* Two column */
  .tc-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 60px; flex: 1; align-items: center; }
  .tc-text h2 { font-size: 60px; }
  .tc-photo { margin: 0; }
  .tc-img { width: 100%; height: 800px; border-radius: 4px; background-size: cover; background-position: center;
    box-shadow: 0 1px 0 rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06); }
  /* Janela de vídeo: chroma-key verde, removido por colorkey no ffmpeg. */
  .tc-img--key { background: #00b140; }
  /* Capa em vídeo: fundo transparente (o reel entra por baixo na composição). */
  .cover--video { background: transparent !important; }

  /* Video proof — o reel como prova viva da narrativa */
  .vp-grid { display: grid; grid-template-columns: 1fr 466px; gap: 56px; flex: 1; align-items: center; }
  .vp-stat { display: flex; flex-direction: column; margin-bottom: 30px; }
  .vp-num { font-family: var(--serif); font-weight: 800; font-size: 104px; line-height: 0.92;
    color: var(--ink); letter-spacing: -0.01em; }
  .vp-num-label { font-size: 18px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted);
    margin-top: 10px; }
  .vp-quote { font-family: var(--serif); font-style: italic; font-size: 40px; line-height: 1.18;
    color: var(--ink); margin-bottom: 24px; }
  .vp-read { font-size: 27px; line-height: 1.5; color: #45433b; }
  .vp-read b { color: var(--ink); }
  .vp-photo { margin: 0; position: relative; }
  .vp-img { width: 466px; height: 828px; border-radius: 6px; background-size: cover; background-position: center;
    box-shadow: 0 2px 12px rgba(0,0,0,0.12); border: 1px solid rgba(0,0,0,0.06); }
  .vp-tag { position: absolute; top: 18px; left: 18px; background: rgba(0,0,0,0.72); color: #fff;
    font-size: 15px; font-weight: 600; letter-spacing: 0.14em; padding: 8px 16px; border-radius: 999px; }
  .tc-photo figcaption { margin-top: 16px; font-size: 16px; letter-spacing: 0.16em; color: var(--muted); text-transform: uppercase; }

  /* Full bleed text */
  .full-bleed { background-size: cover; background-position: center; padding: 72px 80px; }
  .fb-scrim { position: absolute; inset: 0; z-index: 2;
    background: linear-gradient(105deg, rgba(8,6,3,0.9) 0%, rgba(8,6,3,0.62) 55%, rgba(8,6,3,0.25) 100%); }
  .fb-content { position: relative; z-index: 6; margin-top: auto; margin-bottom: 28px; max-width: 78%; }
  .fb-content h2 { font-size: 74px; margin-bottom: 34px; }

  /* List — hairline editorial, não caixas pesadas */
  .list-wrap { display: flex; flex-direction: column; }
  .list-wrap h2 { font-size: 58px; }
  .list-items { list-style: none; margin: 8px 0 40px; }
  .list-row { display: flex; gap: 28px; align-items: baseline; padding: 30px 0; border-top: 1px solid var(--hair); }
  .list-row:last-child { border-bottom: 1px solid var(--hair); }
  .list-num { font-family: var(--serif); font-style: italic; font-size: 34px; color: var(--muted); min-width: 56px; }
  .list-text { font-size: 31px; line-height: 1.4; color: #2c2920; }

  /* Text only */
  .text-only { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .to-rule { width: 72px; height: 4px; background: var(--ink); margin-bottom: 40px; }
  .text-only h1 { margin-bottom: 40px; }
  .text-only .body { font-size: 34px; max-width: 26ch; }

  /* Reasoning chain */
  .reasoning { flex: 1; display: flex; flex-direction: column; }
  .reasoning h2 { font-size: 60px; margin-bottom: 12px; }
  .reasoning .body { margin-bottom: 0; }
  /* Respiro (Apple-minimal): slide NU, uma ideia isolada em escala máxima, centrada. */
  .slide.respiro { align-items: center; justify-content: center; text-align: center; padding: 120px 100px; }
  .respiro--dark { background: var(--ink); color: #fff; }
  .respiro--paper { background: var(--paper); color: var(--ink); }
  .respiro--accent { background: var(--accent); color: #fff; }
  .resp-eye { font-family: 'Poppins', sans-serif; font-size: 22px; letter-spacing: 0.24em;
    text-transform: uppercase; font-weight: 500; color: var(--accent-lt); margin-bottom: 40px; }
  .respiro--paper .resp-eye { color: var(--accent); }
  .respiro--accent .resp-eye { color: rgba(255,255,255,0.9); }
  .resp-sup { font-family: var(--serif); font-size: 46px; line-height: 1.1; opacity: 0.58; margin-bottom: 16px; }
  .resp-h { font-family: var(--serif); font-weight: 500; line-height: 1.04; letter-spacing: -0.015em; max-width: 17ch; }
  .resp-h i { font-style: italic; }
  .resp-sub { font-family: 'Poppins', sans-serif; font-size: 30px; line-height: 1.5; font-weight: 400;
    opacity: 0.74; margin-top: 40px; max-width: 28ch; }
  .resp-num { font-family: var(--serif); font-weight: 700; font-size: 250px; line-height: 0.9; letter-spacing: -0.03em; }
  .resp-numlabel { font-family: 'Poppins', sans-serif; font-size: 26px; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--accent-lt); margin-top: 30px; }
  .resp-ix { position: absolute; top: 56px; left: 80px; z-index: 6; font-family: 'Poppins', sans-serif;
    font-size: 20px; letter-spacing: 0.08em; font-weight: 500; color: var(--accent); opacity: 0.8; }
  .respiro--dark .resp-ix, .respiro--accent .resp-ix { color: rgba(255,255,255,0.6); }

  /* Cadeia = o card "Seu Mapa" do app, em registro PREMIUM: cartão branco
     rounded, sombra suave, camadas em linhas com bolinha violeta. */
  .chain { margin-top: 24px; background: var(--card); border-radius: 30px; box-shadow: var(--shadow);
    padding: 28px 40px; flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
  .chain-node { display: flex; gap: 22px; align-items: flex-start; padding: 10px 0; }
  .chain-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--accent);
    margin-top: 14px; flex: 0 0 auto; }
  /* Seta de consequência (narrativa → território → tema → pauta), no trilho das bolinhas. */
  .chain-arrow { width: 12px; text-align: center; color: var(--accent); font-size: 18px;
    line-height: 1; padding: 3px 0; opacity: 0.55; }
  .chain-rt { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .chain-label { font-family: 'Poppins', sans-serif; font-size: 15px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--accent); font-weight: 600; }
  .chain-value { font-family: var(--serif); font-size: 31px; line-height: 1.22; color: var(--ink); }

  /* CTA */
  .cta-dark { background: var(--ink); color: var(--paper); text-align: center; align-items: stretch; }
  .cta-top { display: flex; flex-direction: column; align-items: center; padding: 72px 80px 0; }
  .cta-seal { display: inline-flex; flex-direction: column; gap: 4px; border: 1.5px solid rgba(255,255,255,0.35);
    border-radius: 999px; padding: 14px 36px; }
  .cta-seal span { font-size: 14px; letter-spacing: 0.22em; color: rgba(255,255,255,0.45); }
  .cta-seal strong { font-size: 20px; letter-spacing: 0.18em; color: var(--paper); }
  .cta-mid { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 22px; padding: 0 80px; }
  .cta-h1 { color: var(--paper); font-size: 64px; font-weight: 600; line-height: 1.1; }
  .cta-body { font-size: 26px; line-height: 1.55; color: rgba(255,255,255,0.6); max-width: 80%; margin: 0 auto;
    letter-spacing: 0.01em; }
  .cta-benefits { display: flex; flex-direction: column; width: 100%; max-width: 760px; margin: 6px auto 0; }
  .cta-benefit { display: flex; align-items: center; gap: 16px; text-align: left; padding: 19px 4px;
    border-top: 1px solid rgba(255,255,255,0.13); font-size: 27px; line-height: 1.3; color: rgba(255,255,255,0.92); }
  .cta-benefit:last-child { border-bottom: 1px solid rgba(255,255,255,0.13); }
  .cta-benefit b { color: #fff; }
  .cta-bullet { font-size: 13px; color: var(--accent-lt); flex: 0 0 auto; }
  .cta-bot { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 0 80px 52px; }
  .cta-action { font-size: 38px; font-weight: 600; background: var(--accent); color: #fff;
    border-radius: 999px; padding: 27px 62px; letter-spacing: 0.01em; }
  .cta-action strong { font-weight: 800; }
  .cta-sub { font-size: 21px; color: rgba(255,255,255,0.5); letter-spacing: 0.01em; }
  .cta-dark .footer { color: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.12); padding: 0 80px 40px; }
`;

/** Documento HTML completo para um único slide. */
export function renderSlideHtml(
  slide: SlideBrief,
  brief?: CarouselBrief,
  video = false,
): string {
  SLIDE_TOTAL = brief?.slides?.length ?? 0;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>${CSS}</style>
</head>
<body>
  ${renderSection(slide, brief, video)}
</body>
</html>`;
}
