# Auditoria do upload pelo botão + no mobile

Data: 08/09/2026. Escopo: seleção, envio, análise, salvamento, recuperação e descarte do vídeo no fluxo real de `DiagnosticoRealShellClient` → `MobileStrategicProfileAnalyzeFlow`.

## Conclusão

Há falhas concretas que independem de saldo no Gemini. O principal encadeamento é: a análise falha, o servidor apaga o vídeo temporário e o navegador repete a mesma requisição usando o arquivo apagado. Depois, a interface pode substituir o erro original por uma mensagem dizendo que não confirmou o envio. Assim, um problema de análise aparece para a usuária como problema de upload.

Também foram encontrados problemas de cancelamento, troca de arquivo, validação, recuperação e autorização de acesso ao arquivo temporário. Não é possível atribuir esses achados aos relatos históricos sem usuário, horário ou identificador da tentativa. Esta revisão não implementa nem publica correções.

## Como o fluxo funciona hoje

1. O botão + verifica o acesso e abre o formulário.
2. O navegador lê duração e miniatura, solicita uma URL assinada e envia o vídeo diretamente ao armazenamento temporário.
3. Uma requisição longa a `/api/dashboard/mobile-strategic-profile/analyze-real` confere a cota, carrega contexto, baixa e verifica o vídeo, chama o Gemini e salva o diagnóstico.
4. O servidor tenta apagar o arquivo temporário. O navegador busca dados de confirmação e abre o resultado.

Não há um trabalho persistido que o celular possa consultar depois de recarregar a página. O limite de produto continua sendo 90 segundos e 300 MB; aumentar esses limites não resolve os problemas abaixo.

## Achados prioritários

### 1. P1 — Repetição automática reutiliza arquivo que o servidor acabou de apagar

**Evidência:** reprodução automatizada do cliente e inspeção do descarte no orquestrador.

O cliente repete até três vezes respostas 5xx, 408, 425 e 429 usando o mesmo corpo. Ele não respeita `retryable: false`. O orquestrador apaga o arquivo em caminhos de falha do provedor antes de devolver a resposta. Uma falha inicial recuperável pode virar “arquivo não encontrado” na segunda tentativa. Erros definitivos de permissão também são repetidos.

Referências:

- `src/app/dashboard/boards/components/videoUpload/appPreview/mobileStrategicProfileAnalysisSubmitClient.ts:23` e `:47`.
- `src/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisOrchestrator.ts:557` e `:625`.

**Correção recomendada:** estabelecer um único contrato de repetição entre cliente e servidor, obedecer ao motivo da falha e preservar o arquivo enquanto houver possibilidade de retomada, com prazo de expiração limitado. Só repetir automaticamente uma operação que possa retornar o resultado anterior sem reprocessar o vídeo. Respeitar a espera indicada pelo provedor quando aplicável.

**Aceite:** simular falha transitória e erro definitivo; nenhum deles deve provocar análise contra arquivo apagado, e um erro definitivo deve produzir uma única tentativa.

### 2. P1 — A mensagem real de erro desaparece dentro do próprio formulário

**Evidência:** teste automatizado e navegador em viewport móvel, com serviço simulado.

No tratamento de falha, o componente escreve a mensagem original e limpa os dados da sessão. Como esses dados são dependências do efeito que dispara a análise, o efeito roda novamente, ainda na etapa de processamento. Sem sessão, ele sobrescreve a mensagem com “Não conseguimos confirmar o envio do vídeo. Volte e envie novamente.”

Referência: `src/app/dashboard/boards/components/videoUpload/appPreview/MobileStrategicProfileAnalyzeFlow.tsx:370–470`.

**Impacto:** a pessoa recebe uma explicação errada e tende a reenviar um vídeo que já havia subido corretamente. O atendimento perde a causa original.

**Correção recomendada:** representar explicitamente os estados de envio, análise, falha e conclusão; iniciar a análise por uma transição controlada, sem reiniciá-la ao limpar dados auxiliares. Preservar código, etapa e identificador da tentativa até a resolução.

**Aceite:** erros de envio, tempo excedido, serviço indisponível e cota devem manter sua mensagem e oferecer ações adequadas à causa.

### 3. P1 — Falta recuperação durável e proteção contra reprocessamento

**Evidência:** inspeção do caminho real; risco de concorrência não exercitado contra o provedor ou banco de produção.

