/**
 * storyCard.ts — o cartão que o premiado posta.
 *
 * POR QUE ISTO EXISTE. O prêmio dentro do PDF só é visto por quem lê o PDF: 33 pessoas,
 * uma vez por semana. O cartão de story é o mesmo prêmio na frente da audiência do
 * premiado — e é isso que faz aparecer no relatório valer alguma coisa, muito mais do
 * que qualquer frase que a gente escreva pedindo.
 *
 * 1080×1920 porque é o formato do story. Sem texto de convencimento: quem posta já está
 * convencido, e um card cheio de frase de efeito não se posta.
 *
 * A capa vem embutida em base64 (ver embedImages.ts), então o PNG é gerado sem rede e
 * não quebra quando a URL do Instagram expirar.
 */

import type { Highlight } from "../../../src/app/lib/relatorio/types";

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const HIGHLIGHT_VISUAL: Record<string, { symbol: string; color: string; ink: string; label: string }> = {
  destaque_do_territorio: { symbol: "★", color: "#C64A70", ink: "#14120F", label: "Destaque do território" },
  video_da_comunidade: { symbol: "↗", color: "#4D7F9A", ink: "#14120F", label: "Vídeo da comunidade" },
  frase_da_semana: { symbol: "“", color: "#76618E", ink: "#14120F", label: "Frase da semana" },
  coragem: { symbol: "⚡", color: "#9A7937", ink: "#14120F", label: "Coragem" },
  consistencia: { symbol: "7/7", color: "#587965", ink: "#14120F", label: "Consistência" },
  virada: { symbol: "↻", color: "#B86557", ink: "#14120F", label: "Virada" },
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

/** Um arquivo por premiado. `week` entra no selo e no nome do arquivo. */
export function renderStoryCardHtml(highlight: Highlight, week: number, year: number): string {
  const image = highlight.post?.thumbnailUrl ?? highlight.creatorAvatarUrl;
  const imageKind = highlight.post?.thumbnailUrl ? "thumbnail" : highlight.creatorAvatarUrl ? "avatar" : "graphic";
  const visual = HIGHLIGHT_VISUAL[highlight.kind] ?? HIGHLIGHT_VISUAL.destaque_do_territorio!;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Instrument+Sans:wdth,wght@75..100,400..700&family=JetBrains+Mono:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{width:${STORY_WIDTH}px;height:${STORY_HEIGHT}px;background:#F8F5F0;color:#14120F;
  font-family:'Instrument Sans',system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
.card{--award:${visual.color};--award-ink:${visual.ink};position:relative;width:100%;height:100%;background:#F8F5F0}
.accent{position:absolute;right:0;top:0;width:160px;height:10px;background:var(--award)}
.top{position:absolute;top:72px;left:78px;right:78px;display:flex;align-items:center;justify-content:space-between}
.selo{display:flex;align-items:center;gap:16px;color:var(--award);font-family:'JetBrains Mono',monospace;
  font-size:21px;letter-spacing:.15em;text-transform:uppercase;font-weight:700}
.selo b{width:48px;height:48px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  background:color-mix(in srgb,var(--award) 14%,#F8F5F0);font-family:'Bricolage Grotesque',sans-serif;
  font-size:27px;line-height:.7;letter-spacing:0}
.week{font-family:'JetBrains Mono',monospace;font-size:19px;letter-spacing:.12em;text-transform:uppercase;color:#6B6560}
.mediaback{position:absolute;left:201px;top:183px;width:650px;height:1156px;border-radius:48px;
  background:color-mix(in srgb,var(--award) 14%,#F8F5F0);transform:rotate(-2deg)}
.media{position:absolute;left:215px;top:170px;width:650px;height:1156px;border-radius:44px;
  background-size:cover;background-position:center;background-color:color-mix(in srgb,var(--award) 13%,#D9D0C5);
  box-shadow:0 30px 80px rgba(38,31,26,.16),0 0 0 2px rgba(20,18,15,.06);overflow:hidden}
.media.avatar{background-position:center top}
.media.graphic{display:flex;align-items:flex-end;padding:56px;background:linear-gradient(155deg,
  color-mix(in srgb,var(--award) 22%,#F8F5F0),#D9D0C5)}
.graphicmark{position:absolute;right:34px;top:22px;font-family:'Bricolage Grotesque',sans-serif;
  font-size:300px;line-height:.8;font-weight:700;color:color-mix(in srgb,var(--award) 24%,transparent)}
.initials{font-family:'Bricolage Grotesque',sans-serif;font-size:190px;font-weight:700;
  letter-spacing:-.08em;color:var(--award)}
.bottom{position:absolute;top:1390px;left:78px;right:78px}
.premio{font-family:'JetBrains Mono',monospace;font-size:21px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--award);font-weight:700}
.nome{font-family:'Bricolage Grotesque',sans-serif;font-size:76px;font-weight:650;
  letter-spacing:-.045em;line-height:.96;margin-top:18px;max-width:900px}
.handle{font-family:'JetBrains Mono',monospace;font-size:25px;color:#6B6560;margin-top:13px}
.res{font-family:'Bricolage Grotesque',sans-serif;font-size:39px;font-weight:600;margin-top:27px;line-height:1.12}
.terr{font-size:25px;color:#5F5954;margin-top:10px}
.marca{position:absolute;bottom:48px;left:78px;font-family:'JetBrains Mono',monospace;
  font-size:19px;letter-spacing:.18em;text-transform:uppercase;color:#817A73;font-weight:700}
</style></head>
<body><div class="card">
  <div class="accent"></div>
  <div class="top"><span class="selo"><b>${esc(visual.symbol)}</b>${esc(visual.label)}</span><span class="week">semana ${week}</span></div>
  <div class="mediaback"></div>
  <div class="media ${imageKind}"${image ? ` style="background-image:url('${esc(image)}')"` : ""}>
    ${imageKind === "graphic" ? `<div class="graphicmark">${esc(visual.symbol)}</div><div class="initials">${esc(initials(highlight.creatorName))}</div>` : ""}
  </div>
  <div class="bottom">
    <p class="premio">${esc(highlight.label)}</p>
    <p class="nome">${esc(highlight.creatorName)}</p>
    ${highlight.creatorHandle ? `<p class="handle">@${esc(highlight.creatorHandle)}</p>` : ""}
    <p class="res">${esc(highlight.result)}</p>
    ${highlight.territoryLabel ? `<p class="terr">${esc(highlight.territoryLabel)}</p>` : ""}
  </div>
  <div class="marca">D2C · semana ${week} de ${year}</div>
</div></body></html>`;
}

/** Nome de arquivo estável e sem acento, para o criador achar o dele. */
export function storyCardFileName(highlight: Highlight, index: number): string {
  const slug = highlight.creatorName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `story-${String(index + 1).padStart(2, "0")}-${slug || "criador"}.png`;
}
