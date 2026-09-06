---
tipo: armadilha
alcance: sistêmico — vale auditoria
---

# `compactView` esconde função sem avisar

## O padrão errado

Um bloco da home foi feito com uma versão compacta (`compactView`), que esconde ações pra caber no espaço menor. Depois, uma **rota dedicada** reaproveita esse mesmo componente compacto — e leva junto o esconderijo.

Resultado: a página inteira daquela funcionalidade nasce sem os botões que deveria ter. Ninguém percebe, porque o componente "funciona".

## Onde já aconteceu

No CRM. **Corrigido lá**, mas o padrão é sistêmico: `compactView` aparece em vários lugares (Mídia Kit, Descobrir, Publis, home minimalista). **Os outros ainda não foram auditados.**

## O que fazer

Ao criar rota dedicada pra alguma coisa que já tem bloco na home, **não reaproveite a versão compacta**. A rota dedicada é o lugar onde tudo aparece.

## Ligações

[[Collabs]] · [[Mídia Kit e Publis]]
