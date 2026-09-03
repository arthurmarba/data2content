// scripts/relatorio/lib/patterns.ts
//
// Motor puro (sem Mongo, sem LLM) que lê 90 dias de posts de UM criador e
// devolve, por dimensão (assunto, cenário, tom, elenco, enquadramento, dia,
// horário), o que rende acima ou abaixo da mediana DELE MESMO — mais o que
// aconteceu com cada item na última semana.
//
// É o método do TrendReport (src/app/lib/relatorio/rankingEngine.ts) aplicado a
// uma pessoa em vez de um território:
//   • índice = mediana do item ÷ mediana geral do criador na janela;
//   • nada é cortado por amostra pequena — a linha aparece com o nível de
//     evidência ao lado (indício/sinal/tendência) e a ordenação usa o índice
//     ENCOLHIDO (baseline.ts::forceMagnitude), então um item visto 1× com 3,0×
//     não passa na frente de um visto 8× com 1,6×;
//   • gancho NÃO vira categoria: é texto livre e único por vídeo, agrupar
//     exigiria inventar um vocabulário que não existe no mapRegistry. Em vez
//     disso listamos os extremos com o texto exato.
//
// O LLM (Galileia) não recalcula nada daqui — só escreve a interpretação.

import {
  medianAll,
  indexAgainstBaseline,
  evidenceLevel,
  forceMagnitude,
} from "./baseline";
import { gridPosition, SLOT_LABELS, WEEKDAY_LABELS_SHORT } from "@/app/lib/relatorio/weekWindow";
import {
  canonicalPlaceById,
  canonicalToneById,
  canonicalAssetRoleById,
  canonicalFramingById,
} from "@/app/lib/relatorio/mapRegistry";
import type {
  ExtremoItem,
  PadraoDimensao,
  PadraoLinha,
  PadroesJanela,
  PostSemana,
} from "./types";

/** Post da janela de 90 dias — forma interna do motor, não serializada. */
export interface PostJanela {
  postDate: Date;
  stats: PostSemana["stats"];
  sceneElements?: any;
}

/** Teto de linhas por tabela. Não é um corte estatístico (nada é excluído por
 *  amostra pequena — Regra 2): é só o que cabe numa página. O que sobra é
 *  contado honestamente no rodapé da tabela. */
const MAX_LINHAS = 10;

/** Quantos itens mostrar de cada lado nas listas de extremos. Seis (e não três)
 *  porque o valor aqui é ver a LISTA — com poucos itens vira anedota, e é na
 *  quantidade que o padrão de linguagem aparece. */
const N_EXTREMOS = 6;

type Item = { id: string; label: string };
type Extractor = (p: PostJanela) => Item[];

const byIds = (
  ids: unknown,
  lookup: (id: string) => { label: string } | null,
): Item[] => {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => {
      const label = typeof id === "string" ? lookup(id)?.label : null;
      return label ? { id: String(id), label } : null;
    })
    .filter((v): v is Item => v !== null);
};

interface DimensaoSpec {
  chave: string;
  titulo: string;
  subtitulo: string;
  /** true = depende da leitura de cena (some quando não há cobertura). */
  precisaCena: boolean;
  extrair: Extractor;
  /** Mínimo de posts para a linha entrar. Só usado no assunto específico, onde
   *  quase tudo é único: sem isto a tabela viraria uma lista de n=1. Não é um
   *  corte estatístico disfarçado — o que fica de fora aparece na lista de
   *  extremos, com a frase exata. */
  minPosts?: number;
}

