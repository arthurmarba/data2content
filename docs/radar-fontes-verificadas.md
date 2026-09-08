# Radar — catálogo de origens verificadas

Lista de tudo que já foi conferido à mão, para ninguém repetir a pesquisa. Cada linha diz o que a
origem entrega **sem login** e o que fazer com ela. Última rodada: **07/09/2026**.

O registro operacional (com robots, termos e situação de distribuição) fica em
`src/app/lib/campaignRadar/sourceRegistry.ts` — 47 origens hoje. Esta nota é a leitura humana dele.
Quem encontrar origem nova, cadastra lá **e** acrescenta a linha aqui.

## 1. Rende oportunidade hoje, em página pública

| Origem | O que dá pra ver sem conta | Cuidado |
| --- | --- | --- |
| Influencer Brasil | Listagem de projetos com investimento, vagas, prazo e categoria | O "investimento" é do projeto para N vagas, não o cachê do creator |
| 99Freelas | Projetos de UGC e vídeo, com descrição e prazo | Muita vaga de edição no meio; filtrar quem grava. Uma busca só devolve pouco: 20 termos ("ugc", "atriz", "apresentador", "depoimento", "porta voz"...) renderam 210 projetos, 35 deles para quem aparece na câmera |
| Workana | Projetos de UGC com faixa de valor em dólar | Responde 403 a requisição automatizada: só leitura por navegador. Paginar até a página 3 dobra o resultado |
| The Insiders Brasil | Vitrine diz quais campanhas estão abertas | Permuta; briefing e prazo só depois do login |
| POPline Creators | Nomes das campanhas ativas de música e festival | Cachê e entregas não aparecem sem conta; os cards não têm link próprio (tudo aponta para /register), então a plataforma entra como uma linha só |
| AchaPubli | Feed JSON público com marca, entregas e link | **Parado desde março/2026**; `status: active` não prova chamada aberta |
| Portal G (RSS) | Notícias de squads e clubes de creators | Não traz link de candidatura; confirmar na página da marca |

## 2. Público, porém parado ou só vitrine

