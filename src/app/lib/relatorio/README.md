# Relatório Semanal

Toda segunda, um relatório de 21 telas com a análise da semana que fechou, por
território. Três funções ao mesmo tempo: entrega semanal para a base, roteiro da
reunião de quinta, e peça de aquisição.

## Como rodar

```bash
npm run relatorio:fechar:dry-run          # calcula e escreve o JSON, sem congelar
npm run relatorio:fechar                  # congela o snapshot da última semana fechada
npm run relatorio:fechar -- --week=2026-W30
npm run relatorio:render -- --report=output/relatorio-semanal/2026-W30/report.json
```

`RELATORIO_TERRITORIOS=paternidade,casa-real,cozinha,treino` fixa os quatro
territórios da reunião. Sem essa variável, os quatro são escolhidos por volume.

## A arquitetura

**O mapa é o dicionário. A semana é a medição.**

O card "Seu Mapa" registra, por criador, o território dele, a narrativa, os assets de
vida e o tom. Esse card muda devagar — é declaração. O relatório pega os posts da última
semana e avalia **quais desses elementos do mapa apareceram** e com que resultado. As
categorias nunca são derivadas dos posts.

| Elemento | Fonte |
|---|---|
| **Território** | `mapa.territorios` → registro canônico. O post herda o território de quem postou. |
| **Narrativa** | `mapa.narrativa_central` — a frase que resume o mapa |
| **Asset de vida** | `mapa.assets`, traduzido para PAPEL pelo registro (Regra 3) |
| **Assunto** | `mapa.temas` → assunto canônico. **Não** é `contentIntent`, que é intenção |
| **Tom de fala** | `mapa.tom` → registro canônico |
| **`context` do post** | só **evidência**: confirma ou contradiz o mapa |

