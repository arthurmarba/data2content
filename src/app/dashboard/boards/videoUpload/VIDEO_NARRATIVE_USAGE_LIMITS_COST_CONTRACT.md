# Video Narrative Usage Limits and Cost Contract

## Objetivo

Este documento define limites, custo, quota, consumo, retry, cooldown e regras comerciais futuras para análise narrativa de vídeo antes de qualquer endpoint real, upload real ou beta.

Ele existe para separar decisões comerciais e operacionais de qualquer implementação real de billing, cobrança, endpoint, upload ou UI.

## Escopo

- é contrato, não implementação;
- não existe billing real nesta fase;
- não existe cobrança nesta fase;
- não existe endpoint real nesta fase;
- não existe upload real nesta fase;
- não existe UI nesta fase.

## Princípio Central

A análise de vídeo deve ser útil para o criador sem abrir um custo imprevisível para a D2C.

## O Que Conta Como Análise Consumida

Regra conceitual para consumo de quota:

- análise deve contar quando o provider real é chamado com sucesso suficiente para retornar `VideoNarrativeAnalysis` útil;
- falha antes de chamar provider não deve consumir quota;
- payload inválido não deve consumir quota;
- falta de API key/configuração não deve consumir quota;
- falha total do provider pode não consumir quota na fase beta;
- resposta parcial com análise útil pode consumir quota;
- reprocessamento manual deve consumir nova análise, salvo exceção admin/dev.

## Limites Recomendados Por Fase

### Fase Admin/Manual

- sem limite comercial;
- uso apenas por admin/dev;
- registrar manualmente custo/latência fora do produto;
- não usar vídeo de usuário real.

### Fase Endpoint Interno

- limite baixo por admin/dev;
- 1 vídeo por request;
- 1 análise por request;
- timeout server-side;
- sem retry automático ilimitado.

### Fase Beta Fechado

- sugestão inicial: 5 análises/mês por usuário;
- vídeo até 60s;
- tamanho até 100MB quando houver upload/storage;
- retry manual controlado;
- limite diário opcional;
- feature flag para desligamento rápido.

### Fase Produto

- plano atual pode começar com 5 a 10 análises/mês;
- pacotes extras ou upgrade apenas depois de custo real conhecido;
- controle por plano;
- cooldown contra abuso;
- rate limit por usuário/conta;
- limite por tamanho/duração.

## Recomendação Inicial

Como ainda não há custo real medido:

- usar 5 análises/mês no beta como hipótese de beta, não promessa pública;
- não prometer 10 análises/mês até medir custo;
- considerar 10 análises/mês apenas depois de medir custo real por vídeo curto e confirmar que o custo é seguro;
- deixar possibilidade de pacote extra futura;
- não implementar cobrança agora.

## Métricas Obrigatórias Antes De Lançamento

Antes de lançar análise de vídeo para usuários, devemos medir:

- custo por análise;
- latência por análise;
- taxa de falha;
- taxa de fallback;
- taxa de schema parse ok;
- tamanho/duração do vídeo;
- provider status;
- quantidade de retries;
- uso por usuário;
- seed útil gerado ou não;
- conversão para blueprint/roteiro.

As métricas obrigatórias e logs seguros devem seguir `VIDEO_NARRATIVE_OBSERVABILITY_CONTRACT.md` antes de qualquer uso real.

## Retry E Cooldown

- retry automático deve ser limitado;
- retry por falha de configuração não deve acontecer;
- retry por payload inválido não deve acontecer;
- retry por falha transitória pode existir com limite futuro;
- usuário não deve conseguir disparar loops;
- cooldown pode ser aplicado por usuário se houver falhas repetidas;
- admin/dev pode ter bypass controlado em ambiente interno.

## Rate Limit Futuro

O rate limit futuro deve considerar:

- por usuário;
- por conta;
- por IP se aplicável;
- por plano;
- por janela de tempo;
- por tamanho/duração;
- por endpoint interno.

## Feature Flags

- `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED` controla provider real;
- uma futura flag pode controlar endpoint interno;
- uma futura flag pode controlar beta para usuários;
- flag deve permitir desligamento rápido;
- nunca usar `NEXT_PUBLIC` para habilitar custo real.

## Falhas E Quota

Status conceituais futuros:

- `usage_limited`;
- `quota_exceeded`;
- `cooldown_active`;
- `provider_unavailable`;
- `invalid_payload`;
- `disabled`;
- `ready`;
- `failed`.

## UX Futura Para Limite

Cópias conceituais em português para limite, falha sem consumo e indisponibilidade:

- “Você atingiu o limite de análises de vídeo deste período.”
- “Não consumimos uma análise porque o vídeo não pôde ser validado.”
- “A análise de vídeo está temporariamente indisponível.”
- “Tente novamente mais tarde ou use um vídeo menor.”

Essas mensagens devem manter tom humano, sem promessa de resultado e sem pressionar reenvio.

## Relação Com Contratos Existentes

Este contrato complementa:

- `VideoNarrativeAnalysis`;
- `PostCreationVideoSeed`;
- `VideoNarrativeInternalEndpointContract`;
- `VideoNarrativeInputSourceContract`;
- `VideoNarrativeConsentRetentionContract`;
- Gemini readiness audit;
- real run harness.

Ele depende das decisões de consentimento, retenção e storage/input antes de qualquer beta.

## Critérios Antes De Implementar Limite Real

Só implementar limite real depois que houver:

- billing/quota Gemini disponível;
- pelo menos 3 vídeos curtos testados;
- custo médio estimado;
- latência média estimada;
- política de beta definida;
- consentimento/retenção definidos;
- storage/input definido;
- endpoint interno implementado;
- logs seguros definidos;
- observabilidade mínima definida;
- decisão sobre plano atual e pacotes extras.

## Decisão Recomendada Agora

Como não há billing/quota:

- não implementar cobrança;
- não implementar quota real;
- documentar contrato;
- usar 5 análises/mês como hipótese de beta, não promessa pública;
- revisitar depois do teste real manual.

## Próximas Fases Possíveis

- MM17: contrato de métricas/observabilidade;
- MM18: contrato de endpoint real com usage guard e observability hooks;
- MM19: contrato de UI copy para limites;
- MM20: implementação de limite real depois de billing e endpoint interno.
