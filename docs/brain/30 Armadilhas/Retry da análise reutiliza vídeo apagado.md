# Retry da análise reutiliza vídeo apagado

Constatado em 08/09/2026. Correção implementada na mesma data; a auditoria abaixo descreve o comportamento anterior.

O caminho novo registra `VideoAnalysisJob` ao emitir a URL de envio. A requisição de análise apenas aceita o trabalho; `/api/worker/analyze-uploaded-video` executa a leitura. Um índice único de `activeKey` permite uma análise ativa por usuário, e uma posse temporária impede dois trabalhadores na mesma sessão. O navegador consulta o trabalho e nunca repete a geração após resposta perdida.

A resposta validada do provedor e os metadados verificados são guardados antes da gravação final. A recuperação reaproveita ambos sem depender do vídeo temporário. Sem checkpoint, uma interrupção ambígua não provoca outra chamada paga automaticamente. Resultado já salvo é recuperado pelo ID determinístico do diagnóstico.

`/api/cron/recover-video-analyses` tem cadastro próprio a cada cinco minutos em `src/scripts/scheduleCrons.ts`; sua ativação na QStash é necessária na publicação. Limpeza de sessão cancelada é reconciliada após o vencimento da URL, cobrindo transferências que terminaram depois de fechar a tela. Nenhum estado de upload vai para localStorage/sessionStorage.

No upload pelo + mobile, `mobileStrategicProfileAnalysisSubmitClient.ts` repete o mesmo corpo em respostas 5xx e alguns outros status, ignorando `retryable: false`. O `videoNarrativeRealAnalysisOrchestrator.ts` tenta apagar o arquivo temporário antes de devolver algumas falhas do provedor. A próxima tentativa pode buscar um arquivo que acabou de ser apagado.

Há uma segunda armadilha: o `catch` de `MobileStrategicProfileAnalyzeFlow.tsx` limpa os metadados de upload, mas permanece em `processing`. A mudança reinicia o efeito e substitui a mensagem original por “Não conseguimos confirmar o envio do vídeo”. Um problema de análise passa a parecer problema no envio.

Os dois comportamentos foram reproduzidos com dependências simuladas; a troca da mensagem também foi confirmada no navegador. Não atribuir relatos antigos a esse encadeamento sem correlacionar a tentativa.

O ID do diagnóstico deriva da sessão e há índice único declarado por usuário/diagnóstico. Isso não impede repetição de chamadas ao provedor: falta devolver resultado existente e impedir trabalho concorrente antes da chamada. Não afirmar que a mesma sessão necessariamente grava dois diagnósticos.

Ao corrigir, alinhar repetição, retenção temporária e recuperação por sessão no servidor. Manter a regra de não guardar vídeo/sessão no localStorage ou sessionStorage. A coleção antiga `creator_video_narrative_real_analysis_usage` não recebe mais as falhas dessa rota; coleção vazia não significa operação saudável.

Ver [auditoria completa](../../auditoria-upload-mobile-2026-09-08.md).
