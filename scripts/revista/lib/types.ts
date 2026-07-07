// scripts/revista/lib/types.ts
// Tipos do brief editorial da Revista D2C (Galeano).
// Espelham o schema JSON definido na skill .claude/skills/galeano/SKILL.md.

export type AnguloRevista = "perfil" | "collab" | "narrativa" | "territorio" | "noticias";

export type BatidaSlide =
  | "gancho"
  | "quem-e"
  | "tensao"
  | "revelacao" // A frase que reenquadra o criador (1º slide do 2º ato)
  | "twist" // O mapa: a cadeia narrativa → território → pauta (slide-herói)
  | "porque" // Por que a estrutura explica o conteúdo (ponte para a prova)
  | "prova"
  | "payoff"
  | "convite";

export type LayoutSlide =
  | "cover"
  | "two-column"
  | "full-bleed-text"
  | "photo-top" // foto grande no topo, manchete + corpo embaixo (pilar notícias)
  | "stat-card" // número-herói: um dado dramático isolado (pilar notícias)
  | "comparison" // X vs Y: dois mundos lado a lado (pilar notícias)
  | "diagram" // fluxo/esquema: nós conectados representando a narrativa
  | "pauta-card" // ficha de pauta de publi (ato comercial do perfil)
  | "respiro" // slide-respiro: NU (sem header/rodapé), uma linha gigante centrada (modernização Apple-minimal)
  | "list"
  | "text-only"
  | "reasoning"
  | "video-proof"
  | "cta";

export type FonteImagem = "profile_picture" | "thumbnail" | "generated" | "video" | "none";

export interface SlideVideo {
  /** instagramMediaId do REEL — usado para rebuscar a media_url fresca na Graph API. */
  mediaId: string;
  /** userId dono do reel (precisa ter token Instagram válido). */
  userId: string;
  /** Segundo inicial do trecho a usar no slide (default 0). */
  inicio?: number;
  /** Duração do trecho em segundos (default 8). */
  duracao?: number;
  /** Caminho local do mp4 baixado (preenchido por videoCover.ts). */
  localVideo?: string;
}

export interface SlideImagem {
  fonte: FonteImagem;
  /** URL original (Instagram, expira) ou URL permanente do R2 após fetchAssets.
   *  Pode ficar AUSENTE no brief que o Galeano escreve: o `resolveAssets.ts`
   *  preenche a partir do `context.json` usando `postId` (thumbnail) ou a
   *  `fonte: "profile_picture"` (foto de perfil do criador). */
  url?: string | null;
  /** Referência ENXUTA a um post do `context.json` (o `instagramMediaId`). Quando
   *  presente, o `resolveAssets.ts` preenche `url` (thumbnail) e, se for vídeo,
   *  monta `video` automaticamente — assim o Galeano nunca cola URLs assinadas à
   *  mão no brief (eram a fonte do 403 e do gasto de contexto). */
  postId?: string;
  /** A quem a imagem pertence (para auditoria/legenda). */
  userId?: string | null;
  /** Crédito da foto (pilar `noticias`), renderizado discreto sobre/abaixo da
   *  imagem. Ex.: "Foto: CazéTV/YouTube", "Wikimedia Commons". Uso editorial. */
  credito?: string;
  /**
   * Quando presente, este slide vira um card de VÍDEO: o reel do criador toca
   * na janela da imagem (capa full-bleed ou coluna da direita). O `url`/thumbnail
   * continua servindo de poster/fallback estático. Ver videoCover.ts.
   */
  video?: SlideVideo;
}

