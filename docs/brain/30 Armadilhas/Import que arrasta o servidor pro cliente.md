---
tipo: armadilha
custo: "next dev" quebrado sem explicação
---

# Importar serviço de servidor dentro de componente de cliente

## O sintoma

Você adiciona um `import` num arquivo com `"use client"` e o `npm run dev` quebra com um erro que não fala de nada disso.

## A causa

`audienceInsightsService.ts` (e serviços parecidos) carregam coisas de servidor — o `winston`, por exemplo. Importar **valor** dele num componente de cliente arrasta a biblioteca inteira pro pacote do navegador, e o empacotador desiste.

## O que fazer

- Importe só **tipo**: `import type { ... }`.
- Ou use o módulo enxuto feito pra isso: `audienceTerritoryLabels.ts`.
- Regra geral: componente de cliente conversa com o servidor **por rota de API**, não por import.

## Ligações

[[Mídia Kit e Publis]] · [[Card de audiência trava]]
