# Board Adaptativo V2 - Checklist de QA Manual

Este checklist orienta a validação visual/manual do harness interno antes de qualquer integração da V2 no BoardShell.

## Pré-requisitos

- Estar na branch `feat/adaptive-post-creation-board-v2`.
- Rodar o app localmente.
- Usar `NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED=1`.
- Acessar `/dashboard/boards/adaptive-v2-preview`.

## Cenários para Revisar

| Cenário | URL relativa |
| --- | --- |
| `validate-pauta` | `/dashboard/boards/adaptive-v2-preview?scenario=validate-pauta` |
| `format-guidance` | `/dashboard/boards/adaptive-v2-preview?scenario=format-guidance` |
| `discover-pauta` | `/dashboard/boards/adaptive-v2-preview?scenario=discover-pauta` |
| `brand-match` | `/dashboard/boards/adaptive-v2-preview?scenario=brand-match` |
| `collab-match` | `/dashboard/boards/adaptive-v2-preview?scenario=collab-match` |
| `comment-to-post` | `/dashboard/boards/adaptive-v2-preview?scenario=comment-to-post` |

## Checklist Visual por Cenário

Aplicar este checklist em todos os cenários:

- O título `Preview interno — Board Adaptativo V2` aparece.
- O cenário ativo está correto.
- O input controlado está correto.
- O modo detectado está correto.
- O bloco `Leitura inicial` aparece.
- O bloco `Caminhos de decisão` aparece.
- O bloco `Leitura da rodada` aparece.
- O bloco `Plano estratégico` aparece.
- As perguntas estão legíveis.
- Opções longas não quebram o layout.
- A indicação `Sugestão estratégica` não parece gabarito.
- Não aparece score, nota, percentual ou pontuação.
- Não aparece linguagem de jogo/prova.
- Próximos passos parecem úteis e não prometem performance.

## Checklist Específico por Cenário

### validate-pauta

- Não deve mostrar bloco de collab automaticamente.
- Deve parecer validação de ideia, não plano comercial forçado.

### format-guidance

- Deve começar pela força/narrativa da pauta antes do formato.
- Formato deve aparecer como conclusão da leitura.

### discover-pauta

- Deve parecer desbloqueio criativo.
- Deve começar por território/narrativa.

### brand-match

- Deve mostrar `Encaixe com marca`.
- Não deve mostrar `Encaixe com collab` sem motivo.

### collab-match

- Deve mostrar `Encaixe com collab`.
- Deve sugerir dinâmica de parceria sem parecer campanha obrigatória.

### comment-to-post

- Deve aproveitar o comentário como origem da pauta.
- Deve parecer resposta à audiência.

## Checklist de Linguagem Proibida

Procurar visualmente pelos termos abaixo. Nenhum deles deve aparecer na experiência renderizada:

- `score`
- `nota`
- `pontuação`
- `acerto`
- `erro`
- `errado`
- `resposta correta`
- `gabarito`
- `venceu`
- `perdeu`
- `garantido`
- `certeza`
- `comprovado`
- `viralizar garantido`

## Checklist Mobile e Responsivo

Testar no DevTools em largura mobile:

- Cards de opção.
- Blocos 5W2H.
- Cenas sugeridas.
- Próximos passos.
- Links de cenário.
- Scroll geral da página.
- Quebra de textos longos em labels, helpers e razões.
- Espaçamento entre blocos e legibilidade em telas estreitas.

## Critérios de Aprovação Visual

Considerar a QA visual aprovada apenas se:

- Nenhum termo proibido for encontrado.
- Nenhum layout estiver quebrado.
- Nenhum cenário renderizar bloco errado de marca/collab.
- A navegação por cenários funcionar.
- A página bloqueada aparecer corretamente com a flag off.
- A experiência parecer mentoria estratégica, não quiz de acerto.

## Achados

Preencher durante a revisão manual:

| Cenário | Problema encontrado | Severidade | Sugestão de ajuste | Status |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Próxima Decisão

Depois desta QA manual, escolher uma das próximas direções:

- Avançar para V2M: proteção por sessão admin/dev.
- Fazer ajuste visual de UI caso a QA encontre problema.

Não avançar para integração no BoardShell antes de resolver achados visuais relevantes.
