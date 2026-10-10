---
tipo: fundação
---

# 12 — Glossário do produto

As palavras da Data2Content têm significado preciso. Usar errado no código ou na tela quebra a lógica do produto inteiro, porque as camadas se apoiam umas nas outras.

## A cadeia

> **asset → território → narrativa → pauta**

Cada degrau só existe se o de baixo existir. É por isso que não dá pra "gerar pautas" pra quem ainda não tem narrativa.

### Asset
Um **elemento de vida** do criador: a filha, a cozinha do apartamento, o cachorro, o carro velho. Não é credencial, não é habilidade, não é prêmio. Se cabe num currículo, não é asset.

### Território
Um **substantivo** — o assunto onde o criador vive. Maternidade, gastronomia, moda. "Humor" não é território; "humor de casal" é, porque tem assunto embaixo. Curto (1 a 3 palavras), sem verbo e sem sufixo de público ("…para criadores").

### Tema
O **cruzamento entre território e narrativa**: uma cena concreta, quase filmável, que só existe porque *este* criador ocupa *aquele* território. Não é o território repetido em gerúndio — território "paternidade" + narrativa "sair do piloto automático" dá o tema "sair do trabalho e ir correndo pra casa ver a família", não "ser pai".

O tema ficou de fora desta lista por um tempo, embora exista no código (`mapaLayersGuide.ts`) e viaje no MCP como `themes`. É ele que se cruza com os assets para virar pauta.

### Narrativa
Uma **tensão ou uma missão** — o que está em jogo na vida do criador. Não é descrição, não é nicho. É a frase que explica por que o conteúdo dele importa.

Uma narrativa só é considerada **firme** com **duas leituras concordando** — Instagram e vídeo (`resolveEvidenceLevel`). A confirmação do criador não entra nessa conta: ela protege o núcleo de ser sobrescrito, e ajuda a liberar pauta, que é outro portão. Ver [[Seu Mapa]] e [[Pauta exige narrativa]].

### Pauta
O assunto de um vídeo específico, nascido do cruzamento entre narrativa e território.

## Outras palavras

| Palavra | O que quer dizer |
| --- | --- |
| **Seu Mapa** | A leitura completa do criador; o card e o board de mesmo nome |
| **MapaSeed** | O modelo no banco que guarda essa leitura (`src/app/models/MapaSeed.ts`) |
| **Ponto-ouro** | O encontro entre narrativa, audiência e marcas — a lente da consultoria |
| **Collab** | Encontro entre dois criadores que dividem território |
| **Publi** | Conteúdo pago por marca |
| **Mídia Kit** | A página pública que o criador manda pra marca |
| **Território (relatório)** | No relatório semanal, o recorte da comunidade inteira, não de um criador |
| **Boards** | Os blocos que o criador prende na home do computador |
| **Norte** | A declaração de propósito do criador, colhida no onboarding |

## Os três agentes editoriais

Irmãos, mesma cozinha de dados, entregas diferentes:

- **Galeano** — a Revista D2C. Carrosséis editoriais diários sobre criadores reais.
- **Galileia** — o relatório individual, em PDF, pra reunião de consultoria.
- **Galisteu** — o deck (.pptx) da reunião de grupo.

Moram em `.claude/skills/` e em `scripts/`. Não são funcionalidades do aplicativo: são ferramentas de operação.

## Ligações

[[Seu Mapa]] · [[Pautas e Roteiros]] · [[Cadeia narrativa e pauta]]
