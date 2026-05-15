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
- consentimento/retenção ainda não foram implementados;
- limite por plano ainda não existe;
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

## Decisão Recomendada

Como não há billing agora, seguir sem teste real e avançar apenas em:

- auditoria;
- docs;
- preview/fallback;
- planejamento de endpoint/storage;
- sem expor para usuário.

## Frase Norte

> O sistema pode estar pronto para testar Gemini real sem ainda estar pronto para lançar vídeo no produto.
