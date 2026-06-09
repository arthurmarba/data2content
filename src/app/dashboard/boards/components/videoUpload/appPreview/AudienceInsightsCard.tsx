"use client";

/**
 * AudienceInsightsCard — "Sua Audiência"
 *
 * Responde a pergunta que só o Data2Content pode responder:
 * "O que minha audiência revela sobre mim — que eu ainda não vi no meu próprio mapa?"
 *
 * Cada seção é um insight NÃO-ÓBVIO: cruzamento de comportamento (saves/shares)
 * com as dimensões classificadas do mapa (território, tom, intenção).
 * O Instagram já mostra saves e alcance — o que aparece aqui é o que ele não consegue
 * mostrar porque não conhece a narrativa, o tom e a intenção de cada post.
 *
 * Card = headline (o quê). Modal = profundidade (por quê + dado adicional).
 * Modal nunca repete o headline do card.
 */

import { useState, useCallback } from "react";
import { X } from "lucide-react";
import type { AudienceInsights } from "@/app/dashboard/boards/videoUpload/audienceInsightsService";

// Tokens alinhados ao card "Roteiros", com acento verde para Audiência.
const CARD_RADIUS = 20;
const CARD_BG = "#f6fbf7";
const CARD_SHADOW = "0 1px 6px rgba(16,185,129,0.10), 0 0 0 0.5px rgba(16,185,129,0.08)";
const CARD_ACCENT = "#10b981";
const CARD_TEXT = "#14532d";
const CARD_DIVIDER = "rgba(16,185,129,0.10)";
const CARD_DIVIDER_SOFT = "rgba(16,185,129,0.08)";

// ─── Copy layer ────────────────────────────────────────────────────────────────
// Cada função traduz um campo de AudienceInsights em texto humano.
// Sujeito = sempre a audiência ("elas"), nunca o criador.
// Sem números absolutos. Sem prescrições ("você deve...").

// Humaniza rótulos crus do classificador para linguagem de narrativa:
//   "Tecnologia/Digital"          → "tecnologia"
//   "Estilo de Vida e Bem-Estar"  → "estilo de vida e bem-estar"
//   "Inspirador/Motivacional"     → "inspirador"
function humanizeLabel(raw: string): string {
  return raw.split("/")[0]!.trim().toLowerCase();
}

function orphanCardHeadline(label: string): string {
  return `Você falou pouco de ${territoryNoun(label)} — mas é o que mais salvam.`;
}

function orphanModalBody(label: string, postCount: number): string {
  return `Você criou sobre ${territoryNoun(label)} só ${postCount} ${postCount === 1 ? "vez" : "vezes"} — menos do que qualquer outro assunto. Mesmo assim, toda vez que foi lá, elas salvaram para si: o gesto de quem quer voltar.`;
}

function orphanModalReflection(): string {
  return `Esse pode ser um lado seu que você ainda não assumiu completamente.`;
}

function toneCardHeadline(label: string): string {
  return `Seu lado ${humanizeLabel(label)} é o que mais conecta com elas.`;
}

function toneModalBody(label: string): string {
  return `Tom é como você fala, não o que fala. É o seu jeito ${humanizeLabel(label)} que mais faz as pessoas salvarem — sinal de que a forma como você se expressa é parte do que elas reconhecem em você.`;
}

function toneModalReflection(): string {
  return `O reconhecimento não vem de postar mais — vem de ser mais você em certos momentos.`;
}

function formatInversionCardHeadline(savesLabel: string): string {
  return `${capitalize(humanizeLabel(savesLabel))} alcança menos — mas é o que elas salvam.`;
}

function formatInversionModalBody(reachLabel: string, savesLabel: string): string {
  return `${capitalize(humanizeLabel(reachLabel))} te leva mais longe, mas é em ${humanizeLabel(savesLabel)} que elas salvam para si. Alcance diz quantos viram; reconhecimento diz quem quis ficar.`;
}

function formatInversionModalReflection(): string {
  return `Os dois formatos têm papéis diferentes no que você constrói — nenhum é melhor que o outro.`;
}

function intentCardHeadline(label: string): string {
  return `Quando você posta pra ${intentPhrase(label)}, é o que elas mais salvam.`;
}

function intentModalBody(label: string): string {
  return `Toda postagem tem uma intenção por trás. Quando a sua é ${intentPhrase(label)}, é o que elas mais salvam pra rever — não é o tema que faz ficar, é o porquê.`;
}

function intentModalReflection(): string {
  return `Saber por que você cria é tão importante quanto o que cria. Esse é o objetivo que mais fica com elas.`;
}

// Território de reconhecimento (assunto mais salvo, sem comparação com mapa)
function resonantTerritoryCardHeadline(label: string): string {
  return `${capitalize(territoryNoun(label))} é o assunto que elas mais salvam.`;
}

