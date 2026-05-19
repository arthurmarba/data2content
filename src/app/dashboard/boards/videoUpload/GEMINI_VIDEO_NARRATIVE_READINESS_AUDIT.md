# Gemini Video Narrative Readiness Audit

## Objetivo

Esta auditoria valida a prontidão técnica da linha Gemini multimodal sem chamada real. O teste real ainda depende de API key com billing/quota disponível, então esta fase confirma apenas contratos, isolamento e guardas antes de qualquer execução externa futura.

## Estado Atual

Já existe:

- `VideoNarrativeAnalysis`;
- `PostCreationVideoSeed`;
- mock provider narrativo;
- preview interno narrativo;
- prompt/schema Gemini;
- provider com flag server-side;
- client factory com `@google/genai`;
- composer `env/config -> factory -> provider`;
- harness manual de execução real;
- rota real segura do Perfil Estratégico mobile `/dashboard/boards/mobile-strategic-profile` (MM54);
- adapter de dados síncrono e puro `mobileStrategicProfileExistingDataAdapter.ts` (MM55).

## O Que Ainda Não Foi Validado

- qualidade real da resposta Gemini;
- latência real;
- custo real por vídeo;
- aderência real ao JSON;
- interpretação real de vídeo curto;
- comportamento real com vídeo sem contexto.

## Checklist De Segurança

- o provider real é server-side;
- a flag server-side é obrigatória;
- o provider real não usa `NEXT_PUBLIC`;
- a API key vem de env;
- a API key não é retornada;
- `rawText` não é exposto no harness;
- o harness retorna apenas `hasRawText`;
- sem endpoint público;
- sem UI pública;
- sem upload real;
- sem integração automática no board;
- sem persistência;
- sem chamada real em teste automatizado;
- sem navegação/menu.

## Checklist De Arquitetura

- `VideoNarrativeAnalysis` é o output principal;
- `VideoProcessingArtifacts` é evidência auxiliar;
- `PostCreationVideoSeed` é a ponte segura;
- o provider Gemini é injetável;
- a factory é isolada;
- o composer não roda sozinho;
- o harness é manual;
- existe fallback;
- o schema normaliza resposta inválida;
- o prompt pede JSON válido;
- a linguagem evita promessa absoluta.

## Riscos Pendentes