A rota permite 300 segundos e executa todo o trabalho dentro da requisição. O POST de análise não tem prazo local nem cancelamento. Se a conexão cair depois de o servidor começar, o navegador pode repetir enquanto a primeira tentativa ainda trabalha. Não existe consulta inicial de resultado por sessão nem bloqueio de processamento concorrente.

Há uma proteção parcial importante: o identificador do diagnóstico deriva da sessão de upload, e o modelo declara índice único por usuário e diagnóstico. Isso protege contra dois documentos da mesma sessão quando o índice está instalado; **não evita duas chamadas ao Gemini** nem faz a segunda requisição devolver o diagnóstico existente. A persistência usa `create`, portanto uma segunda gravação pode virar falha. Uma nova sessão criada ao reenviar também gera outro identificador.

A cota é conferida por contagem de leituras salvas, sem reserva atômica. Duas sessões simultâneas podem passar pela mesma disponibilidade. É uma corrida de concorrência, não uma comprovação de consumo duplicado nos relatos recebidos.

Referências:

- `src/app/api/dashboard/mobile-strategic-profile/analyze-real/route.ts:8` e chamada de `assertCanStartNarrativeMapReading`.
- `src/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisOrchestrator.ts:735`.
- `src/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisService.ts:52`.
- `src/app/models/CreatorVideoNarrativeDiagnosis.ts:405`.
- `src/app/dashboard/boards/videoUpload/narrativeMapReadingQuotaService.ts`.

**Correção recomendada:** sessão e trabalho persistidos, processamento em fila, identificador estável, exclusão mútua e consulta de estado/resultado. Reservar a cota ao aceitar o trabalho e conciliá-la ao concluir ou falhar. Guardar a análise produzida antes das etapas posteriores para que uma falha de salvamento não obrigue nova chamada ao Gemini. Retomar a tela a partir do servidor, sem guardar vídeo ou sessão em localStorage/sessionStorage.

**Aceite:** duas submissões da mesma sessão produzem um processamento; queda de rede após conclusão recupera o resultado salvo; duas sessões disputando a última leitura não passam simultaneamente.

### 4. P1 — Falta conferir se a chave do arquivo pertence ao usuário e à sessão

**Evidência:** inspeção das rotas e teste dos validadores; nenhuma tentativa de acesso a arquivo de terceiros em produção.

O emissor cria uma chave com hash do usuário e identificador de sessão. Porém, as rotas de análise e exclusão aceitam a chave recebida após validação de formato, sem conferir sua correspondência com o usuário autenticado e com a sessão informada. Os validadores também aceitam sessão e chave divergentes.

Um usuário autenticado e elegível que obtenha uma chave válida de outra pessoa pode encaminhá-la a essas operações. A dificuldade de adivinhar a chave reduz a exposição, mas não substitui autorização. Não foi encontrada evidência de exploração.

Referências:

- `src/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageSignedUrlProvider.ts:80`.
- `src/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisTypes.ts`.
- `src/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadCleanupTypes.ts`.
- `src/app/api/dashboard/mobile-strategic-profile/upload-cleanup/route.ts:99`.

**Correção recomendada:** resolver a chave a partir de uma sessão persistida pertencente ao usuário. Como proteção imediata, validar também a correspondência exata entre proprietário, sessão e chave antes de ler ou apagar. Aplicar a regra a todos os caminhos de limpeza.

**Aceite:** usuário A nunca analisa nem apaga arquivo de B; trocar a sessão mantendo uma chave válida também é rejeitado.

### 5. P1 — Preparação e análise competem pelo mesmo prazo; cancelamento é incompleto

**Evidência:** inspeção dos limites e chamadas. Não foi realizado ensaio de carga com vídeos reais de 300 MB.

O prazo padrão do provedor é de 90 segundos, configurável. Ele envolve a execução da fábrica inteira: upload pela API de arquivos, espera de processamento e geração. A preparação pode fazer até 45 consultas, com intervalos de um segundo além do tempo de rede. Upload e consultas do arquivo não recebem o sinal de cancelamento aplicado à geração.

A exclusão do arquivo no Gemini é aguardada no `finally`, sem limite próprio. Assim, uma demora na preparação ou limpeza pode ocupar o prazo mesmo com crédito disponível. Se a preparação falhar antes de devolver o nome do arquivo, o caminho externo de limpeza também pode ficar sem essa referência.

Referências: `videoNarrativeGeminiProviderConfig.ts:57`, `videoNarrativeGeminiProvider.ts:53`, `geminiVideoNarrativeClientFactory.ts:94`, `:106`, `:593` e `:691`, todos em `src/app/dashboard/boards/videoUpload/`.