const DIMENSOES: DimensaoSpec[] = [
  {
    chave: "assuntoRepetido",
    titulo: "Assunto que você repetiu",
    subtitulo: "o tema exato do vídeo, quando voltou mais de uma vez",
    precisaCena: true,
    minPosts: 2,
    extrair: (p) => {
      const subs = p.sceneElements?.subjects;
      if (!Array.isArray(subs)) return [];
      return subs
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
        .map((s) => ({ id: s.toLowerCase(), label: s }));
    },
  },
  {
    chave: "cenario",
    titulo: "Cenário",
    subtitulo: "onde você gravou",
    precisaCena: true,
    extrair: (p) => {
      const id = p.sceneElements?.placeId;
      const label = typeof id === "string" ? canonicalPlaceById(id)?.label : null;
      return label ? [{ id: String(id), label }] : [];
    },
  },
  {
    chave: "elenco",
    titulo: "Quem e o que aparece",
    subtitulo: "as pessoas e coisas em cena",
    precisaCena: true,
    extrair: (p) => byIds(p.sceneElements?.assetRoleIds, canonicalAssetRoleById),
  },
  {
    chave: "objeto",
    titulo: "Objeto em cena",
    subtitulo: "as coisas que aparecem no vídeo, quando repetem",
    precisaCena: true,
    minPosts: 2,
    extrair: (p) => {
      const objs = p.sceneElements?.objects;
      if (!Array.isArray(objs)) return [];
      return objs
        .map((o) => (typeof o === "string" ? o.trim() : ""))
        .filter(Boolean)
        .map((o) => ({
          id: o.toLowerCase(),
          // Texto livre do Gemini vem em minúscula; capitaliza pra tabela.
          label: o.charAt(0).toUpperCase() + o.slice(1),
        }));
    },
  },
  {
    chave: "tom",
    titulo: "Tom",
    subtitulo: "o jeito de falar do vídeo",
    precisaCena: true,
    extrair: (p) => byIds(p.sceneElements?.toneIds, canonicalToneById),
  },
  {
    chave: "enquadramento",
    titulo: "Enquadramento",
    subtitulo: "como a câmera te mostra",
    precisaCena: true,
    extrair: (p) => byIds(p.sceneElements?.framingIds, canonicalFramingById),
  },
  {
    chave: "dia",
    titulo: "Dia da semana",
    subtitulo: "quando você publica",
    precisaCena: false,
    extrair: (p) => {
      const { dayOfWeek } = gridPosition(p.postDate);
      return [{ id: `d${dayOfWeek}`, label: WEEKDAY_LABELS_SHORT[dayOfWeek] ?? "?" }];
    },
  },
  {
    chave: "horario",
    titulo: "Horário",
    subtitulo: "a faixa do dia em que o post sai",
    precisaCena: false,
    extrair: (p) => {
      const { slot } = gridPosition(p.postDate);
      return [{ id: `s${slot}`, label: SLOT_LABELS[slot] ?? "?" }];
    },
  },
];

function buildDimensao(
  spec: DimensaoSpec,
  posts: PostJanela[],
  semanaDe: Date,
  medianas: PadroesJanela["medianas"],
): PadraoDimensao {
  const grupos = new Map<string, { label: string; posts: PostJanela[] }>();
  for (const p of posts) {
    for (const item of spec.extrair(p)) {
      const g = grupos.get(item.id) ?? { label: item.label, posts: [] };
      g.posts.push(p);
      grupos.set(item.id, g);
    }
  }

  const linhas: PadraoLinha[] = [];
  for (const [id, g] of grupos) {
    const idx = (campo: "shares" | "saved" | "views", base: number | null) =>
      indexAgainstBaseline(medianAll(g.posts.map((p) => p.stats[campo])), base);

    const naSemana = g.posts.filter((p) => p.postDate >= semanaDe);
    linhas.push({
      id,
      label: g.label,
      nPosts: g.posts.length,
      indexShares: idx("shares", medianas.shares),
      indexSaved: idx("saved", medianas.saved),
      indexViews: idx("views", medianas.views),
      evidence: evidenceLevel(g.posts.length),
      semana: naSemana.length
        ? {
            nPosts: naSemana.length,
            indexShares: indexAgainstBaseline(
              medianAll(naSemana.map((p) => p.stats.shares)),
              medianas.shares,
            ),
          }
        : null,
    });
  }

  // Ordena pelo índice ENCOLHIDO: o que puxa forte pra cima OU pra baixo sobe,
  // mas só na medida em que a amostra sustenta.
  linhas.sort(
    (a, b) =>
      forceMagnitude(b.indexShares, b.nPosts) - forceMagnitude(a.indexShares, a.nPosts),
  );

  const visiveis = spec.minPosts
    ? linhas.filter((l) => l.nPosts >= (spec.minPosts as number))
    : linhas;

  return {
    chave: spec.chave,
    titulo: spec.titulo,
    subtitulo: spec.subtitulo,
    linhas: visiveis.slice(0, MAX_LINHAS),
  };
}