- billing/quota não validado;
- modelo default ainda não validado em execução real;
- prompt pode precisar de ajuste após resposta real;
- schema pode precisar tolerar variações;
- File API/upload ainda não existe;
- origem real do `videoUri` ainda precisa ser definida;
- consentimento/retenção foram formalizados em MM15, mas ainda não foram implementados;
- limites/custo foram formalizados em MM16, mas ainda não foram implementados;
- observabilidade foi formalizada em MM17, mas ainda não foi implementada;
- endpoint guards foram formalizados em MM18, mas ainda não foram implementados;
- guard contracts puros foram formalizados em MM19, mas ainda não foram conectados a endpoint real;
- payload validation contracts foram formalizados em MM20, mas ainda não foram conectados a endpoint real;
- input/source guard helpers foram formalizados em MM21, mas ainda não foram conectados a endpoint real;
- consent/retention guard helpers foram formalizados em MM22, mas ainda não foram conectados a endpoint real;
- usage/quota guard helpers foram formalizados em MM23, mas ainda não foram conectados a endpoint real;
- observability event contracts foram formalizados em MM24, mas ainda não enviam eventos para analytics real;
- safe response builder foi formalizado em MM25, mas ainda não foi conectado a endpoint real;
- endpoint skeleton readiness foi formalizado em MM26;
- endpoint skeleton admin/dev foi criado em MM27, mas bloqueia provider real e não chama Gemini;
- endpoint mock mode foi criado em MM28 com `VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE=mock`, mas ainda sem Gemini real;
- diagnosis and creator learning model foi criado em MM29 para orientar extração, quiz e UX futura;
- sinais do criador são extraídos em MM29, mas não são persistidos;
- diagnosis-driven quiz builder foi criado em MM30 para gerar perguntas a partir do diagnóstico;
- perguntas de MM30 têm `learningSignalType` e respostas ainda não persistem;
- creator narrative profile contract foi criado em MM31 para agregar sinais sem banco ou persistência;
- `shouldPersistLater` segue apenas metadado e persistência continua bloqueada;
- app-first flow state model foi criado em MM32 para modelar jornada, copy e prompts antes da UI;
- prompts de upgrade e Instagram foram definidos em MM32 sem conectar billing ou Instagram real;
- internal app-first preview foi criado em MM33 para visualizar a jornada com cenários mockados;
- a preview MM33 continua sem upload real, persistência, BoardShell, endpoint real ou Instagram real;
- UI primitives foram criados em MM34 para deixar a preview mais próxima de app;
- os primitives MM34 seguem isolados da rota real, sem upload real, persistência, BoardShell ou integração externa;
- interactive app-first preview foi criado em MM35 para navegar pela jornada com estado local;
- o modo `mode=interactive` continua sem upload real, endpoint call, persistência, BoardShell ou Gemini real;
- interactive preview UX refinement foi concluído em MM36 para lapidar copy, quiz, diagnóstico, CTAs e prompts;
- a preview MM36 segue mock/local-state; a próxima etapa pode revisar visualmente no navegador ou preparar integração controlada com fluxo real;
- browser UX QA checklist foi criada em MM37 para orientar revisão visual/funcional da preview interativa;
- a próxima etapa deve considerar os achados da QA antes de qualquer upload real, BoardShell, paywall ou integração real;
- evolving creator diagnosis contract foi criado em MM38 como camada segura de produto sobre o diagnóstico pontual;
- MM38 não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint e não muda upload/storage;
- access tier diagnosis rules foi criado em MM39 para separar valor free, premium e Instagram conectado;
- MM39 não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage e não muda billing real;
- diagnosis presentation model foi criado em MM40 como camada segura de produto/apresentação;
- MM40 transforma diagnóstico evolutivo e regras de acesso em blocos estruturados para futura UI, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage e não muda UI real;
- evolving diagnosis preview scenarios foi criado em MM41 como camada segura de preview/mock;
- MM41 conecta diagnóstico evolutivo, regras de acesso e presentation model aos cenários mockados, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage e não muda UI pública;
- mobile diagnosis UI refactor foi criado em MM42 como camada segura de UI interna/preview;
- MM42 materializa o presentation model na preview interna, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage e não cria UI pública;
- strategic profile state contract foi criado em MM43 como camada segura de contrato/produto;
- MM43 modela o Perfil Estratégico mobile como diagnóstico vivo do creator, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera Mídia Kit ou Comunidade reais;
- strategic profile mapping layer foi criado em MM44 como camada segura de contrato/mapping;
- MM44 monta um `MobileStrategicProfile` consumível pela futura UI, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera Mídia Kit ou Comunidade reais;
- strategic profile preview UI foi criado em MM45 como camada segura de UI interna/preview;
- MM45 materializa visualmente o Perfil Estratégico mobile em preview interna, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera Mídia Kit ou Comunidade reais;
- strategic profile login intent copy foi criado em MM46 como camada segura de auth copy/reuso;
- MM46 reaproveita `LoginClient` para copy contextual de Perfil Estratégico e análise narrativa, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera NextAuth;
- media kit modal bridge foi criado em MM47 como camada segura de UI interna/preview;
- MM47 adiciona um modal visual/local para apontar ao Mídia Kit existente, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera Mídia Kit real ou `MediaKitView`;
- analyze entry and return flow foi criado em MM48 como camada segura de UI interna/mock;
- MM48 modela a ação `+ / Analisar vídeo` como fluxo local que retorna ao Perfil, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera Mídia Kit, Comunidade ou login reais;
- mobile navigation preview strategy foi criado em MM49 como camada segura de estratégia/contrato;
- MM49 consolida `Perfil / + / Comunidade` para navegação mobile futura, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera navegação real;
- activation widget conflict strategy foi criado em MM50 como camada segura de estratégia/contrato;
- MM50 modela conflitos do `ActivationPendingWidget` com bottom nav, ação central, Mídia Kit modal e fluxo de análise, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera `ActivationPendingWidget` real;
- strategic profile mobile UX QA checklist foi criado em MM51 como camada segura de QA;
- MM51 valida a experiência do Perfil Estratégico como produto antes de integração real, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera UI real de produção;
- strategic profile mobile visual polish foi aplicado em MM52 como camada segura de UI interna/preview;
- MM52 refina visualmente a preview do Perfil Estratégico, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera UI real de produção;
- strategic profile preview copy refinement foi aplicado em MM53 como camada segura de copy/preview;
- MM53 melhora a linguagem da preview do Perfil Estratégico, mas não aumenta readiness de Gemini real, não adiciona provider externo, não muda endpoint, não muda upload/storage, não muda persistência e não altera UI real de produção;
- rota real segura do Perfil Estratégico mobile foi criada em MM54, protegida por feature flag server-side e sessão do NextAuth, garantindo isolamento total do dashboard legado, sem impactar prontidão externa;
- adapter de dados síncrono e puro foi criado em MM55, isolando o mapeamento de sessão NextAuth e home summary do Perfil mobile, garantindo zero dependência de banco de dados, Prisma, chamadas fetch ou providers externos;
- hidratação de dados reais client-side foi implementada em MM56, enriquecendo o Perfil Estratégico mobile com dados existentes do `HomeSummaryResponse` (Mídia Kit, planos/premium, comunidade VIP/Free e fallback robusto sem Prisma, banco de dados, dependência do Gemini real, alteração de MediaKitView, Comunidade ou sidebar);