**Assunto ≠ intenção.** `contentIntent` diz o que o post TENTA fazer ("Ensinar",
"Converter"); `mapa.temas` diz sobre o que ele É ("Sair do trabalho a tempo de viver a
vida familiar"). Numa reunião, a segunda lista é a que gera conversa. O `contentIntent`
sobrou só como fallback enquanto o post não foi avaliado, e some sozinho quando for.

**O multiplicador se explica em português.** Cada tabela carrega uma `reading` derivada
do próprio número (`describeFinding.ts`) — *"O post típico com look montado recebeu 2,4
vezes mais comentários por pessoa alcançada do que o post típico de
Maternidade/Paternidade nesta semana."* Existe porque a régua muda por métrica e o `×`
esconde isso: curtidas/comentários/compartilhamentos/salvamentos são **por pessoa
alcançada** contra o território; retenção é contra o **esperado para a duração**;
alcance é contra o **próprio criador**.

Território é **domínio de vida** (substantivo): Paternidade, Cozinha, Treino. `humor`
sozinho não é território — é tom. Mas `humor de casal` é: carrega um domínio dentro.

**A ordem do registro é mecanismo, não estilo.** A primeira regra que casa ganha, então o
mais específico vem antes: `saude-mental` → `autocuidado` → `bem-estar` (senão
"autocuidado e bem-estar" cairia no residual), e `maternidade` antes de todos (senão
"autocuidado materno" perderia o recorte mais forte).

A **Regra 3** é aplicada no registro e em nenhum outro lugar. O mapa real contém
`a esposa (Lívia Linhares)`, `a filha (Liv)`, `animais (cavalo)`. O relatório diz
`parceiro em cena`, `filho em cena`, `animal em cena` — e um teste garante que o rótulo
pessoal nunca escapa para o slide.

```bash
npm run relatorio:auditar-mapa   # cobertura do registro contra os mapas reais
```

## As decisões que não são óbvias

**A semana é a entrega; a janela de 90 dias é a comparação.** A base real tem ~140
posts e ~31 criadores ativos por semana. Um ranking calculado só sobre 7 dias tem
células de n=1. Então:

| | vem de |
|---|---|
| o número da linha e as ocorrências | a semana |
| o direito de a linha existir | a janela (≥8 aparições, ≥3 criadores) |
| a base do 1,0× | a semana (mediana do território) |
| a linha de base de retenção | a janela |
| o movimento (▲3 / ▼2 / novo) | o snapshot de 3 semanas atrás |

**A base do 1,0× é da SEMANA, não da janela.** Com denominador de 90 dias, uma semana
em que o território caiu joga toda linha abaixo de 1,0 e a risca preta de corte deixa
de separar "puxa pra cima" de "puxa pra baixo".

**Mediana em tudo, e winsorização no p90.** As métricas são de cauda pesada. Com média,
a primeira matriz gerada com dado real trouxe "alcance 148×" — um post que viralizou,
virando propriedade do elemento porque era o único da semana naquela faixa.

**Retenção tem duas leituras, de propósito.** No ranking de assunto/tom ela é
corrigida pela duração (senão premia vídeo curto); no gráfico de duração ela é crua
(corrigir ali achataria o gráfico cujo eixo é a duração).

**Alcance é comparado com o próprio criador.** Alcance varia três ordens de grandeza
entre criadores do mesmo território.

**O corte de janela pressupõe janela classificada.** O corte de elegibilidade exige ≥8
ocorrências em 90 dias. Se só a semana corrente estiver com a cena avaliada, ele
efetivamente exige ≥8 ocorrências *na semana* — muito mais duro que o desenhado. Medido:
em Maternidade, 8 papéis passavam o corte da semana e só 3 o da janela. Por isso o
backfill de 3–4 semanas vale a pena uma vez; depois o cron acumula sozinho.

**Território não abre tela com menos de 3 criadores.** Com 2, as quatro telas saem
vazias: o corte de ranking exige ≥2 criadores por elemento e duas pessoas não produzem
elemento compartilhado. Quatro slides em branco custam mais que um território a menos.

**A previsão é derivada do ranking, não escrita.** O candidato é o elemento que funciona
muito (≥1,4×) e ainda é pouco adotado (≤60% do território). Nascendo do ranking, a frase
e os elementos que a semana seguinte vai medir não podem divergir. Ver `buildPrediction.ts`.

**O snapshot é irrecuperável.** `Metric.stats` é cumulativo e reescrito a cada sync, então
o ranking de uma semana passada não pode ser reconstruído com os números que ela tinha.
Semana que não roda o `close-week` é perdida para sempre.

## Estado hoje

| Tela | Status |
|---|---|
| 01 capa · 02 territórios · 19 comparação · 20 destaques | ✅ com dado real |
| 04 assuntos · 05 grade/duração/vídeos · 06 matriz | ✅ com dado real |
| 02/21 previsão | ✅ estrutura pronta; resultado aparece na 2ª semana de operação |
| 03 lista de narrativas | ✅ do mapa — a frase de cada criador do território |
| 03 ranking de assets | ✅ com dado real (papéis do mapa confirmados no vídeo) |
| 04 tom do mapa | ✅ onde a avaliação de cena cobriu; vazio e explicado onde não |
| 06 pautas | ✅ uma por elemento forte, cruzada com a narrativa do mapa |
| 21 previsão | ✅ derivada do ranking, gravada para a semana seguinte medir |
| 02 resultado da previsão | ✅ a partir da 2ª semana de operação |

### Assets de vida

`Metric.sceneElements` é preenchido conferindo o mp4 do reel **publicado** contra o mapa
daquele criador. A pergunta é FECHADA — em vez de "classifique este vídeo", o prompt leva
os 5–8 itens do mapa dele, com o rótulo que ele mesmo escreveu, e pergunta quais
aparecem. Mais barato, mais preciso, e é o que faz o relatório medir o mapa.

**Custo real medido** (82 chamadas, semana 29): **US$ 0,0042 por vídeo** — US$ 0,35 pela
semana inteira. Um pouco abaixo da estimativa de US$ 0,005.

**Não faça backfill de 90 dias.** O corte de elegibilidade olha a janela de 90 dias e a
janela INCLUI a semana corrente, então classificar só a semana já popula o ranking: na
primeira execução, `casa` saiu com 42 ocorrências em 15 criadores, `filho_em_cena` com 22
em 8. O cron `relatorio-semanal-cenas` roda domingo 22h, antes do close-week.

### O teto de cobertura, medido

Na janela de 90 dias há **3.485 vídeos**. O que dá para classificar:

| | vídeos | |
|---|---|---|
| Criadores COM token | ~1.280 | 37% — o teto real |
| **Sem `instagramAccessToken`** | **2.202** de **40 criadores** | **63% — inalcançável** |

Sem token não há como baixar o mp4. O efeito é concentrado, não diluído: **Treino tem 4
criadores e nenhum com token**, então aquele território não terá asset nenhum por mais
que se classifique. Maternidade perde 5 dos 13.

Reconectar esses 40 criadores vale mais que qualquer ajuste no motor.

O backfill filtra por criadores com token e ordena do mais NOVO para o mais antigo — a
Graph API deixa de servir `media_url` para mídia antiga, e sem esses dois cuidados o
`--limit` era consumido por posts que nunca passariam (numa execução de 800, 685 pulados
por falta de token e 1 lido).

Vídeos acima de 14MB vão pela **Files API** em vez de inline — o part inline viaja em
base64, que infla 33%, e o request do Gemini para em 20MB. Sem esse caminho o relatório
perderia ~20% dos vídeos.

```bash
npm run relatorio:cenas:dry-run           # 5 vídeos, sem gravar
npm run relatorio:cenas -- --limit=200    # lote com teto de custo
```

O gasto real é auditável, não estimado — cada chamada entra em `GeminiUsageLog` com a
tag `cena`:

```js
db.geminiusagelogs.aggregate([{$match:{tag:"cena"}},{$group:{_id:null,
  in:{$sum:"$promptTokens"},out:{$sum:"$outputTokens"},n:{$sum:1}}}])
```

### Narrativas

`narrativesOfTerritory` lista a narrativa de cada criador do território que postou na
semana. Como cada narrativa é uma frase própria ("um pai que busca equilíbrio e qualidade
de vida perto da família"), duas pessoas raramente têm a mesma — então a contagem é 1 por
narrativa. Agrupar frases distintas numa narrativa compartilhada é curadoria, não string
matching; até existir, a lista mostra as narrativas reais.

## Arquivos

```
mapRegistry.ts        o registro canônico: territórios, papéis de asset, tons
mapProfiles.ts        o mapa de cada criador, resolvido para o canônico
territories.ts        seleção dos territórios da semana + ponte de evidência
types.ts              WeeklyReportData — a fronteira cálculo × apresentação
weekWindow.ts         semanas ISO em America/Sao_Paulo, janela, grade dia×faixa
postMetrics.ts        Metric → as 7 métricas; faixas de duração; mediana e percentil
retentionBaseline.ts  linha de base de retenção por duração e de alcance por criador
rankingEngine.ts      a tabela de ranking com os 7 padrões do §6
collectTerritory.ts   as 4 telas de um território
collectPlatform.ts    capa, visão geral, comparação, destaques
buildReport.ts        junta tudo num WeeklyReportData
loadWindow.ts         a única leitura de banco
weeklyReportService.ts fecha a semana e grava o snapshot
sceneEvaluation.ts    confere um reel publicado contra o mapa do criador
```

Render e operação em `scripts/relatorio-semanal/`; cron em
`src/app/api/cron/weekly-report-close`; worker de cena em
`src/app/api/worker/classify-published-scene`.
