---
tipo: domínio
---

# Seguidores — quantos entram e saem por dia

## O que é

O saldo diário de seguidores de cada criador, e quanto cada conteúdo trouxe de
gente nova. Até 07/09/2026 o sistema sabia dizer **quantos seguidores alguém
tem**, mas não **quantos ganhou ontem**.

## Onde mora

| Peça | Caminho |
| --- | --- |
| Total de seguidores no tempo | `src/app/models/AccountInsight.ts` (`followersCount`) |
| Saldo por dia | `src/app/lib/followers/dailyFollowerGrowth.ts` |
| Ponte para o MCP | `src/app/lib/mcp/followerGrowth.ts` |
| Saldo por criador na base | `src/app/lib/mcp/adminAnalytics.ts` |
| Seguidores por post | `Metric.stats.follows` |
| Coleta | `src/app/lib/instagram/api/fetchers.ts`, `config/instagramApiConfig.ts` |

## O dado que já existia e ninguém usava

A cada sincronização do Instagram, o sistema grava um `AccountInsight` com o
total de seguidores do momento. Isso acontece desde 14/05/2025 e roda umas três
vezes por dia. São 31 mil leituras guardadas.

Ou seja: a série sempre esteve lá. Faltava a subtração.

## A regra: o Instagram não conta ganho, ele conta total

Nenhuma métrica da API devolve "seguidores ganhos no dia" para a janela que a
gente quiser. O que a API devolve é o total naquele instante. O ganho é uma
diferença que **nós** calculamos — e por isso ele carrega três honestidades que
não podem ser apagadas por conveniência de tela:

**É saldo, não conquista.** Já vem descontado quem deixou de seguir. Falar
"ganhou 40 seguidores" quando o número é 40 líquido esconde que talvez 90 tenham
entrado e 50 saído. Dia negativo é informação, não erro de coleta.

**Dia sem leitura não é dia de saldo zero.** Se a sincronização falhou na terça,
a variação de quarta cobre dois dias. A série declara isso em `daysCovered` e
**não divide** o ganho entre os dias — dividir seria inventar um número para a
terça. Zero significaria "ninguém seguiu", que é uma afirmação diferente de "não
medimos".

**Sem leitura antes do período, não há primeiro dia.** Falta referência. De novo:
diferente de não ter crescido.

**O dia de hoje ainda não acabou.** Às nove da manhã, o "fechamento" de hoje é
uma manhã. Comparado com dias inteiros, hoje seria eleito o pior dia da série
todo santo dia. Por isso o dia em curso vem com `dayIsComplete: false`, fica fora
de melhor/pior dia e da contagem de dias negativos, e aparece separado em
`inProgressDay`.

## O buraco da referência

Na base real, 58 criadores tinham leitura nos últimos 30 dias, mas só 38 tinham
também leitura nos 30 dias **anteriores** à janela. Exigir referência prévia
descartava um terço deles.

A saída foi medir a partir da primeira leitura de dentro do período quando não há
anterior, dizendo em `measuredFromDate` onde a conta começou — o saldo cobre menos
dias, e `creatorsMeasuredFromInsidePeriod` conta quantos estão assim. Isso levou a
cobertura de 36 para 55 dos 56 criadores com post.

Quem tem uma leitura só no período continua sem saldo: início e fim seriam o mesmo
número, e o zero resultante seria mentira com cara de estabilidade.

## Por conteúdo

`Metric.stats.follows` é quantas pessoas passaram a seguir a partir daquele post.
A API entrega para FEED e Stories. Para **Reels ela não estava sendo pedida** —
justamente o formato que mais traz gente nova era o que não media. Em 07/09/2026
o `follows` entrou na lista de Reels.

O risco disso é específico e vale saber: a chamada de insights é atômica. Uma
métrica que a API recuse derruba a leitura inteira daquele post — alcance,
visualizações, interações, tudo. Por isso `fetchMediaInsights` ganhou uma
salvaguarda: se a API recusar uma métrica marcada como opcional, ele repete sem
ela e guarda a recusa para o resto da execução. Custa uma chamada extra por
sincronização, no pior caso, e nunca custa o post.

Se dentro de alguns dias `stats.follows` continuar aparecendo só em posts de
imagem, é a API dizendo que não entrega para Reels — e a resposta certa é aceitar,
não insistir.

## No Claude e no ChatGPT

- `get_follower_growth` — a série diária do próprio criador.
- `get_creator_follower_growth` — a mesma coisa, no MCP administrativo.
- `analyze_creator_portfolio` — saldo por criador e o total da base, com
  `sortBy: "follower_gain"`.
- `list_top_content` com `metric: "follows"` — qual conteúdo trouxe mais gente.

## Conferir

```bash
npm run smoke:mcp-admin-portfolio   # inclui a série diária no banco real
npx jest src/app/lib/followers      # as regras de honestidade da série
```

## Ligações

[[MCP — ChatGPT e Claude]] · [[Instagram e métricas]] · [[Relatório Semanal]]
