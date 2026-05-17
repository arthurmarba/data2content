# Video Narrative Consent and Retention Contract

## Objetivo

Este documento define regras de consentimento, retenção e privacidade para a futura análise narrativa de vídeo, antes de qualquer experiência real com usuário.

Ele existe para deixar claras as decisões mínimas de segurança, expiração, logs e uso de sinais narrativos antes de qualquer upload real, endpoint real ou storage real.

## Escopo

- é contrato, não implementação;
- não existe upload real nesta fase;
- não existe endpoint real nesta fase;
- não existe UI nesta fase;
- não existe storage real nesta fase.

## Princípio Central

O vídeo deve ser tratado como dado temporário de análise, não como ativo permanente da conta.

## O Que O Usuário Deve Consentir No Futuro

Antes de enviar um vídeo para análise narrativa, o usuário precisa entender:

- que o vídeo será enviado para análise por IA;
- que o vídeo pode conter imagem, voz, rosto, ambiente, texto na tela e dados pessoais;
- que a análise retorna diagnóstico narrativo, blueprint e possíveis sinais estratégicos;
- que o arquivo de vídeo não deve ser salvo permanentemente por padrão;
- que sinais narrativos só devem alimentar perfil/conta se houver regra clara;
- que a análise pode falhar ou pedir mais contexto;
- que o vídeo deve ser dele ou autorizado.

## Texto Conceitual De Consentimento Futuro

Texto curto em português para uso futuro em uma interface de consentimento:

> Ao enviar este vídeo, você autoriza a D2C a analisá-lo com IA para gerar uma leitura narrativa, sugestões de pauta e direção de roteiro. O vídeo será tratado como arquivo temporário de análise. A D2C não deve salvar o arquivo permanentemente sem uma regra clara de retenção. Evite enviar vídeos com dados sensíveis ou pessoas que não autorizaram o uso.

## Retenção Recomendada Por Fase

### Fase Admin/Manual

- não salvar vídeo no produto;
- usar apenas URI/payload temporário;
- não registrar base64;
- não registrar rawText completo;
- output pode ser salvo manualmente fora do repo apenas se sanitizado.

### Fase Endpoint Interno

- vídeo temporário;
- expiração curta;
- logs sem vídeo/base64/API key;
- guardar apenas status, issues seguras e timestamps se necessário.

### Fase Beta

- retenção máxima sugerida: 24h a 72h para arquivo de vídeo;
- análise textual pode ficar associada à sessão/board se o usuário confirmar;
- sinais narrativos não devem ser persistidos automaticamente sem decisão de produto.

### Fase Produto

- política explícita de retenção;
- exclusão/expiração documentada;
- opção de apagar análise/vídeo;
- logs auditáveis sem conteúdo sensível.

## Dados Que Não Devem Ser Salvos Por Padrão

- vídeo bruto;
- base64;
- rawText completo do provider;
- API key;
- arquivos temporários após expiração;
- sinais narrativos permanentes sem consentimento específico;
- rostos/voz como atributos biométricos.

O rawText completo não deve ser retornado/salvo por padrão.

## Dados Que Podem Ser Salvos Com Cuidado

- status da análise;
- createdAt;
- expiresAt;
- provider status;
- issues sanitizadas;
- `VideoNarrativeAnalysis` sanitizado;
- `PostCreationVideoSeed`;
- decisão do usuário de transformar em pauta/roteiro;
- sinais narrativos somente se houver regra futura.

## Sinais Narrativos E Perfil Do Usuário

`VideoNarrativeAnalysis` pode gerar `profileSignals` para indicar aprendizados úteis sobre narrativa, formato, tom, marca, pauta ou direção de roteiro.

Esses `profileSignals` não devem ser automaticamente persistidos no perfil do usuário.

No futuro, pode haver uma confirmação explícita como:

> Usar esse aprendizado para melhorar minhas próximas sugestões.

Até lá, sinais narrativos devem ficar no contexto da análise/sessão e não devem alimentar perfil/conta de forma automática.

## Remoção E Expiração

Requisitos futuros:

- todo arquivo temporário deve ter `expiresAt`;
- cleanup deve ser idempotente;
- falha de cleanup deve ser auditável;
- usuário/admin deve poder ver status de expiração em beta/produto;
- arquivos expirados não devem ser usados para nova análise.

O futuro endpoint deve aplicar consent guard e retention guard conforme `VIDEO_NARRATIVE_REAL_ENDPOINT_GUARDS_CONTRACT.md` antes de qualquer chamada ao provider.

MM22 formaliza `VideoNarrativeConsentPolicy`, `VideoNarrativeRetentionPolicy` e `validateVideoNarrativeConsentRetentionForPhase` como helpers puros para esses guards futuros. Isso ainda não cria endpoint, upload real, storage real, cleanup real ou UI.

## Logs

Regras para logs:

- não logar vídeo;
- não logar base64;
- não logar API key;
- não logar rawText completo;
- logs podem conter ids, status, duração, tamanho, provider status, timestamps e issues seguras;
- logs de custo/latência devem ser agregados quando possível.

Logs seguros e observabilidade futura devem seguir `VIDEO_NARRATIVE_OBSERVABILITY_CONTRACT.md` antes de endpoint real ou beta.

## Relação Com Contratos Existentes

Este contrato depende e complementa:

- `VideoTemporaryStorageObject`;
- `VideoStorageRetention`;
- `VideoUploadSession`;
- `VideoNarrativeInputSourceContract`;
- `VideoNarrativeInternalEndpointContract`;
- consent/retention guard helpers;
- `VideoNarrativeAnalysis`;
- `PostCreationVideoSeed`.

## Critérios Antes De Beta

Antes de qualquer beta com usuário real:

- consentimento aprovado;
- retenção definida;
- limites/custo definidos;
- logs seguros e observabilidade definidos;
- cleanup implementado;
- limite por plano definido;
- storage definido;
- endpoint interno testado;
- Gemini real testado com vídeos curtos;
- UI deixando claro que é análise temporária;
- opção de não persistir sinais no perfil.

## Decisão Recomendada Agora

Como não há billing/quota e ainda não há upload real:

- não implementar consentimento em UI ainda;
- não implementar retenção real ainda;
- documentar contrato;
- tratar o contrato de limites/custo como dependência antes de beta;
- usar o contrato como bloqueio antes de qualquer beta.

## Próximas Fases Possíveis

- MM16: contrato de custo/limites de uso;
- MM17: contrato de cleanup/storage retention real;
- MM18: endpoint interno real com usage guard, somente depois de billing;
- MM19: UI copy de consentimento e limites, antes de beta.
