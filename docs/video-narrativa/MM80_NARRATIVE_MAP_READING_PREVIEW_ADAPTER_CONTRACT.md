# MM80 — Narrative Map Reading Preview Adapter Contract

Este milestone cria um adapter puro para organizar leituras documentadas e capitulos editoriais em um view model da futura experiencia mobile.

## Decisao

O adapter transforma dados ja estruturados em `NarrativeMapMobileViewModel`.

Ele nao busca dados, nao salva dados, nao chama endpoint e nao cria estrategia nova. A funcao apenas normaliza o que a UI precisa renderizar.

## Experiencia futura

A experiencia final sera organizada em:

- Perfil;
- Leituras;
- Oportunidades.

Perfil mostra o mapa narrativo atual. Leituras mostram evidencias documentadas por video. Oportunidades mostram territorios, fit narrativo e caminhos comerciais em formacao.

## Regras de produto

- Instagram e camada de precisao, nao aba.
- Oportunidades sao territorios e fit narrativo enquanto nao houver match real.
- Leituras usam `rememberedAs`, nao thumbnail persistida.
- Um video isolado continua sendo leitura documentada, nao atualizacao direta do Perfil geral.
- O CTA principal continua sendo "Nova leitura".
- O diagnostico completo continua secundario.

## Guardrails

Este PR nao:

- altera endpoint real ou endpoint mock;
- chama Gemini;
- chama storage;
- busca banco;
- salva documento;
- altera `CreatorStrategicProfileSnapshot`;
- cria agregador do Perfil;
- altera UI real;
- altera `MediaKitView`, Comunidade, billing, Stripe, NextAuth, shells, sidebar ou navegacao real.

O adapter nao importa service de persistencia, Mongoose/model direto, Gemini SDK, storage SDK ou endpoint real/mock.

## Preview interno

O harness interno passa a consumir o view model para header, hero, tabs e acoes, mas continua preview interno. Cards e modais seguem mockados e isolados.

## Proximo passo sugerido

Um proximo PR pode criar um adapter server-side controlado para montar este view model a partir de leituras ja consultadas por outro fluxo, ainda sem alterar endpoint real ou UI final.
