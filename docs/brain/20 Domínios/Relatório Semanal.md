---
tipo: domínio
---

# Relatório Semanal — a consultoria virando documento

## Cuidado: são dois relatórios

Confundir os dois é o erro mais comum desta área.

| | **Individual** | **Por território** |
| --- | --- | --- |
| De quem fala | Um criador | A comunidade inteira num assunto |
| Quem escreve o julgamento | O modelo de linguagem | Ninguém — é determinístico |
| Ferramenta | Galileia (`/galileia`) | TrendReport (`/trendreport`) |
| Modelo no banco | `StrategicReport`, `WeeklyReportPrediction` | `WeeklyTerritoryReport` |

## Onde mora

| Peça | Caminho |
| --- | --- |
| Motor | `src/app/lib/creatorWeeklyReport/engine.ts` |
| Padrões e veredito | `patternSections.ts`, `patternVerdict.ts`, `patternHighlights.ts`, `patternActions.ts` |
| Contexto | `patternContextService.ts` |
| Geração pela fila | `/api/worker/generate-creator-weekly-report` |
| Fechamento no relógio | `/api/cron/weekly-report-close`, `/api/cron/creator-weekly-reports` |
| Fechar à mão | `npm run relatorio:fechar` (tem `--dry-run` e `--aceitar-numeros-de-hoje`) |
| Números congelados | `relatorio/statsFreeze.ts` (regras), `statsFreezeStore.ts` (banco), modelo `WeeklyStatsFreeze` |
| Renderizar | `npm run relatorio:render` |
| Auditar o mapa | `npm run relatorio:auditar-mapa` |

## As duas janelas

A semana **entrega**; os 90 dias **comparam**. Um número da semana só significa alguma coisa medido contra a mediana do próprio criador no trimestre — nunca contra outro criador, nunca contra média de mercado.

Para não deixar um vídeo fora da curva distorcer tudo, o motor usa **mediana** e apara o topo (percentil 90).

## A regra que mais se esquece

> **O mapa é o dicionário.**

Território, narrativa, asset e tom vêm do card "Seu Mapa" — **não da legenda do post**. O registro canônico só agrupa o que o mapa já nomeou. Ver [[O mapa é o dicionário]].

## O que não volta — e o que completa depois

O fechamento da semana (segunda 01h, `closeWeek`) grava um retrato do momento. Desde 27/09/2026 ele também **congela os números** de cada post da semana em `WeeklyStatsFreeze`, antes de calcular. A regra:

> **O que estava medido na segunda fica; o que faltava completa depois.**

- **Números** (alcance, curtidas, retenção…) entram congelados no primeiro fechamento que encontra o post com alcance ou visualização. Nunca são reescritos. Post ainda sem número espera o próximo fechamento.
- **Leitura de cena** (assunto, tom, asset, gancho) entra em qualquer refechamento. Por isso refechar com `?week=` ou `npm run relatorio:fechar -- --week=<semana>` dias depois, quando a leitura alcançar a semana, é seguro: completa a leitura sem trocar os números da segunda pelos do dia.
- **Todo post entra**, classificado ou não. A classificação da legenda só alimenta formato e a evidência "a legenda sugere outro território"; território vem do mapa, números não dependem de IA, e assunto/tom/asset vêm da leitura de cena. Até 26/09 o fechamento descartava post pendente — a W38 perdeu 108 de 397 posts assim.
- **Cobertura**: cada retrato guarda `coverage` — posts, com número, congelados, classificados, com leitura de cena e quando os números foram congelados. O comando `relatorio:fechar` imprime isso.
- **Variação de engajamento** compara os números congelados de cada semana (posts de 1 a 7 dias contra posts de 1 a 7 dias). Semana sem congelamento cai nos números do dia.
- **Previsão ao refechar**: a aposta da semana anterior é medida de novo só se foi esta semana que a resolveu; aposta desta semana que a seguinte já mediu não é reescrita.

**Semana fechada antes do congelamento (até 2026-W38) não tem números guardados.** Refechá-la grava os números do dia, e o fechamento recusa sem `--aceitar-numeros-de-hoje` (na rota, `aceitarNumerosDeHoje=1`). Use `--dry-run` antes.

O que continua com o número do dia num refechamento: as linhas de base de 90 dias (retenção esperada por duração, alcance típico do criador, média própria dos destaques), que usam posts antigos. Muda pouco — post antigo quase não cresce.

Se a IA ficar sem saldo, drene a fila antes de segunda 01h BRT com `npm run requeue:classification-retryable -- --week=<semana> --write --enqueue`: sem classificação não há leitura de cena. Ver [[Crédito do Gemini paralisa a leitura publicada]] e [[Retrato da semana gravado sem números]].

## Assets de cena

A leitura de cena e tom sai da mídia publicada: vídeos, fotos e carrosséis são
lidos pelo Gemini (`npm run relatorio:cenas`, com `--dry-run` para apenas listar).
O worker e o comando compartilham a renovação das URLs assinadas do Instagram.
O custo medido em setembro foi de aproximadamente US$ 0,015 por vídeo; o custo de
imagens depende da quantidade de slides. Confira `GeminiUsageLog` entre lotes.

## Ligações

[[Seu Mapa]] · [[O mapa é o dicionário]] · [[Classificação de conteúdo]]

## Formatos e carrosséis (11/09/2026)

A leitura visual preserva todos os itens, inclusive páginas adicionais da Graph API.
Vídeos internos são enviados como vídeo, com áudio; não são substituídos por capas.
`PublishedContentEvidence.slides` conserva posição, tipo, função, descrição, texto
visível e fala exclusiva do vídeo daquele item. `visualCoverage` informa total e
completude. Os campos temporais de compatibilidade ficam nulos nas imagens.

A leitura só conclui quando todos os itens foram baixados e constam da resposta.
Há limites de tamanho por arquivo e timeout; ultrapassá-los registra a pendência,
sem cortar slides silenciosamente. O limite inline considera o pedido inteiro;
arquivos excedentes usam a Files API.

Foto e carrossel não têm retenção nem duração de vídeo no nível do post. A sincronização
limpa esses campos e os consumidores de relatórios e MCP ignoram valores antigos
incompatíveis. Reels e vídeos de feed têm referências separadas na comparação individual.
No MCP, as transcrições dos vídeos internos seguem o mesmo pedido explícito de
transcrição da leitura de Reels, sem misturar a fala de slides numa timeline global.