export interface SlideBrief {
  n: number;
  batida: BatidaSlide;
  layout: LayoutSlide;
  /** Pode conter <b> e <i>. */
  headline: string;
  /** Sobrescreve o kicker editorial automático (derivado da batida). Usado no
   *  pilar de notícias, cujos rótulos não seguem o vocabulário de perfil
   *  (ex.: "EM PAUTA", "O CONTEXTO", "O QUE FAZER"). */
  kicker?: string;
  /** (capa de notícia) Onde a manchete se ancora na foto — escolha a zona mais
   *  limpa da imagem. Default "bottom". */
  coverHeadline?: "top" | "bottom";
  /** (capa de notícia) Cor do texto: "light" = branco sobre zona escura;
   *  "dark" = preto sobre zona clara. O scrim acompanha. Default "light". */
  coverTone?: "light" | "dark";
  /** (capa de notícia) Como inserir o texto — garante leitura conforme a foto:
   *  - "soft": gradiente sutil (foto com zona limpa naturalmente escura/clara).
   *  - "strong": gradiente forte na faixa do texto (default — lê na maioria).
   *  - "band": faixa quase sólida atrás do texto (à prova de qualquer fundo —
   *    foto ocupada, clara ou branca). Use quando a foto não tem zona limpa. */
  coverScrim?: "soft" | "strong" | "band";
  /** Parágrafos do corpo; pode conter <b>. Vazio quando o layout não usa corpo. */
  corpo?: string;
  /** Itens para o layout `list`. */
  lista?: string[];
  /** Estatística editorial em destaque (layout `video-proof`), ex: "974 mil". */
  stat?: string;
  /** Rótulo sob o número (layout `video-proof`). Default "interações".
   *  Ex.: "views", "comentários", "compartilhamentos". */
  statLabel?: string;
  /** Passos para o layout `reasoning` (cadeia narrativa → território → pauta). */
  cadeia?: string[];
  /** Fonte do dado (layouts de dados: `stat-card`, `comparison`, `diagram`).
   *  Renderizada discreta. Ex.: "IAB Brasil · 2025". Honestidade: todo número tem fonte. */
  fonte?: string;
  /** Dois lados do layout `comparison` (X vs Y). */
  comparacao?: Comparacao;
  /** Nós do layout `diagram` (fluxo/esquema): cada string é um nó, ligados por seta. */
  fluxo?: string[];
  /** Linhas rotuladas do layout `pauta-card` (ficha de publi), ex.:
   *  [{ rotulo: "A CENA", texto: "..." }, { rotulo: "A MARCA APARECE", texto: "..." }]. */
  ficha?: { rotulo: string; texto: string }[];
  /** (layout `respiro`) Linha pequena ACIMA da manchete-herói (ex.: "O humor dela não é piada."). */
  sup?: string;
  /** (layout `respiro`) Fundo do slide nu: "dark" (default), "paper" ou "accent" (bloco terracota). */
  fundo?: "dark" | "paper" | "accent";
  /** (layout `respiro`) Tamanho da manchete em px (default 96). Ajuste pela extensão da linha. */
  escala?: number;
  imagem?: SlideImagem;
  /**
   * Prompt de arte editorial para o Nano Banana (gemini-2.5-flash-image).
   * - SEM `arteRef`: gera um FUNDO atmosférico/conceitual (sem pessoas).
   * - COM `arteRef`: gera o CRIADOR numa cena editorial que ilustra a narrativa,
   *   usando a foto real como referência de identidade (image-to-image).
   * O prompt descreve a CENA/atmosfera; a identidade vem da `arteRef`. Tom de
   * ensaio editorial, nunca fotojornalismo factual. Ver generateArt.ts.
   */
  artePrompt?: string;
  /**
   * URL/caminho da foto real do criador a usar como referência de identidade na
   * geração (profilePictureUrl ou thumbnail de um post). Aceita http(s) ou file://.
   */
  arteRef?: string;
}

export interface ComparacaoLado {
  /** Rótulo da coluna, ex.: "TV" / "DIGITAL". */
  rotulo: string;
  /** Itens/contrastes daquele lado. */
  itens: string[];
  /** Seta de tendência ao lado do rótulo: "up" (↑) ou "down" (↓). Opcional. */
  tendencia?: "up" | "down";
  /** Largura (0–100) de uma barra fina sob o rótulo — visualiza um share/peso. Opcional. */
  barra?: number;
}

export interface Comparacao {
  esquerda: ComparacaoLado;
  direita: ComparacaoLado;
}

export interface CriadorBrief {
  userId: string;
  nome: string;
  handle: string | null;
  narrativaCentral: string;
  territorios: string[];
  assets: string[];
}

export interface ManyChatConfig {
  keyword: string;
  /** Texto da DM enviada quando alguém comenta a keyword. Inclui link + UTM. */
  dm: string;
}

export interface CarouselBrief {
  data: string; // YYYY-MM-DD
  angulo: AnguloRevista;
  /** Criadores da matéria. Vazio no pilar de notícias (a pauta é um fato externo,
   *  não um criador da base) — mas pode trazer 1 criador quando a notícia se ancora
   *  num criador da D2C. */
  criadores: CriadorBrief[];
  titulo: string;
  /** Fonte da notícia (pilar `noticias`), ex.: "Fonte: The Verge · jun/2026".
   *  Renderizada na capa tipográfica. Ignorada nos outros pilares. */
  fonte?: string;
  slides: SlideBrief[];
  caption: string;
  manychat: ManyChatConfig;
}

// ─── Saída do queryCreators (entrada de contexto para o Galeano escrever) ───────

export interface PostResumo {
  postLink: string;
  postDate: string;
  type: string;
  format: string[];
  description: string;
  thumbnailUrl: string | null;
  totalInteractions: number;
  /** ID da mídia no Instagram — necessário p/ marcar `imagem.video` (card de vídeo). */
  instagramMediaId: string | null;
}

export interface CriadorContexto {
  userId: string;
  nome: string;
  handle: string | null;
  profilePictureUrl: string | null;
  maturidade: string;
  narrativaCentral: string;
  territorios: string[];
  temas: string[];
  narrativasAdjacentes: string[];
  assets: string[];
  tom: string;
  /** Posts mais coerentes/performáticos para servir de prova na matéria. */
  topPosts: PostResumo[];
}
