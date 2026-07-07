// scripts/reuniao/lib/types.ts
//
// Tipos do Galisteu — a apresentação (.pptx) da reunião de grupo da Data2Content.
// Terceiro irmão da família: Galeano (revista/carousel) e Galileia (relatório
// individual em PDF). Aqui o entregável é um DECK que o host projeta e conduz,
// falando de CADA participante com 1 ponto forte + 1 ponto a ajustar da semana,
// + sugestões de collab ENTRE os participantes + a categoria de marca que encaixa
// na narrativa de cada um.
//
// A lente é a mesma da Galileia — o PONTO-OURO (narrativa × audiência × marca,
// com a narrativa como âncora) — mas destilada a UM forte e UM fraco por criador,
// porque é reunião em grupo, não consultoria individual.

import type { PostSemana, Snapshot } from "../../relatorio/lib/types";

export type { PostSemana, Snapshot };

/** Selo dos 3 círculos do ponto-ouro (reusa a régua da Galileia).
 *  fraco = sinal insuficiente (post recente, poucos dados) — honestidade, não chute. */
export type Selo = "verde" | "amarelo" | "vermelho" | "fraco";

// ─── ENTRADA: contexto da reunião (queryMeeting.ts escreve isto) ────────────

/** A semana de UM participante (espelha o miolo de ContextoSemana da Galileia,
 *  sem o snapshot anterior — V1 do Galisteu não faz comparativo). */
export interface ParticipanteSemana {
  /** null quando o criador não foi encontrado na base (relatado, não trava). */
  encontrado: boolean;
  /** A string que o usuário passou (@handle ou nome), p/ rastrear não-encontrados. */
  consulta: string;
  userId: string | null;
  nome: string;
  handle: string | null;
  profilePictureUrl: string | null;
  narrativaCentral: string;
  territorios: string[];
  temas: string[];
  assets: string[];
  tom: string;
  posts: PostSemana[];
  /** Snapshot da semana anterior (da Galileia), se existir — liga o comparativo. */
  anterior: Snapshot | null;
}

export interface MeetingContext {
  /** Fim do período (YYYY-MM-DD). */
  data: string;
  periodo: { de: string; ate: string };
  participantes: ParticipanteSemana[];
}

// ─── SAÍDA: o deck que o Galisteu escreve (deck.json) ───────────────────────

/** Um ponto (forte ou a ajustar) sobre um post/sinal da semana. */
export interface Ponto {
  /** A leitura, em 1 frase concreta (o que o host fala). */
  texto: string;
  /** A evidência: qual post / qual sinal sustenta a leitura. */
  evidencia: string;
  /** Post que ancora o ponto (puxa a thumb no slide). */
  postId?: string | null;
  thumbnailUrl?: string | null;
  /** Sinal em destaque — SEMPRE relativo (vs. média do criador), nunca cru. */
  stat?: { valor: string; label: string };
  /** Selos internos do ponto-ouro (derivam a leitura; não vão crus no slide). */
  selos?: { narrativa: Selo; audiencia: Selo; marca: Selo };
}

/** Categoria de marca que encaixa na narrativa (fit por narrativa, nunca logo). */
export interface GanchoMarca {
  /** O arquétipo/categoria que encaixa (ex.: "produto pra rotina caótica de mãe"). */
  categoria: string;
  /** 1 exemplo real, renderizado em itálico como menção — nunca como fato fechado. */
  exemplo: string;
  /** A EVIDÊNCIA: o território/tensão que o conteúdo já prova e por onde a marca entra
   *  (método: "marcas compram narrativa, não alcance"). Ex.: "a rotina antes do sol". */
  porque?: string;
}

/** Próximos passos do criador — fecha a cadeia narrativa→território→tema→asset→pauta.
 *  É o coração do D2C na reunião: o criador sai com o que postar, não só com um boletim. */
export interface ProximosPassos {
  /** A lacuna que abre as pautas: território que esfriou ou asset do mapa ocioso. */
  lacuna?: string;
  /** 2–3 pautas ESPECÍFICAS (nível "o dia em que…"), derivadas do mapa — nunca trend. */
  pautas: { titulo: string; porque: string }[];
}

