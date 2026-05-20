# MM83 — Profile Synthesis Snapshot Guarded Persistence

Status: concluido.

## Objetivo

Este PR cria o write path explicito da sintese acumulada do Perfil para o snapshot geral `CreatorStrategicProfileSnapshot`.

O Perfil geral passa a ter uma rota segura para ser atualizado por sintese acumulada de leituras documentadas, e nao pelo ultimo video isolado.

Fluxo permitido:

`CreatorVideoNarrativeDiagnosis[] -> CreatorStrategicProfileSynthesis V1 -> CreatorStrategicProfileSnapshot`

Fluxo proibido:

`ultimo video -> snapshot geral sobrescrito diretamente`

## O que foi criado

- `creatorStrategicProfileSynthesisSnapshotMapper.ts`
  - transforma `CreatorStrategicProfileSynthesis` em `MobileStrategicProfileSnapshotPayload`;
  - preserva o schema atual do snapshot;
  - adiciona metadados seguros em `extraData`;
  - usa linguagem conservadora quando ha pouca evidencia;
  - preserva padroes existentes quando a sintese isolada ainda nao tem evidencia suficiente.

- `creatorStrategicProfileSynthesisPersistenceService.ts`
  - expoe `persistCreatorStrategicProfileSynthesis`;
  - usa `dry_run` por padrao;
  - escreve somente quando `mode: "write"` e a sintese e valida;
  - bloqueia escrita com sintese `empty`;
  - retorna resultado seguro, sem documento completo e sem stack trace.

- `video_reading_synthesis_v1`
  - nova origem auditavel para o snapshot;
  - separa atualizacao por sintese acumulada de sementes manuais, mock analysis e analises futuras.

## Metadados seguros

O snapshot pode receber em `extraData`:

- `synthesisVersion`;
- `synthesisUpdatedAt`;
- `synthesisSource`;
- `analyzedReadingsCount`;
- `synthesisStatus`;
- `synthesisWarnings`.

Esses metadados nao incluem payload bruto de leitura, midia, storage, resposta de modelo ou transcricao longa.

## Guardrails

- Este PR ainda nao pluga endpoint real.
- Este PR ainda nao chama Gemini.
- Este PR ainda nao chama storage/R2.
- Este PR ainda nao altera upload ou cleanup.
- Este PR ainda nao altera UI real.
- Este PR ainda nao cria matches reais.
- Este PR ainda nao salva video, thumbnail, signed URL, objectKey, raw response ou transcricao longa.
- O selector e o preview continuam dry-run e nao escrevem snapshot.

## Regra anti-overwrite

- `empty`: nao escreve no snapshot em modo `write`.
- `first_reading`: persiste como primeiro sinal/hipotese, sem criar padrao recorrente.
- `signals_emerging`: persiste como sinal em formacao, sem tratar como narrativa definitiva.
- `pattern_in_formation` e `profile_consistent`: podem preencher padroes recorrentes quando ha evidencia acumulada.

Uma leitura isolada nao pode virar narrativa principal definitiva do Perfil.

## Proximo passo

O proximo PR pode integrar esse write path ao fluxo controlado, provavelmente primeiro no mock/allowlist, mantendo a separacao entre leitura documentada, sintese acumulada e persistencia do snapshot geral.
