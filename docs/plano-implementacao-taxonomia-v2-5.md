# Plano Tecnico De Implementacao Da Taxonomia V2.5

## Objetivo
Transformar a proposta semantica da V2.5 em um rollout executavel no projeto atual.

Referencia conceitual:
- [plano-taxonomia-categorias-v2-5.md](/Users/arthurmarba/d2c-frontend/docs/plano-taxonomia-categorias-v2-5.md#L1)

Base tecnica ja existente:
- [classificationV2.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/classificationV2.ts#L1)
- [classificationRuntime.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/classificationRuntime.ts#L1)
- [classificationV2Bridge.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/classificationV2Bridge.ts#L1)
- [Metric.ts](/Users/arthurmarba/d2c-frontend/src/app/models/Metric.ts#L1)
- [backfillClassificationV2.ts](/Users/arthurmarba/d2c-frontend/scripts/backfillClassificationV2.ts#L1)

## Escopo Da V2.5

### Dimensoes novas
- `stance`
- `proofStyle`
- `commercialMode`
- `entityTargets`
- `classificationMeta`

### Dimensoes ajustadas
- `tone`
- `contentSignals`

### Dimensoes mantidas
- `format`
- `contentIntent`
- `narrativeForm`
- `context`
- `references`

## Estado Atual Do Codigo

Hoje o projeto ja tem:
- persistencia e validacao de `contentIntent`, `narrativeForm` e `contentSignals`
- worker e backfill V2
- bridge legado -> V2
- ranking e highlights ja aceitando parte da leitura V2

Ainda nao tem:
- enums/schema para `stance`, `proofStyle`, `commercialMode`, `entityTargets`, `classificationMeta`
- prompt do worker preparado para V2.5
- migracao de legado para essas novas dimensoes
- telas consumindo essas dimensoes de forma nativa

## Mudancas Tecnicas Necessarias

### 1. Taxonomia

#### Arquivos a criar
- `src/app/lib/classificationV2_5.ts`

#### Conteudo esperado
- enums e catalogos para:
  - `stance`
  - `proofStyle`
  - `commercialMode`
- helpers de canonicalizacao e alias lookup
- labels para leitura

#### Categorias recomendadas

`stance`
- `endorsing`
- `questioning`
- `critical`
- `comparative`
- `testimonial`

`proofStyle`
- `demonstration`
- `before_after`
- `case_study`
- `social_proof`
- `personal_story`
- `opinion`
- `myth_busting`
- `list_based`

`commercialMode`
- `paid_partnership`
- `affiliate`
- `discount_offer`
- `lead_capture`
- `dm_conversion`
- `product_launch`

#### Decisoes de compatibilidade
- `critical` deixa de ser categoria nobre de `tone`
- `sponsored` e `promo_offer` deixam de ser categoria nobre de `contentSignals`

### 2. Schema Do Banco

#### Arquivo principal
- [Metric.ts](/Users/arthurmarba/d2c-frontend/src/app/models/Metric.ts#L1)

#### Campos a adicionar
- `stance: string[]`
- `proofStyle: string[]`
- `commercialMode: string[]`
- `entityTargets: EntityTarget[]`
- `classificationMeta: Mixed`

#### Estrutura sugerida
```ts
type EntityTarget = {
  type:
    | "brand"
    | "product"
    | "service"
    | "person"
    | "city"
    | "country"
    | "franchise"
    | "platform";
  label: string;
  canonicalId?: string | null;
};

type ClassificationMeta = {
  confidence?: Partial<Record<string, number>>;
  evidence?: Partial<Record<string, string[]>>;
  primary?: string | null;
  secondary?: string | null;
};
```

#### Validacao
- usar o mesmo padrao hoje aplicado em `V2_CLASSIFICATION_FIELDS`
- rejeitar valores desconhecidos para `stance`, `proofStyle` e `commercialMode`
- `entityTargets` deve validar `type` e `label`

### 3. Runtime De Classificacao

#### Arquivo principal
- [classificationRuntime.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/classificationRuntime.ts#L1)

#### Mudancas necessarias
- estender `ClassificationResult`
- estender `RESULT_KEY_MAPPING`
- estender o prompt do worker para as novas dimensoes
- adicionar extracao deterministica para parte de `commercialMode`
- preparar `classificationMeta.confidence` e `classificationMeta.evidence`

#### Deterministico
Continuar ou mover para regra:
- `comment_cta`
- `save_cta`
- `share_cta`
- `link_in_bio_cta`
- `dm_cta`
- `giveaway`

Adicionar deterministicamente quando houver sinal forte:
- `paid_partnership`
- `discount_offer`
- `dm_conversion`

#### Semantico via IA
- `contentIntent`
- `narrativeForm`
- `tone`
- `stance`
- `proofStyle`
- `context`
- `references`
- `commercialMode` quando nao for obvio por regra
- `entityTargets`

### 4. Rotas E Escrita

#### Arquivos principais
- [route.ts](/Users/arthurmarba/d2c-frontend/src/app/api/worker/classify-content/route.ts#L1)
- [reclassifyAll.ts](/Users/arthurmarba/d2c-frontend/scripts/reclassifyAll.ts#L1)
- [route.ts](/Users/arthurmarba/d2c-frontend/src/app/api/metrics/route.ts#L1)

#### Mudancas necessarias
- gravar os novos campos no worker
- semear V2.5 na criacao de metricas manuais
- limpar tambem os novos campos nos scripts de reset/retry

### 5. Bridge E Backfill

#### Arquivos principais
- [classificationV2Bridge.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/classificationV2Bridge.ts#L1)
- [backfillClassificationV2.ts](/Users/arthurmarba/d2c-frontend/scripts/backfillClassificationV2.ts#L1)

#### Extensoes necessarias
- evoluir a bridge para `V2_5`
- criar helpers:
  - `sanitizeLegacyToneForV2_5`
  - `buildClassificationV2_5BackfillUpdate`
  - `hasClassificationV2_5BackfillChanges`

#### Regras de migracao recomendadas

`tone -> stance/tone`
- `critical` sai de `tone` e vira `stance.critical`
- `humorous` continua em `tone`
- `inspirational` continua em `tone`
- `neutral` continua em `tone`
- `educational` nao vai para `tone`
- `promotional` nao vai para `tone`

`contentSignals -> commercialMode/contentSignals`
- `sponsored` -> `commercialMode.paid_partnership`
- `promo_offer` -> `commercialMode.discount_offer`

#### Estrategia de execucao
- `dry-run`
- `--write` apenas para novos campos
- `--rewrite-legacy` em janela controlada

### 6. Analytics

#### Arquivos ja parcialmente preparados
- [rankingsService.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/dataService/marketAnalysis/rankingsService.ts#L1)
- [aggregateUserPerformanceHighlights.ts](/Users/arthurmarba/d2c-frontend/src/utils/aggregateUserPerformanceHighlights.ts#L1)

#### Novas leituras que devem existir
- top `stance`
- top `proofStyle`
- top `commercialMode`

#### Areas a ajustar
- platform highlights
- strategic report
- media kit
- planner batch
- discover personalization

#### Regra de adocao
- as novas dimensoes entram primeiro em analytics e APIs
- UI so passa a exibir depois de existir volume e backfill suficientes

### 7. UI

#### Discover
Primeira camada visivel:
- `format`
- `contentIntent`
- `narrativeForm`
- `context`

Camada avancada:
- `tone`
- `stance`
- `proofStyle`
- `commercialMode`
- `contentSignals`

#### Media Kit e relatorios
Destacar:
- melhor `contentIntent`
- melhor `narrativeForm`
- melhor `context`

Exibir como secundarios:
- `stance`
- `proofStyle`
- `commercialMode`

#### Regra de UX
- `entityTargets` nao deve virar uma nuvem caotica de chips
- usar `entityTargets` mais em drilldown e busca do que em filtro principal

## Fases De Implementacao

### Fase 1. Fundacao V2.5
- criar `classificationV2_5.ts`
- adicionar campos no `Metric`
- criar testes unitarios da taxonomia e validacao

### Fase 2. Worker E Escrita
- estender `classificationRuntime.ts`
- estender worker, `reclassifyAll` e `metrics`
- cobrir com testes do runtime

### Fase 3. Bridge E Backfill
- evoluir `classificationV2Bridge.ts`
- criar script de backfill V2.5
- rodar `dry-run`
- validar amostras antes do `--write`

### Fase 4. Analytics
- expor ranking por `stance`, `proofStyle`, `commercialMode`
- adicionar highlights novos
- ajustar strategic report e media kit

### Fase 5. UI
- filtros avancados na Descoberta
- badges e insights em Mídia Kit
- leitura tática no Planner

## Ordem Recomendada De Entrega

### Entrega 1
- schema
- taxonomia
- runtime

### Entrega 2
- bridge
- backfill
- auditoria

### Entrega 3
- rankings
- highlights
- APIs

### Entrega 4
- Discover
- Mídia Kit
- Planner
- relatórios

## Riscos Principais
- excesso de dimensoes expostas cedo demais na UI
- ruido semantico entre `tone` e `stance`
- duplicacao entre `commercialMode` e `contentSignals`
- explosao de cardinalidade se `entityTargets` virar enum fechado
- migracao precipitada do legado sem amostragem manual

## Mitigacoes
- manter `entityTargets` estruturado, nao taxonomico
- exibir `stance`, `proofStyle` e `commercialMode` primeiro em analytics, nao em todos os filtros
- usar rollout por flag onde houver risco de regressao visual
- reclassificar semanticamente apenas o resíduo ambíguo

## Criterios De Aceite
- `critical` nao aparece mais como `tone`
- `sponsored` e `promo_offer` nao aparecem mais como `contentSignals` nobres
- `stance`, `proofStyle` e `commercialMode` existem no banco e no worker
- backfill V2.5 roda em `dry-run` e `write` com amostragem segura
- rankings e highlights conseguem responder consultas pelas novas dimensoes

## Primeiro Passo Recomendado
Se eu fosse executar agora, a primeira entrega concreta seria:

1. criar `classificationV2_5.ts`
2. expandir [Metric.ts](/Users/arthurmarba/d2c-frontend/src/app/models/Metric.ts#L1)
3. estender [classificationRuntime.ts](/Users/arthurmarba/d2c-frontend/src/app/lib/classificationRuntime.ts#L1)
4. criar testes unitarios dos novos enums e aliases

Essa e a menor fatia que abre o resto do rollout com risco controlado.
