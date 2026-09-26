---
tipo: decisão
área: produto
status: em vigor desde 26/09/2026
---

# Padrão consistente liberado depois do piloto

## A decisão

Em 26/09/2026 a promoção de padrão a **"consistente"** (o que o Perfil chama de "O que já é regra" e o diagnóstico chama de padrão firme) foi ligada: `CONSISTENT_POLICY_VALIDATED = true` em `src/app/lib/creatorWeeklyReport/evidencePolicy.ts`. Até então o cálculo marcava os candidatos (`candidateConsistent`) mas não mostrava nenhum, e todo padrão aparecia como aposta.

O Arthur pediu que a decisão fosse tomada ("decidir o piloto"); ela foi tomada pela evidência abaixo, no critério de aceite do [plano de evolução do Perfil](../../plano-evolucao-perfil-2026-09-08.md), Entrega 5.

## O critério (como está no código)

Um padrão só é consistente com **tudo** isto:

- ao menos 6 posts do mesmo formato, e ao menos 15 posts do mesmo formato na referência de 90 dias;
- posts em ao menos 3 semanas diferentes;
- índice mediano de 1,20 ou mais, medido no snapshot do 7º dia (não na métrica de hoje);
- ao menos 2/3 das ocorrências acima do normal do próprio criador;
- retirar qualquer uma das semanas não inverte o sinal;
- cobertura de ao menos 80% da leitura de cena (exceto dia e horário) e do snapshot do 7º dia.

## A evidência do piloto

Os dois fechamentos que o piloto esperava:

| Fechamento | Candidatos | Seguiram acima do normal na semana seguinte | Seguiram candidatos |
| --- | --- | --- | --- |
| W36 → W37 | 12 | 12 | 7 |
| W37 → W38 | 13 | 12 (um ficou em 1,00×) | 7 |

Nenhum candidato virou prejuízo na semana seguinte. Pouco mais da metade manteve o selo: a regra erra para o lado cauteloso, que é o aceitável — o plano pedia que "um viral isolado não domine" e que "sinais com cobertura insuficiente permaneçam provisórios".

## Limites conhecidos

- **Amostra pequena:** 25 candidatos, de 6 a 8 criadores por semana. Estabilidade medida só uma semana à frente.
- **O selo pisca:** cerca de 45% dos candidatos perdem o selo na semana seguinte sem piorar de resultado. O diagnóstico congela na segunda, então o texto não oscila no meio da semana; os cartões antigos, sim.
- **Pode ficar escondido:** o destaque de cada dimensão é o item de maior pontuação; um padrão consistente pode perder o lugar para uma aposta com índice mais alto em poucos posts.
- **Setembro teve alcance gravado como zero** entre ~06/09 e 25/09 (ver [[Relatório Semanal]]); a comparação usa compartilhamentos quando há cobertura, o que reduz o efeito, mas não o elimina.
- Não é significância estatística. É uma política calibrada com dado real.

## Como voltar atrás e quando revisar

Voltar é trocar a constante para `false`. Revisar depois de mais quatro fechamentos: se mais de 20% dos candidatos ficarem abaixo do normal na semana seguinte, apertar o corte.

## Ligações

[[O Perfil mostra diagnóstico, não cartões]] · [[Relatório Semanal]] · [[Jornada e Perfil]]
