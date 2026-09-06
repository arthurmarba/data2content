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
| Fechar à mão | `npm run relatorio:fechar` (tem `--dry-run`) |
| Renderizar | `npm run relatorio:render` |
| Auditar o mapa | `npm run relatorio:auditar-mapa` |

## As duas janelas

A semana **entrega**; os 90 dias **comparam**. Um número da semana só significa alguma coisa medido contra a mediana do próprio criador no trimestre — nunca contra outro criador, nunca contra média de mercado.

Para não deixar um vídeo fora da curva distorcer tudo, o motor usa **mediana** e apara o topo (percentil 90).

## A regra que mais se esquece

> **O mapa é o dicionário.**

Território, narrativa, asset e tom vêm do card "Seu Mapa" — **não da legenda do post**. O registro canônico só agrupa o que o mapa já nomeou. Ver [[O mapa é o dicionário]].

## O que não volta

O fechamento da semana grava um retrato do momento. **Esse retrato é irrecuperável**: se fechar errado, não dá pra reconstruir depois com os dados de hoje. Use `--dry-run` antes.

## Assets de cena

A leitura de cena e tom sai do vídeo publicado, lido pelo Gemini (`npm run relatorio:cenas`, com `--dry-run`). Custo na casa de meio centavo de dólar por vídeo.

## Ligações

[[Seu Mapa]] · [[O mapa é o dicionário]] · [[Classificação de conteúdo]]
