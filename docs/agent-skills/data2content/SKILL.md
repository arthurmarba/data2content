---
name: data2content
description: >
  Guia estratégico e de produto para o Data2Content — a plataforma que lê a vida do criador como narrativa e devolve decisão com evidência. Use SEMPRE que o usuário mencionar Data2Content, ou falar de decisão de produto, feature, UX, copy, onboarding, jornada do criador, mapa, narrativa, territórios, pauta, roteiro, coerência, collabs, publis, mídia kit, comunidade, conector Claude/MCP ou monetização. Também quando pedir para avaliar uma feature, escrever copy, priorizar implementação ou discutir posicionamento. Na dúvida, aplique.
---

# Data2Content — direção de produto

Responda em **português (pt-BR)**, salvo se o usuário escrever em inglês.

Esta skill é o **porquê**. O **como** mora em `docs/brain/` dentro do repositório —
comece por `docs/brain/00 Comece por aqui.md`. Quando as duas divergirem sobre um
fato do código, o cérebro ganha; quando divergirem sobre propósito, esta skill ganha.

---

## North Star

Data2Content é um **companheiro estratégico calmo** para criadores — não uma fábrica
de conteúdo, dashboard de growth hack, nem marketplace de marcas.

A plataforma ajuda o criador a entender **quem ele é**, **o que quer com o conteúdo**
e **como a vida dele vira conteúdo coerente**. Só depois: criação, distribuição,
collabs, marcas, monetização.

**Crença central:** dado de criador é sinal de vida e narrativa. A leitura existe para
reduzir a ansiedade de postar, não para aumentar a dependência do número.

**O eixo da comunidade:** "você não cria sozinho". A reunião semanal é companhia, não
aula. O termo correto em qualquer superfície é **reunião da comunidade**.

---

## Número é evidência — o que se recusa é o número pelado

Esta regra substitui qualquer leitura de que o produto esconde métrica. Ele não esconde:
ele **mostra o número e o que o sustenta**.

Todo número aparece com três coisas:

1. **A amostra** que o sustenta ("14 posts")
2. **O período e a cobertura** de onde ele saiu
3. **O que ele autoriza** — uma ação, um teste, ou um "ainda não dá pra concluir"

**Peso visual é função da certeza.** Dado confirmado recebe o contraste mais forte da
tela; dado a confirmar fica suave; dado ausente é **nulo, nunca zero** — zero se lê como
"publicou e ninguém viu".

Isso não é teoria. No código: a pílula de cachê só fica forte quando o pagamento está
definido (`JourneyWorkspace.tsx`); o preto é reservado a ações **e ao dado que decide**
(`--j-highlight` em `jornada.css`); o índice do padrão é o maior tipo do card, com a
amostra logo abaixo (`ProfilePatternSections.tsx`); e as somas do MCP saem `null` quando
não há post elegível, acompanhadas do método e dos avisos (`adminAnalytics.ts`).

**Nunca:** número sem amostra; média sem denominador declarado; alcance somado
apresentado como audiência única; métrica atual de post antigo apresentada como retrato
do passado; número inventado para preencher lacuna. Se falta dado, diga que falta.

---

## A cadeia do mapa

A cadeia tem **duas direções, e as duas valem**. Confundi-las produz mapa errado.

**Geração (de cima para baixo)** — como a IA constrói, em `mapaLayersGuide.ts`:

> narrativa → território → **tema** → asset

**Dependência (de baixo para cima)** — o que autoriza o quê, no glossário e no `CLAUDE.md`:

> asset → território → narrativa → **pauta**

Cada degrau da segunda só existe se o de baixo existir.

| Camada | O que é | O que **não** é |
| --- | --- | --- |
| **Narrativa** | Tensão ou missão — a identidade de quem publica | Descrição do conteúdo, nicho, bio, 3ª pessoa genérica |
| **Território** | Substantivo curto: o assunto onde o criador vive | Verbo, adjetivo, sufixo de público ("…para criadores") |
| **Tema** | O cruzamento território × narrativa: uma cena quase filmável | Eco do território em gerúndio ("paternidade" → "ser pai") |
| **Asset** | Elemento real de vida: a filha, a cozinha, o cachorro | Credencial, diploma, prêmio |
| **Pauta** | O assunto de um vídeo específico | Ideia solta sem ancoragem |

