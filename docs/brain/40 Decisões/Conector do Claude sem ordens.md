---
tipo: decisão
área: MCP
status: em vigor desde 29/09/2026
---

# No Claude, o servidor descreve e entrega dados; não dá ordens

Em 29/09/2026 a Anthropic devolveu a submissão do diretório de conectores. As instruções do servidor mandavam o Claude "seguir conversationPolicy", repetir um lembrete com link ao fim de toda resposta de conta gratuita, mostrar o convite da comunidade uma vez e só mencionar limitações quando pedissem. Para o diretório, isso é o servidor dirigindo o assistente por fora da conversa, e **mover a ordem para dentro da resposta de uma ferramenta não resolve**.

## A regra

Quando a conexão vem do Claude (`clientSurface === "claude"`, decidido pelo registro OAuth em `clientSurface.ts`):

- **Instruções** (`buildClaudeServerInstructions`): o que cada ferramenta faz e quando serve, o vocabulário do mapa como definição e como ler os dados. Menos de 1.900 caracteres; o portal cortou a versão anterior por volta de 2.040.
- **Respostas:** saem, em qualquer profundidade, `instruction`, `usage`, `nextAction`, `technicalDetail(Audience)`, `conversationPolicy`, `onboardingPrompt` e `closingReminder`. Saem também do formato declarado de cada ferramenta, senão a validação da biblioteca recusa a resposta.
- **Conta gratuita:** sem lembrete no fim. O limite continua voltando como erro com o código do recurso e o link do perfil, como dado.
- **Collab:** a descrição diz que só aparece quem ativou "aparecer para collab" e que métricas privadas nunca saem.

Tudo mora em `src/app/lib/mcp/claudeDirectoryPolicy.ts` e entra por um ponto só, o `registerTool` de `server.ts`.

## Por que só no Claude, por enquanto

A OpenAI estava revisando a versão enviada em 26/09 com as instruções antigas. Mudar o que o ChatGPT vê no meio da revisão arriscava desencontrar da cópia guardada lá. Depois do veredito da OpenAI, a intenção é unificar — as diretrizes de lá também preferem dado a ordem.

## O que vale para os dois

- **Campos de entrada publicados.** `compare_public_instagram_creators` e `record_script_feedback` usavam `.refine()` no esquema de entrada; a montagem da lista não reconhece esquema refinado e publicava "sem campos". A checagem foi para dentro da ferramenta. Ver [[Esquema com refine publica ferramenta sem campos]].
- **Ranking de collab só com quem aceitou.** `buildCollabCreatorSuggestions({ onlyCollabDiscoveryOptIn: true })` no MCP. Antes, o ranking complementar pegava qualquer assinante com Instagram conectado. É privacidade de terceiros, não regra de loja.

## Custo

O lembrete ao fim das respostas gratuitas era peça do [[Funil do plugin]]. No Claude ele deixa de existir; o caminho para o site passa a ser só o link devolvido quando um recurso está fora do plano.

## Conferir

`npm run test:mcp` — `claudeDirectoryPolicy.test.ts` mede as instruções e procura verbos de ordem; `server.test.ts` confere, no Claude, que nenhuma ferramenta declara campo de ordem e que as duas ferramentas publicam seus campos nos dois chats.

## Ligações

[[MCP — ChatGPT e Claude]] · [[Funil do plugin]]
