---
tipo: armadilha
custo: rótulo e título com tamanho e cor errados, sem erro nenhum
---

# Parágrafo da Jornada engole o tamanho do componente

## O sintoma

Dentro da Jornada, um texto escrito como `<p className="text-[10.5px] ...">` aparece com 14 px, cinza e margem própria. No card de identidade do Perfil, o rótulo "SUA NARRATIVA" saía maior que todos os outros rótulos da tela, a linha abaixo do nome saía com 14 px em vez de 12, e o pedido "Defina sua narrativa…" (desenhado com 19 px em preto) saía com 14 px em cinza. Nada quebra, nenhum teste falha: só fica feio.

## A causa

`jornada.css` tem `.j-workspace p { font-size: 14px; color: #6a605a; margin: 10px 0; }`. Esse seletor tem uma classe e um elemento; a classe Tailwind do componente (`.text-\[10\.5px\]`) tem só uma classe. O da Jornada vence, em qualquer ordem de CSS.

O mesmo vale para `h2` e `h3`, que a Jornada também estiliza.

## A correção

Texto que tem tamanho próprio vira `div` (ou `span`), não `p`. Parágrafo corrido, que deve seguir o corpo da Jornada, continua `p`. Foi o que se fez em `ProfileIdentityCard.tsx`, na linha "Instagram conectado" de `ProfileNextStepField.tsx` e em `ProfileWeeklyDiagnosis.tsx` (26/09/2026).

Não resolver afrouxando a regra da Jornada para `p:not([class])`: todo parágrafo com qualquer classe (até um `m-0`) perderia o corpo de texto nas quatro abas.

## Parente próximo

`.ds-button--primary` traz do design system antigo uma sombra rosa. A Jornada não tem sombra; desde 26/09/2026 `jornada.css` zera a sombra do primário.

## Como conferir

No navegador, `getComputedStyle(el).fontSize` do texto suspeito. Se der 14px onde a classe diz outra coisa, é isso.

## Ligações

[[Jornada e Perfil]] · [[Redesenho da jornada e mockup do app]]
