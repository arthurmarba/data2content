// scripts/relatorio/lib/types.ts
//
// Tipos do Relatório Semanal do Criador (consultoria individual).
// Irmão do Galeano: mesma filosofia de pipeline (dados → estado → render),
// mas o entregável é um RELATÓRIO didático em PDF, não um carousel.
//
// A lógica central do relatório é o PONTO-OURO: o conteúdo que está, ao mesmo
// tempo, dentro da NARRATIVA do criador, é pedido pela AUDIÊNCIA e tem fit com
// MARCAS. A narrativa é a âncora — audiência e marcas se leem através dela.

/** Selo de cada círculo do Venn na avaliação de um post.
 *  - verde:    acertou esse círculo.
 *  - amarelo:  parcial / dá pra ajustar.
 *  - vermelho: não acertou / destoou.
 *  - fraco:    sinal insuficiente (pouco engajamento, classificação incerta,
 *              post recente demais) — honestidade de dado, não inventa veredito. */
export type Selo = "verde" | "amarelo" | "vermelho" | "fraco";

export type Veredito = "repetir" | "ajustar" | "nao-repetir";

/** Onde uma pauta planejada mira no Venn dos 3 círculos. */
export type Mira = "centro" | "narrativa+audiencia" | "narrativa+marca" | "narrativa";

// ─── ENTRADA: contexto da semana (queryWeek.ts escreve isto) ────────────────

export interface PostSemana {
  postId: string | null; // instagramMediaId
  postLink: string;
  postDate: string; // YYYY-MM-DD
  type: string;
  /** Classificação V2.5 já existente no Metric — o agente lê e mapeia p/ o mapa. */
  format: string[];
  proposal: string[];
  context: string[];
  tone: string[];
  references: string[];
  description: string;
  thumbnailUrl: string | null;
  /** Sinais de demanda real da audiência. saves/shares > reach (pedido > exposição). */
  stats: {
    views?: number;
    reach?: number;
    likes?: number;
    comments?: number;
    saved?: number;
    shares?: number;
    total_interactions?: number;
  };
  /** Cada métrica do post ÷ a mediana do criador (criador.baseline). Ex.: shares:10
   *  = "10× a mediana de compartilhamentos deste criador". null quando falta dado
   *  de um dos lados (não confundir com 0). Usar isto para o campo `stat` do
   *  report.json em vez de estimar a comparação de cabeça. */
  indices?: {
    views?: number | null;
    reach?: number | null;
    shares?: number | null;
    saved?: number | null;
    engagementRate?: number | null;
  };
  /** Leitura de cena do vídeo (Gemini, mesma pipeline do TrendReport) — quem
   *  aparece, onde, o que foi dito, o gancho de abertura. Ausente quando o post
   *  ainda não foi classificado ("vazio honesto"): a Galileia segue sem isto,
   *  não é obrigatório. Ver scripts/relatorio-semanal/backfillScenes.ts. */
  cena?: {
    assuntos: string[]; // texto livre do próprio vídeo (subjects)
    objetos: string[];
    falas: string[]; // quotes, verbatim
    local: string | null; // label resolvida via canonicalPlaceById
    enquadramentos: string[]; // labels via canonicalFramingById
    esteticas: string[]; // labels via canonicalAestheticById
    gancho: string | null; // openingLine — a frase/texto que abre o vídeo
    tituloNaTela: string | null; // screenTitle
  };
}

/** Mediana das métricas do PRÓPRIO criador nos ~90 dias antes da semana do
 *  relatório — não um "quanto é normal" do território, mas do criador mesmo
 *  (alcance/views variam ordens de grandeza entre contas; a única comparação
 *  honesta é contra a própria história). Ver scripts/relatorio/lib/baseline.ts. */
export interface CreatorBaseline {
  nPosts: number;
  medianViews: number | null;
  medianReach: number | null;
  medianShares: number | null;
  medianSaved: number | null;
  medianEngagementRate: number | null;
  /** false quando nPosts < MIN_BASELINE_SAMPLE — sem histórico suficiente pra
   *  comparar com honestidade; a Galileia não deve inventar índice aqui. */
  sufficient: boolean;
}