/** Extremos de um texto livre do vídeo (gancho, assunto específico): ordena os
 *  posts pelo índice de compartilhamento e mostra as pontas com a frase exata.
 *  É a alternativa honesta a agrupar em categoria quando cada vídeo traz um
 *  texto praticamente único — a frase fala por si. */
function buildExtremos(
  posts: PostJanela[],
  medianaShares: number | null,
  textoDe: (p: PostJanela) => string | null,
): { melhores: ExtremoItem[]; piores: ExtremoItem[] } {
  const itens = posts
    .map((p) => {
      const texto = textoDe(p);
      if (!texto) return null;
      return {
        texto,
        data: p.postDate.toISOString().slice(0, 10),
        indexShares: indexAgainstBaseline(p.stats.shares ?? null, medianaShares),
      } satisfies ExtremoItem;
    })
    .filter((v): v is ExtremoItem => v !== null && v.indexShares !== null)
    .sort((a, b) => (b.indexShares ?? 0) - (a.indexShares ?? 0));

  if (itens.length < 2) return { melhores: [], piores: [] };
  // Sem sobreposição quando a amostra é pequena.
  const n = Math.min(N_EXTREMOS, Math.floor(itens.length / 2));
  return { melhores: itens.slice(0, n), piores: itens.slice(-n).reverse() };
}

/** Constrói a leitura de 90 dias. `posts` é a janela inteira (inclui a semana);
 *  `semanaDe` marca onde a última semana começa. */
export function buildPadroes(
  posts: PostJanela[],
  periodo: { de: string; ate: string },
  semanaDe: Date,
  baselineMedianas?: { shares: number | null; saved: number | null; views: number | null },
): PadroesJanela {
  // Use a baseline anterior à semana quando ela estiver disponível. Isso
  // evita que uma semana com muitos posts zerados transforme a mediana em zero
  // e apague rankings que têm dados válidos (caso real: Glow40 e Camila).
  const medianas = baselineMedianas ?? {
    shares: medianAll(posts.map((p) => p.stats.shares)),
    saved: medianAll(posts.map((p) => p.stats.saved)),
    views: medianAll(posts.map((p) => p.stats.views)),
  };
  const nComCena = posts.filter((p) => p.sceneElements?.version).length;

  const dimensoes = DIMENSOES
    // Dimensão de cena sem nenhuma cobertura sai fora em vez de virar tabela
    // vazia — "vazio honesto é melhor que tabela sem dado".
    .filter((spec) => !spec.precisaCena || nComCena > 0)
    .map((spec) => buildDimensao(spec, posts, semanaDe, medianas))
    .filter((d) => d.linhas.length > 0);

  return {
    periodo,
    nPosts: posts.length,
    nComCena,
    medianas,
    dimensoes,
    ganchos: buildExtremos(posts, medianas.shares, (p) => {
      // Gancho pode ser verbal ou visual. Quando o vídeo abre com texto na
      // tela e não com fala, o screenTitle é a abertura que a audiência viu.
      const t = p.sceneElements?.openingLine ?? p.sceneElements?.screenTitle;
      return typeof t === "string" && t.trim() ? t.trim() : null;
    }),
    // Um post traz até 4 assuntos específicos; juntamos os dele numa linha só
    // para a lista ser "sobre o que era esse vídeo", e não a mesma performance
    // repetida quatro vezes.
    assuntos: buildExtremos(posts, medianas.shares, (p) => {
      const subs = p.sceneElements?.subjects;
      if (!Array.isArray(subs)) return null;
      const limpos = subs.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
      return limpos.length ? limpos.join(" · ") : null;
    }),
  };
}
