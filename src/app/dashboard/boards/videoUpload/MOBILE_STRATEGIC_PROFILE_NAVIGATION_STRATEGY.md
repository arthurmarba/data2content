# Mobile Strategic Profile Navigation Strategy

## Visão geral

O mobile app-first da D2C deve começar pelo Perfil Estratégico, com `+` como ação central e Comunidade como destino existente.

O Perfil é a home mobile porque concentra identidade, Diagnóstico vivo, leitura comercial interna e pontes para recursos existentes. A navegação real de produção não muda nesta fase.

## Estrutura de navegação

```text
[Perfil]   [+]   [Comunidade]
```

## O que cada item faz

### Perfil

- home mobile futura;
- lugar do Perfil Estratégico;
- Diagnóstico vivo do creator;
- Comercial como leitura interna;
- Mídia Kit como bridge/modal.

### +

- ação central;
- inicia análise temporária;
- atualiza o Perfil;
- volta para o Perfil;
- não é aba;
- não é destino permanente.

### Comunidade

- destino existente da Data2Content;
- não recriada nesta linha;
- sem nova superfície social neste PR.

## O que fica fora da bottom nav

- Mídia Kit;
- Diagnóstico;
- Comercial;
- Vídeos analisados;
- Campanhas/CRM;
- Calculadora;
- Configurações.

Mídia Kit é bridge/modal. Diagnóstico e Comercial são abas internas do Perfil. Vídeos analisados não devem virar arquivo visual permanente no produto mobile.

## Auth behavior futuro

Usuário não logado:

- Perfil -> `LoginClient` com `intent=strategic_profile`;
- `+` -> `LoginClient` com `intent=analyze_video`;
- Comunidade -> login/community existente.

Este PR apenas modela a intenção. Não altera `LoginClient`, NextAuth ou callback real.

## Mídia Kit

Mídia Kit é recurso existente, acessado por modal/bridge a partir do Perfil.

Não alterar `MediaKitView`, dashboard real de Mídia Kit ou rota pública de Mídia Kit nesta etapa.

## Comunidade

Comunidade é destino existente.

Não recriar Comunidade, página social, chat, comentários, creators públicos, posts ou mídia kits públicos novos neste PR.

## Riscos

- `ActivationPendingWidget` pode competir visualmente com bottom nav, botão central `+`, CTAs do Perfil e modal de Mídia Kit;
- a sidebar mobile atual já tem comportamento sensível e precisa de integração cuidadosa;
- pode haver duplicidade com a home atual;
- pode surgir pressão para transformar análises em arquivo visual permanente;
- o botão `+` pode virar aba se a decisão de ação central não ficar explícita;
- Mídia Kit e Comunidade podem aparecer duplicados se forem adicionados à bottom nav e mantidos em entradas existentes.

## Decisões futuras

- definir quando integrar a navegação real;
- decidir como esconder, reposicionar ou transformar o `ActivationPendingWidget` no app mobile;
- decidir se o widget fica apenas desktop, acima da bottom nav ou condicionado ao estado de onboarding;
- migrar a home mobile para Perfil sem quebrar o dashboard atual;
- revisar `src/app/dashboard/components/sidebar/config.tsx` com cuidado antes de qualquer alteração real.

### ActivationPendingWidget conflict

Risco identificado: o widget de ativação atual pode competir com bottom nav, botão `+`, CTAs do Perfil, modal de Mídia Kit, fluxo de análise e safe area.

Estratégia temporária: não renderizar esse widget dentro da preview do Perfil e não alterar produção nesta fase.

Recomendação futura: quando a navegação mobile real for integrada por feature flag, preferir ocultar o widget flutuante no app mobile e transformar ativação em card interno do Perfil, preservando comportamento desktop se necessário.

## Fora de escopo

- produção;
- sidebar real;
- `DashboardShell` ou `BoardShell`;
- Mídia Kit real;
- `MediaKitView`;
- Comunidade real;
- `LoginClient`;
- NextAuth;
- upload/storage;
- persistência;
- Gemini real;
- Instagram real;
- billing real.
