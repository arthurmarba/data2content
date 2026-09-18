---
tipo: decisão
área: produto
---

# Pauta só nasce de narrativa + território

## A regra

Gerar pauta exige **narrativa e territórios**. Audiência sozinha **não** libera.

## Dois portões que parecem um só

Eles vivem em arquivos diferentes e respondem perguntas diferentes. Misturá-los já
produziu documento errado.

**Liberar pauta** (`contentIdeasReadinessGate.ts`) exige narrativa e territórios
*presentes* — confirmados pelo criador **ou** detectados pela síntese. O gate está na V2:
a confirmação explícita **enriquece** a pauta, mas deixou de ser portão duro. Se a síntese
já carrega o dado, a geração segue.

**Narrativa firme** (`creatorMap.ts`, `resolveEvidenceLevel`) é outro carimbo, e mais
exigente: só com **duas leituras concordando** — Instagram e vídeo. Uma leitura só é
`one_reading`; nenhuma é `declared`, o ponto de partida que o criador contou. A confirmação
do criador **não** entra nessa conta: o que ela faz é impedir que o enriquecimento
sobrescreva o núcleo (`coreStabilityLocks.ts`).

## Por que

Pauta gerada a partir de audiência produz conteúdo que agrada e não constrói nada. A narrativa é o que faz o vídeo pertencer àquele criador e não a qualquer um do mesmo nicho.

Uma leitura só, sem confirmação, é palpite — e palpite virando pauta produz um mapa que muda de personalidade toda semana.

## Onde vive

`contentIdeasReadinessGate.ts` e `contentIdeaMapAnchors.ts` (o portão da pauta), `mcp/creatorMap.ts` (o carimbo de narrativa firme) e `mapaSeed/coreStabilityLocks.ts` (a confirmação protegendo o núcleo).

## Ligações

[[Pautas e Roteiros]] · [[Cadeia narrativa e pauta]] · [[Seu Mapa]]
