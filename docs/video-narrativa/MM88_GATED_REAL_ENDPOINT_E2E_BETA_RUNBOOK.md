# MM88 - Gated Real Endpoint + E2E Beta Runbook

## Objetivo

O MM88 conecta o endpoint real de análise de vídeo ao pipeline completo de leitura documentada, síntese acumulada e snapshot guardado. O fluxo continua restrito a usuários allowlist/admin-dev e só escreve dados quando flags explícitas são enviadas no payload.

O último vídeo não sobrescreve o Perfil geral diretamente. A análise real gera uma leitura documentada; o Perfil geral só muda depois da síntese acumulada de leituras recentes.

## Fluxo

1. Upload temporário já existente.
2. Referência temporária validada pelo endpoint gated.
3. Provider multimodal real.
4. Parser com `evidenceAnchors` seguros.
5. Diagnóstico estruturado.
6. `persistReading=true`: salva `CreatorVideoNarrativeDiagnosis`.
7. `persistSynthesisSnapshot=true`: consulta leituras recentes, gera síntese acumulada e escreve snapshot pelo guard.
8. Cleanup temporário é tentado independentemente da persistência.
9. Response retorna apenas auditoria segura.

## Flags do Payload

- Sem flags: roda a análise real segura e cleanup, mas não salva leitura nem snapshot.
- `persistReading=true`: salva a leitura documentada, se a análise for válida.
- `persistReading=true` + `persistSynthesisSnapshot=true`: salva leitura, roda síntese acumulada e escreve snapshot guardado.
- `persistSynthesisSnapshot=true` sem `persistReading=true`: não escreve snapshot; retorna skipped seguro.

## Habilitação Gated

Confirme no ambiente interno/beta:

- Mobile Strategic Profile habilitado.
- Upload temporário habilitado.
- Upload real habilitado.
- Real analysis E2E habilitado.
- Provider real habilitado.
- Allowlist/admin-dev habilitado.
- Usage limits beta habilitados.

Não inclua valores de secrets no runbook, logs, payloads ou screenshots.

## Teste E2E Com Usuário Allowlist/Admin-Dev

1. Entre com um usuário de allowlist ou admin-dev.
2. Faça upload temporário de um vídeo curto.
3. Chame o endpoint real com `persistReading=true`.
4. Confirme `videoReadingPersistence.attempted=true`.
5. Confirme `videoReadingPersistence.saved=true`.
6. Confirme que `diagnosisId` foi retornado.
7. Confirme que a leitura salva contém `evidenceAnchors` quando o provider conseguiu extrair falas/cenas.
8. Chame novamente com `persistReading=true` e `persistSynthesisSnapshot=true`.
9. Confirme `synthesisSnapshotWrite.attempted=true`.
10. Confirme `synthesisSnapshotWrite.written=true` ou um `skippedReason` seguro.
11. Abra o shell mobile e confirme que Perfil | Leituras | Oportunidades renderizam.

## Verificação de Não Persistência de Mídia

Confirme que a leitura, snapshot e response não incluem:

- vídeo
- thumbnail
- signed URL
- upload URL
- object key
- local path
- storage provider path
- raw model response
- raw transcript
- transcrição longa

## Verificação de Cleanup

1. Confirme `e2eBetaAudit.cleanupAttempted=true`.
2. Verifique no provider temporário que o objeto temporário foi removido ou expirado conforme política.
3. Se `cleanupWarning` aparecer, trate como incidente operacional beta: a leitura pode ter sido salva, mas a mídia temporária precisa de verificação manual.

## Como Interpretar `videoReadingPersistence`

- `attempted=false`: a flag de persistência não foi enviada ou o fluxo não tinha leitura segura para salvar.
- `saved=true`: a leitura documentada foi persistida.
- `diagnosisId`: identificador seguro para auditoria interna da leitura.
- `skippedReason`: motivo seguro para não tentar salvar.
- `errorCode`: erro seguro de persistência, sem stack trace.

## Como Interpretar `synthesisSnapshotWrite`

- `attempted=false`: snapshot write não foi solicitado ou não havia leitura salva.
- `written=true`: síntese acumulada foi persistida como snapshot guardado.
- `synthesisStatus`: estado editorial da síntese.
- `analyzedReadingsCount`: quantidade de leituras consideradas.
- `updatedAt`: momento seguro do write.
- `skippedReason`: motivo seguro quando o snapshot não foi escrito.

## Falhas Operacionais

- Falha no provider real: não salvar leitura, não rodar síntese, não escrever snapshot.
- Falha no parser de anchors: limpar anchors inválidos e manter análise segura quando possível.
- Falha no save reading: não rodar síntese, não escrever snapshot.
- Falha na síntese: não escrever snapshot.
- Falha no snapshot write: manter leitura salva e retornar auditoria segura.
- Falha no cleanup: retornar `cleanupWarning` e verificar storage temporário.

## Rollback

Desligue as flags internas do beta:

- real analysis E2E
- provider real
- upload real, se necessário
- snapshot write via payload, removendo `persistSynthesisSnapshot`
- reading persistence via payload, removendo `persistReading`

Sem flags explícitas de payload, o endpoint não escreve leitura nem snapshot.

## Checklist Antes de Testar Com 2 ou 3 Creators Reais

- Usuários estão na allowlist/admin-dev.
- Usage limits beta estão ativos.
- Payload não contém mídia bruta, URL assinada ou metadata de storage fora da referência temporária validada.
- Vídeo é curto e autorizado para teste.
- Cleanup é verificado depois da execução.
- Leitura salva contém anchors seguros quando disponíveis.
- Snapshot só é escrito depois de síntese acumulada.
- Shell mobile renderiza Perfil | Leituras | Oportunidades.
- Nenhuma resposta de UI mostra termos técnicos do provider/parser ou metadata de storage.