// ─── PADRÕES: a leitura de 90 dias (patterns.ts calcula, o LLM só interpreta) ──
// Cada linha é um item (um assunto, um cenário, um dia da semana) medido contra
// a mediana da PRÓPRIA criadora na janela. Nada é cortado por amostra pequena:
// a linha aparece com o nível de evidência ao lado (indício/sinal/tendência) e
// a ordenação usa o índice encolhido (baseline.ts::forceMagnitude).

export interface PadraoLinha {
  id: string;
  label: string;
  nPosts: number;
  /** Mediana do item ÷ mediana geral da criadora na janela. null = sem dado. */
  indexShares: number | null;
  indexSaved: number | null;
  indexViews: number | null;
  evidence: "indicio" | "sinal" | "tendencia";
  /** Como esse item se saiu na ÚLTIMA SEMANA. null = não apareceu na semana. */
  semana: { nPosts: number; indexShares: number | null } | null;
}

export interface PadraoDimensao {
  chave: string; // "assunto" | "cenario" | "tom" | "elenco" | "enquadramento" | "dia" | "horario"
  titulo: string;
  /** Explica em uma linha o que a dimensão mede (vai no cabeçalho da tabela). */
  subtitulo: string;
  linhas: PadraoLinha[];
}

/** Item de uma lista de extremos (gancho ou assunto específico): texto exato do
 *  vídeo + como aquele post rendeu. Usado quando agrupar em categoria seria
 *  inventar taxonomia — a frase fala por si. */
export interface ExtremoItem {
  texto: string;
  data: string;
  indexShares: number | null;
}

export interface PadroesJanela {
  periodo: { de: string; ate: string };
  nPosts: number;
  /** Quantos dos posts da janela têm leitura de cena (as dimensões de cena só
   *  enxergam esses). Serve para o relatório ser honesto sobre a cobertura. */
  nComCena: number;
  medianas: { shares: number | null; saved: number | null; views: number | null };
  dimensoes: PadraoDimensao[];
  /** Ganchos não são agrupados em categoria (texto livre, único por vídeo):
   *  mostramos os extremos com o texto exato e deixamos o padrão falar. */
  ganchos: { melhores: ExtremoItem[]; piores: ExtremoItem[] };
  /** Assunto ESPECÍFICO, como o vídeo trata de fato (não o tópico guarda-chuva).
   *  Quase todo assunto específico é único — por isso a leitura é por extremos,
   *  igual aos ganchos. Os poucos que se repetem viram tabela própria
   *  (`dimensoes` com chave "assuntoRepetido"), onde repetição vira padrão. */
  assuntos: { melhores: ExtremoItem[]; piores: ExtremoItem[] };
}

export interface ContextoSemana {
  periodo: { de: string; ate: string };
  criador: {
    userId: string;
    nome: string;
    handle: string | null;
    profilePictureUrl: string | null;
    narrativaCentral: string;
    territorios: string[];
    temas: string[];
    assets: string[];
    tom: string;
    /** Baseline calculada dos últimos ~90 dias (omitida se sem dado). */
    baseline?: CreatorBaseline;
  };
  posts: PostSemana[];
  /** Leitura de 90 dias (tabelas prontas). O LLM NÃO copia isto para o
   *  report.json — o render busca daqui direto, e o report.json carrega só a
   *  interpretação escrita (`ReportData.padroesLeitura`). */
  padroes?: PadroesJanela;
  /** Snapshot da semana anterior, se existir (liga o comparativo na 2ª execução). */
  anterior: Snapshot | null;
}

// ─── ESTADO: snapshot persistido por semana (a "memória" do agente) ─────────
// Vive em output/relatorios/<slug>/snapshots.json. NUNCA reler o PDF — o agente
// lê este snapshot para fechar o loop ("o que prometi virou conteúdo?").

export interface Snapshot {
  data: string; // YYYY-MM-DD (fim do período)
  narrativaCentral: string;
  territoriosOcupados: string[];
  audienciaPede: string;
  facaMais: string[];
  facaMenos: string[];
  /** Títulos das pautas planejadas para a semana seguinte (cobrança no próximo). */
  planoPrometido: string[];
  /** Veredito por post, p/ o próximo relatório cobrar "repetiu o que pedi?". */
  vereditos: { postId: string | null; veredito: Veredito }[];
}

