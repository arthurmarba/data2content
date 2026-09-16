---
Criado: 2026-09-16
---

# Padrões presos em "Esperando" quando a mediana de shares é zero

No Perfil do Arthur (16/09/2026), **todas as 11 dimensões** (dia, horário, onde, objeto, elenco, enquadramento, tom, clima, assunto, recorrente, jeito de começar) apareciam dentro de "Esperando mais posts", com a leitura dizendo "59 posts lidos". Nenhum card de padrão saía. Não é falta de dados nem o corte de `RULE_CUT`.

## A mecânica

1. `buildPatternSections` só tira uma dimensão da espera se o highlight dela for `kind === "answer"`.
2. `patternHighlights.promotable` exige `index > 1` — rendeu acima da mediana da própria conta.
3. `engine.chooseComparisonMetric(metrics)` escolhe a métrica **uma vez, global**: precisa existir em ≥80% dos posts e ter mediana > 0. Escolheu `shares`.
4. Mas `engine.bestPerformanceIndex` compara **por coorte de formato** (`formatCohort = metric.type`): divide pela mediana daquele tipo de post.
5. Conta real: 18 posts em 90 dias, 17 REEL + 1 IMAGE. Mediana de shares dos reels = **0** (8 zeros, 2 sem o campo, máximo 17). `indexAgainst` devolve `null` quando a base é ≤ 0 → **todo reel fica sem índice**.
6. Sobra a coorte IMAGE, de um post só: ele é a própria mediana, índice exatamente **1,00** — e 1 não é `> 1`.

Ou seja: a métrica passa no teste **global** e é inútil **por coorte**. Com a mediana da coorte em zero, nada é promovido por mais posts que entrem.

## Como reconhecer

`GET /api/dashboard/mobile-strategic-profile/weekly-report` e olhar os `items` dos `groups`: se `comparisonMetric` é `shares`, o `index` vem `null` na maioria e o maior é exatamente `1`, é esta armadilha. Conferir a mediana de shares por `type` em `/api/v1/users/<id>/videos/list` (`posts[].stats.shares`).

## Conserto aplicado em 16/09/2026 (opção escolhida pelo Arthur)

- `engine.cohortBaseline` escolhe a métrica **por coorte de formato**, com reserva `shares → saved → views` e exigindo mediana > 0 **na própria coorte**. `Baseline` perdeu o campo global `dimension` (e os medianos `shares/saved/views`, que já eram mortos) e ganhou `cohorts: Map`.
- `COHORT_MIN_POSTS = 3`: coorte menor não serve de régua. Com dois posts, um está sempre acima da mediana por definição — promover ali é ruído; com um, o índice sai exatamente 1,00.
- `comparisonMetric` do item passou a dizer a verdade: `groupComparisonMetric` só nomeia a métrica quando todos os posts do grupo foram medidos pela mesma; senão fica vazio.
- `analysedPosts` agora vem do motor (posts distintos por dimensão) e `patternHighlights` usa ele, mantendo a soma antiga só como reserva para relatórios já congelados.
- Regressão travada em `engine.test.ts`: 17 reels de mediana zero + 1 foto → régua vira `views` e o índice passa de 1; e coorte de 2 posts não gera índice. Cenário de 2 posts do teste de assuntos cresceu para 3 pelo mesmo motivo.
- **Relatórios já gravados não mudam sozinhos:** o snapshot da semana é congelado. Para ver o efeito é preciso regerar (`POST /api/dashboard/mobile-strategic-profile/weekly-report`) ou esperar o fechamento da próxima semana.
- **Regerar exige `{"force": true}` no corpo.** Sem isso, `service.ts:108` compara a `sourceRevision` e, como os posts não mudaram, devolve a foto gravada — a rota responde `ok: true` com o `generatedAt` antigo e parece que regerou. Sintoma de que veio a foto velha: `comparisonMetric` ainda `shares` e `analysedPosts` ausente.

## Resultado na conta do Arthur (16/09/2026, após regerar com force)

Régua virou `saved` (salvamentos) — nos reels a mediana de `shares` é zero, a de `saved` não. **10 das 13 dimensões passaram a ter resposta** e a gaveta caiu de 11 para 2 padrões em espera. Exemplos: enquadramento "plano aberto" 5,0×, elenco "parceiro em cena" 5,0×, clima "com música" 5,0×, dia "sábado" 3,5×, cenário "estabelecimento" 3,0×. Ficaram sem resposta apenas tom e jeito de começar (topo exatamente 1,00). A contagem de posts lidos passou a bater com a realidade (18, 17, 15, 11 por dimensão, não mais 59).

## Bônus: o "posts lidos" da gaveta é inflado

`patternHighlights.analysedPosts` soma `nPosts` de **todas as opções** do grupo, e um post entra em várias opções (multi-rótulo). Com 18 posts reais, clima mostrava 59, enquadramento 40, elenco 32. O número não é de posts, é de ocorrências.

## Ligações

[[Relatório Semanal — janela híbrida]] · [[Perfil v5 — padrões por evidência + território]]