Os casos que confundem: "humor" não é território, "humor de casal" é. Um prêmio não é
asset; a sala onde ele está pendurado, talvez. "Falo sobre maternidade" não é narrativa;
"sustento a casa e não quero perder a infância dela" é.

### Dois portões diferentes — não misture

- **Liberar pauta** exige narrativa **e** territórios *presentes* — confirmados pelo
  criador **ou** detectados pela síntese. Audiência sozinha nunca libera.
  (`contentIdeasReadinessGate.ts`; confirmação explícita enriquece, mas não é portão duro.)
- **Narrativa firme** é outro carimbo: só com **duas leituras concordando**.
  (`creatorMap.ts`, `evidenceLevel`.) Com uma leitura só, é ponto de partida declarado —
  trate como palpite, não como diagnóstico.

### O mapa é o dicionário

Território, narrativa, asset e tom saem do mapa — nunca da legenda do post nem de rótulo
inventado na hora. O relatório **agrupa** o que o mapa já nomeou; não cria vocabulário
novo. Sem isso, duas semanas seguidas ficam incomparáveis.

### O mapa pertence ao criador

Enriquecimento **nunca remove** um chip — só o criador remove. A fonte refina a redação
ou acrescenta. É o que mantém o mapa estável e tira o medo de "vão apagar o que é meu".

---

## As quatro superfícies do criador

Desde 15/09/2026 a entrada depois do login é `/dashboard/jornada`, com quatro abas.
A Home antiga do desktop foi desligada de propósito: duas experiências vivas são duas
para manter.

| Aba | O que entrega |
| --- | --- |
| **Perfil** | Identidade, narrativa, padrões da semana, pedidos prontos para o Claude |
| **Publis** | Oportunidades do radar, mídia kit, calculadora de cachê |
| **Collabs** | Propostas, salvas, interesse, combinadas, disponibilidade |
| **Comunidade** | Próxima reunião, grupo, gravações, diretório de criadores |

**A quinta superfície é o conector.** O MCP põe a Data2Content dentro do Claude e do
ChatGPT, com ~28 ferramentas. Não é integração acessória: é o que a landing vende, e o
Perfil termina numa gaveta de pedidos prontos para copiar e colar lá.

**A regra de conversa do conector é posicionamento, não configuração.**
`conversationPolicy.ts` proíbe o assistente de vender plano, preço ou upgrade e de mandar
para o checkout. O destino de quem precisa de mais é o perfil, informativo. Mexer nessa
política é mexer no posicionamento — e há teste travando.

---

## Regras de decisão

Antes de recomendar, aprovar ou implementar:

1. Fortalece autoconhecimento, clareza narrativa ou ação coerente?
2. Reduz a ansiedade de ideia, postagem, número, crítica ou medo de flop?
3. Cabe numa das quatro abas ou no conector — ou vira mais um mini-produto solto?
4. Trata dado como significado, **mostrando o número com amostra, período e o que ele autoriza**?
5. Ajuda a criar a partir da vida, sem transformar toda a vida em conteúdo?
6. A tela é calma e diz o próximo passo?
7. Respeita a cadeia e os dois portões?

Resposta incerta → **reduza a feature** até ela caber num lugar só.

---

## A resposta é sim ou não, nunca talvez

A intenção de publicação é binária. Se o produto não consegue decidir, ele não pergunta:
vai buscar mais evidência.

O veredito julga três eixos e nada mais: **narrativa** (isso é seu?), **audiência** (isso
conversa com quem te vê?) e **marca** (isso te aproxima de ser contratado?).

Um "talvez" devolve ao criador exatamente o trabalho que ele veio delegar.

---

## Monetização

O match de publi é de **três eixos**: narrativa, **preço** e chance real de fechar. Uma
oportunidade que combina com a narrativa mas está fora da faixa de preço **não é match** —
nunca chame de compatível.

Outras regras que o produto já fixou:

- Orçamento total da campanha não vira cachê individual.
- A ação é "ver no site da plataforma". A D2C é o radar, não a plataforma de candidatura —
  botão de candidatura aqui prometeria o que não existe.
- Trancado pelo plano mostra a prova de que existe (marca, título, pagamento, prazo) e
  esconde o briefing. **A trava é no servidor**, nunca só na tela.
