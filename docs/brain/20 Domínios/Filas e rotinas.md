---
tipo: domínio
---

# Filas e rotinas — o que roda sem ninguém olhando

## As duas famílias

**Fila (QStash)** — alguém empurra um trabalho e vai embora; o trabalhador executa depois. Endereços em `/api/worker/*`, protegidos pela assinatura do QStash (`QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`).

**Relógio (cron)** — roda em horário marcado. Endereços em `/api/cron/*`, protegidos por `CRON_SECRET`.

A lista completa e sempre atual está em [[Trabalhos em fundo]] (gerada por script).

## Por que isso existe

A Vercel corta requisição longa. Classificar conteúdo, ler vídeo com IA e atualizar Instagram passam do limite. Então a regra é: **se demora, vai pra fila**.

Quando uma tela "fica processando pra sempre", quase sempre o trabalho não chegou ao trabalhador ou morreu lá dentro — não é a tela que está quebrada.

## Agendamento

A retenção de snapshots tem comando próprio `npm run maintenance:mongo-storage`
(simulação por padrão), com execução recorrente local pelo Codex. Não há cron dessa
limpeza publicado na Vercel. Ver [[Histórico diário conserva oito meses e uma referência]].

`src/scripts/scheduleCrons.ts` (`npm run schedule:crons`).

## As rotinas que mexem com dinheiro ou com o criador

- `mature-affiliate-commissions` — libera comissão
- `expire-trials`, `notify-free-month-ending`, `whatsapp-trial` — ciclo de assinatura
- `weekly-report-close` — **grava um retrato que não volta atrás** (ver [[Relatório Semanal]])
- `weekly-mapa-whatsapp`, `weekly-whatsapp-message`, `send-daily-tips` — falam com o criador

Mudança em qualquer uma dessas quatro últimas famílias é visível pra pessoa de fora. Trate como envio, não como código.

## Leitura publicada e manutenção de roteiro

`classify-published-scene` usa `ContentReadingState`: posse temporária por post,
checkpoint da extração, tentativas, motivo e próxima tentativa. A extração paga
é reaproveitada se apenas a persistência falhar. Falta de saldo pausa Gemini por
seis horas; depois um job testa recuperação. A fila não confunde token inválido,
URL expirada, mídia excluída e formato incompatível.

`refresh-script-evidence` reconcilia métricas e vínculos confirmados e reconstrói
DNA em lotes de até 500 evidências por criador, sem IA. É acionado por novas
evidências, alterações de publicação do roteiro e pelo cron de recuperação.
Se a fila de manutenção falhar, o salvamento continua e o cron é a retaguarda.
Auditoria por padrão é somente leitura; `audit:script-evidence -- --reconcile`
escreve no ambiente configurado e deve ser tratado como operação de banco.

## Ligações

[[10 Mapa do sistema]] · [[Trabalhos em fundo]] · [[Classificação de conteúdo]]


## Encadeamento do Perfil

Classificação concluída aciona `classify-published-scene`, que entrega a evidência
salva a `generate-creator-weekly-report` e `enrich-mapa-instagram`, com agrupamento
de eventos por criador. Falha de publicação na fila não invalida a evidência; o
cron `recover-content-intelligence` é a retaguarda. O lote reserva espaço para
pendências antigas e alterna criadores dentro de cada faixa de idade.

O enriquecimento do Instagram usa posse temporária, checkpoint e revisão de
conteúdo. Mudança apenas de métricas não provoca outra geração do mapa. A
sincronização não espera pela IA de enriquecimento.

## Collabs (setembro de 2026)

`/api/worker/collabs` processa `CollabJob` com assinatura QStash, lease e checkpoint. O cron `recover-content-intelligence` republica pedidos pendentes e conclui falhas esgotadas liberando reservas. `CollabSettings` controla piloto e pausa sem apagar propostas. O aviso de match é um evento criado na mesma transação da confirmação; resposta ambígua do provedor exige revisão, não reenvio automático.

## Upload de vídeo (setembro de 2026)

`VideoAnalysisJob` registra a sessão assinada, dono, estado e resultado. `lib/videoAnalysis/` aceita e recupera trabalhos; `/api/worker/analyze-uploaded-video` executa a análise com assinatura QStash. Há uma análise ativa por criador, resultado por sessão e checkpoint validado da IA. Uma interrupção sem checkpoint não repete automaticamente a chamada paga. `/api/cron/recover-video-analyses`, cadastrado para cada cinco minutos, recupera trabalhos e reconcilia arquivos temporários. Publicar o código não cadastra automaticamente o agendamento: ativá-lo na QStash faz parte da liberação.