| Origem | Situação em 07/09/2026 |
| --- | --- |
| Squid (#VidadeInfluencer) | Sem campanha nova publicada desde 31/07/2026 |
| TAG Creator | A página "Campanhas" é portfólio de 2022 (Chilli Beans, Adobe, Realme) |
| Publipost | O "Mural dos Creators" lista creators disponíveis, não campanhas de marca |
| Creator Ads | O Linktree usado como vitrine não existe mais |
| CreatorGPT | Páginas `/campanha/<id>` abrem sem login, mas não há índice público; `creatorgpt.com.br` não resolve, o ativo é `mycreatorgpt.com` |

## 3. A campanha existe, mas só dentro da conta

Unfy · Buzzcreators · Publion · Vulse · AirFluencers · Get Influencer · Bloomer · The Creator ·
Creatify · Inbazz · Publify · PlayNest · MIS · Influency.me · Noovid · Comû Delas · Creators LLC.

Para essas, o caminho não é coleta: é parceria, e-mail oficial ou o próprio creator encaminhando o
que recebe. Spark entra na mesma lista como agência — seleção por projeto, sem vitrine.

## 4. Bloqueadas por proteção antibot

Skeepers e BrandLovrs devolvem desafio de bot para qualquer requisição automatizada. Só dá para
olhar com navegador, e ainda assim as campanhas ficam na área logada.

## 5. Eventos com credenciamento de creator — o calendário

Família que a Up!ABC e o Tijuca Geek já ocupam no radar. Vale conferir na janela indicada:

| Evento | Janela do credenciamento | Situação hoje |
| --- | --- | --- |
| Brasil Game Show | Pedidos até 19/09, evento 09–12/10/2026 | **Aberto** — categoria própria de Influenciadores |
| CCXP | Costuma abrir semanas antes; CCXP26 é 3–6/12 | Conferir a partir de outubro |
| Beauty Fair | 27/07 a 10/08, análise até 01/09 | Encerrado; repete em julho |
| gamescom latam | Primeiro trimestre | Edição 2026 já realizada |
| Virada Cultural SP | Abril/maio, formulário próprio para influenciadores | Encerrado; repete a cada edição |

A Beauty Fair puxa junto as seleções das marcas de beleza (Lola, Hidramais): olhar as duas coisas na
mesma semana.

## 6. Squads e clubes de marca

| Marca | Situação | Falta |
| --- | --- | --- |
| Keune Creators | Formulário público, ciclos trimestrais, bônus e comissão | Confirmar qual ciclo está aberto |
| Creators MBOOM | Cadastro anunciado em 04/09/2026 | Link de inscrição; o site oficial não expõe |
| Vizzela Team | Aceita a partir de 1.000 seguidores | O endereço de cadastro citado não respondeu |
| Dermage | Programa por comissão e cupom | Endereço exato da plataforma |
| Lola Creators Club | Seleção da Beauty Fair encerrou em 20/08 | Acompanhar a próxima chamada |
| Acelera CB (Casas Bahia) · Forever Lover (Forever Liss) | Já no catálogo como `uncertain` desde 01/09 | Confirmação de chamada aberta |

O padrão dos squads: a marca anuncia no Instagram e na imprensa, e o formulário some no link da bio.
O RSS do Portal G é hoje a melhor pista pública para esse tipo de chamada.

## 7. Falsos positivos — não voltar a checar

- **Kolab** (`kolab.com.br`) — plataforma de recrutamento e testes de RH, nada a ver com creators.
- **FameBit** — descontinuada; virou YouTube BrandConnect, que não tem vitrine pública.
- **Maxfluency** — endereço responde com aplicação vazia, sem produto no ar.
- **GetNinjas** — marketplace de serviços; aparece nas listas de "sites de publi" por engano.
- **Programas de afiliado de marketplace** (Amazon, Shopee, Mercado Livre, Hotmart) — cadastro
  permanente de afiliado, não campanha com prazo. Outra categoria de produto, se um dia entrar.
- **Upfluence, Influence.co, Buzzoole** — do lado da marca ou fora do Brasil.
- **Freelancer.com.br** — parece irmão do 99Freelas e do Workana, mas a listagem não abre sem login.

## 8. A camada de rede social e WhatsApp — como se olha

O feed do AchaPubli mostrou que 98 das vagas dele vieram de WhatsApp. Essa camada existe e é a maior;
o que faltava era saber por onde entrar. Testado em 07/09/2026:

| Superfície | Abre sem login? | Como olhar |
| --- | --- | --- |
| Post do Threads | **Sim** — texto, data, respostas e "Threads relacionadas" | Buscar termos de recrutamento restritos a `threads.com` e abrir o post |
| Perfil do Threads | Não — a grade pede login | Chegar pelo post, não pelo perfil |
| Perfil do Instagram | Não — a grade pede login | Mesma busca, ou o creator da comunidade encaminhando |
| Canal de WhatsApp | **Em parte** — nome, descrição e a última atualização | Espiada de monitoramento; não é histórico |
| Grupo de WhatsApp | Não — o convite só mostra o nome | Entrar é ato humano; depois é encaminhar para o radar |

Contas que publicam chamada com frequência: `@maisinfluencer` (a mais constante), `@laurasouzaolv`,
`@clubepatroa`, `@nexa.creators`, `@thaismassuchetto`, `@parceirosweb_`, `@bondcreators_`.

Na coleta de 07/09 saíram **doze chamadas** dessa camada, das quais quatro ainda de pé e já no lote:
cerveja com evento em Recife no dia 19/09, eletrônicos com prioridade para moda, cosméticos capilares
e haircare no Rock in Rio. As outras oito (móveis planejados no Sul, pet, seguros com futebol, São
João, feriado de 7 de setembro, suplementos, squad de beleza, TikTok Shop) já tinham passado da data
ou eram de meses atrás — o post fica no ar depois que a campanha fecha, então **a data do post é
obrigatória** na leitura.

Sinal útil: os comentários denunciam o estado real da porta. Numa das chamadas, um creator escreveu
"o grupo tá fechado, não permite entrada"; em outra, "a comunidade já está cheia".

**Duas ressalvas antes de usar isso no relatório.** O post quase nunca traz briefing, prazo ou marca:
ele manda para um grupo de WhatsApp de terceiro — ou seja, a rede social entrega a *porta*, não a
oportunidade. E parte desses grupos cobra do creator pelo acesso às vagas (o canal conferido pedia
R$ 29,99). Mandar creator para uma porta paga é decisão de produto, não de coleta.

**A saída que escala** não é raspar essa camada — é receber dela: o creator da comunidade encaminha a
publi que já chega no WhatsApp dele, e a tela `/admin/campaign-radar` transforma em candidata. É o
único inventário que nenhuma plataforma concorrente tem, e é o mesmo caminho da Central de Publis.

## 9. Ainda não verificado

Telegram, as agências que recrutam por formulário aberto e os perfis agregadores do Instagram um a
um. X segue fora por API paga; a busca da API do Threads segue desligada — o que foi liberado aqui é
leitura manual de post público, coisa diferente.
