---
tipo: armadilha
área: planejamento
---

# Cache do planejamento nunca acerta

`PlannerRecCache.algoVersion` é `String` no schema. `api/planner/batch` e `api/planner/recommendations` gravam `ALGO_VERSION` numérico (3 e 4); o Mongoose converte para `"3"` ao salvar e a leitura compara `cached.algoVersion === ALGO_VERSION`. Texto nunca é igual a número: o cache **não é servido nunca**, a recomendação é recalculada em todo pedido e o registro é regravado.

Visto na auditoria de espaço de 26/09/2026: 406 registros, semanas de 2025 acumuladas, nenhum lido. O TTL "opcional" dependia de `PLANNER_FREEZE_TTL_DAYS`, que nunca foi definida. Agora o modelo declara TTL de 30 dias em `frozenAt` e o índice real `frozenAt_ttl` foi criado.

Corrigir a comparação (`String(cached.algoVersion) === String(ALGO_VERSION)`) muda o produto: o planejamento passa a mostrar a recomendação congelada da semana em vez de recalcular. Decisão de produto, não limpeza.

[[Expiração declarada não garante limpeza no MongoDB]]
