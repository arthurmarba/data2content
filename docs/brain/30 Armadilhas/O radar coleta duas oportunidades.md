---
tipo: armadilha
custo: relatório vazio com o mercado cheio
---

# O radar coleta duas oportunidades

## O que acontece

Você roda `npm run campaign-radar:collect` esperando as campanhas do dia e recebe **duas**: Up!ABC e
Tijuca Geek. Parece que o mercado secou ou que os coletores quebraram.

## Por quê

Nenhum dos dois. A revisão de 07/09/2026 passou a exigir permissão registrada por origem
(`collectionPolicy.ts`): só Up!ABC e Tijuca Geek foram revisadas, e a revisão vence em 30 dias. Todas
as outras — Influencer Brasil, Squid, Creator Ads, PlayNest, 99Freelas, Animextreme — são bloqueadas
**antes da rede**, com aviso, não com erro. No mesmo 07/09, a Influencer Brasil sozinha tinha 37
projetos públicos e 19 ativos.

O aviso por origem no fim da execução é o sinal; o número final de oportunidades não é.

## O que fazer

Enquanto não houver autorização escrita ou revisão de coleta das origens que rendem volume, o
relatório se alimenta de **captura manual** pela tela `/admin/campaign-radar` ou por lote JSON.
A varredura de 07/09 está em [[radar-varredura-2026-09-07]] e rendeu 44 candidatas. Antes de sair
pesquisando origem nova, abra [[radar-fontes-verificadas]]: são 42 origens já conferidas, com o que
cada uma entrega sem login, o calendário de credenciamento de evento e os falsos positivos.

Duas ciladas de leitura ao capturar à mão:

- o "investimento" que a Influencer Brasil publica é o do projeto para N vagas — **não** é cachê do
  criador, e o catálogo proíbe apresentá-lo assim;
- o feed público do AchaPubli traz 283 vagas com `status: active`, mas nenhuma publicada depois de
  março de 2026. Status de agregador não prova chamada aberta; confira o prazo e a página da marca.

## Ligações

[[Mídia Kit e Publis]] · [[Variável só no .env.local]]
