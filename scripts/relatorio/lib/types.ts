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
  };
  posts: PostSemana[];
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
  /** Movimento 2 — o que a audiência pede. */
  audiencia: AudienciaPedido;
  /** Movimento 3 — faça mais / faça menos. */
  facaMais: string[];
  facaMenos: string[];
  /** Movimento 4 — plano da próxima semana. */
  plano: PautaPlano[];
  /** Costura comparativa — só a partir da 2ª semana. */
  comparativo?: Comparativo;
}
