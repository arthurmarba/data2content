---
tipo: armadilha
custo: script de manutenção morre antes da primeira linha
---

# Script com `tsx` não acha o `server-only`

## O sintoma

Você roda um script de `scripts/` com `tsx --env-file=.env.local` e o Node morre
antes de começar:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'server-only'
imported from src/app/lib/community/communityInvite.server.ts
```

O script não tem nada a ver com comunidade. Em 02/10/2026 foi o
`refresh:metrics:user`, que só queria atualizar métricas do Instagram.

## Por que acontece

`server-only` não é um pacote instalado: o Next traz o dele embutido e resolve
sozinho no build. Fora do Next ele não existe, então qualquer arquivo com
`import "server-only"` quebra o script que chegar até ele — por mais longe que
esteja.

A corrente daquele dia:

```
scripts/refreshMetricsByUser.ts
→ lib/instagram (até o dataSyncService direto)
→ instagram/db/connectionManagement.ts   (avisa por e-mail quando a conexão cai)
→ lib/emailService.ts                    (importava todos os templates no topo)
→ emails/proWelcome.ts                   (põe o link do grupo VIP no e-mail)
→ community/communityInvite.server.ts    (import "server-only")
```

Começou em 14/08/2026, quando o link VIP passou a ser protegido. Desde então,
todo script que encostasse no `emailService` estava quebrado sem ninguém notar.

## O que fazer

Não tire o `import "server-only"`: ele impede que o link VIP vá parar no
navegador. Corte a corrente no ponto em que um arquivo usado por scripts puxa o
protegido. No `emailService`, o template do Pro agora é carregado dentro de
`sendProWelcomeEmail` (`await import(...)`), não no topo do arquivo.

Também não adianta apontar `server-only` para um arquivo vazio no
`tsconfig.json`: o Next lê os mesmos caminhos e a proteção poderia sumir em
silêncio.

Outros arquivos com o mesmo cadeado: `billing/serverBillingPrices.ts`,
`cpmBySegment.ts`, `ai/cpmDynamicService.ts`. Script que precise deles cai na
mesma rasteira.

## Como achar a corrente rápido

O erro só diz quem importou o `server-only`, não quem trouxe esse arquivo. Um
gancho de resolução do Node (`module.register`) carregado depois do `tsx`, que
anota cada par "quem importou → o que foi importado", reconstrói o caminho em
uma rodada. Rodar o script com `--help` basta: a falha acontece antes de
qualquer código executar.

Ligações: [[Script com tsx não enxerga import nomeado do mongoose]] ·
[[Import que arrasta o servidor pro cliente]] · [[Instagram e métricas]]
