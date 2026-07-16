# Design system mobile — Creator Studio

Este documento é o contrato visual do app mobile. A landing e o produto compartilham a mesma linguagem: papel quente, tinta quase preta, rosa como ação primária, Bricolage Grotesque em títulos e Instrument Sans em texto e controles.

## Fonte da verdade

- Tokens CSS e camada de compatibilidade: `src/design-system/tokens.css`
- Tokens tipados para estilos inline e SVG: `src/design-system/tokens.ts`
- Primitivos React: `src/design-system/primitives.tsx`
- Curvas e durações: `src/design-system/motion.ts`
- Catálogo visual local: `/debug/design-system`
- Auditoria: `npm run design-system:audit -- --strict`

O container raiz de qualquer experiência mobile deve receber `d2c-mobile-app` e as variáveis de fonte de `d2cFontVariables`. Isso garante que páginas carregadas dentro ou fora do shell principal tenham a mesma tipografia e os mesmos tokens.

## Regras de uso

1. Use tokens semânticos (`brand`, `paper`, `surface`, `text`, `line`, `success`, `warning`, `danger`) em vez de nomes de cor ou hexadecimais.
2. Use Bricolage somente para títulos, marcos narrativos e números de destaque. Corpo, labels, campos e botões usam Instrument Sans.
3. Rosa identifica a ação principal da tela. Ações secundárias usam tinta, superfície neutra ou variante ghost; não introduza um segundo acento concorrente.
4. Cards existem apenas quando agrupam conteúdo ou uma ação. Prefira hierarquia por tipografia e espaçamento a empilhar caixas.
5. Controles interativos devem ter alvo mínimo de 44 × 44 px, foco visível e rótulo acessível.
6. Sheets usam `BottomSheet` ou as classes `ds-scrim`, `ds-sheet` e `ds-sheet__handle`. Devem responder a Escape e declarar `role="dialog"`/`aria-modal`.
7. Animações usam os tokens de movimento e respeitam `prefers-reduced-motion`.

## Paleta de categorias e dados

As antigas doze cores do `CATEGORY_MAP` foram reduzidas a uma paleta semântica da marca. Rosa, coral e laranja podem diferenciar categorias; verde, âmbar e vermelho ficam reservados para estados. Cores literais remanescentes em SVGs, gráficos ou arte decorativa são permitidas quando representam dados ou ilustração, mas não podem definir navegação, CTA, tipografia, fundo de tela, card, campo ou overlay.

## Cobertura da migração

- Shell raiz, safe areas, cabeçalhos, tab bar e menu de conta
- Perfil, mapa narrativo, cards, detalhes e estados vazios
- Feed, deck, detalhes, salvas, combinadas e match de Collabs
- Onboarding, conexão do Instagram, upload e análise de vídeo
- Calculadora, Mídia Kit, paywall, sheets, modais e overlays utilitários
- Rotas standalone de preview, que recebem o mesmo escopo visual do app real

A camada de compatibilidade em `tokens.css` mantém componentes legados coerentes enquanto eles são extraídos para os primitivos compartilhados. Ela não é autorização para criar novas classes de cor: código novo deve consumir tokens/primitivos diretamente.

## Padrões de alto impacto

- **Perfil:** “Seu Mapa” e “Sua Audiência” são áreas editoriais de trabalho, com uma superfície principal, divisores internos e chips neutros. Rosa marca somente seleção e próxima ação.
- **Novo vídeo:** o botão central sempre traz o rótulo “Analisar”. O fluxo abre como sheet, começa por uma área de upload reconhecível e mantém contexto, consentimento e progresso no mesmo percurso.
- **Pagamento:** no mobile, a assinatura abre pela base da tela. Mostra proposta contextual, período, preço, no máximo três benefícios e uma única ação primária; listas promocionais repetidas não devem voltar.

## Checklist de entrega

- Conferir os estados normal, carregando, vazio, erro, bloqueado e concluído.
- Conferir largura de 390 px, safe areas, teclado e rolagem do sheet.
- Navegar do onboarding ao Perfil e de Collabs aos overlays sem quebra visual.
- Rodar testes direcionados, `npm run typecheck`, auditoria estrita e build.
- Atualizar o catálogo visual ao adicionar ou alterar um primitivo.
