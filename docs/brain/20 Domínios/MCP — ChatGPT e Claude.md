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
| Mapa do creator | `creatorMap.ts` |
| Rotas | `/api/mcp/*` |

## A regra de conversa

`conversationPolicy.ts` **não é detalhe**: é o produto. Ele decide o que o assistente pode dizer, quando pede o Norte, e o que nunca deve fazer — nomeadamente, **nunca vender plano, preço ou upgrade, e nunca mandar pro checkout**. Mexer nessa política é mexer no posicionamento, não no código.

## O mapa alimenta as respostas (desde 06/09/2026)

Por um bom tempo o `MapaSeed` era lido no MCP em **um lugar só** — `collabIntelligence.ts`, para casar parceiros — e nunca para responder ao próprio criador. As respostas no Claude e no ChatGPT saíam de categoria de classificação, sem camada narrativa: duas Data2Content respondendo a mesma pergunta de jeitos diferentes.

Hoje:

- **`get_creator_map`** devolve narrativa, territórios, temas, assets, tom e formatos — mais o **nível de evidência** (`declared` / `one_reading` / `two_readings`), que é o que autoriza tratar a narrativa como firme. Visível a qualquer conta que tenha mapa, mesma regra de `evaluateMapaAccess`.
- **`list_content_ideas`** devolve as pautas já ancoradas em narrativa e território. **Pro apenas** — a recusa aponta o perfil e nunca oferta plano.
- **`get_creator_intelligence_snapshot`** carrega o resumo do mapa e avisa em `coverage` quando ele falta ou a narrativa não está firme.
- O **vocabulário viaja junto com o dado**: sem isso o modelo trata "humor" como território e credencial como asset.

## Atalhos de conversa

Cinco prompts registrados, que aparecem prontos no cliente: `what_to_post`, `is_it_worth_posting`, `weekly_review`, `find_collab`, `script_from_idea`. Nenhum deles fala de plano ou preço — um teste trava isso.

## O inventário de inteligência

`intelligenceContract.ts` é o registro público do que o MCP se compromete a expor. Ele **já esteve completamente defasado**: citava nove ferramentas inexistentes e nenhuma das reais, porque o teste só conferia se a lista estava vazia.

Agora cada camada declara um `status`, e um teste em `server.test.ts` confere nome por nome contra as ferramentas registradas de verdade. Ao renomear ferramenta, o teste quebra — que é o ponto.

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
