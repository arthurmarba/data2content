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
- harness manual de execução real.

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
- sem expor para usuário.

## Frase Norte

> O sistema pode estar pronto para testar Gemini real sem ainda estar pronto para lançar vídeo no produto.