- limite por plano real ainda não existe;
- custo real ainda desconhecido.

## Critérios Para Liberar Teste Real Manual

Antes de rodar real:

- API key nova e segura;
- quota/billing disponível;
- vídeo curto e não sensível;
- flag ligada localmente;
- comando manual com env;
- não commitar vídeo/base64;
- não commitar API key;
- output sanitizado salvo fora do repositório, se necessário.

## Critérios Para Criar Endpoint Interno Depois

Só criar endpoint depois que:

- teste real manual rodar pelo menos 3 vídeos curtos;
- schema parsear respostas úteis ou ajustes forem feitos;
- custo/latência forem anotados;
- fallback for validado;
- decisão de input de vídeo for tomada: File API, inline ou storage;
- autenticação admin/dev for definida.

Próximo passo documental:

- revisar `VIDEO_NARRATIVE_INTERNAL_ENDPOINT_CONTRACT.md` antes de qualquer implementação de rota.
- revisar `VIDEO_NARRATIVE_INPUT_SOURCE_CONTRACT.md` antes de qualquer implementação de upload real.

## Decisão Recomendada

Como não há billing agora, seguir sem teste real e avançar apenas em:

- auditoria;
- docs;
- preview/fallback;
- planejamento de endpoint/storage;
- contrato formal de origem do vídeo;
- contrato formal de consentimento/retenção;
- contrato formal de limites/custo;
- contrato formal de observabilidade;
- contrato formal de guards do endpoint real;
- contratos puros de guard result/status;
- contratos puros de payload validation;
- helpers puros de input/source guard;
- helpers puros de consent/retention guard;
- helpers puros de usage/quota guard;
- contratos puros de eventos de observabilidade;
- safe response builder puro;
- endpoint skeleton readiness verde;
- endpoint skeleton admin/dev protegido por `VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED=true`, sem provider real;
- endpoint mock mode interno com resposta simulada útil por `VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE=mock`;
- diagnóstico estratégico puro para níveis `free`, `premium` e `instagram_optimized`;
- creatorSignals derivados de quiz/pergunta/análise/seed/Instagram futuro, sempre sem persistência automática;
- quiz builder puro orientado por lacunas do diagnóstico, sem UI e sem persistir respostas;
- contrato de perfil narrativo do criador com merge/summary em memória, sem banco;
- modelo puro de fluxo app-first com estados, CTAs e prompts, sem UI;
- sem expor para usuário.

## Frase Norte

> O sistema pode estar pronto para testar Gemini real sem ainda estar pronto para lançar vídeo no produto.
