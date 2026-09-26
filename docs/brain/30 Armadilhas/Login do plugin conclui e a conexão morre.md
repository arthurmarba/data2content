---
tipo: armadilha
custo: semanas
resolvido: sim
---

# Login do plugin conclui e a conexão morre

## O sintoma

A OpenAI recusou a versão 1.0.0 do plugin com "não foi possível concluir seu login ou fluxo OAuth". Para o revisor, o login pela opção "Acesso de revisão" e a tela "Autorizar conexão" funcionavam — e depois nada. No Claude, o conector do Arthur mostrava "Insufficient scope" no mesmo período.

## A causa

`authenticateMcpRequest` exigia **todos** os scopes de `getMcpConnectionScopes()` em cada chamada ao `/api/mcp`. Quem não tinha um deles recebia 403 em tudo, não só na ferramenta que o usava.

Dois caminhos levavam a um token sem o conjunto inteiro:

- **O ChatGPT pede os scopes que as ferramentas declaram** em `securitySchemes`. Nenhuma declara `strategy:read` nem `audience:read` (são sempre alternativas), então o token do revisor nunca os trazia. Em 22/09/2026, das 18h12 às 18h19 UTC, ele autorizou sete vezes com os mesmos nove scopes; todas morreram depois do consentimento (`mcp_oauth_refresh_tokens`, cliente `d2c_mcp__qm43Ew…`).
- **Conexão antiga não ganha scope novo.** Quem conectou antes de `campaigns:read` entrar ficou de fora.

## A correção

Desde 25/09/2026 (`14ece4d8`) a entrada exige só `getMcpRequiredScope()` (`profile:read`), como o MCP admin. Cada ferramenta cobra o seu via `scopeRequiredResult`. O teste com os nove scopes exatos do revisor está em `adminAuthIsolation.test.ts`.

**Ao criar ferramenta nova, ponha o `hasScope` dela** — a entrada não protege mais por você.

## Como descobrir da próxima vez

Os logs da Vercel guardam cerca de um dia; a revisão acontece semanas depois. O banco guarda: `mcp_oauth_clients` (quem se registrou), `mcp_oauth_consent_requests` e `mcp_oauth_refresh_tokens` (quem autorizou, quando e com quais scopes). Filtrar pelo `userId` da conta `openai-review-pro@`.

## Parente

No portal da OpenAI, `Advanced settings → Default scope override` já foi removido duas vezes (08/09 e 26/09) e voltou. Conferir antes de cada envio.