function resonantTerritoryModalBody(label: string): string {
  return `De tudo que você publica, o assunto que elas mais salvam é ${territoryNoun(label)}. Salvar é um ato privado: quem salvou disse, sem palavras, que isso é dela — pra voltar depois.`;
}

function resonantTerritoryModalReflection(): string {
  return `Esse é o assunto que mais fica com elas. Ele está no centro do que você quer ser reconhecido?`;
}

// Território em ascensão (tendência no tempo)
function risingCardHeadline(label: string): string {
  return `Falar de ${territoryNoun(label)} vem ganhando força no que elas salvam.`;
}

function risingModalBody(label: string): string {
  return `Comparando o começo e o agora do período, ${territoryNoun(label)} subiu no que elas salvam. Um assunto não nasce pronto — ele cresce quando você volta nele e a audiência responde.`;
}

function risingModalReflection(): string {
  return `Talvez seja um lado seu amadurecendo. Vale notar se isso reflete pra onde você quer ir.`;
}

// Combo cirúrgico (território × momento)
function comboCardHeadline(c: { territoryLabel: string; whenLabel: string }): string {
  return `Quando você fala de ${territoryNoun(c.territoryLabel)} ${c.whenLabel}, elas salvam bem mais.`;
}

function comboModalBody(c: { territoryLabel: string; whenLabel: string }): string {
  return `${capitalize(territoryNoun(c.territoryLabel))} ${c.whenLabel} é o encontro certo: nesse momento, esse assunto é salvo muito mais do que a média. Não é o assunto sozinho nem o horário sozinho — é os dois juntos.`;
}

function comboModalReflection(): string {
  return `Um padrão assim não é regra pra seguir à risca — é uma pista de quando você e essas pessoas se encontram melhor.`;
}

// V2 — Divergência mapa↔audiência
function divergenceCardHeadline(audienceLabel: string): string {
  return `Elas te reconhecem por ${territoryNoun(audienceLabel)} — talvez mais do que você imagina.`;
}

function divergenceModalBody(_audienceLabel: string, _mapLabel: string): string {
  // A caixa comparativa acima já mostra mapa vs. audiência — aqui só o significado.
  return `Salvar é a audiência dizendo, sem palavras, "isso é meu". Elas estão fazendo isso por um ângulo que ainda não está no centro do seu mapa — um lado seu que já chegou nelas antes de você nomear.`;
}

function divergenceModalReflection(): string {
  return `Isso não significa mudar — significa que a audiência já viu algo que você talvez não tenha nomeado ainda.`;
}

// V2 — Quem te acompanha (demografia)
// A fonte cola cidade+estado de formas redundantes:
//   "Rio de Janeiro, Rio de Janeiro"          → "Rio de Janeiro"
//   "Rio de Janeiro, Rio de Janeiro (state)"  → "Rio de Janeiro"
// Normaliza cada token (sem parênteses, minúsculo) e remove os que são duplicata
// ou subconjunto de outro já visto.
function cleanLocation(raw: string): string {
  const seen: string[] = [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    // base sem sufixos como "(state)", "(estado)", minúscula
    const base = token.replace(/\([^)]*\)/g, "").trim().toLowerCase();
    if (!base) continue;
    // pula se já vimos essa base, ou se ela contém/está contida numa já vista
    const redundant = seen.some((s) => s === base || s.includes(base) || base.includes(s));
    if (redundant) continue;
    seen.push(base);
    out.push(token.replace(/\s*\([^)]*\)\s*/g, "").trim()); // remove o "(state)" do display
  }
  return out.join(", ");
}

function demographicsCardHeadline(d: { dominantGender: string | null; topAgeRange: string | null; topCity: string | null }): string {
  // Sem rótulo no card, a frase precisa se apresentar sozinha.
  const parts: string[] = [];
  if (d.dominantGender) parts.push(d.dominantGender === "feminino" ? "mulheres" : d.dominantGender === "masculino" ? "homens" : "pessoas");
  if (d.topAgeRange) parts.push(`de ${d.topAgeRange.replace("-", " a ")}`);
  if (d.topCity) parts.push(`de ${cleanLocation(d.topCity)}`);
  return parts.length > 0 ? `Quem mais te acompanha: ${parts.join(", ")}.` : "Sua audiência já tem um perfil definido.";
}

function demographicsModalBody(): string {
  return `Essas são as pessoas que escolheram te acompanhar. Quando você cria, é com elas que está falando — mesmo sem nunca terem se apresentado.`;
}

function demographicsModalReflection(): string {
  return `Esse é o público que te reconhece. Era quem você imaginava quando começou?`;
}

// ─── Quem segue ≠ quem engaja (divergência demográfica) ───────────────────────