**Correção recomendada:** limites e medição por etapa, cancelamento propagado a todas as operações possíveis e limpeza com prazo próprio/reconciliação posterior. Não resolver apenas aumentando o timeout total. O resultado concluído precisa sobreviver a uma falha de limpeza.

## Experiência móvel e validação

| Problema | Evidência e impacto | Melhoria |
| --- | --- | --- |
| Fechar durante o envio não cancela o PUT | Reproduzido: o botão continua habilitado, o pai desmonta o fluxo, o envio termina sem análise e sem chamada de limpeza. Os metadados de limpeza só são guardados depois do PUT. | Registrar a sessão antes do envio; cancelar a transferência e reconciliar arquivos abandonados no servidor. |
| Duração do arquivo anterior interfere no novo | Reproduzido: selecionar um vídeo longo, trocar por um curto e receber o metadado antigo depois bloqueia o curto como se tivesse 120 s. A miniatura usa o mesmo padrão assíncrono sem identificação da seleção. | Descartar respostas de seleções anteriores e aguardar a validação do arquivo atual antes de avançar. |
| Nome legítimo pode ser tratado como executável | Reproduzido com `viagem.tsuru.mp4`: a procura por `.ts` em qualquer parte do nome o rejeita. | Validar extensão e conteúdo efetivo, mantendo proteções contra arquivos disfarçados sem bloquear trechos inocentes do nome. |
| MP4 com MIME vazio é rejeitado | Reproduzida a validação com nome `.mp4` e MIME vazio. O cliente encaminha `file.type` literalmente. Não foi comprovada a frequência desse caso em aparelhos reais. | Resolver ausência de MIME com uma política segura e confirmar o formato no servidor; nome sozinho não basta. |
| Envio sem progresso real ou prazo explícito | PUT usa `fetch` sem controle de progresso, timeout ou abort. Falhas diferentes se tornam uma mensagem genérica. | Progresso de bytes no envio, cancelamento e mensagens por etapa; renovar sessão expirada quando necessário. |
| Progresso da análise é uma simulação de tempo | A barra chega a 94% após cerca de 45 s, sem sinal do servidor de que o relatório está terminando. | Mostrar etapas reais: enviado, preparando, analisando, salvando. Evitar porcentagem sem medição correspondente. |
| Resultado salvo ainda depende de outro GET | Após sucesso, o shell aguarda os dados de confirmação em uma chamada sem timeout. Ela pode manter a pessoa esperando apesar do diagnóstico salvo. | Abrir o resultado salvo imediatamente; enriquecer os dados depois, com prazo e recuperação. |
| Limpeza aparenta sucesso mesmo com HTTP de erro | O callback de cleanup do shell não verifica respostas não-2xx. | Confirmar resultado e reconciliar pendências; falha de limpeza não deve apagar a informação de sucesso da análise. |
| Recuperação exige voltar ao envio | “Tentar novamente” retorna à etapa de upload, sem consultar se a análise já existe ou continua em andamento. | Recuperar trabalho e resultado antes de oferecer novo envio. |

Referências de interface: `MobileStrategicProfileAnalyzeFlow.tsx:168`, `:230`, `:472`, `:537`, `:680`, `:700` e `:895`; `mobileStrategicProfileDirectUploadClient.ts`; `mobileStrategicProfileUploadSessionClient.ts`; `mobileStrategicProfileAnalysisConfirmationClient.ts`; `useAnalysisProgress.ts`; `DiagnosticoRealShellClient.tsx:1340` e `:1529`, todos em `src/app/dashboard/boards/components/videoUpload/appPreview/`.

Referência de validação: `src/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadValidation.ts:74`.

Há ainda uma oportunidade de acessibilidade: o diálogo declara seu papel, mas não incorpora o controle de foco e Escape usado em outros diálogos recentes da plataforma. Deve permitir navegação por teclado e devolver foco ao botão +, respeitando o estado da operação.

## Riscos adicionais a validar com aparelhos e arquivos representativos

- A verificação de mídia executa decodificação dos primeiros segundos com prazo de 15 s. Vídeos pesados podem falhar na preparação antes do Gemini. Testar MOV/HEVC e 4K dentro dos limites, sem presumir que todos esses formatos já falham.
- A geração estruturada tem limite de saída; resposta truncada ou inválida precisa aparecer como falha de análise, com motivo de término registrado, e não como erro de envio. Não foi atribuída incidência a esse motivo nesta auditoria.
- Exercitar Safari/iPhone, Chrome/Android, troca de rede, suspensão e reabertura do aplicativo, sessão expirada e falha após salvar. A verificação em navegador desta revisão não substitui essa matriz.

