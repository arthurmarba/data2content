---
tipo: armadilha
custo: dias
resolvido: sim
---

# Esquema com `.refine()` some na lista de ferramentas do MCP

## O sintoma

A ferramenta aparece no Claude ou no ChatGPT, mas o assistente não manda nenhum filtro, ou manda
qualquer coisa: na lista de ferramentas ela foi publicada **sem campos**. Nada quebra no servidor.

## A causa

Quando o `inputSchema` de `registerTool` é um esquema zod com `.refine()` (vira `ZodEffects`), a
montagem da lista não reconhece o formato e publica um objeto vazio. Aconteceu duas vezes:
`compare_public_instagram_creators` (comentário em `publicInstagramResearch.ts`) e
`search_external_creators` do MCP admin, que ficou sem campos de #916 até #935.

## A correção

Publique um `z.object(...)` simples e valide as regras de combinação dentro do handler, devolvendo a
mensagem do zod como erro (ver `marketplaceSearchInputSchema` x `marketplaceSearchSchema`). O teste
"exposes only read-only administrative tools" em `adminServer.test.ts` falha se qualquer ferramenta do
MCP admin sair sem campos.
