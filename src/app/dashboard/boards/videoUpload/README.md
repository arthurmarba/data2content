# Video Upload Foundation

Este diretório guarda a fundação pura do épico VU. A intenção é preparar, em fases pequenas, uma forma futura de receber vídeo como fonte narrativa sem tratar vídeo como produto separado.

Nesta fase, vídeo é apenas uma possível origem futura para preencher uma `NarrativeSource`.

## VU1 — Contratos puros e validação

Status: concluído nesta branch.

Arquivos principais:

- `videoUploadTypes.ts`: tipos, limites padrão, validação pura e bridge conceitual para fonte narrativa.
- `videoUploadTypes.test.ts`: cobertura dos tipos utilitários, validações, bridge e isolamento de escopo.

O que existe:

- status de processamento futuro;
- fontes possíveis de vídeo;
- MIME types aceitos;
- limites padrão de duração e tamanho;
- códigos e mensagens de validação;
- criação de draft vazio;
- validação determinística de draft;
- bridge compatível com a ideia de `video_upload_future`.

O que não existe:

- upload real;
- endpoint;
- storage;
- transcrição;
- extração de frames;
- análise multimodal;
- OpenAI;
- banco;
- UI;
- BoardShell;
- integração com o fluxo real.

## Limites padrão

- Duração máxima: 60 segundos.
- Tamanho máximo: 100 MB.
- Formatos aceitos: `video/mp4`, `video/quicktime`, `video/webm`.
- Pergunta do criador obrigatória.

## Validação

`validateVideoUploadDraft` normaliza `fileName`, `mimeType` e `creatorQuestion`, preserva tamanho e duração, e retorna erros exibíveis de forma simples.

Validações atuais:

- arquivo obrigatório;
- formato suportado;
- limite de tamanho;
- duração informada;
- limite de duração;
- pergunta do criador quando exigida;
- nome de arquivo sem caracteres simples de risco.

## Bridge narrativa

`buildNarrativeSourceBridgeFromVideoUpload` só retorna dados quando o draft passa pela validação.

O retorno usa:

- `sourceType: "video_upload_future"`;
- `creatorQuestion` normalizada;
- `transcript: null`;
- `visualDescription: null`;
- metadados básicos do vídeo.

O arquivo não importa tipos da NSE nesta fase para manter o acoplamento baixo. A compatibilidade é conceitual e deve ser formalizada em uma fase posterior.

## QA

Comandos recomendados para esta fundação:

```bash
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadTypes.test.ts
npm run typecheck
git diff --check
```

## Próximas fases sugeridas

- VU2: fixture/harness de pré-validação sem upload real.
- VU3: contrato de storage temporário, ainda sem implementação real.
- VU4: contrato de transcrição e frames.
- VU5: integração conceitual com NSE em teste, sem produto real.