// ─── SAÍDA: o relatório que o agente escreve (report.json) ──────────────────

export interface PostAvaliacao {
  postId: string | null;
  postLink: string;
  postDate: string;
  thumbnailUrl: string | null;
  /** Linha curta: território · asset · tom · formato. */
  oQueEra: string;
  /** Os 3 círculos do Venn. */
  narrativa: Selo;
  audiencia: Selo;
  marca: Selo;
  /** Sinal de demanda em destaque (ex.: "312 salvamentos"). */
  stat?: { valor: string; label: string };
  funcionou: string; // 1 frase concreta
  enfraqueceu: string; // 1 frase concreta
  veredito: Veredito;
  /** A frase/texto exato que abre o vídeo (de context.posts[].cena.gancho) —
   *  copiar verbatim quando existir, não parafrasear. Renderiza como uma linha
   *  discreta sob `oQueEra`; omitir quando o post não tiver leitura de cena. */
  gancho?: string | null;
  /** Local + assunto da cena (de context.posts[].cena.local/assuntos) — a
   *  versão individual do que a tabela de território mostra coletivamente.
   *  `assunto` é ESCOLHIDO por você entre as opções de `cena.assuntos` (o
   *  Gemini costuma dar 2-4 parafraseamentos do mesmo tema — escolha o mais
   *  específico, não liste todos). Omitir quando não houver leitura de cena. */
  cena?: { local?: string | null; assunto?: string | null };
}

export interface AudienciaPedido {
  /** Frase-síntese: o que a audiência está pedindo, em linguagem de narrativa. */
  resumo: string;
  /** Por dimensão do mapa (território/tom): quão forte ressoou. */
  itens: { dimensao: string; sinal: "alto" | "medio" | "baixo"; nota: string }[];
}

export interface PautaPlano {
  /** Pauta específica nível "o dia que..." — derivada, não genérica. */
  titulo: string;
  /** Por que agora: território descoberto, asset não usado, demanda da audiência. */
  porque: string;
  mira: Mira;
}

export interface Comparativo {
  /** Cobrança do que foi prometido na semana anterior. */
  prometido: { item: string; cumpriu: "sim" | "parcial" | "nao"; nota: string }[];
  /** Delta narrativo da semana (1-2 frases). */
  delta: string;
}

export interface ReportData {
  data: string; // YYYY-MM-DD (fim do período)
  periodo: { de: string; ate: string };
  criador: {
    userId: string;
    nome: string;
    handle: string | null;
    profilePictureUrl: string | null;
    narrativaCentral: string;
    territorios: string[];
    tom: string;
  };
  /** Abertura didática: 1-2 frases sobre a semana, tom calmo, sem pressão. */
  resumoSemana: string;
  /** Faixa de "números da semana" na capa — número traduzido em sentido, não
   *  vaidade. 3-4 itens, ex.: [{valor:"3",label:"posts"},{valor:"440",label:"salvamentos"},
   *  {valor:"Reforma barata",label:"território mais forte"}]. */
  numeros?: { valor: string; label: string }[];
  /** Movimento 1 — crítica post a post. */
  avaliacoes: PostAvaliacao[];
  /** Movimento 2 — leitura dos padrões de 90 dias. Você escreve APENAS a
   *  interpretação (1-2 frases por dimensão, chaveado por `PadraoDimensao.chave`
   *  + "ganchos"); as TABELAS vêm calculadas do context.json e são mescladas no
   *  render. Nunca transcreva número aqui — o número já está na tabela. */
  padroesLeitura?: Record<string, string>;
  /** Movimento 3 — o que a audiência pede. */
  audiencia: AudienciaPedido;
  /** Movimento 3 — faça mais / faça menos. */
  facaMais: string[];
  facaMenos: string[];
  /** Movimento 4 — plano da próxima semana. */
  plano: PautaPlano[];
  /** Costura comparativa — só a partir da 2ª semana. */
  comparativo?: Comparativo;
}
