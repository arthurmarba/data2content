---
tipo: armadilha
custo: semanas
resolvido: sim
---

# Esquema com `.refine()` publica a ferramenta sem campos

## O sintoma

Uma ferramenta do MCP existe, funciona no teste chamando direto, e nenhum assistente consegue usá-la: na lista de ferramentas ela aparece com entrada `{"type":"object","properties":{}}`. A Anthropic apontou isso em `compare_public_instagram_creators` e `record_script_feedback` em 29/09/2026 — as duas estavam assim no ChatGPT também.

## A causa

`buildToolDescriptor` (em `server.ts`) passa o esquema por `normalizeObjectSchema` do SDK. Ele reconhece `z.object(...)`, mas não `z.object(...).refine(...)` — o refine embrulha o objeto num `ZodEffects`. Sem reconhecer, a lista publica o objeto vazio.

## A correção

O esquema de entrada é sempre `z.object` simples. Regra que cruza campos (dois @s iguais, "informe ao menos uma avaliação") vai para dentro da ferramenta e volta como erro com código claro (`duplicate_usernames`, `feedback_required`).

O teste de `server.test.ts` confere os campos publicados das duas ferramentas nos dois chats. **Ao criar ferramenta nova, não use `.refine()` no `inputSchema`.**
