# Radar — varredura manual de 07/09/2026

Levantamento das oportunidades de publicidade abertas no Brasil hoje, feito à mão para alimentar o
relatório em PDF. Complementa `radar-coleta-gratuita-operacao.md` (política de coleta) e
`campaign-radar-report-mvp.md` (fluxo do relatório).

## Por que a varredura foi manual

A revisão de 07/09/2026 desligou a coleta automática de quase todas as origens. Rodando
`npm run campaign-radar:collect` hoje, o resultado é **2 oportunidades** (Up!ABC e Tijuca Geek):
Influencer Brasil, Squid, Creator Ads, PlayNest, 99Freelas e Animextreme retornam bloqueadas antes
da rede. No mesmo dia, só a Influencer Brasil tinha **37 projetos públicos, 19 deles ativos**. O
relatório não fica desatualizado por falta de oportunidade no mercado; fica por falta de permissão
de coleta registrada.

## O que está aberto hoje

Lote pronto para importar: `output/campaign-radar/2026-09-07/varredura-manual.json` — 75 candidatas,
todas nascendo pendentes de revisão.

| Origem | Candidatas | Observação |
| --- | --- | --- |
| Influencer Brasil | 18 | Projetos marcados "Ativo" na listagem pública, com investimento e vagas publicados. Prazos entre 08/09 e 31/12/2026; dois sem prazo. |
| 99Freelas | 35 | Projetos de UGC e creator em vídeo, achados com 20 termos de busca em 210 projetos varridos. Valor e prazo não aparecem na listagem; a proposta exige conta. |
| The Insiders Brasil | 2 | Permuta. "A TAL DA CASTANHA" e aparadores/barbeadores Philips com "Inscreva-se!" na vitrine pública. |
| POPline Creators | 1 | Entrada única para a plataforma: a home lista campanhas ativas de festivais e gravadoras (Rock in Rio, AFROPUNK, Primavera Sound, Universal Music), sem cachê nem prazo públicos. |
| Workana | 13 | Projetos públicos de UGC com faixa de valor em dólar. O site recusa requisição automatizada; leitura só por navegador. |
| Brasil Game Show | 1 | Credenciamento de influenciadores aberto até 19/09 para o evento de 09 a 12/10. Permuta: credencial de cobertura, sem cachê. |
| Threads (posts públicos) | 4 | Chamadas de marca publicadas por contas de recrutamento; a candidatura passa por grupo de WhatsApp de terceiro. |
| Keune Creators | 1 | Squad de marca com formulário público; ver ressalva abaixo. |

Os valores da Influencer Brasil aparecem como **investimento do projeto** para N vagas. Nenhum deles
foi gravado como cachê individual confirmado, conforme a regra do catálogo.

## Marcas montando squad de creators

Confirmado com página pública e candidatura verificável:

- **Keune Creators** — ciclos trimestrais, bônus por vendas, comissão e cupom. O formulário do Google
  está publicado, mas o texto da página ainda anuncia resultado "na primeira quinzena de abril":
  confirmar com a marca qual ciclo está aberto antes de publicar.

Confirmado como notícia, ainda **sem link de candidatura verificado** — não entrou no lote:

- **Creators MBOOM** (04/09/2026) — comunidade da marca de beleza; cadastro anunciado, mas o site
  oficial não expõe a página de inscrição; provavelmente vive no perfil do Instagram.
- **Vizzela Team** — aceita perfis a partir de 1.000 seguidores; o endereço de cadastro citado
  (`minhaloja.vizzela.com.br/cadastro`) não respondeu na verificação de hoje.
- **Dermage** — programa de influenciadores por comissão e cupom; a plataforma existe, o endereço
  exato não foi confirmado.
- **Lola Creators Club** — a seleção para a Beauty Fair 2026 encerrou em 20/08; o clube continua.
- **Acelera CB (Casas Bahia)** e **Forever Lover (Forever Liss)** já estão no catálogo como
  `uncertain` desde a edição de 01/09.

## Origens novas registradas

O registro saiu de 14 para **47 origens**. Todas as novas entram como monitoramento, com distribuição
pendente e coleta automática desligada — cadastrar não liga nada, só evita pesquisar de novo. A
leitura humana dessa lista, com o que cada origem entrega sem login, está em
[`radar-fontes-verificadas.md`](radar-fontes-verificadas.md).

