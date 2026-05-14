# Video Upload Preview — QA Manual

## Objetivo

Este checklist serve para validar visualmente a rota interna `/dashboard/boards/video-upload-preview` usando cenários simulados de vídeo.

A revisão não envolve upload real. O objetivo é verificar se o harness mostra com clareza como um `VideoUploadDraft` e `VideoProcessingArtifacts` simulados podem virar uma `NarrativeSource`, passar pela NSE e alimentar o Adaptive V2.

## Pré-requisitos

- Estar na branch `feat/video-upload-simulated-preview`.
- Rodar o app localmente.
- Usar `NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED=1`.
- Acessar `/dashboard/boards/video-upload-preview`.
- Manter o PR em draft.
- Não conectar a usuários reais.

## URLs Dos Cenários

- `/dashboard/boards/video-upload-preview?scenario=transcript-skincare`
- `/dashboard/boards/video-upload-preview?scenario=visual-backstage`
- `/dashboard/boards/video-upload-preview?scenario=brand-frames-ocr`
- `/dashboard/boards/video-upload-preview?scenario=improve-hook`
- `/dashboard/boards/video-upload-preview?scenario=collab-empty-artifacts`
- `/dashboard/boards/video-upload-preview?scenario=invalid-draft`

## Checklist Geral

Validar visualmente:

- O título `Preview interno — Video Upload Foundation` aparece.
- O aviso de que são cenários controlados aparece.
- A lista de cenários aparece.
- O cenário ativo está correto.
- O draft do vídeo está visível.
- A validação do draft está visível.
- A readiness está visível.
- Os artifacts simulados estão visíveis.
- A fonte narrativa aparece quando aplicável.
- A intenção detectada aparece.
- O adaptive mode aparece.
- O plano gerado aparece quando aplicável.
- O estado bloqueado aparece com a flag off.
- Não há input livre, textarea ou file picker.
- Não há qualquer sugestão de upload real.

## Checklist Por Cenário

### transcript-skincare

- `validation ok` aparece.
- `readiness true` aparece.
- A transcrição está preenchida.
- A intent é `validate_before_posting`.
- O adaptive mode é `validate_pauta`.
- O plano é gerado.

### visual-backstage

- A `visualDescription` está preenchida.
- A intent é `discover_narrative`.
- O adaptive mode é `discover_pauta`.
- O plano tem narrativa preenchida.

### brand-frames-ocr

- Frames e OCR aparecem.
- A `visualDescription` contém contexto visual.
- A intent é `brand_potential`.
- O adaptive mode é `brand_match`.
- O bloco `Encaixe com marca` aparece.
- O bloco `Encaixe com collab` não aparece sem motivo.

### improve-hook

- A intent é `improve_content`.
- O adaptive mode é `validate_pauta`.
- Os assets indicam `weakness` ou `hook_signal`.
- O plano sugere ajuste sem tom escolar.

### collab-empty-artifacts

- Os artifacts estão vazios.
- `readiness false` aparece.
- O pipeline ainda roda pela `creatorQuestion`.
- A intent é `collab_potential`.
- O adaptive mode é `collab_match`.
- O bloco `Encaixe com collab` aparece.

### invalid-draft

- `validation ok false` ou estado equivalente de não validação aparece.
- NSE e Adaptive V2 não rodam.
- O plano gerado não aparece.
- O estado parece `não validado`, não `erro`.

## Checklist Mobile

Testar em largura mobile:

- Links de cenário quebram linha sem sobrepor.
- Cards não criam overflow horizontal.
- Blocos de artifacts continuam legíveis.
- `NarrativeSourcePreview` encaixa bem.
- Plano e próximos passos são escaneáveis.
- A página mantém scroll natural.

## Checklist De Linguagem Proibida

Reprovar se aparecer na UI:

- garantido
- certeza
- comprovado
- viralizar
- score
- nota
- pontuação
- acerto
- erro
- gabarito
- resposta correta
- venceu
- perdeu
- salvo
- treinado
- definitivo
- aprendido permanentemente

Se for necessário falar de validação, usar `não validado`, `pendência` ou `precisa de contexto`, evitando `erro` na UI.

## Checklist De Segurança De Produto

Confirmar que:

- Não existe upload real.
- Não existe botão de enviar arquivo.
- Não existe file picker.
- Não existe endpoint.
- Não existe storage.
- Não existe OpenAI.
- Não existe ffmpeg.
- Não existe banco.
- Não existe conexão com BoardShell.
- Não existe link em navegação/menu.
- Não existe input livre do usuário.

## Achados

| Cenário | Problema encontrado | Severidade | Sugestão de ajuste | Status |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Próxima Decisão

Depois da QA manual, decidir entre:

- ajuste visual/copy no harness;
- proteção por sessão admin/dev;
- manter como preview interno;
- só depois discutir storage temporário real.
