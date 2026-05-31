# Sua Audiência — família "Asset×resultado" (dormente)

**Status:** arquiteturalmente completa, **dormente** (zero sinal em produção). Degrada
graciosamente — `topLifeAsset` retorna `null` e a família simplesmente não aparece no card.

**Não fazer backfill.** O dado de asset nasce da análise de vídeo no momento do diagnóstico;
não há histórico para recuperar. A família só ganha vida com dados gerados daqui pra frente.

---

## O que é

No card "Sua Audiência", responde: *"qual cena/asset de vida da sua rotina gera mais
reconhecimento quando aparece no conteúdo?"* (Etapa 5 — Assets × performance). Ex.: "quando
aparece com seu cachorro, elas guardam mais".

- Campo no Metric: `lifeAssets?: string[]` (`src/app/models/Metric.ts`).
- Família no serviço: `topLifeAsset` em `audienceInsightsService.ts` + copy/modal `lifeAsset*`
  em `AudienceInsightsCard.tsx`. **Já implementadas e testadas.**

## Por que está dormente (medido em 2026-05)

- **0 de 28.420** Metrics com `lifeAssets` populado.
- **0 diagnósticos** com `publishIntent='yes'`.

Dois motivos:

1. **A fonte não gera dado ainda.** `lifeAssets` vêm de `contentContext` (setting,
   socialPresence, lifeSignals) da análise Gemini, promovidos quando o criador declara
   `publishIntent='yes'` (Stream A). Ninguém passou por esse fluxo ainda.

2. **Gap de timing no design atual.** A promoção em
   `src/app/api/dashboard/mobile-strategic-profile/diagnosis/[id]/publish-intent/route.ts`
   (~linha 106) exige `publishIntent='yes'` **E** `instagramMediaId`, casando por
   `{ instagramMediaId, user }`. Mas o diagnóstico ocorre **antes** de publicar — o post
   ainda não existe como Metric (Instagram não sincronizou). Logo, o `updateOne` casa 0 docs
   mesmo quando Stream A rodar.

## Plano de implementação (quando Stream A começar a registrar `publishIntent='yes'`)

Mover a promoção do **intent-time** para o **ingestion-time**:

1. Manter os assets no diagnóstico (já estão em `contentContext`); ao declarar
   `publishIntent='yes'`, NÃO depender de `instagramMediaId`.
2. No **sync de métricas** (`src/app/lib/instagram/db/metricActions.ts`, onde o Metric é
   upsertado), reconciliar: para o `user`, buscar um diagnóstico recente com
   `publishIntent='yes'` ainda não linkado e casar com o novo Metric por **caption/recência**
   (a legenda publicada costuma bater com o roteiro/descrição do diagnóstico). Ao casar,
   promover `lifeAssets` e marcar o diagnóstico como linkado (evita re-link).
3. Janela de recência curta (ex.: diagnóstico nos últimos N dias) + similaridade de texto
   mínima para evitar falso-match.

**Gatilho para implementar:** primeiro lote real de diagnoses com `publishIntent='yes'`.
Antes disso é otimização prematura (sem dado para validar o matching).

## Verificação rápida (cobertura)

```
Metrics com lifeAssets:        countDocuments({ lifeAssets: { $exists: true, $ne: [] } })
Diagnoses publishIntent='yes': CreatorVideoNarrativeDiagnosis.countDocuments({ publishIntent: 'yes' })
```
Quando os dois pararem de ser 0, a família começa a aparecer — e aí o gap de timing acima
precisa estar resolvido para o matching de fato acontecer.
