---
tipo: armadilha
status: resolvido em 03/09/2026
---

# Produção já saiu de uma branch que não era o `main`

## O que aconteceu

Houve um período em que os deploys saíam de uma branch de Codex, não do `main`. Existiam **duas linhas de MCP em paralelo** e o que estava no ar não era o que se lia no `main`.

Resolvido em **03/09/2026**, mantendo a linha que estava no ar.

## Por que continua valendo

Porque o hábito que causou isso — desenvolver em branches paralelas de agente — continua. Ao investigar comportamento de produção, **confirme de qual branch aquele deploy saiu** antes de acreditar no código que você está lendo.

## Ligações

[[Trabalho pronto e nunca enviado]]
