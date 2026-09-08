---
tipo: decisão
área: Instagram e métricas
---

# Histórico diário conserva oito meses e uma referência

Arthur aprovou em 07/09/2026 a limpeza e retenção de `daily_metric_snapshots`:

- Conservar oito meses **de calendário**, calculados em `America/Sao_Paulo` pelo relógio do MongoDB.
- Para cada post, conservar também o snapshot mais recente anterior ao corte. Mesmo um post com todos os registros antigos mantém essa referência.
- Apagar somente os demais snapshots anteriores ao corte. Um TTL simples no campo `date` não atende: apagaria a referência protegida.
- Preservar usuários, posts (`metrics`), métricas consolidadas, análises, roteiros, relatórios e registros financeiros. Status de assinatura não entra no filtro.
- PDFs do mídia kit são cache de 30 minutos; documentos vencidos devem expirar pelo índice TTL `expiresAt` com `expireAfterSeconds: 0`.

O comando `npm run maintenance:mongo-storage` simula por padrão. Aplicação autorizada:

```bash
npm run maintenance:mongo-storage -- --apply --expected-db=data2content --ensure-pdf-ttl
```

O comando usa o driver nativo (sem criação automática de índices por importação de modelos), salva e verifica uma cópia recuperável dos snapshots antes da exclusão e trabalha em lotes de 250. Revalida a identidade, a data e `updatedAt` de cada registro ao apagar; alterações concorrentes são preservadas. Confere as referências protegidas e a contagem dentro da janela após a execução.

Cópias em `output/mongodb-maintenance/<execução>/`, ignoradas pelo Git: `snapshots-removiveis.ejsonl.gz` usa EJSON canônico para conservar ObjectIds, datas e tipos numéricos; `resultado.json` guarda SHA-256, contagem verificada e os resultados; `referencias-preservadas.ejson` identifica os registros protegidos. Antes de restaurar, conferir SHA e usar EJSON com `{ relaxed: false }`; a restauração deve inserir somente IDs ausentes, sem sobrescrever registros existentes. Não executar restauração automática junto da retenção.

A rotina diária está ativa às 10h pelo Codex neste computador, ID `reten-o-di-ria-do-mongodb`, não como rota publicada na Vercel. Depende do computador ligado, projeto local, credenciais e aplicativo disponíveis; em uma migração futura para QStash/cron, desativar a rotina local para não duplicar execução. O TTL de PDFs foi aplicado diretamente no MongoDB e independe dessa rotina local.

Primeira execução: 129.238 snapshots e 51 PDFs removidos, 151,32 MB de documentos. As 7.321 referências anteriores e os 178.991 snapshots na janela foram conferidos. A ocupação de dados + índices caiu de aproximadamente 517 para 392 MB; índices cresceram durante a exclusão, então não confundir bytes de documentos removidos com redução líquida instantânea da cota. Simulação posterior encontrou zero candidatos.

[[Instagram e métricas]] · [[Filas e rotinas]] · [[Expiração declarada não garante limpeza no MongoDB]]
