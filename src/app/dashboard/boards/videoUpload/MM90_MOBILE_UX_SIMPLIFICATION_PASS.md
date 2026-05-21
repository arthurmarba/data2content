# MM90 — Mobile UX Simplification Pass

Status: implementado.

## Decisão de produto

A experiência mobile real da Data2Content deve parecer um app de direção estratégica para creators, não um mockup de celular nem uma ferramenta técnica de upload. O Perfil é a casa da leitura; o vídeo é o gatilho; a pergunta do creator define intenção; o contexto rápido ajuda a interpretar; o resultado volta para o Perfil.

## Experiência mobile real

- A rota real usa o `NarrativeMapMobileShell` como referência visual.
- A superfície real ocupa a tela como app e não usa moldura preta de aparelho.
- O preview interno pode manter device frame, state switcher e fixtures para QA.
- A navegação mobile global continua limitada a `Perfil` e `Comunidade`.
- As abas internas do Perfil continuam `Mapa`, `Leituras` e `Oportunidades`.
- `Nova leitura` não é item de menu global.

## Status Card do Perfil

O Perfil usa um Status Card compacto, não um balão flutuante. Ele resume estado, consequência e próximo passo:

- Free sem leitura: `Perfil em construção`, CTA `Analisar meu primeiro vídeo`.
- Free com leitura usada: `Leitura grátis usada`, CTA `Assinar Pro`.
- Pro sem Instagram: `Pro ativo`, CTA principal `Conectar Instagram`, CTA secundário `Nova leitura`.
- Pro com Instagram: `Pro ativo`, texto de quota mensal e CTA `Nova leitura`.
- Pro com limite usado: `Limite mensal usado`, CTA `Ver leituras`.
- Pagamento pendente ou ação necessária mantém CTA financeiro claro.

Pro sem Instagram não fica bloqueado para nova leitura; conectar Instagram melhora a precisão do Perfil.

## Nova leitura estratégica

O fluxo mobile foi ajustado para:

1. Intro: `Nova leitura estratégica`.
2. Upload: `Escolha o vídeo`.
3. Pergunta aberta: `O que você quer entender?`.
4. Contexto rápido: respostas reais em botões.
5. Processamento: `Analisando sua narrativa`.
6. Confirmação: `Leitura pronta`.

A pergunta aberta entra como `creatorGoal`. As sugestões rápidas definem `selectedGoalOption` sem substituir a intenção livre do usuário. O contexto rápido envia `quickAnswers` reais, selecionadas pelo usuário.

## Mídia Kit e Comunidade

- Mídia Kit fica dentro do Perfil, no topo de `Oportunidades`.
- Quando disponível, mostra ações claras: `Copiar link`, `Ver como marca`, `Abrir Mídia Kit`.
- Quando falta Instagram, mostra `Conectar Instagram`.
- Comunidade continua marketplace/lista de creators.
- O banner de consultoria é compacto: Free vê `Assinar e entrar`; Pro vê `Entrar`.
- A rota canônica mobile de Comunidade usada por CTAs é `/planning/discover`.

## Segurança

MM90 não altera motor de IA, provider/parser, persistência segura, Stripe, NextAuth, DashboardShell, BoardShell, sidebar ou `MediaKitView` público.

A UI continua sem expor vídeo bruto persistido, thumbnail persistente, `signedUrl`, `uploadUrl`, `objectKey`, `localPath`, `storageProviderPath`, raw response, raw transcript ou transcript longa.