// Formata um valor demográfico para exibição conforme a dimensão.
function engagedValueLabel(dimension: string, value: string): string {
  if (dimension === "gênero") return value === "feminino" ? "mulheres" : value === "masculino" ? "homens" : "pessoas";
  if (dimension === "cidade") return cleanLocation(value);
  return value; // faixa etária: "35-44"
}

function engagedDivergenceCardHeadline(d: { dimension: string; followerLabel: string; engagedLabel: string }): string {
  const f = engagedValueLabel(d.dimension, d.followerLabel);
  const e = engagedValueLabel(d.dimension, d.engagedLabel);
  if (d.dimension === "gênero") return `Te seguem ${f}, mas quem mais engaja são ${e}.`;
  if (d.dimension === "cidade") return `Te seguem de ${f}, mas quem mais engaja é de ${e}.`;
  return `Te seguem ${f}, mas quem mais engaja tem ${e}.`;
}

function engagedDivergenceModalBody(d: { dimension: string; followerLabel: string; engagedLabel: string }): string {
  const e = engagedValueLabel(d.dimension, d.engagedLabel);
  return `Seguir é um clique; engajar é uma escolha repetida. Quem mais salva, comenta e compartilha o que você faz — ${e} — não é exatamente quem mais te segue. Esse é o público que está de verdade com você.`;
}

