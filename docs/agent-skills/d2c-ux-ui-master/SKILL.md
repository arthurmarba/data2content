---
name: d2c-ux-ui-master
description: >
  Guia de interface da Data2Content: as decisões visuais e de interação que o produto já tomou, e as que já foram testadas e rejeitadas. Use ao desenhar, implementar ou revisar qualquer tela do criador — Jornada, Perfil, Publis, Collabs, Comunidade, mídia kit, calculadora, onboarding, saída de IA, copy de interface, componente ou estado vazio. Também ao escolher cor, espaçamento, tipografia, animação ou padrão de navegação.
---

# Data2Content — interface

Responda em **português (pt-BR)**, salvo se o usuário escrever em inglês.

Esta skill é a **linguagem visual**. O propósito do produto está na skill `data2content`;
o estado do código está em `docs/brain/`. Onde esta skill e o código divergirem, o código
ganha — e a divergência vira correção aqui.

**Regra de ouro:** este produto já tomou decisões. Muita coisa que parece boa ideia genérica
já foi testada aqui e rejeitada. Antes de propor cor, sombra, animação ou biblioteca nova,
leia a seção "Já testado e rejeitado".

---

## O que a interface precisa provocar

Calma, clareza e a sensação de saber o próximo passo. O criador chega ansioso — com ideia,
com número, com medo de flopar. A tela existe para reduzir isso.

Ela **não** deve parecer um painel de métricas, nem um terminal financeiro, nem um feed de
gráficos. Deve parecer um companheiro estratégico que já olhou os dados por você.

---

## Número é o herói, não o vilão

Esta é a regra que mais se erra aqui, porque o instinto genérico de UX manda "traduzir
métrica em insight" e esconder o resto. **Não é o que este produto faz.**

O número aparece **grande e primeiro**. No card de padrão, o índice (`7,5×`) é o maior tipo
do card, com a amostra ("14 posts") logo abaixo e a série de quatro semanas ao lado.

O que se recusa é o **número pelado**. Todo número carrega três coisas:

1. **A amostra** que o sustenta
2. **O período e a cobertura**
3. **O que ele autoriza** — uma ação, um teste, ou um "ainda não dá pra concluir"

**Peso visual é função da certeza.** Dado confirmado recebe o preto; dado a confirmar fica
suave; dado ausente é **nulo declarado, nunca zero**. A pílula de cachê só fica forte quando
o pagamento está definido — é a regra inteira em um componente.

Nunca esconda um número para "não assustar". Mostre-o com o que ele significa.

---

## Cor

**A D2C não tem cor de marca.** É preto e branco. Quem procurar um accent color vai achar o
rosa `#fa165b` em `src/design-system/tokens.css` — **não é marca**, e a Jornada o sobrescreve
para quase-preto (`#171717`).

A regra publicada:

- **Página branca.** Card cinza neutro, sem contorno. O card é uma peça só.
- **Preto é o único contraste forte** — ações, seleção e a pílula do dado que decide
  (`--j-highlight`). É por ali que a futura cor de marca entra, trocando uma linha.
- **Cor só em status**, pequena: bolinha mais texto, sem fundo.
- Etiquetas dentro do card usam o fundo do card com contorno escuro.
- Mídia kit é a exceção: branco com contorno, porque é vitrine para marca.

---

## Os dois sistemas de token

Saber em qual você está evita estragar a tela.

| Sistema | Onde | Como é |
| --- | --- | --- |
| `--ds-*` | `src/design-system/tokens.css` | O antigo: papel quente, rosa, sombras |
| `--j-*` | `src/app/dashboard/jornada/jornada.css` | A Jornada: branco, cinza neutro, preto, sem sombra |

A Jornada **remapeia** os tokens `--ds-*` dentro do seu escopo. Mexer no `tokens.css` achando
que muda a Jornada é engano comum — e o contrário também.

---

## Já testado e rejeitado

Não reintroduza sem conversar:

| Ideia | Por que caiu |
| --- | --- |
| Fundo de página colorido | Testado; pesado |
| Card bege/areia | Pesado; o cinza veio de referência do Arthur |
| Tons por categoria (rosé, lilás, sálvia) | Cinco famílias na mesma tela recriaram o embaralhado que se queria resolver |
| Card dentro de card | A narrativa em quadro próprio leu como "card dentro de card" |
| Sombra | A Jornada zera `box-shadow`. Contorno fino resolve — e sombra vira retângulo cinza no PDF |
| Botão desabilitado em cinza | Melhor dizer o motivo |
| Porcentagem de match | Não temos o dado que sustentaria o número |
| Modo escuro | Não existe no produto. Não invente |

---

## Padrões de interação já decididos

- **Carrossel serve para escolher entre poucos; lista serve para achar entre muitos.**
  Nove carrosséis seguidos custavam nove rolagens para chegar ao último.
- **Detalhe pesado abre em tela cheia** (`dialog`), como o mídia kit e a publi — não empurra
  a página.
- **O card inteiro é o alvo de toque** quando a linha tem um destino só.
- **Pílula é dado; botão é verbo.** Não misture.
- **Estado de espera não some da tela.** "Esperando mais posts" é a prova de que a leitura
  olhou aquela dimensão — vive fechado, em uma linha.
- **Ação, não rótulo.** O card diz "Tenha a caneca de café em cena", não "Caneca de café".
  Traduzir substantivo em decisão é trabalho da tela, não de quem lê.

---

## Uma experiência, não duas

Desde 15/09/2026, celular e computador compartilham a mesma Jornada. A Home antiga do desktop
foi desligada de propósito: duas experiências vivas são duas para manter.

Desenhe para 390 px primeiro e deixe o computador **expandir** — não redefinir. Confira as duas
larguras antes de dar por pronto.

---

## Pilha: o que existe e o que não existe

Next.js 15 (App Router), React 18, TypeScript, Tailwind 3, `lucide-react` para ícone.

Cuidado com duas suposições comuns:

- **Não há shadcn/ui.** `src/components/ui/` é componente próprio do projeto. Use o que está lá.
- **`framer-motion` existe no projeto, mas a Jornada não usa.** Não introduza animação nova ali
  sem pedir; a linguagem atual é sóbria.

Componentes compartilhados têm variantes `journey` / `compact` para não quebrar as telas antigas.

---

## Como agir

### Ao desenhar uma tela
1. Qual ansiedade ela reduz? Qual é o próximo passo único?
2. Qual número decide, e ele está com amostra, período e ação?
3. Cabe no preto-e-branco com status colorido, ou você está inventando cor?
4. Funciona a 390 px?

### Ao revisar
1. Card dentro de card? Sombra? Cor decorativa? Modo escuro?
2. Número sem amostra? Zero onde deveria ser nulo?
3. Carrossel onde deveria ser lista?
4. Botão prometendo o que o produto não faz?

### Ao escrever copy de interface
Calmo, direto, sem jargão de growth. Uma pergunta focada vale mais que um parágrafo.
Nunca "poste mais" nem "bata o algoritmo". Todo número na copy vem com amostra e período.

---

## Referências

As referências visuais reais deste produto são **MIS** e **BrandLovrs**, trazidas pelo Arthur —
não Linear, Arc ou Raycast. Quando precisar de padrão, olhe o que a Jornada já faz.

- `src/app/dashboard/jornada/jornada.css` — os tokens vivos e os comentários que explicam por quê
- `docs/brain/40 Decisões/Redesenho da jornada e mockup do app.md` — o histórico das decisões
- `docs/brain/30 Armadilhas/` — as rasteiras já tomadas