## Observabilidade e evidência de produção

A rota desativa intencionalmente os registros antigos de tentativa/sucesso/falha de `creator_video_narrative_real_analysis_usage`; essa coleção não é mais a fonte de cota. Portanto, ausência de erros nela não demonstra ausência de falhas no produto. Os eventos atuais de erro incluem um identificador de requisição, mas o cliente não o preserva para atendimento.

Na consulta agregada somente de leitura dos últimos 30 dias, foram encontrados 16 registros de uso do Gemini com tag de vídeo, o mais recente em 02/09/2026. Eles indicam respostas registradas do provedor, não necessariamente diagnósticos válidos e salvos. **Não há denominador confiável para calcular taxa de falha ou conversão com esses números.**

As consultas disponíveis de logs não recuperaram uma tentativa específica de análise, com limitação de retenção informada pela ferramenta. Uma consulta CLI retornou rotas alheias ao filtro pretendido e foi descartada como evidência do upload. Os relatos históricos continuam sem correlação individual.

Recomendação: registrar sessão/trabalho, etapa, duração, tamanho/formato, código do provedor, quantidade de tentativas, salvamento e limpeza, sem conteúdo do vídeo nem chaves/URLs privadas. Mostrar um código curto de atendimento na falha. Separar saldo/cota do provedor, limite de requisições, cota de leituras do produto, problema de arquivo e falha de infraestrutura.

## O que já está adequado

- Existe limite explícito de 90 s e 300 MB, com validação também no servidor.
- O upload usa URL assinada e armazenamento temporário, evitando encaminhar o arquivo inteiro pelo formulário da aplicação.
- A correção conhecida do checksum automático do SDK no R2 já está aplicada (`WHEN_REQUIRED`); não foi classificada como novo bug.
- O fluxo real exige diagnóstico salvo antes de avançar; o modelo declara unicidade por usuário/diagnóstico.
- A cota usa leituras salvas como referência, embora falte reserva para concorrência.

## Validação realizada

1. Suíte existente focada: **186 testes passaram e 1 falhou**, em 12 suítes. A falha lê um runbook no caminho antigo dentro do código; o documento foi movido para `docs/video-narrativa/`. Isso não é uma falha funcional comprovada, mas impede considerar toda a seleção verde.
2. **Sete reproduções automatizadas passaram**, comprovando os comportamentos defeituosos: repetição após exclusão simulada, desrespeito a `retryable: false`, perda da mensagem, envio abandonado sem limpeza, falsos bloqueios de arquivo, validação de sessão/chave divergentes e metadado antigo sobrescrevendo o novo.
3. No navegador, viewport 390 × 844, o componente real foi exercitado com vídeo sintético e backend simulado. Confirmados erro sobrescrito e retorno ao upload por “Tentar novamente”. Evidências locais: `output/playwright/upload-audit-error-mobile.png` e `output/playwright/upload-audit-retry-mobile.png`.
4. Não foram feitas chamadas pagas de análise, acesso cruzado entre usuários, alteração de dados ou publicação. Não foi executada uma análise completa com o provedor real nesta revisão.

As reproduções temporárias foram mantidas fora da descoberta normal do Jest: elas demonstram bugs atuais e não devem virar testes permanentes esperando comportamento errado. Ao corrigir, converter os cenários em testes do comportamento desejado.

## Ordem recomendada de execução

1. **Correções imediatas:** vínculo entre usuário/sessão/arquivo; impedir repetição insegura; preservar mensagem original; corrigir troca de arquivo e cancelamento do envio.
2. **Confiabilidade:** sessão e trabalho persistidos, fila, resultado reaproveitável, reserva de cota, retomada e limpeza reconciliada; limites por etapa do provedor.
3. **Experiência:** progresso real, resultado salvo acessível de imediato, recuperação antes de reenvio, mensagens acionáveis e acessibilidade.
4. **Validação e acompanhamento:** matriz de aparelhos/formatos/rede, concorrência e falhas injetadas; corrigir a referência quebrada do teste; medir sucesso por etapa e custo por diagnóstico efetivamente salvo.

O critério de conclusão deve ser a jornada completa: selecionar, enviar, processar, salvar, recuperar após interrupção e descartar com segurança. Saldo disponível e resposta isolada do Gemini não bastam para validar essa jornada.
