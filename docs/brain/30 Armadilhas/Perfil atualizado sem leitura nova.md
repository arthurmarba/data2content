---
tipo: armadilha
---

# Perfil atualizado sem leitura nova

O Perfil pode ter relatório regenerado e números recentes com ganchos e cenas
antigos. A atualização de `Metric.updatedAt` não comprova leitura de conteúdo.

Em 08/09/2026, uma conta tinha sete posts na semana fechada e nenhum deles com
`sceneElements`. O relatório estava `ready` porque 55% dos 90 dias tinham leitura:
o corte então vigente exigia 40% do histórico, sem testar a semana. O provedor estava
pausado por saldo e quatro classificações recentes também aguardavam saldo/quota.

Antes de investigar cache, confira separadamente:

- post importado e métricas sincronizadas;
- classificação básica (`classificationStatus`);
- leitura de cena/abertura (`sceneElements.version` e `analyzedAt`);
- estado de fila e provedor (`content_reading_states`);
- relatório semanal e seu corte na última semana fechada;
- mapa, `instagramEnrichedAt` e confirmações do criador.

O card de gancho seleciona uma frase de um post vencedor nos 90 dias, sempre com
`nPosts: 1`. Pode permanecer por semanas mesmo quando o multiplicador muda.
Os assuntos da capa têm outra armadilha: posts em ordem crescente, primeiros 12
assuntos únicos, primeiros seis exibidos. Isso favorece assuntos antigos.

No mapa, narrativa confirmada não é sobrescrita e listas no limite não recebem
novos chips. Preservação de identidade não significa análise recente concluída.

Não use `sourceMetricsUpdatedAt` como prova de que a IA leu hoje. O campo de conexão fazia isso antes da correção de 08/09/2026. Regenerar
relatório sem recuperar as cenas não resolve a falta de evidência.

Diagnóstico e recomendações: `docs/auditoria-atualizacao-perfil-2026-09-08.md`.

Ligações: [[Seu Mapa]] · [[Classificação de conteúdo]] · [[Crédito do Gemini paralisa a leitura publicada]]


## Correção no código — setembro de 2026

`creatorWeeklyReport/evolution.ts` separa análise, sincronização e revisão do mapa.
Cobertura de 28 dias incompleta não recebe estado atualizado só porque há cenas
antigas. Assuntos e aberturas recentes incluem a semana corrente; resultados
semanais continuam com corte fechado. A fonte tem assinatura de conteúdo e a
gravação compara a versão lida para não perder uma atualização concorrente.

A política `perfil_evidencia_v2_piloto` calcula candidatos com D7 real e compara
formatos equivalentes. `CONSISTENT_POLICY_VALIDATED` permanece falso até dois
fechamentos de calibração. Séries de políticas diferentes não se misturam.

`npm run audit:profile-evolution` consulta sem escrever e sem chamar IA. Perfil
com indicador honesto não significa provedor recuperado: em 08/09, os sete posts
da conta auditada continuavam pendentes por pausa de saldo/classificação/falha.
