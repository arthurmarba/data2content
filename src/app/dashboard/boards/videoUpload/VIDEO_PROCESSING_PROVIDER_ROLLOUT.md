# Video Processing Providers — Rollout Plan

## Objetivo

Este documento orienta a escolha futura de providers para transformar vídeo em artifacts narrativos úteis para a D2C.

Os providers futuros poderão gerar:

- transcrição;
- frames;
- OCR;
- resumo visual;
- sinais técnicos;
- análise multimodal.

Ainda não existe provider real implementado. Hoje existem apenas contratos puros, helpers determinísticos e QA com resultados mockados.

## Arquitetura Atual

```text
VideoUploadSession
↓
VideoProcessingTaskRequest
↓
VideoProcessingTaskResult
↓
mergeVideoProcessingTaskResults
↓
VideoProcessingArtifacts
↓
buildProcessedNarrativeSourceFromVideoUpload
↓
NSE
↓
Adaptive V2
↓
Strategic Plan
```

## Matriz De Tarefas E Possíveis Providers

| Task | Possíveis providers futuros | Entrada necessária | Saída esperada | Custo esperado | Risco | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| transcription | `future_whisper`, `future_assemblyai`, `future_openai` | signed URL ou arquivo temporário | `transcript.fullText` + `segments` | médio | idioma, ruído, duração | Entrega valor rápido porque transforma fala em contexto textual para a NSE. |
| frame_extraction | `future_ffmpeg` | arquivo temporário | `VideoFrameArtifact[]` | baixo/médio | processamento pesado no servidor | Deve priorizar poucos frames-chave para controlar custo e latência. |
| ocr | `future_google_vision`, `future_openai` | frames | `VideoOcrArtifact[]` | médio | texto pequeno, baixa qualidade | Útil quando o conteúdo depende de texto na tela. |
| visual_summary | `future_openai` | frames ou descrição visual | `visualSummary` | médio/alto | alucinação se contexto visual for fraco | Deve ser conservador e indicar leitura, não conclusão definitiva. |
| technical_signals | `future_ffmpeg`, análise local | metadata, frames ou áudio | `VideoTechnicalSignal[]` | baixo/médio | excesso de sinais pouco úteis | Só deve sobreviver se gerar decisão prática para narrativa. |
| multimodal_summary | `future_openai` | transcript + frames + OCR | resumo multimodal | alto | custo, latência, qualidade variável | Deve vir depois de transcrição, frames e OCR estarem validados. |

## Ordem Recomendada De Implementação

1. Storage temporário real.
2. Extração real de duração/metadata.
3. Transcrição.
4. Frames-chave.
5. OCR.
6. Visual summary.
7. Multimodal summary.
8. Persistência opcional de sinais narrativos.

A ordem mais segura começa por storage e metadata porque todo processamento depende de arquivo temporário, expiração e limites confiáveis.

Transcrição deve vir antes porque entrega contexto textual rápido para intenção, assets narrativos e Adaptive V2. Frames e OCR enriquecem a leitura quando a narrativa depende do visual. Multimodal summary deve vir depois, por custo, latência e complexidade de avaliação.

## Critérios De Decisão Antes De Provider Real

- custo por minuto;
- latência aceitável;
- suporte a português;
- qualidade em áudio ruim;
- retenção de arquivos;
- política de privacidade;
- limite por plano;
- possibilidade de retry;
- capacidade de remover dados;
- facilidade de auditoria;
- compatibilidade com signed URL;
- risco de vendor lock-in.

## Política De Custos

Perguntas que precisam ser respondidas antes de qualquer implementação real:

- Quantas análises de vídeo por mês cada plano permite?
- Análise de vídeo entra no plano atual ou vira add-on?
- Qual custo máximo aceitável por análise?
- Vídeos longos devem ser bloqueados ou cobrados diferente?
- Devemos processar sempre tudo ou começar apenas com transcrição?
- O usuário deve ver quando um vídeo não tem contexto suficiente?

## Política De Consentimento

- O usuário precisa saber que o vídeo será analisado.
- O usuário precisa saber se sinais poderão enriquecer o perfil narrativo.
- A experiência deve diferenciar análise temporária de aprendizado persistente.
- Nenhum sinal deve ser salvo no perfil sem regra clara.
- A arquitetura deve permitir futura exclusão ou expiração.

## Riscos E Mitigação

| Risco | Impacto | Mitigação |
| --- | --- | --- |
| Custo inesperado | A margem do produto pode ser corroída por análises longas ou repetidas. | Definir limites por plano, começar com transcrição e registrar custo por análise. |
| Upload de arquivos grandes | Pode aumentar latência, custo e falhas de processamento. | Validar tamanho/duração antes do envio e manter limites conservadores. |
| Vazamento por URL pública | Pode expor vídeo do usuário fora do fluxo esperado. | Usar acesso privado, signed URL curta e `publicUrl` nulo por padrão. |
| Baixa qualidade de transcrição | Pode gerar leitura narrativa fraca. | Registrar confiança quando existir, permitir fallback visual e mostrar contexto insuficiente. |
| Provider indisponível | Pode bloquear análise e frustrar o usuário. | Suportar retry, fallback e mensagens conservadoras. |
| Processamento lento | Pode tornar a experiência pouco prática. | Processar por etapas, comunicar status e limitar tarefas caras. |
| Persistência indevida | Pode salvar sinais sem consentimento claro. | Separar análise temporária de persistência e manter flag específica para perfil. |
| Linguagem prometendo performance | Pode criar expectativa indevida sobre alcance ou resultado. | Usar linguagem de leitura, direção, contexto e oportunidade. |
| Usuário achar que o vídeo foi treinado permanentemente | Pode gerar desconfiança sobre uso dos dados. | Explicar expiração, consentimento e diferença entre análise e aprendizado persistente. |

## Feature Flags Futuras Sugeridas

- `NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED`
- `VIDEO_UPLOAD_REAL_ENABLED`
- `VIDEO_PROCESSING_TRANSCRIPTION_ENABLED`
- `VIDEO_PROCESSING_FRAMES_ENABLED`
- `VIDEO_PROCESSING_OCR_ENABLED`
- `VIDEO_PROCESSING_MULTIMODAL_ENABLED`
- `VIDEO_NARRATIVE_PROFILE_PERSISTENCE_ENABLED`

Flags server-side devem ser preferidas para processamento real, providers e custo. Flags públicas podem controlar apenas previews e estados de interface.

## Checklist Antes De Implementar Provider Real

- [ ] Storage temporário real escolhido.
- [ ] Política de retenção aprovada.
- [ ] Sessão de upload persistida.
- [ ] Autenticação server-side definida.
- [ ] Limites por plano definidos.
- [ ] Logs/auditoria definidos.
- [ ] Consentimento definido.
- [ ] Provider escolhido.
- [ ] Custo estimado.
- [ ] Rollback definido.
- [ ] Rate limit definido.
- [ ] QA manual dos previews concluída.
- [ ] Feature flags off por padrão.

## Próximos PRs Sugeridos

- PROVIDER1: provider mock in-memory, apenas teste, sem rede. Concluído como provider local determinístico.
- PROVIDER2: usar o provider mock em harness ou QA adicional, ainda sem rede.
- STORAGE1: implementação real de storage temporário.
- UPLOAD1: endpoint server-side para criar upload session.
- PROCESS1: transcrição real em ambiente protegido.
- PROCESS2: frames/OCR.
- PROCESS3: multimodal summary.
- PROFILE1: persistência opcional de sinais narrativos.
