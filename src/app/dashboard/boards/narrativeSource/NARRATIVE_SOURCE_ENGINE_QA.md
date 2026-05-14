# Narrative Source Engine Manual QA

Checklist manual para validar a NSE no browser antes de qualquer conexão com o fluxo real.

## Pré-requisitos

- Estar na branch `feat/adaptive-post-creation-board-v2`.
- Rodar o app localmente.
- Usar `NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED=1`.
- Acessar `/dashboard/boards/narrative-source-preview`.
- Manter o PR em draft.

## URLs dos cenários

- `/dashboard/boards/narrative-source-preview?scenario=video-validate`
- `/dashboard/boards/narrative-source-preview?scenario=video-brand-potential`
- `/dashboard/boards/narrative-source-preview?scenario=video-discover-narrative`
- `/dashboard/boards/narrative-source-preview?scenario=video-improve-content`
- `/dashboard/boards/narrative-source-preview?scenario=video-collab`
- `/dashboard/boards/narrative-source-preview?scenario=comment-to-post`
- `/dashboard/boards/narrative-source-preview?scenario=script-to-plan`

## Checklist geral

- A página mostra `Preview interno — Narrative Source Engine`.
- A página informa que usa cenários controlados.
- A lista de cenários aparece sem quebrar layout.
- O cenário ativo está correto.
- `sourceType` está correto.
- `creatorQuestion`, `rawText`, `transcript` ou `visualDescription` aparecem compactados.
- Bloco `Fonte narrativa` aparece.
- Bloco `Intenção da fonte` aparece.
- Bloco `Assets narrativos` aparece.
- Bloco `Sinais para entender a conta` aparece.
- Bloco `Entrada estratégica para o Adaptive V2` aparece.
- Bloco `Plano gerado` aparece quando há plano.
- Nenhum campo sugere que algo foi salvo, treinado ou persistido definitivamente.
- Com a flag desligada, a página mostra estado bloqueado e não renderiza a preview.

## Checklist de linguagem

Procurar visualmente e reprovar se aparecer:

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

## Checklist mobile

Testar em largura mobile no DevTools:

- links de cenário quebram linha sem sobrepor conteúdo;
- cards de fonte ficam legíveis;
- listas de assets não estouram a tela;
- sinais de perfil continuam legíveis;
- entrada Adaptive V2 não cria overflow horizontal;
- plano e próximos passos ficam escaneáveis;
- página mantém scroll natural.

## Checklist por cenário

### video-validate

- Intent deve ser `validate_before_posting`.
- Adaptive mode deve ser `validate_pauta`.
- Plano deve parecer validação de pauta, não oferta comercial forçada.

### video-brand-potential

- Intent deve ser `brand_potential`.
- Adaptive mode deve ser `brand_match`.
- Deve mostrar `Encaixe com marca`.
- Não deve mostrar `Encaixe com collab` sem motivo.

### video-discover-narrative

- Intent deve ser `discover_narrative`.
- Adaptive mode deve ser `discover_pauta`.
- A leitura deve parecer descoberta de narrativa.

### video-improve-content

- Intent deve ser `improve_content`.
- Assets devem incluir fraqueza de gancho ou sinal de abertura.
- Plano deve sugerir ajuste de gancho sem tom de correção escolar.

### video-collab

- Intent deve ser `collab_potential`.
- Adaptive mode deve ser `collab_match`.
- Deve mostrar `Encaixe com collab`.

### comment-to-post

- `sourceType` deve ser `comment`.
- Assets devem incluir `comment_to_post`.
- Plano deve preservar a origem do comentário.

### script-to-plan

- `sourceType` deve ser `script`.
- A leitura deve tratar o roteiro como ponto de partida.
- Plano deve ser gerado sem sugerir upload ou automação inexistente.

## Achados

| Cenário | Problema encontrado | Severidade | Sugestão de ajuste | Status |
| --- | --- | --- | --- | --- |
| | | | | |

## Próxima decisão

Depois dessa QA manual, decidir entre:

- NSE10: proteção por sessão admin/dev;
- ajustes visuais no harness;
- adiar integração até resolver linguagem, persistência ou escopo de upload.
