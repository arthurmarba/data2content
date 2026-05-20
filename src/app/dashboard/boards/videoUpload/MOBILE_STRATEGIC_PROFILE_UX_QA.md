# Mobile Strategic Profile UX QA

## Visão geral

Esta checklist valida a experiência mobile do Perfil Estratégico antes de qualquer integração real.

Frase-guia:

> O Perfil da D2C é o diagnóstico vivo do creator. Cada vídeo analisado atualiza esse perfil.

Objetivo do QA:

- confirmar que o Perfil parece a casa mobile do app;
- confirmar que o usuário entende a relação entre Perfil, diagnóstico vivo e análise de vídeo;
- validar que `+` é ação central, não aba;
- validar que Mídia Kit e Comunidade seguem como recursos existentes;
- impedir dependência visual de histórico de vídeos ou dashboard espremido;
- registrar achados antes de polish/copy ou integração real.

Documentos relacionados:

- `MOBILE_STRATEGIC_PROFILE_NAVIGATION_STRATEGY.md`
- `MOBILE_STRATEGIC_PROFILE_ACTIVATION_WIDGET_STRATEGY.md`

## Setup da preview

URL base:

- `/dashboard/boards/mobile-strategic-profile-preview`

Feature flag:

- `NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED=1`

Requisito de acesso:

- usuário `admin/dev`;
- preview interna apenas;
- nenhuma navegação real deve ser alterada durante este QA.

## Estados obrigatórios da preview

- Anonymous profile: `/dashboard/boards/mobile-strategic-profile-preview?state=anonymous_view_profile`
- Anonymous analyze: `/dashboard/boards/mobile-strategic-profile-preview?state=anonymous_analyze_video`
- Account only: `/dashboard/boards/mobile-strategic-profile-preview?state=account_only`
- First reading free: `/dashboard/boards/mobile-strategic-profile-preview?state=first_reading_free`
- Premium without Instagram: `/dashboard/boards/mobile-strategic-profile-preview?state=premium_without_instagram`
- Instagram optimized: `/dashboard/boards/mobile-strategic-profile-preview?state=instagram_optimized`
- Media Kit available: `/dashboard/boards/mobile-strategic-profile-preview?state=media_kit_available`

## Critérios do topo do Perfil

- [ ] O topo parece um perfil social, não um dashboard.
- [ ] Nome, handle e bio aparecem com clareza.
- [ ] Status pills explicam estado, não métrica técnica.
- [ ] Não aparecem “18 sinais”, “3 narrativas” ou percentual de perfil.
- [ ] CTA principal está claro.
- [ ] Botão `+` é entendido como ação de análise.

## Critérios do Auth Gate

- [ ] Usuário anônimo não vê Perfil fake.
- [ ] Copy de Perfil orienta criar Perfil Estratégico.
- [ ] Copy de `+` orienta analisar primeiro vídeo.
- [ ] Preview não chama login real.
- [ ] Preview não importa `LoginClient`.
- [ ] Intenção futura de callback fica clara.

## Critérios do Perfil em construção

- [ ] Estado não parece vazio.
- [ ] Usuário entende que já tem uma casa no app.
- [ ] CTA “Analisar primeiro vídeo” aparece cedo.
- [ ] Comercial aparece como limitado/construção.
- [ ] Mídia Kit não aparece como disponível sem condição.
- [ ] Não há sensação de erro ou bloqueio agressivo.

## Critérios da primeira leitura gratuita

- [ ] Entrega valor real.
- [ ] Mostra diagnóstico inicial.
- [ ] Mostra próximo passo.
- [ ] Sugere Instagram sem parecer obrigatório.
- [ ] Não parece relatório longo.
- [ ] Não tenta parecer perfil completo.

## Critérios do premium

- [ ] Parece mais completo que free.
- [ ] Diagnóstico tem profundidade.
- [ ] Comercial aparece como tradução estratégica.
- [ ] Não promete marca, publi ou match.
- [ ] Instagram é apresentado como precisão futura, não obrigação.

## Critérios do Instagram optimized