As quatro que mais rendem:

- `the-insiders-public-campaigns` — vitrine pública diz quais campanhas estão abertas; briefing e
  contrapartida exigem login. Permuta.
- `popline-creators-public-campaigns` — nomes das campanhas ativas são públicos; cachê e prazo não.
  Território de música, festival e cultura pop, que nenhuma outra origem cobre.
- `achapubli-public-feed` — agregador com feed público (`data_new.json`, sem login) trazendo marca,
  entregas e link de candidatura. **Cuidado:** as 283 entradas seguem marcadas como `active`, mas
  nenhuma foi publicada depois de março de 2026. O campo de status não prova chamada aberta.
- `portalg-oportunidades` — portal editorial com RSS que noticia squads e clubes de creators. Serve
  para descobrir a chamada; o link de candidatura precisa ser confirmado na página da marca.

Entraram também, na segunda rodada: **Workana** (projetos públicos, como o 99Freelas),
**Brasil Game Show**, **CCXP**, **gamescom latam**, **Beauty Fair** e **Virada Cultural SP** (a
família de credenciamento de creator em evento, que a Up!ABC e o Tijuca Geek já ocupavam), e
**Keune Creators** como primeiro squad de marca com formulário público.

## Origens verificadas que não rendem oportunidade

- **Squid** — a comunidade pública não publica campanha nova desde 31/07/2026.
- **Bloomer**, **The Creator**, **Creatify**, **Inbazz**, **PlayNest**, **Publify**, **Unfy**,
  **Buzzcreators**, **Vulse**, **Publion**, **AirFluencers**, **Get Influencer** — as campanhas só
  aparecem depois do cadastro.
- **Skeepers** e **BrandLovrs** — bloqueiam a leitura pública (desafio de bot).
- **Creator Ads** — o Linktree usado como vitrine não existe mais (`Page Not Found`).
- **TAG Creator** — a página de campanhas é portfólio de 2022.
- **Publipost** — o mural público lista creators disponíveis, não campanhas de marca.
- **MIS** — segue só no aplicativo, com captura manual.
- Falsos positivos que aparecem nas listas de "sites de publi" e não são: **Kolab** (RH),
  **FameBit** (descontinuada), **GetNinjas**, **Maxfluency** e os programas de afiliado de
  marketplace.

## Como fechar o PDF a partir daqui

1. Revisar as 41 candidatas em `/admin/campaign-radar` (importação por lote JSON), ou pelo caminho de
   linha de comando, usando `output/campaign-radar/2026-09-07/review-decisions.template.json` como
   molde — todas as decisões nascem `pending` de propósito.
2. `npm run campaign-radar:review -- --input=.../varredura-manual.json --decisions=.../review-decisions.json`
3. `npm run campaign-radar:report -- ...` e `npm run campaign-radar:validate`.

O gerador recusa lote com qualquer item pendente; isso é o desenho, não um erro.

### Edição de 07/09 já gerada

`output/pdf/radar-d2c-2026-09-07.pdf` — 39 páginas, 71 campanhas e 2 programas.

A revisão que destravou o gerador está em `review-decisions.json`, assinada como
`varredura-claude-2026-09-07` para não se passar por decisão editorial do Arthur. Regra aplicada:
aprovada toda chamada com página pública conferida hoje; rejeitadas as duas do Threads em que um
comentário na própria chamada dizia que o grupo de jobs estava fechado ou lotado. Para mudar
qualquer veredito, basta editar esse arquivo e repetir os dois comandos.

O validador acusa `missingTitles` para a campanha de climatizadores: o título é longo e o card o
corta com reticências, então a comparação exata falha. Conferido no texto do PDF — o card está lá.
Links e termos proibidos passaram limpos, e as 39 páginas foram inspecionadas em imagem.

## O que decidir para a próxima edição

A varredura manual não escala: 75 candidatas custaram uma sessão inteira. As duas saídas são pedir
autorização escrita às origens que já rendem volume (Influencer Brasil, 99Freelas e Workana concentram 66 das
75) ou revisar a coleta gratuita delas nos moldes do que foi feito com Up!ABC e Tijuca Geek. Sem uma
das duas, o relatório continua dependendo de captura à mão.
