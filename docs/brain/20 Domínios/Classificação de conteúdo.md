---
tipo: domínio
---

# Classificação de conteúdo — como cada post ganha rótulo

## Por que importa mais do que parece

Quase todo card de análise do produto depende de posts classificados. Quando algo "trava em Processando", a classificação é a primeira suspeita — ver [[Card de audiência trava]].

## As cinco dimensões

Todo conteúdo é rotulado em cinco eixos, definidos em `src/app/lib/classification.ts`:

`format` · `proposal` · `context` · `tone` · `reference`

## O caminho do dado

```
post chega  →  entra na fila (QStash)  →  /api/worker/classify-content
            →  IA classifica  →  grava no modelo Metric
```

| Peça | Caminho |
| --- | --- |
| Taxonomia | `src/app/lib/classification.ts` |
| Versões da taxonomia | `classificationV2.ts`, `classificationV2_5.ts`, `classificationV2Bridge.ts` |
| Execução | `classificationRuntime.ts` |
| Provedor de IA | `classificationAiProvider.ts` |
| Erros e reprocesso | `classificationAiErrors.ts` |
| Cache | `classificationCache.ts` |
| Quarentena | `classificationQuarantineResolution.ts` |
| Trabalhador | `/api/worker/classify-content` |

## Por que existem tantas versões

A taxonomia mudou duas vezes e as versões convivem: `classificationLegacy`, `V2`, `V2_5`, com uma ponte entre elas. Dado antigo continua no formato antigo até um backfill passar. **Ao ler uma classificação, confira em qual versão ela foi feita** antes de concluir que está errada.

Os planos escritos estão em `docs/plano-taxonomia-categorias-v2.md` e `docs/plano-taxonomia-categorias-v2-5.md`.

## Ferramentas de linha de comando

```bash
npm run reclassify                        # reclassifica tudo
npm run reset-classification-failed       # devolve os que falharam pra fila
npm run requeue:classification-retryable  # reenfileira o que dá pra tentar de novo
npm run classification:complete-empty     # completa classificações vazias
```

Todas falam com o **banco real**. Leia antes de rodar.

## Cache

A classificação é cara, então há cache. Se mudou o prompt ou a taxonomia e "nada mudou", o cache é o suspeito.

## Ligações

[[Instagram e métricas]] · [[Relatório Semanal]] · [[Custo de IA é decisão de arquitetura]]