- No mídia kit, métrica e audiência ficam: ali o número é argumento comercial. A
  apresentação pública do mapa leva só narrativa e territórios — nunca assets, evidências
  ou diagnóstico.

---

## Collabs

Collab é o encontro entre dois criadores que dividem território, e a dupla precisa
acrescentar contribuição concreta — não só compartilhar palavras.

- **Interesse enviado não é combinada.** Só vira combinação com aceite dos dois na mesma
  proposta. Não existe versão "só recomendação" sem aceite mútuo: isso já foi construído e
  descartado.
- Disponibilidade exige opt-in e data; pausa prevalece sobre histórico de interesse.
- Intenção unilateral nunca é devolvida ao outro lado.
- **Nunca** passe diagnóstico privado do parceiro para a sugestão.

---

## Princípios de UX

- **Uma coisa de cada vez.** Uma pergunta, um estado, uma ação.
- **Menos texto.** Estrutura, progresso e escolha clara carregam a experiência.
- **Onboarding é reflexão guiada**, não formulário.
- **Retorno e edição.** O criador volta e ajusta o que declarou.
- **Enriquecimento incremental.** Vídeo, Instagram e respostas alimentam o mapa aos poucos.
- **Sem firula.** Afiado, enxuto, só tão complexo quanto a crença exige.

### O que a linguagem visual já decidiu

Página branca, card cinza neutro sem contorno, card é peça só (nada de quadro dentro de
card). Etiquetas usam o fundo do card com contorno escuro. **Preto é o único contraste
forte** — ações, seleção e a pílula do dado que decide. Cor só em status, pequena.
A marca ainda é preto e branco; a futura cor entra trocando o token do destaque.
**Já testado e rejeitado:** fundo de página colorido, tons por categoria, card dentro de card.

**Vocabulário da plataforma:**
`mapa` · `narrativa` · `território` · `tema` · `asset` · `tom` · `formatos` · `pauta` ·
`roteiro` · `coerência` · `padrões` · `oportunidades` · `próximos passos` ·
`reunião da comunidade`

---

## Como agir em cada tipo de pedido

### Avaliação de feature
1. Localize: qual aba, ou o conector?
2. Passe pelas 7 regras de decisão.
3. Veredito claro: ✅ faz sentido agora / ⚠️ faz sentido depois (quando?) / ❌ não se encaixa.
4. Se ⚠️ ou ❌, proponha a versão reduzida que caberia.

### Copy e UX
1. Tom calmo e direto, sem jargão de growth.
2. Use o vocabulário da plataforma.
3. Prefira uma pergunta focada a uma explicação longa.
4. Todo número na copy vem com amostra e período.

### Decisão de implementação
1. Onde o produto está hoje nessa área (leia a nota do domínio em `docs/brain/20 Domínios/`).
2. Qual a menor mudança que conecta a feature ao propósito.
3. A tela resultante é calma e diz o próximo passo?
4. Mencione o alinhamento brevemente no fim.

### Roadmap
Mapa e narrativa antes de collabs e monetização. Feature isolada se conecta à jornada
antes de entrar feature nova.

---

## O que evitar

| ❌ Nunca | ✅ Em vez disso |
| --- | --- |
| "Poste mais" | "Este post faz sentido para o seu mapa?" |
| "Bata o algoritmo" | "Isso conecta com sua narrativa?" |
| Esconder o número para não assustar | Mostrar o número com amostra, período e o que ele autoriza |
| Soma ausente virando zero | Nulo declarado, com a cobertura ao lado |
| Chamar interesse de combinada | Combinada só com aceite dos dois |
| Chamar de compatível uma oferta fora da faixa de preço | Match é narrativa **e** preço **e** chance de fechar |
| Vender plano dentro do conector | Apontar o perfil, sem oferta |
| Forçar o criador num nicho | Respeitar identidade com múltiplos territórios |
| Monetização antes de clareza narrativa | Primeiro o mapa |
| Features como ilhas | Conectar à jornada antes de avançar |

---

## Referências

- `docs/brain/00 Comece por aqui.md` — o estado real do sistema hoje
- `docs/brain/12 Glossário do produto.md` — as palavras que não se trocam
- `docs/brain/40 Decisões/` — o que já foi decidido e descartado
- `references/source-notes.md` — a conversa de origem (05/2026), para ambiguidade de direção
