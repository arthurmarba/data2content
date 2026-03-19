# Checklist Curto de PR e Deploy

## PR

- Confirmar que o PR inclui runtime, modelo e scripts operacionais da classificacao canonica.
- Confirmar que `src/app/api/metrics/route.ts` e `src/app/api/worker/classify-content/route.ts` persistem apenas IDs canonicos.
- Confirmar que `src/app/models/Metric.ts` rejeita valores desconhecidos nos campos principais.
- Confirmar que `src/app/lib/classification.ts` e `src/app/lib/classificationLegacy.ts` contem a taxonomia e os aliases esperados.
- Confirmar que os scripts de auditoria e saneamento estao no PR.
- Rodar:

```bash
npm run smoke:types
npm test -- --runInBand src/app/lib/classification.test.ts
npm test -- --runInBand src/app/lib/classificationLegacy.test.ts
npm test -- --runInBand src/app/models/Metric.classification.test.ts
npm test -- --runInBand src/app/lib/classificationQuarantineResolution.test.ts
```

## Deploy

- Publicar o codigo de runtime.
- Publicar o worker/job que grava classificacao.
- Confirmar que o ambiente esta usando a versao de Node esperada pelo projeto.
- Rodar auditoria inicial no banco de producao.
- Se houver legado, rodar migracao deterministica, quarentena, remapeamento e regras revisadas.
- Rodar auditoria final.

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

## Aceite

- `auditClassificationLegacy` sem `unknown`, `alias` ou `deterministic changes pending`
- `auditClassificationQuarantine` com `0` em todas as dimensoes
- `auditClassificationQuarantineConflicts` com lista vazia
- novas classificacoes entrando apenas como IDs canonicos

## Pos deploy

- Rodar `npm run audit:classification-health` em ambiente equivalente ou os tres scripts de auditoria em producao.
- Repetir a auditoria depois do primeiro ciclo real de classificacao.
- Repetir diariamente na primeira semana.