- [ ] Mostra leitura mais precisa.
- [ ] Mostra Instagram conectado.
- [ ] Não promete performance.
- [ ] Não afirma uso de dados reais se for mock/preview.
- [ ] Mídia Kit disponível aparece como bridge quando aplicável.

## Critérios do Mídia Kit modal

- [ ] Mídia Kit não é aba principal.
- [ ] Modal abre a partir da ação de Mídia Kit.
- [ ] Modal parece ponte para recurso existente.
- [ ] Não cria Mídia Kit mobile novo.
- [ ] Não altera `MediaKitView`.
- [ ] Não mostra diagnóstico interno.
- [ ] Não mostra ponto fraco, quiz, sinais pendentes ou recomendações internas.
- [ ] Botões são visuais/local preview only.
- [ ] Sem clipboard real.
- [ ] Sem Web Share API.
- [ ] Sem `window.open`.
- [ ] Sem navegação automática.

## Critérios do fluxo +

- [ ] `+` do header abre fluxo.
- [ ] `+` da bottom nav abre o mesmo fluxo.
- [ ] Botão “Analisar vídeo” abre o mesmo fluxo.
- [ ] Botão “Analisar primeiro vídeo” abre o mesmo fluxo.
- [ ] Fluxo é curto.
- [ ] Fluxo parece temporário.
- [ ] Confirmação diz “Diagnóstico atualizado.”
- [ ] Volta para o Perfil.
- [ ] Não cria recibo longo.
- [ ] Não cria página final.
- [ ] Não cria histórico de vídeos.
- [ ] Não mostra upload real.
- [ ] Não usa `FileReader`.
- [ ] Não usa `fetch`.
- [ ] Não usa storage.

## Critérios de navegação

- [ ] Bottom nav mockada tem apenas Perfil / + / Comunidade.
- [ ] Perfil é destino principal.
- [ ] `+` é ação central, não aba.
- [ ] Comunidade é destino existente.
- [ ] Mídia Kit não aparece na bottom nav.
- [ ] Diagnóstico não aparece na bottom nav.
- [ ] Comercial não aparece na bottom nav.
- [ ] Campanhas, CRM e calculadora não aparecem no mobile enxuto.

## Critérios de Comunidade

- [ ] Comunidade aparece apenas como destino.
- [ ] Não existe feed novo.
- [ ] Não existe chat.
- [ ] Não existem comentários.
- [ ] Não existem creators públicos novos.
- [ ] Não duplica página existente.

## Critérios do ActivationPendingWidget

- [ ] Widget não aparece dentro da preview do Perfil.
- [ ] Estratégia documenta conflito com bottom nav.
- [ ] Estratégia documenta conflito com `+`.
- [ ] Estratégia documenta conflito com Mídia Kit modal.
- [ ] Estratégia documenta conflito com fluxo de análise.
- [ ] Nenhuma alteração real foi feita no widget.

## Critérios de linguagem

A experiência deve soar:

- simples;
- estratégica;
- humana;
- app-first;
- prática;
- orientada a próximo passo.

Não deve soar:

- dashboard técnico;
- relatório longo;
- curso;
- rede social nova;
- jogo;
- paywall agressivo;
- laudo médico;
- CRM.

Termos proibidos:

- score;
- nota;
- pontos;
- ranking;
- gabarito;
- garantido;
- certeza;
- comprovado;
- viralizar garantido;
- match real;
- marca garantida;
- patrocínio garantido;
- vídeos salvos;
- histórico de vídeos;
- novo Mídia Kit;
- Mídia Kit mobile;
- 18 sinais;
- 3 narrativas;
- percentual de perfil.

## Critérios de segurança

Validar que a experiência não renderiza:

- API key;
- base64 longo;
- URL assinada com token;
- texto bruto sensível;
- arquivo real de vídeo;
- thumbnail real;
- diagnóstico interno no Mídia Kit;
- dados privados de Instagram real.

## Cenário MM61 — Upload Metadata Dry-Run

Validar na rota real do Perfil Estratégico mobile:

