# Rollout de Classificacao Canonica

## Objetivo

Garantir que:

- novas classificacoes sejam persistidas apenas como IDs canonicos
- o legado duplicado ou fora de dimensao nao volte a nascer
- o banco continue auditavel apos deploy

Checklist curto para execucao do time:

- ver [docs/classification-canonical-pr-deploy-checklist.md](./classification-canonical-pr-deploy-checklist.md)

## O que precisa ir para producao

Arquivos de runtime:

- `src/app/lib/classification.ts`
- `src/app/lib/classificationLegacy.ts`
- `src/app/models/Metric.ts`
- `src/app/api/metrics/route.ts`
- `src/app/api/worker/classify-content/route.ts`
- `src/app/lib/instagram/utils/helpers.ts`
- `src/utils/calculateAverageVideoMetrics.ts`
- `src/utils/aggregatePlatformDayPerformance.ts`
- `src/utils/aggregatePlatformTimePerformance.ts`
- `src/app/api/v1/users/[userId]/performance/time-distribution/posts/route.ts`

Arquivos operacionais:

- `scripts/auditClassificationLegacy.ts`
- `scripts/migrateCanonicalCategories.ts`
- `scripts/quarantineClassificationLegacy.ts`
- `scripts/auditClassificationQuarantine.ts`
- `scripts/auditClassificationQuarantineConflicts.ts`
- `scripts/remapClassificationQuarantine.ts`
- `scripts/applyReviewedClassificationQuarantineResolutions.ts`
- `src/app/lib/classificationQuarantineResolution.ts`

## Pre deploy

1. Confirmar que o build e os tipos passam.
2. Confirmar que os testes da classificacao passam.
3. Garantir que o ambiente de producao esteja com a mesma versao de Node exigida pelo projeto.

Comandos:

```bash
npm run smoke:types
npm test -- --runInBand src/app/lib/classification.test.ts
npm test -- --runInBand src/app/lib/classificationLegacy.test.ts
npm test -- --runInBand src/app/models/Metric.classification.test.ts
npm test -- --runInBand src/app/lib/classificationQuarantineResolution.test.ts
```

## Deploy

1. Subir o codigo de runtime.
2. Publicar o worker que grava classificacao.
3. Publicar qualquer job que atualize metricas e use os helpers canonicos.
4. Somente depois rodar saneamento no banco de producao, se ainda houver legado.

## Saneamento de producao

Rodar nesta ordem:

1. Auditoria inicial
2. Migracao deterministica
3. Quarentena do resíduo invalido
4. Remapeamento conservador
5. Aplicacao das regras revisadas
6. Auditoria final

Comandos base:

```bash
npx tsx --env-file=.env.production ./scripts/auditClassificationLegacy.ts
npx tsx --env-file=.env.production ./scripts/migrateCanonicalCategories.ts --write
npx tsx --env-file=.env.production ./scripts/quarantineClassificationLegacy.ts --write
npx tsx --env-file=.env.production ./scripts/remapClassificationQuarantine.ts --write
npx tsx --env-file=.env.production ./scripts/applyReviewedClassificationQuarantineResolutions.ts --write
npx tsx --env-file=.env.production ./scripts/auditClassificationLegacy.ts
npx tsx --env-file=.env.production ./scripts/auditClassificationQuarantine.ts
npx tsx --env-file=.env.production ./scripts/auditClassificationQuarantineConflicts.ts
```

## Criterio de aceite

O rollout so esta completo quando:

- `auditClassificationLegacy` nao mostrar `unknown`, `alias` ou `deterministic changes pending`
- `auditClassificationQuarantine` retornar `0` em todas as dimensoes
- `auditClassificationQuarantineConflicts` retornar lista vazia
- novas gravacoes seguirem entrando apenas como IDs canonicos

## Monitoramento pos deploy

Janela recomendada:

- dia 0: rodar auditoria imediatamente apos deploy e apos o primeiro ciclo real de classificacao
- dias 1 a 7: rodar auditoria diaria
- depois: rodar auditoria semanal ou apos qualquer mudanca na taxonomia

Comando local consolidado:

```bash
npm run audit:classification-health
```

Em producao, rode os tres scripts diretamente com o env correto:

```bash
npx tsx --env-file=.env.production ./scripts/auditClassificationLegacy.ts
npx tsx --env-file=.env.production ./scripts/auditClassificationQuarantine.ts
npx tsx --env-file=.env.production ./scripts/auditClassificationQuarantineConflicts.ts
```

## Sinais de regressao

Investigar imediatamente se aparecer:

- valor novo em `classificationQuarantine`
- `label` humano salvo nos arrays principais em vez de ID
- valor de uma dimensao aparecendo sistematicamente em outra
- aumento de `general`, `neutral` ou tokens de hashtag nos campos de classificacao

## Manutencao futura

Quando surgir uma categoria nova:

1. adicionar a categoria na taxonomia central
2. adicionar aliases necessarios em `classification.ts`
3. adicionar testes
4. reauditar o banco
5. so depois liberar a nova classificacao em producao
