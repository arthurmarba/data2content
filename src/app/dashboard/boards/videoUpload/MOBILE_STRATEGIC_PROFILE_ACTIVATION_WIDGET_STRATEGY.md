# Mobile Strategic Profile Activation Widget Strategy

## Visão geral

O ActivationPendingWidget é útil na experiência atual, mas pode competir com a nova navegação mobile app-first do Perfil Estratégico.

Este documento define a estratégia futura sem alterar o widget real.

## Estado atual

Sem alterar produção, o comportamento atual deve ser tratado como:

- widget fixo no mobile;
- aparece próximo ao rodapé;
- pode expandir ou minimizar;
- pode executar ações reais em produção;
- usa camada visual alta.

Arquivos relacionados, apenas para contexto:

- `src/app/dashboard/components/activation/ActivationPendingWidget.tsx`;
- `src/app/dashboard/components/activation/useActivationChecklist.ts`;
- `src/app/dashboard/components/sidebar/config.tsx`.

## Conflitos com o Perfil Estratégico

O widget pode competir com:

- bottom nav;
- botão `+`;
- CTAs do Perfil;
- modal de Mídia Kit;
- fluxo de análise;
- safe area.

## Políticas possíveis

- manter em produção por enquanto;
- ocultar na experiência mobile app-first futura;
- transformar em card interno;
- manter só desktop;
- reposicionar com safe area;
- controlar por feature flag.

## Recomendação atual

- não alterar produção agora;
- não renderizar o widget dentro da preview do Perfil;
- em futura integração mobile, preferir ocultar o widget flutuante e transformar ativação em card interno do Perfil.

## Integração futura

- só mexer depois de a navegação real do Perfil ser implementada;
- usar feature flag;
- testar com bottom nav e modal de Mídia Kit;
- preservar desktop se necessário;
- validar o fluxo de análise com o widget ausente, oculto ou transformado em card.

## Fora de escopo

- alteração do widget real;
- alteração de `useActivationChecklist`;
- alteração de navegação real;
- alteração de billing;
- alteração de Instagram;
- alteração de Mídia Kit;
- endpoint, upload, storage ou persistência;
- Gemini real.
