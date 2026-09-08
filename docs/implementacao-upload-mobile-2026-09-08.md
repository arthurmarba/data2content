# Correções do upload pelo + no mobile

Implementadas em 08/09/2026, a partir da [auditoria](auditoria-upload-mobile-2026-09-08.md).

## Comportamento implementado

- A emissão da URL assinada registra proprietário, sessão e arquivo no servidor. Análise e cancelamento conferem essa correspondência; conhecer uma chave de outro usuário não autoriza usá-la.
- A requisição de análise aceita um trabalho persistido e retorna rapidamente. O processamento fica em `/api/worker/analyze-uploaded-video`, autenticado pela assinatura QStash.
- Uma análise ativa por usuário reserva a capacidade desse fluxo até a conclusão. O trabalhador confere a cota de leituras salvas antes de chamar a IA. Duas submissões da mesma sessão convergem para o mesmo trabalho, e dois trabalhadores não podem processá-lo simultaneamente.
- A resposta validada da IA e os metadados verificados ficam em um checkpoint antes da gravação final. Falha nessa gravação permite até três tentativas de processamento, reutilizando a análise e dispensando novo download do vídeo. Diagnóstico já salvo é recuperado pelo identificador determinístico da sessão.
- Interrupção ambígua sem checkpoint não autoriza outra chamada paga automática. O SDK Gemini também foi configurado para uma única tentativa, evitando repetições internas invisíveis.
- O botão + consulta trabalhos pendentes e resultados ainda não vistos. Isso também ocorre antes do bloqueio de nova leitura por cota, permitindo recuperar uma análise que acabou de consumir a última leitura disponível.
- Fechar a tela durante o processamento encerra apenas o acompanhamento. O trabalho continua no servidor; o vídeo e a sessão não são guardados em localStorage/sessionStorage.
- Fechar durante o envio cancela a transferência. A sessão é registrada antes do PUT e o cancelamento é reconciliado novamente após o vencimento da URL, cobrindo transferências que terminem tarde.
- O erro original permanece na tela, acompanhado de um código de atendimento quando disponível. O navegador não repete a geração após erro HTTP ou resposta perdida; consulta o trabalho existente.
- A análise real mostra etapas do servidor, sem porcentagem simulada. O envio mostra porcentagem de bytes, com prazo e cancelamento.
- A duração e a miniatura de uma seleção anterior são descartadas quando o arquivo muda. O avanço aguarda a verificação local; se o navegador não consegue ler a duração, a verificação definitiva continua no servidor.
- Nomes como `viagem.tsuru.mp4` não são mais confundidos com executáveis. MIME ausente recebe uma indicação baseada na extensão permitida; a verificação efetiva da mídia continua no servidor. Arquivos disfarçados como `video.exe.mp4` e `video.mp4.exe` continuam bloqueados.
- O resultado salvo não aguarda outro GET quando o servidor já entregou os dados de confirmação. As consultas auxiliares e o envio têm prazos próprios.
- O diálogo contém o foco, restaura o acionador e fecha por Escape, inclusive quando o botão anterior desapareceu na troca de etapa.

## Processamento e retenção

`src/app/lib/videoAnalysis/` concentra aceitação, recuperação e execução. O código anterior da rota foi transferido para `execute.ts`, preservando a lógica de análise, enriquecimento e salvamento. O novo modelo é `src/app/models/VideoAnalysisJob.ts`.

O trabalhador tem limite de 300 s e posse de 360 s. A preparação de arquivos grandes recebe uma margem adicional de 60 s separada do prazo configurado de geração. Upload e consultas da API de arquivos recebem cancelamento e limites; a exclusão no Gemini tem prazo de 3 s. Download do armazenamento tem prazo de 45 s. A análise de cenas usa imagem reduzida para aliviar a verificação de arquivos pesados. Os limites de produto permanecem 90 s e 300 MB.

O FFmpeg foi incluído no manifesto de empacotamento do novo trabalhador, substituindo a referência à antiga rota síncrona no script de build.

A sessão expira em 24 h. `/api/cron/recover-video-analyses` recupera trabalhos interrompidos, republica os que aguardam fila e reconcilia arquivos encerrados. A limpeza espera o vencimento da URL assinada mais uma margem de dez minutos antes da confirmação final, para cobrir PUT tardio. Registros encerrados e com limpeza confirmada são removidos após sete dias sem atualização. Não há TTL que apague o registro antes de reconciliar o arquivo.

Os nomes das variáveis existentes foram mantidos. São necessários QStash, sua assinatura, URL base da aplicação, armazenamento e Gemini já configurados.

## Verificação

- **223 testes passaram em 19 suítes**, cobrindo interface, cliente, armazenamento, análise, rotas, autenticação do trabalhador/cron e persistência.
- **`npm run build` concluído com sucesso**, incluindo o FFmpeg no manifesto do trabalhador. O build ainda informa o aviso preexistente de opções incompatíveis do ESLint; isso não foi tratado como uma execução de lint aprovada.
- Os testes de persistência usam MongoDB descartável local, sem conexão com o banco configurado em `.env.local`.
- Comprovados: isolamento entre usuários, concorrência de sessões e trabalhadores, reaproveitamento do checkpoint, recuperação após perda de resposta, preservação da mensagem e cancelamento durante o PUT.
- Teste específico confirma recuperação de checkpoint mesmo quando o arquivo temporário não está disponível.
- Checagem completa de tipos executada com 4 GB de memória. A checagem inicial com o limite padrão esgotou memória e não foi considerada validação.
- Navegador em 390 × 844: seleção de vídeo sintético, erro preservado, fechamento por Escape e reabertura. A prévia usou serviços simulados e foi removida após a validação.
- Evidências locais: `output/playwright/upload-fixes-error-mobile.png` e `output/playwright/upload-fixes-reopened-mobile.png`.
- Inventário do cérebro regenerado com `npm run brain`.

Não foi realizada chamada paga de análise nesta validação. Safari/iPhone e Chrome/Android físicos, arquivos 4K/HEVC representativos e o percurso completo R2 → Gemini → diagnóstico em produção continuam sendo verificações de liberação; o ensaio em navegador usa vídeo sintético e serviços simulados.

## Publicação e ativação

O cadastro do novo cron a cada cinco minutos está em `src/scripts/scheduleCrons.ts`. **Publicar o código não cria esse agendamento na QStash.** A liberação exige publicar o trabalhador e cadastrar `video-analysis-recovery` apontando para `/api/cron/recover-video-analyses`, com o corpo e horário definidos no script. Evitar republicar rotinas de mensagens não relacionadas apenas para ativar esta recuperação.

Antes de liberar, conferir o índice único esparso `activeKey` em `VideoAnalysisJob`, a assinatura do trabalhador, a entrega da fila e a inclusão do FFmpeg no manifesto. A aplicação também garante a criação dos índices ao registrar a primeira sessão. O teste de liberação deve cobrir envio, conclusão, reabertura e interrupção de conexão, verificando um único diagnóstico e uma única chamada paga por tentativa aceita.

Sessões emitidas pela versão antiga não têm registro no modelo novo: se atravessarem a publicação, o usuário poderá precisar enviar novamente. Reverter apenas o front para a versão síncrona não é compatível com o contrato HTTP 202 do novo endpoint; frontend e backend precisam ser publicados juntos.
