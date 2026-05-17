# Video Narrative Input Source Contract

## Objetivo

Este documento define como o vídeo poderá chegar ao futuro endpoint interno/admin de análise narrativa antes de qualquer upload real.

## Escopo

- é contrato, não implementação;
- não existe upload real nesta fase;
- não existe endpoint real nesta fase;
- não existe storage real nesta fase;
- não existe UI nesta fase.

## Problema

O futuro endpoint precisa receber uma referência segura ao vídeo, mas há caminhos diferentes:

- `videoUri` vindo da Gemini File API;
- `inlineVideoBase64` para testes pequenos;
- storage temporário próprio;
- GCS/S3/R2;
- URL pública restrita.

## Comparação De Opções

### Opção A — Gemini File API

Um arquivo local/admin é enviado para a Gemini File API, a Gemini retorna `file.uri`, e o endpoint recebe `videoUri`.

Prós:

- alinhado ao SDK Gemini;
- melhor para arquivos maiores que inline;
- bom para harness/admin.

Contras:

- acopla a origem ao provider;
- não resolve storage próprio do produto;
- depende de billing/quota;
- precisa decidir retenção, limpeza e expiração conforme a política do provider.

### Opção B — inlineVideoBase64

Um vídeo pequeno é convertido para base64, e o endpoint recebe `inlineVideoBase64` + `mimeType`.

Prós:

- simples;
- sem storage;
- bom para vídeos muito curtos.

Contras:

- payload grande;
- risco de log acidental;
- ruim para UX;
- não serve como fluxo principal.

### Opção C — Storage Temporário Próprio

A D2C recebe o upload, salva temporariamente em um storage escolhido, gera URI ou signed URL, e o endpoint usa esse input.

Prós:

- controle de retenção;
- controle de expiração;
- melhor para UX futura;
- permite auditoria e limites.

Contras:

- exige provider de storage;
- exige upload real;
- exige cleanup;
- exige consentimento;
- exige mais segurança.

### Opção D — GCS/S3/R2

São variações possíveis de storage temporário próprio:

- GCS pode conversar melhor com o ecossistema Google;
- S3/R2 podem ser adequados por custo e ecossistema;
- a decisão depende da infraestrutura real do projeto.

### Opção E — URL Pública Restrita

Pode servir apenas para testes muito controlados. Não é recomendada para produto por risco de privacidade, disponibilidade e expiração.

## Recomendação Inicial

### Fase De Teste Real Manual

- usar Gemini File API ou inline base64 pequeno;
- não commitar vídeo;
- não commitar API key.

### Fase De Endpoint Interno/Admin

- aceitar `videoUri` primeiro;
- manter inline base64 apenas como fallback controlado.

### Fase De Beta/Produto

- usar storage temporário próprio ou provider escolhido;
- nunca depender de base64 como fluxo principal;
- a File API pode existir como etapa intermediária/admin, mas não precisa ser a origem de produto.

## Contrato De Input Recomendado Para O Endpoint Futuro

```json
{
  "id": "manual-video-narrative-run",
  "creatorQuestion": "Quero saber se vale postar",
  "videoUri": "file-or-storage-uri",
  "inlineVideoBase64": null,
  "mimeType": "video/mp4",
  "source": "gemini_file_api | inline_base64 | temporary_storage | gcs | s3 | r2 | public_url_restricted",
  "creatorContext": {
    "handle": "...",
    "niche": "...",
    "knownNarratives": []
  }
}
```

## Validações Recomendadas

- exigir `videoUri` ou `inlineVideoBase64` + `mimeType`;
- bloquear payload sem vídeo;
- limitar `creatorQuestion`;
- limitar `knownNarratives`;
- permitir apenas `mimeType` aceito;
- bloquear base64 acima de limite pequeno;
- exigir `source`;
- rejeitar URL pública em beta/produto, exceto se explicitamente permitido;
- nunca logar base64;
- nunca retornar raw video data.

O futuro endpoint deve aplicar input source guard conforme `VIDEO_NARRATIVE_REAL_ENDPOINT_GUARDS_CONTRACT.md` antes de chamar o provider.

MM20 formaliza `VIDEO_NARRATIVE_ALLOWED_SOURCES` e `VIDEO_NARRATIVE_ALLOWED_MIME_TYPES` em código puro para preparar o futuro `payload_schema` guard e parte do `input_source` guard. `public_url_restricted` permanece documentado como source possível, mas bloqueado por padrão nesta fase.

MM21 formaliza `VIDEO_NARRATIVE_INPUT_SOURCE_POLICIES` para as fases `manual_real_test`, `internal_endpoint`, `closed_beta` e `production`. As políticas permitem File API e inline pequeno apenas em fases internas/controladas, priorizam storage/URI para beta/produto e mantêm `public_url_restricted` bloqueado por padrão.

## Limites Iniciais

- vídeo até 60s;
- até 100MB quando houver upload/storage;
- inline base64 apenas para teste pequeno;
- 1 vídeo por análise;
- 1 análise por execução interna;
- beta futuro com 5 análises/mês;
- limites de tamanho/duração devem considerar custo real por análise;
- timeout server-side;
- expiração obrigatória para storage temporário.

## Privacidade E Segurança

- não salvar vídeo permanentemente;
- não persistir sinais no perfil sem decisão posterior;
- consentimento antes de beta;
- retenção documentada;
- seguir `VIDEO_NARRATIVE_CONSENT_RETENTION_CONTRACT.md` antes de qualquer upload real;
- cleanup obrigatório;
- logs sem vídeo/base64/API key;
- resposta sem `rawText` completo;
- apenas `hasRawText`.

## Relação Com Contratos Existentes

- `VideoUploadDraft`;
- `VideoUploadSession`;
- `VideoTemporaryStorageObject`;
- `VideoStorageRetention`;
- contrato de consentimento/retenção;
- contrato de limites/custo;
- real run harness Gemini;
- contrato de endpoint interno/admin;
- payload validation contracts;
- input/source guard helpers;
- `VideoNarrativeAnalysis`.

## Critérios Antes De Implementar Upload Real

- escolher provider de storage;
- definir política de retenção;
- definir consentimento;
- aprovar o contrato de consentimento/retenção;
- definir limites por plano;
- definir regra de custo/usage limit por tamanho/duração;
- definir cleanup;
- definir quem pode acessar;
- validar Gemini real com 3 vídeos curtos;
- medir latência/custo;
- decidir se a File API entra como etapa intermediária.

## Decisão Recomendada Agora

Como ainda não há billing/quota:

- não implementar upload real;
- manter inline/base64 apenas como caminho manual teórico;
- documentar File API como candidata para teste real;
- preparar o contrato para `videoUri`;
- só implementar storage quando houver integração real com produto.

## Próximas Fases Possíveis

- MM15: contrato de consentimento/retenção;
- MM16: contrato de limites/custos;
- MM17: endpoint interno real, somente se billing existir;
- MM18: upload/storage real.