- abrir o fluxo `+ / Analisar vídeo`;
- selecionar um vídeo válido MP4, MOV ou WEBM;
- confirmar que a UI mostra nome, tipo e tamanho aproximado, sem thumbnail ou player;
- aceitar o consentimento curto de validação narrativa;
- continuar e ver a mensagem de vídeo validado antes de objetivo/perguntas;
- simular arquivo inválido ou grande demais e confirmar mensagem humana de erro;
- confirmar que o arquivo não aparece como histórico, galeria, replay ou card salvo;
- finalizar o fluxo e validar que a análise mock segue atualizando o snapshot do Perfil.

## Nota MM62 — Storage Provider Abstraction

O dry-run de upload metadata continua sem arquivo sair do browser. A camada server-side de provider temporário pode retornar `disabled` ou `mock`, mas provider real segue bloqueado.

QA deve validar que a UI e a resposta da upload-session API não exibem nem persistem:

- signed URL;
- uploadUrl;
- storageKey;
- bucket real;
- thumbnail;
- histórico visual de vídeos.

## Critérios de aprovação geral

A experiência só passa se:

- usuário anônimo entende por que precisa entrar;
- usuário só com Gmail entende como começar;
- usuário free entende valor da primeira leitura;
- usuário premium entende o valor do diagnóstico vivo;
- usuário com Instagram entende a precisão adicional;
- Perfil parece a casa do app;
- `+` parece ação, não aba;
- Mídia Kit parece recurso existente;
- Comunidade parece destino existente;
- não há histórico de vídeos;
- não há duplicação de produto pronto;
- a tela não parece dashboard espremido;
- a experiência é compreensível em até 30 segundos.

## Tabela de achados

| Cenário | Largura | Achado | Severidade | Ação sugerida | Status |
|---|---:|---|---|---|---|
| anonymous_view_profile | 390 |  | blocker/high/medium/low/polish |  | aberto |
| anonymous_analyze_video | 390 |  | blocker/high/medium/low/polish |  | aberto |
| account_only | 390 |  | blocker/high/medium/low/polish |  | aberto |
| first_reading_free | 390 |  | blocker/high/medium/low/polish |  | aberto |
| premium_without_instagram | 390 |  | blocker/high/medium/low/polish |  | aberto |
| instagram_optimized | 390 |  | blocker/high/medium/low/polish |  | aberto |
| media_kit_available | 390 |  | blocker/high/medium/low/polish |  | aberto |

Severidades permitidas:

- blocker;
- high;
- medium;
- low;
- polish.

## Próximas decisões sugeridas

Após QA, os próximos PRs prováveis são:

- MM52 — Strategic Profile Mobile Visual Polish;
- MM53 — Strategic Profile Preview Copy Refinement;
- MM54 — Mobile Navigation Integration Plan;
- MM55 — Strategic Profile Data Integration Readiness.

Não recomendar integração real antes do QA/polish visual.

## Histórico

- MM52 aplica polish visual inicial na preview mobile do Perfil Estratégico.
- MM53 refinou a copy da preview mobile do Perfil Estratégico.
- QA manual ainda deve validar clareza, compreensão em 30 segundos e ausência de duplicação de produto antes de integração real.
- QA manual ainda deve ser executado antes de qualquer integração real.

## Guardrails do MM51

- Sem Gemini real.
- Sem upload/storage real.
- Sem persistência.
- Sem endpoint alterado.
- Sem `LoginClient` alterado.
- Sem NextAuth alterado.
- Sem `MediaKitView` alterado.
- Sem Comunidade real alterada.
- Sem `ActivationPendingWidget` alterado.
- Sem Instagram real.
- Sem billing real.

## Guardrails do MM54

- Rota real protegida por feature flag server-side e sessão NextAuth ativa.
- Redirecionamento correto de usuários deslogados preservando callbackUrl e intent=strategic_profile.
- Ocultação de elementos internos de preview no header (`isRealShell`).
- Zero alteração no dashboard atual e sem duplicação de produto pronto.

## Guardrails do MM55

