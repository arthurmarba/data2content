---
tipo: domínio
---

# MCP — a Data2Content dentro de outros chats

## O que é

Uma porta que deixa o ChatGPT e o Claude conversarem com a inteligência da Data2Content: o criador pergunta lá, o dado vem daqui.

## Onde mora

| Peça | Caminho |
| --- | --- |
| Servidor | `src/app/lib/mcp/server.ts` |
| Catálogo de ferramentas | `catalog.ts` |
| Estado da conta | `accountState.ts` |
| Política de conversa | `conversationPolicy.ts` |
| Inteligências | `creatorIntelligence.ts`, `contentIntelligence.ts`, `scriptIntelligence.ts`, `collabIntelligence.ts`, `campaignRadar.ts` |
| Norte do criador | `creatorNorth.ts` |
| Login (OAuth) | `src/app/lib/mcp/oauth/`, `auth.ts` |
| Permissões | `entitlement.ts`, `toolAuthorization.ts` |
| Administrativo (só leitura) | `adminServer.ts`, `adminCatalog.ts`, `adminAuthorization.ts`, `adminAudit.ts` |
| Qualidade | `qualityEvals.ts` |
| Rotas | `/api/mcp/*` |

## A regra de conversa

`conversationPolicy.ts` **não é detalhe**: é o produto. Ele decide o que o assistente pode dizer, quando pede o Norte, e o que nunca deve fazer — nomeadamente, **nunca vender plano, preço ou upgrade, e nunca mandar pro checkout**. Mexer nessa política é mexer no posicionamento, não no código.

## Situação do ChatGPT

O plugin depende de aprovação da OpenAI e de um plano caro. Por isso a landing pública fala **só do Claude** até o aplicativo ser aprovado. Ver [[ChatGPT fora da landing]].

## Chaves de ambiente

`MCP_ADMIN_ENABLED`, `MCP_CAMPAIGN_RADAR_ENABLED`, `MCP_SUPPORTED_SCOPES`, `MCP_CONNECTION_SCOPES`, `MCP_ADMIN_*`.

## Conferir

```bash
npm run test:mcp            # a suíte
npm run eval:mcp            # qualidade das respostas
npm run typecheck:mcp       # tipos (tsconfig próprio)
npm run smoke:mcp-oauth     # o login
```

## Ligações

[[Pautas e Roteiros]] · [[Collabs]] · [[ChatGPT fora da landing]]