/** O reel que toca DENTRO do slide (PowerPoint/Keynote desktop). O agente aponta
 *  o postId; o renderDeck rebusca o mp4 fresco via Graph API (token do criador) e
 *  preenche videoPath/posterUrl. Sem token/vídeo → degrada pro poster estático. */
export interface ReelEmbed {
  postId: string | null;
  /** Poster do reel (thumb) — preenchido pelo render; vira o cover do vídeo no PPT. */
  posterUrl?: string | null;
  /** Caminho local do mp4 baixado — preenchido pelo render. */
  videoPath?: string | null;
}

/** Leitura de coerência da semana — a lente-assinatura do D2C: o quanto o conteúdo
 *  ficou dentro do mapa, e se há sinal de "voltou ao automático" (método do Ronaldo:
 *  postar por hábito, narrativa central sumindo). É diagnóstico, vive no Tempo A. */
export interface Coerencia {
  /** no-mapa = coerente · parcial = misto · automatico = voltou ao automático. */
  status: "no-mapa" | "parcial" | "automatico";
  /** 1 frase calma (sem ansiedade): o que aconteceu com a narrativa na semana. */
  resumo: string;
}

export interface CriadorSlide {
  userId: string | null;
  nome: string;
  handle: string | null;
  profilePictureUrl: string | null;
  narrativaCentral: string;
  territorios: string[];
  /** Leitura de coerência da semana (Tempo A). */
  coerencia?: Coerencia;
  /** Faixa curta de números da semana (relativos/traduzidos), opcional. */
  numeros?: { valor: string; label: string }[];
  pontoForte: Ponto;
  pontoAjustar: Ponto;
  ganchoMarca: GanchoMarca;
  /** Próximos passos: a lacuna + pautas da semana (a cadeia narrativa→pauta). */
  proximosPassos?: ProximosPassos;
  /** Pauta de fala/condução p/ o host (e o que provavelmente vão perguntar). */
  falaSugerida?: string;
  /** Reel que toca no slide — normalmente o do ponto forte. */
  reel?: ReelEmbed;
  // ── Bloco 3 — enriquecimento de dados (tudo opcional) ──
  /** Mini-gráfico da semana: um par de barras (saves/shares) por post.
   *  O agente preenche a partir dos saves/shares do digest. */
  grafico?: { posts: { rotulo: string; saves: number; shares: number }[] };
  /** O que a audiência pediu, em 1 linha de narrativa (lido por saves/shares + classificação). */
  audienciaPede?: string;
  /** Delta vs. a semana passada (só quando há `anterior`): cumpriu o que prometeu? 1 linha. */
  comparativo?: string;
  /** Criador sem posts na semana: slide nasce do mapa, sinais marcados como fracos. */
  semSinal?: boolean;
}

export interface CollabSugerida {
  a: string; // @handle do participante A
  b: string; // @handle do participante B
  /** O que cada um traz pra collab (a complementaridade) — 1 frase curta cada. */
  aTraz?: string;
  bTraz?: string;
  territorioComum: string;
  porque: string;
  /** A pauta concreta da collab — prática, nível "o vídeo em que…". */
  pautaIdeia: string;
  /** Resumo de 1 frase de como gravar à distância (fallback / chamada). */
  comoGravar: string;
  /** COMO gravar à distância, em PASSOS numerados (a maioria não mora na mesma
   *  cidade): cada passo diz quem grava o quê e como vira o vídeo final.
   *  Ex.: ["A Laura grava o plano em casa e manda", "A Amanda filma a execução",
   *  "Editor junta em tela dividida", "Cada uma posta 1 reel marcando a outra"]. */
  gravarPassos?: string[];
  /** Por que essa collab funciona pros DOIS (o ganho mútuo) — 1 frase. */
  porQueFunciona?: string;
}

export interface DeckData {
  reuniao: {
    data: string; // YYYY-MM-DD
    titulo: string;
    participantes: string[]; // handles/nomes na ordem de apresentação
  };
  criadores: CriadorSlide[];
  /** Pares sugeridos ENTRE os participantes (1–3). */
  collabs: CollabSugerida[];
  fechamento: {
    /** O fio comum da semana entre os participantes. */
    fioComum: string;
    /** Lembrete da reunião da comunidade ("você não cria sozinho"). */
    lembreteComunidade: string;
  };
}