- O adapter de dados `buildMobileStrategicProfileExistingDataAdapter` deve ser 100% puro e determinístico.
- Nenhuma consulta ao banco de dados, Prisma ou chamada HTTP/fetch externa dentro do adapter.
- Sem dependência ou uso de bibliotecas de renderização React ou NextAuth runtime.
- Suporte a overrides no mapeamento apenas em modo de teste/QA sob a feature flag ativa.
- Validação estrita para descartar base64 longo e strings inseguras no avatar.
- Retorno de warnings de forma interna na lista de retorno para depuração.

## Guardrails do MM56

- A hidratação de dados reais deve ocorrer de forma assíncrona client-side, sem bloquear a exibição inicial baseada nos dados da sessão do NextAuth.
- Utilização estrita do helper client-side existente `fetchHomeSummaryCached("all")` para obter as informações de Mídia Kit, planos/premium e convites de comunidade.
- Fallback seguro para preservar o estado inicial e manter a rota totalmente funcional em caso de falhas ou rejeições do endpoint de home summary.
- O indicador visual "Atualizando dados do Perfil..." deve ser sutil, temporário, e desaparecer automaticamente quando a hidratação for concluída ou falhar.
- Nenhuma alteração permitida em endpoints, Prisma, banco de dados ou integração com Gemini real nesta fase.
- Nenhuma alteração permitida na navegação de produção global (sidebar, bottom nav ou dashboard shell legado).

## Guardrails do MM57

- O Perfil Estratégico mobile deve carregar e exibir as informações de diagnóstico persistidas de forma transparente.
- Nenhuma mídia bruta, thumbnail ou signed URL de vídeo real deve ser gravada no banco de dados.

## Guardrails do MM58

- O botão central de análise "+" deve abrir o modal de análise interativo mobile.
- A finalização do fluxo de análise narrativa mobile no client deve re-hidratar o estado local do Perfil com o novo snapshot gerado e salvo sem exigir recarregamento total.
- Cenários de falhas temporárias na API devem renderizar estados de erro apropriados e oferecer botões de retentativa claros.

## Guardrails do MM59

- Qualquer futuro upload de vídeo real deve requerer consentimento explícito e prévio do criador na interface do fluxo.
- Mídias não permitidas, extensões suspeitas de executáveis disfarçados e injeções de Base64 ou URLs devem ser sumariamente bloqueadas.
- O processamento de vídeos reais deve seguir o modelo de descarte seguro forçado, descartando mídias imediatamente após a análise.
- Nenhuma interface do fluxo "+" ou endpoint de análise de produção deve ser alterado para processar arquivos de vídeo reais neste momento.

## Guardrails do MM60

- A criação de uma sessão temporária de upload de vídeo no client deve consumir obrigatoriamente a rota server-side `/api/dashboard/mobile-strategic-profile/upload-session`.
- Toda sessão retornada em produção deve ser em modo mock (`providerMode = "mock"`, `storageProvider = "none"`) e sem expor nenhuma `uploadUrl` física até a homologação final.
- O payload enviado pelo client deve conter o consentimento aceito e a versão legível do termo.
- Qualquer erro ou violação de política na requisição da API de sessão deve renderizar mensagens claras de falha na interface sem expor stack traces ou dados sensíveis de servidor.

## Guardrails do MM61

- O fluxo real deve chamar `/api/dashboard/mobile-strategic-profile/upload-session` antes de avançar para objetivo/perguntas.
- O client só pode enviar `fileName`, `mimeType`, `sizeBytes`, `durationSeconds: null`, consentimento, versão do texto e `source`.
- Sem `FileReader`, `URL.createObjectURL`, canvas, video element para metadados, thumbnail, player, storage local ou histórico visual.
- Falhas de upload session não podem apagar o Perfil atual nem impedir a hidratação do HomeSummary.
- A análise mock existente continua sendo o único endpoint de análise chamado após a validação metadata-only.

## Guardrails do MM62

- A upload-session API deve usar a factory server-side de provider temporário.
- Providers reais R2/S3/GCS/Cloudinary permanecem apenas planejados e retornam disabled.
- Nenhuma resposta deve conter signed URL, uploadUrl, storageKey ou bucket real.
- Nenhum SDK de storage deve ser importado.
- `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED=true` deve bloquear a sessão nesta build.