function engagedDivergenceModalReflection(): string {
  return `Talvez seu conteúdo já esteja falando com quem importa — mesmo que o número de seguidores conte outra história.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Rótulo "bonito" para chips/comparações: humaniza (tira barra técnica) + capitaliza.
// "Tecnologia/Digital" → "Tecnologia"; "neutro/descritivo" → "Neutro".
function prettyLabel(s: string): string {
  return capitalize(humanizeLabel(s));
}

// ─── Dicionários curados: rótulo do classificador → frase natural ──────────────
// O problema não é classificação, é renderização: cortar o rótulo no "/" gera
// fragmentos que não encaixam na frase ("posta pra conectar", "reconhecem por
// pessoal e profissional"). Estes mapas traduzem para linguagem natural, com
// fallback para humanizeLabel quando não houver entrada.
const normKey = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();

// Território: famílias-pai viram substantivo natural; filhos usam humanize.
const TERRITORY_NOUN: Record<string, string> = {
  [normKey("Estilo de Vida e Bem-Estar")]: "estilo de vida",
  [normKey("Pessoal e Profissional")]: "vida pessoal e profissional",
  [normKey("Hobbies e Interesses")]: "hobbies",
  [normKey("Ciência e Conhecimento")]: "ciência",
  [normKey("Social e Eventos")]: "vida social",
  [normKey("Geral")]: "vários assuntos",
};
function territoryNoun(label: string): string {
  return TERRITORY_NOUN[normKey(label)] ?? humanizeLabel(label);
}

// Intenção (contentIntent): encaixa em "posta pra ___".
const INTENT_PHRASE: Record<string, string> = {
  [normKey("Conectar/Relacionar")]: "criar laço",
  [normKey("Ensinar")]: "ensinar",
  [normKey("Informar/Atualizar")]: "informar",
  [normKey("Inspirar/Motivar")]: "inspirar",
  [normKey("Entreter")]: "divertir",
  [normKey("Construir Autoridade")]: "mostrar autoridade no assunto",
};
function intentPhrase(label: string): string {
  return INTENT_PHRASE[normKey(label)] ?? humanizeLabel(label);
}

// Forma narrativa: encaixa em "posta ___".
const NARRATIVE_FORM_PHRASE: Record<string, string> = {
  [normKey("Tutorial/Passo a Passo")]: "um tutorial",
  [normKey("Bastidores")]: "os bastidores",
  [normKey("Rotina/Vlog")]: "um vlog da sua rotina",
  [normKey("Atualizacao/Noticia")]: "uma novidade",
  [normKey("Perguntas e Respostas")]: "um Q&A",
  [normKey("Reaction")]: "uma reação",
  [normKey("Review")]: "um review",
  [normKey("Comparacao")]: "uma comparação",
  [normKey("Cena/Esquete")]: "uma cena de humor",
  [normKey("Clipe/Corte")]: "um corte",
  [normKey("Unboxing")]: "um unboxing",
  [normKey("Participacao/Collab")]: "uma collab",
};
function narrativeFormPhrase(label: string): string {
  return NARRATIVE_FORM_PHRASE[normKey(label)] ?? `um ${humanizeLabel(label)}`;
}

// Postura (stance): frase verbal completa para "Quando você ___, é o que mais fica com elas."
const STANCE_PHRASE: Record<string, string> = {
  [normKey("Depoimento")]: "fala da sua própria experiência",
  [normKey("Critico")]: "dá sua opinião sem rodeio",
  [normKey("Questionando")]: "levanta perguntas em vez de respostas prontas",
  [normKey("Endossando")]: "recomenda algo de verdade",
  [normKey("Comparativo")]: "compara os lados de um assunto",
};
function stancePhrase(label: string): string {
  return STANCE_PHRASE[normKey(label)] ?? `traz ${humanizeLabel(label)}`;
}

// ─── V3 — Ritmo ─────────────────────────────────────────────────────────────

function rhythmCardHeadline(label: string, signal: "saves" | "shares"): string {
  if (signal === "shares") return `${capitalize(label)}, é quando elas mais compartilham o que você posta.`;
  return `${capitalize(label)}, é quando elas mais salvam o que você posta.`;
}

function rhythmModalTitle(kind: "dayOfWeek" | "timeOfDay"): string {
  return kind === "dayOfWeek" ? "Quando elas mais salvam" : "O momento em que param pra você";
}

function rhythmModalBody(label: string, signal: "saves" | "shares", _kind: "dayOfWeek" | "timeOfDay"): string {
  if (signal === "shares") {
    return `${capitalize(label)}, o que você posta é compartilhado mais do que em qualquer outro momento. Compartilhar é o gesto de quem diz "isso é pra você" a alguém — elas estão levando seu conteúdo a gente nova sem você pedir.`;
  }
  return `${capitalize(label)}, o que você posta é salvo mais do que em qualquer outro momento. Salvar é um ato privado: quem salvou disse, sem palavras, que esse conteúdo é delas.`;
}

function rhythmModalReflection(kind: "dayOfWeek" | "timeOfDay"): string {
  if (kind === "timeOfDay") {
    return `Não é sobre postar nesse horário — é sobre perceber quando elas têm tempo de verdade pra estar com você.`;
  }
  return `Não é sobre postar mais nesse dia — é sobre reconhecer quando elas estão de verdade com você.`;
}

// ─── V3 — Atenção ────────────────────────────────────────────────────────────

function attentionCardHeadline(label: string): string {
  return `Quando você fala de ${territoryNoun(label)}, elas ficam até o fim.`;
}

function attentionModalBody(label: string): string {
  return `Quando o assunto é ${territoryNoun(label)}, elas assistem até o fim — ou quase. Isso não é alcance, é atenção: a diferença entre quem passou por cima e quem ficou.`;
}

function attentionModalReflection(): string {
  return `O que prende não é o tema — é como você trata ele. Mas a audiência já sabe por onde você vai.`;
}

// ─── V3 — Propagação ─────────────────────────────────────────────────────────

function propagationCardHeadline(label: string): string {
  return `Quando você fala de ${territoryNoun(label)}, é o que elas mais compartilham.`;
}

function propagationModalBody(label: string): string {
  return `Quando o assunto é ${territoryNoun(label)}, elas compartilham com alguém. Compartilhar é o gesto mais generoso que um seguidor pode fazer — é ela dizendo a uma amiga: "isso é pra você".`;
}

function propagationModalReflection(): string {
  return `O que a audiência passa pra frente revela o que ela acha que você representa. Que pessoa ela está apresentando quando manda seu conteúdo?`;
}

// ─── Forma narrativa (como você conta) ────────────────────────────────────────

function narrativeFormCardHeadline(label: string): string {
  return `Quando você posta ${narrativeFormPhrase(label)}, é o que elas mais salvam.`;
}

function narrativeFormModalBody(label: string): string {
  return `De todas as formas de contar uma história, é quando você posta ${narrativeFormPhrase(label)} que elas mais salvam. Não é o tema — é o jeito de levar a ideia que faz querer voltar.`;
}

function narrativeFormModalReflection(): string {
  return `A forma também é narrativa. Esse é o seu jeito de contar que mais fica com elas.`;
}

// ─── Postura / voz (de onde você fala) ─────────────────────────────────────────

function stanceCardHeadline(label: string): string {
  return `Quando você ${stancePhrase(label)}, é o que mais fica com elas.`;
}

function stanceModalBody(label: string): string {
  return `Quando você ${stancePhrase(label)}, elas reconhecem mais. Como você se coloca diante do assunto é parte de quem elas veem em você.`;
}

function stanceModalReflection(): string {
  return `Não é só o que você fala — é de onde você fala. Essa é a voz que mais conecta.`;
}

// ─── V3 — Asset de vida ──────────────────────────────────────────────────────

function lifeAssetCardHeadline(label: string): string {
  return `Quando aparece com ${humanizeLabel(label)}, elas salvam.`;
}

function lifeAssetModalBody(label: string): string {
  return `Quando você aparece com ${humanizeLabel(label)}, elas salvam mais do que em outras situações. Não é o tema — é o cenário de vida: elas te reconhecem num contexto específico de quem você é.`;
}

function lifeAssetModalReflection(): string {
  return `Esse não é um dado de performance. É um retrato de quando você é mais você — e elas percebem.`;
}

// ─── Tipos de modal aberto ──────────────────────────────────────────────────
type ModalType = "orphan" | "tone" | "format" | "intent" | "divergence" | "resonantTerritory" | "rising" | "combo" | "narrativeForm" | "stance" | "engagedDivergence" | "demographics" | "rhythm" | "attention" | "propagation" | "lifeAsset" | null;

// ─── Componente principal ────────────────────────────────────────────────────

interface Props {
  insights: AudienceInsights;
  instagramConnected: boolean;
  /**
   * Fase D — quando fornecido, os modais de TERRITÓRIO ganham um CTA suave que
   * conecta o insight de volta ao mapa (Etapa 12 → Etapa 3). Sem ele, o CTA não
   * aparece. Só nos territórios — ritmo/comportamento não recebem ação (evita
   * virar "poste mais", pressão de performance).
   */
  onReviewTerritories?: () => void;
}

export function AudienceInsightsCard({ insights, instagramConnected, onReviewTerritories }: Props) {
  const [openModal, setOpenModal] = useState<ModalType>(null);
  const closeModal = useCallback(() => setOpenModal(null), []);

  if (!instagramConnected || !insights.hasAny) return null;

  const { orphanTerritory, resonantTone, formatInversion, resonantIntent, territoryDivergence, resonantTerritory, risingTerritory, combo, resonantNarrativeForm, resonantStance, engagedDivergence, demographics, rhythm, attention, propagation, topLifeAsset } = insights;
  const periodLabel = insights.periodLabel ?? "últimos 90 dias";

  // Ordem por VALOR narrativo (todas as que têm sinal aparecem — sem cap):
  //   território/audiência (mais único ao D2C) → expressão (quem você é) →
  //   comportamento → cena de vida → demografia (o "óbvio", âncora por último).
  // Cada linha = rótulo de DIMENSÃO + headline humano. A 1ª não recebe borda-topo.
  const rows: { key: Exclude<ModalType, null>; dimension: string; headline: string }[] = [];
  // ── Combo cirúrgico (mais específico) primeiro ──
  if (combo) {
    rows.push({ key: "combo", dimension: "MOMENTO CERTO", headline: comboCardHeadline(combo) });
  }
  // ── Território + audiência ──
  if (territoryDivergence) {
    rows.push({ key: "divergence", dimension: "TERRITÓRIO", headline: divergenceCardHeadline(territoryDivergence.audienceLabel) });
  }
  if (orphanTerritory) {
    rows.push({ key: "orphan", dimension: "TERRITÓRIO", headline: orphanCardHeadline(orphanTerritory.label) });
  }
  if (resonantTerritory) {
    rows.push({ key: "resonantTerritory", dimension: "TERRITÓRIO", headline: resonantTerritoryCardHeadline(resonantTerritory.label) });
  }
  if (risingTerritory) {
    rows.push({ key: "rising", dimension: "EM ASCENSÃO", headline: risingCardHeadline(risingTerritory.label) });
  }
  if (engagedDivergence) {
    rows.push({ key: "engagedDivergence", dimension: "QUEM ENGAJA", headline: engagedDivergenceCardHeadline(engagedDivergence) });
  }
  // ── Expressão (quem você é) ──
  if (resonantTone) {
    rows.push({ key: "tone", dimension: "TOM", headline: toneCardHeadline(resonantTone.label) });
  }
  if (resonantIntent) {
    rows.push({ key: "intent", dimension: "INTENÇÃO", headline: intentCardHeadline(resonantIntent.label) });
  }
  if (resonantNarrativeForm) {
    rows.push({ key: "narrativeForm", dimension: "FORMA NARRATIVA", headline: narrativeFormCardHeadline(resonantNarrativeForm.label) });
  }
  if (resonantStance) {
    rows.push({ key: "stance", dimension: "POSTURA", headline: stanceCardHeadline(resonantStance.label) });
  }
  // ── Comportamento ──
  if (formatInversion) {
    rows.push({ key: "format", dimension: "FORMATO", headline: formatInversionCardHeadline(formatInversion.savesLeaderLabel) });
  }
  if (rhythm) {
    rows.push({ key: "rhythm", dimension: "RITMO", headline: rhythmCardHeadline(rhythm.label, rhythm.signal) });
  }
  if (attention) {
    rows.push({ key: "attention", dimension: "ATENÇÃO", headline: attentionCardHeadline(attention.label) });
  }
  if (propagation) {
    rows.push({ key: "propagation", dimension: "PROPAGAÇÃO", headline: propagationCardHeadline(propagation.label) });
  }
  if (topLifeAsset) {
    rows.push({ key: "lifeAsset", dimension: "CENA DE VIDA", headline: lifeAssetCardHeadline(topLifeAsset.label) });
  }
  // ── Âncora (o óbvio, por último) ──
  if (demographics) {
    rows.push({ key: "demographics", dimension: "QUEM TE ACOMPANHA", headline: demographicsCardHeadline(demographics) });
  }

  // Sem cap: toda família com sinal confiável aparece (a dedup já evita repetição
  // de território, e o piso de confiança de cada família evita ruído).
  const visibleRows = rows;

  return (
    <>
      {/* ── Card ── */}
      <div
        style={{
          borderRadius: CARD_RADIUS,
          background: CARD_BG,
          boxShadow: CARD_SHADOW,
          padding: "18px 22px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 38, height: 38, borderRadius: "50%",
              background: CARD_ACCENT,
              boxShadow: "0 2px 8px rgba(16,185,129,0.30)",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <AudienceIcon />
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#18181b", letterSpacing: -0.3 }}>
            Sua Audiência
          </span>
        </div>

        {/* Seções */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, margin: "4px -22px 0" }}>
          {visibleRows.map((row, i) => (
            <InsightRow
              key={row.key}
              headline={row.headline}
              onClick={() => setOpenModal(row.key)}
              isFirst={i === 0}
            />
          ))}
        </div>

        {/* Atribuição */}
        <div style={{ margin: "0 -22px", padding: "9px 22px 4px" }}>
          <p style={{ fontSize: 11, color: "#a1a1aa", margin: 0, letterSpacing: 0.1 }}>
            via Instagram · {periodLabel}
          </p>
        </div>
      </div>

      {/* ── Modais ── */}
      {openModal === "orphan" && orphanTerritory && (
        <AudienceModal
          title="O que salvam"
          onClose={closeModal}
          periodLabel={periodLabel}
        >
          <ModalChip label={prettyLabel(orphanTerritory.label)} />
          <ModalBody>{orphanModalBody(orphanTerritory.label, orphanTerritory.postCount)}</ModalBody>
          <ModalReflection>{orphanModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "tone" && resonantTone && (
        <AudienceModal
          title="O tom que ressoa"
          onClose={closeModal}
          periodLabel={periodLabel}
        >
          <ModalChip label={prettyLabel(resonantTone.label)} />
          <ModalBody>{toneModalBody(resonantTone.label)}</ModalBody>
          <ModalReflection>{toneModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "format" && formatInversion && (
        <AudienceModal
          title="Alcance vs reconhecimento"
          onClose={closeModal}
          periodLabel={periodLabel}
        >
          <FormatInversionVisual
            reachLabel={formatInversion.reachLeaderLabel}
            savesLabel={formatInversion.savesLeaderLabel}
          />
          <ModalBody>
            {formatInversionModalBody(formatInversion.reachLeaderLabel, formatInversion.savesLeaderLabel)}
          </ModalBody>
          <ModalReflection>{formatInversionModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "intent" && resonantIntent && (
        <AudienceModal title="A intenção que ressoa" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={prettyLabel(resonantIntent.label)} />
          <ModalBody>{intentModalBody(resonantIntent.label)}</ModalBody>
          <ModalReflection>{intentModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "narrativeForm" && resonantNarrativeForm && (
        <AudienceModal title="Como você conta" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={prettyLabel(resonantNarrativeForm.label)} />
          <ModalBody>{narrativeFormModalBody(resonantNarrativeForm.label)}</ModalBody>
          <ModalReflection>{narrativeFormModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "stance" && resonantStance && (
        <AudienceModal title="De onde você fala" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={prettyLabel(resonantStance.label)} />
          <ModalBody>{stanceModalBody(resonantStance.label)}</ModalBody>
          <ModalReflection>{stanceModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "combo" && combo && (
        <AudienceModal title="O momento certo" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={`${prettyLabel(combo.territoryLabel)} · ${combo.whenLabel}`} />
          <ModalBody>{comboModalBody(combo)}</ModalBody>
          <ModalReflection>{comboModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "divergence" && territoryDivergence && (
        <AudienceModal title="O que a audiência vê" onClose={closeModal} periodLabel={periodLabel}>
          <div className="flex items-stretch gap-3">
            <div className="flex-1 rounded-2xl bg-zinc-50 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-zinc-400 mb-1">Seu mapa</p>
              <p className="text-[13px] font-semibold leading-snug text-zinc-700 break-words">{capitalize(territoryDivergence.mapLabel)}</p>
            </div>
            <div className="flex-1 rounded-2xl bg-green-50 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-green-600 mb-1">Audiência salva</p>
              <p className="text-[13px] font-semibold leading-snug text-green-800 break-words">{prettyLabel(territoryDivergence.audienceLabel)}</p>
            </div>
          </div>
          <ModalBody>{divergenceModalBody(territoryDivergence.audienceLabel, territoryDivergence.mapLabel)}</ModalBody>
          <ModalReflection>{divergenceModalReflection()}</ModalReflection>
          {onReviewTerritories && (
            <ModalReviewMapCta onClick={() => { closeModal(); onReviewTerritories(); }} />
          )}
        </AudienceModal>
      )}

      {openModal === "resonantTerritory" && resonantTerritory && (
        <AudienceModal title="O que elas mais salvam" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={prettyLabel(resonantTerritory.label)} />
          <ModalBody>{resonantTerritoryModalBody(resonantTerritory.label)}</ModalBody>
          <ModalReflection>{resonantTerritoryModalReflection()}</ModalReflection>
          {onReviewTerritories && (
            <ModalReviewMapCta onClick={() => { closeModal(); onReviewTerritories(); }} />
          )}
        </AudienceModal>
      )}

      {openModal === "rising" && risingTerritory && (
        <AudienceModal title="O que vem crescendo" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={prettyLabel(risingTerritory.label)} />
          <ModalBody>{risingModalBody(risingTerritory.label)}</ModalBody>
          <ModalReflection>{risingModalReflection()}</ModalReflection>
          {onReviewTerritories && (
            <ModalReviewMapCta onClick={() => { closeModal(); onReviewTerritories(); }} />
          )}
        </AudienceModal>
      )}

      {openModal === "rhythm" && rhythm && (
        <AudienceModal title={rhythmModalTitle(rhythm.kind)} onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={capitalize(rhythm.label)} />
          <ModalBody>{rhythmModalBody(rhythm.label, rhythm.signal, rhythm.kind)}</ModalBody>
          <ModalReflection>{rhythmModalReflection(rhythm.kind)}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "attention" && attention && (
        <AudienceModal title="O que prende" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={prettyLabel(attention.label)} />
          <ModalBody>{attentionModalBody(attention.label)}</ModalBody>
          <ModalReflection>{attentionModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "propagation" && propagation && (
        <AudienceModal title="O que passa pra frente" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={prettyLabel(propagation.label)} />
          <ModalBody>{propagationModalBody(propagation.label)}</ModalBody>
          <ModalReflection>{propagationModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "lifeAsset" && topLifeAsset && (
        <AudienceModal title="Quando você é mais você" onClose={closeModal} periodLabel={periodLabel}>
          <ModalChip label={prettyLabel(topLifeAsset.label)} />
          <ModalBody>{lifeAssetModalBody(topLifeAsset.label)}</ModalBody>
          <ModalReflection>{lifeAssetModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "engagedDivergence" && engagedDivergence && (
        <AudienceModal title="Quem segue vs. quem engaja" onClose={closeModal} periodLabel={periodLabel}>
          <div className="flex items-stretch gap-3">
            <div className="flex-1 rounded-2xl bg-zinc-50 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-zinc-400 mb-1">Quem te segue</p>
              <p className="text-[13px] font-semibold leading-snug text-zinc-700 break-words">
                {capitalize(engagedValueLabel(engagedDivergence.dimension, engagedDivergence.followerLabel))}
              </p>
            </div>
            <div className="flex-1 rounded-2xl bg-green-50 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-green-600 mb-1">Quem mais engaja</p>
              <p className="text-[13px] font-semibold leading-snug text-green-800 break-words">
                {capitalize(engagedValueLabel(engagedDivergence.dimension, engagedDivergence.engagedLabel))}
              </p>
            </div>
          </div>
          <ModalBody>{engagedDivergenceModalBody(engagedDivergence)}</ModalBody>
          <ModalReflection>{engagedDivergenceModalReflection()}</ModalReflection>
        </AudienceModal>
      )}

      {openModal === "demographics" && demographics && (
        <AudienceModal title="Quem te acompanha" onClose={closeModal} periodLabel={periodLabel}>
          <div className="flex flex-col gap-2.5">
            {demographics.dominantGender && (
              <DemoRow label="Gênero predominante" value={capitalize(demographics.dominantGender)} />
            )}
            {demographics.topAgeRange && (
              <DemoRow label="Faixa etária principal" value={demographics.topAgeRange} />
            )}
            {demographics.topCity && (
              <DemoRow label="Cidade com mais presença" value={cleanLocation(demographics.topCity)} />
            )}
            {!demographics.topCity && demographics.topCountry && (
              <DemoRow label="País com mais presença" value={demographics.topCountry} />
            )}
          </div>
          <ModalBody>{demographicsModalBody()}</ModalBody>
          <ModalReflection>{demographicsModalReflection()}</ModalReflection>
        </AudienceModal>
      )}
    </>
  );
}

// ─── InsightRow ──────────────────────────────────────────────────────────────

function InsightRow({
  headline,
  onClick,
  isFirst,
}: {
  headline: string;
  onClick: () => void;
  isFirst: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center",
        gap: 10,
        width: "100%",
        background: "transparent", border: "none",
        borderTop: isFirst ? "none" : `1px solid ${CARD_DIVIDER_SOFT}`,
        padding: "14px 22px",
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}
    >
      {/* Sem rótulo técnico — a frase humana carrega sozinha. */}
      <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, color: CARD_TEXT, lineHeight: 1.4, fontWeight: 500, letterSpacing: -0.1 }}>
        {headline}
      </p>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0, color: CARD_ACCENT, opacity: 0.5 }}>
        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ─── AudienceModal ──────────────────────────────────────────────────────────

function AudienceModal({
  title,
  onClose,
  children,
  periodLabel = "últimos 90 dias",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  periodLabel?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[270] flex items-end bg-zinc-950/40 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.18)] animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mb-2 flex justify-center pt-4" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-2 pb-4">
          <h2 className="text-[18px] font-bold tracking-tight text-zinc-950">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition active:scale-95 hover:bg-zinc-200"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="h-px bg-zinc-100 mx-6" />

        <div className="px-6 pb-8 pt-5 flex flex-col gap-5">
          {children}
        </div>

        {/* Atribuição */}
        <p className="pb-5 text-center text-[10px] text-zinc-400">
          via Instagram · {periodLabel}
        </p>
      </section>
    </div>
  );
}

// ─── Modal sub-components ───────────────────────────────────────────────────

function ModalChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-[12px] font-semibold text-green-700">
      {label}
    </span>
  );
}

function ModalBody({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-relaxed text-zinc-700">
      {children}
    </p>
  );
}

// Fase D — CTA suave de volta ao mapa (só nos modais de território).
function ModalReviewMapCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 flex w-full items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-left transition active:opacity-70"
    >
      <span className="text-[13px] text-zinc-500">Esse ângulo faz parte do seu mapa?</span>
      <span className="whitespace-nowrap text-[13px] font-semibold text-green-700">Revisar territórios →</span>
    </button>
  );
}

function ModalReflection({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-green-50 px-5 py-4">
      <p className="text-[13.5px] italic leading-relaxed text-green-900">
        {children}
      </p>
    </div>
  );
}

function DemoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[12px] font-semibold text-zinc-400">{label}</p>
      <p className="text-[13px] font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function FormatInversionVisual({
  reachLabel,
  savesLabel,
}: {
  reachLabel: string;
  savesLabel: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-1 rounded-2xl bg-sky-50 px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-sky-500 mb-1">Alcance</p>
        <p className="text-[14px] font-bold text-sky-900">{capitalize(reachLabel)}</p>
      </div>
      <div className="flex-1 rounded-2xl bg-green-50 px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.7px] text-green-600 mb-1">Reconhecimento</p>
        <p className="text-[14px] font-bold text-green-900">{capitalize(savesLabel)}</p>
      </div>
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function AudienceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="7" r="3" stroke="white" strokeWidth="1.8" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" stroke="white" strokeWidth="1.6" />
      <path d="M19.5 19c0-2.5-1.1-4.5-3.5-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Empty-state da Audiência para quem ainda não conectou o Instagram.
 *
 * O card cheio (AudienceInsightsCard) precisa de dados do Instagram e por isso
 * some quando não há conexão. Em vez de a seção desaparecer, este empty-state
 * mantém a presença do card e oferece o próximo passo claro: conectar o
 * Instagram. Tom calmo, sem pressão de performance.
 */
export function AudienceConnectPrompt({
  onConnectInstagram,
  isPro = true,
}: {
  onConnectInstagram?: () => void;
  /** Free users veem a versão "vem com o Pro"; Pro veem o convite direto de conexão. */
  isPro?: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: CARD_RADIUS,
        background: CARD_BG,
        boxShadow: CARD_SHADOW,
        padding: "18px 22px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 38, height: 38, borderRadius: "50%",
            background: CARD_ACCENT,
            boxShadow: "0 2px 8px rgba(16,185,129,0.30)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <AudienceIcon />
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#18181b", letterSpacing: -0.3 }}>
          Sua Audiência
        </span>
      </div>

      <p style={{ fontSize: 16, fontWeight: 600, color: "#3f3f46", margin: 0, lineHeight: 1.45 }}>
        O que a sua audiência reconhece em você.
      </p>
      <p style={{ fontSize: 14, color: "#a1a1aa", margin: "6px 0 16px", lineHeight: 1.5 }}>
        {isPro
          ? "Conecte o Instagram para a D2C revelar sinais que o seu perfil sozinho não mostra."
          : "No Pro, a D2C lê sua grade do Instagram e revela sinais que o seu perfil sozinho não mostra."}
      </p>

      <button
        type="button"
        onClick={onConnectInstagram}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex", alignItems: "center", gap: 7,
          borderRadius: 999, padding: "10px 18px",
          background: "transparent", color: "#18181b",
          fontSize: 13, fontWeight: 600, fontFamily: "inherit",
          border: "1.5px solid #18181b", cursor: "pointer",
        }}
      >
        {isPro ? "Conectar Instagram" : "Conhecer o Pro"}
      </button>
    </div>
  );
}
