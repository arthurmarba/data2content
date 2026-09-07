# Inteligência de roteiros v3

## Resultado esperado

Plataforma, Claude e ChatGPT compartilham a seleção de evidências do próprio criador. Desde a implementação local de 07/09/2026 há dois escritores: o motor interno e o modelo da conversa. `get_script_evidence_pack` entrega poucas referências próprias autorizadas ao cliente; não expõe o corpus em massa. Esta nota descreve o código; não confirma publicação nem execução em produção.

## Pipeline

1. O classificador multimodal v4 lê o Reel com Gemini e extrai texto, segmentos, cenas e narrativa. A qualidade registra corte, consistência temporal e textual. `complete` é verificação estrutural conservadora, não certificação de reconhecimento de fala ou de identidade do locutor. Imagens e miniaturas de vídeos em carrosséis não contam como fala observada.
2. `PublishedContentEvidence` guarda essa evidência fora de `Metric`, junto de duração, watch time, retenção, alcance, interações e vínculo com roteiro salvo.
3. O vínculo é confirmado quando o usuário ligou o roteiro ao post. Caso contrário, usa similaridade lexical dentro de uma janela temporal e marca a confiança como `high`, `possible` ou `unlinked`.
4. `CreatorScriptDnaProfile` agrega até 500 conteúdos dos últimos 365 dias: voz, ritmo, expressões recorrentes, estruturas vencedoras, assuntos, padrões visuais, duração e demografia engajada/followers.
5. A seleção começa pelas métricas atuais, não apenas pelos posts já lidos: até 2.000 posts do período, projeção leve da evidência e até 40 candidatos com texto. Entrega até três exemplos e um contraste comparável, limitados a 16 mil caracteres por texto e 48 mil no conjunto; cortes são declarados. Janela padrão: 180 dias, configurável entre 7 e 365 ou datas ISO explícitas. Referências próprias precisam pertencer à conta, janela e formato pedidos.
6. Engajamento usa interações/alcance; interações absolutas, compartilhamentos, salvamentos, conversa e crescimento têm métricas próprias. Atenção não substitui engajamento. Zero não vira outra métrica e denominador ausente não vira um. O índice compara formato/duração/método com a mediana da conta, reduzindo confiança de amostras pequenas. Exemplo de voz não é necessariamente vencedor. Conversão comercial sem atribuição permanece indisponível; autoridade usa proxy explicitamente rotulada.
7. O cliente escreve a partir de `get_script_evidence_pack` e critica com o mesmo `clientRequestId`, sem duplicar a geração interna. `generate_script_draft` usa o provedor textual configurado em `LLM_PROVIDER_SCRIPTS`/configuração compartilhada. O padrão continua Gemini, sem habilitar gasto OpenAI implicitamente: fallback deve estar permitido na ordem de provedores e em `SCRIPTS_OPENAI_FALLBACK_ENABLED`. Todas as revisões recebem as referências. Duração suportada: 5–180 segundos.
7. O validador mede duração, gancho, CTA, filmabilidade e sobreposição literal. Até duas revisões gerais são feitas quando duração ou cópia falha; se o tempo continuar fora, um ajuste estruturado reescreve somente as falas com orçamento validado por cena.
8. O resultado inclui um recibo de evidência. Baixa cobertura reduz a confiança e aparece como aviso, nunca como informação inventada.

## Privacidade e segurança

- Transcrições integrais e roteiros históricos não são retornados por `get_creator_content_dna`.
- Logs de diagnóstico não recebem transcrições nem prompts. O pedido e as referências entregues são dados privados de produto: `ScriptEvidenceSession` os conserva por sete dias para revisão e proveniência, com TTL e checagem explícita de validade. IDs de sessão são consultados junto do usuário autenticado. A gravação confirmada mantém resumo de fontes, pedido, métricas, recibo e versões do texto em `ScriptEntry`.
- Demografia é sempre agregada e serve para clareza/contexto, nunca para estereótipos.
- `save_script` exige `scripts:write`, confirmação explícita e chave idempotente. `record_script_feedback` guarda «parece comigo», direção e comentário apenas quando solicitados, sem apagar campos anteriores não enviados.
- Nenhuma ferramenta publica no Instagram.
- A capacidade privada e os scopes `content:read`, `metrics:read`, `intelligence:read` são conferidos antes de preparar referências, gerar com corpus ou criticar. Conta sem capacidade privada não entra no corpus; geração genérica continua separada. DNA e evidências privadas exigem Instagram conectado.

## Operação e backfill

Auditar cobertura de um creator:

```bash
npm run audit:script-evidence -- --user=<ObjectId> --days=180
```

O comando é somente leitura por padrão e também mostra seleção, cobertura dos líderes e manutenção proposta, sem imprimir falas. O script npm carrega o ambiente real: conferir destino antes de executar. `--reconcile` aplica métricas/vínculos e reconstrói DNA sem Gemini; `--rebuild-dna` também escreve. Não foram executados contra produção durante esta implementação.

Mudanças de vínculo e novas evidências enfileiram `/api/worker/refresh-script-evidence`; o cron de recuperação é a retaguarda. O worker reconcilia até 500 evidências recentes por conta, mantém métricas atuais e não chama IA. A consulta serve o DNA existente com aviso de defasagem, sem reconstruí-lo na requisição.

`ContentReadingState` mantém lease de seis minutos, tentativas, motivo, próxima tentativa e checkpoint da extração. Se só a persistência falhar, a repetição usa o checkpoint. Falta de saldo pausa Gemini por seis horas; depois apenas um job testa sua recuperação. Cron semanal/recuperação excluem itens bloqueados e distribuem o lote entre contas, priorizando engajamento dentro do conjunto consultado. Vídeos longos e filhos de vídeo de carrossel continuam fora da leitura de áudio suportada.

Reprocessar Reels em lotes controlados pelo saldo Gemini:

```bash
npm run backfill:script-evidence -- --user=<ObjectId> --days=180 --limit=25
```

Após o lote, reconstruir e auditar o DNA:

```bash
npm run audit:script-evidence -- --user=<ObjectId> --days=180 --rebuild-dna
```

O backfill começa pelos vídeos mais novos porque a URL de mídia do Instagram expira. Use lotes pequenos, confira `GeminiUsageLog` com tag `cena` e repita até a cobertura desejada.

## Critérios de prontidão

- `complete`: pelo menos dois exemplos com integralidade estrutural verificada e nenhum líder consultado sem fala utilizável.
- `partial`: há exemplos, mas falta cobertura ou verificação de integralidade.
- `insufficient`: não há exemplo utilizável, ou o rascunho foi produzido pelo fallback local sem evidências enviadas a um modelo.

`selectionStage`, `selectedExamples`, `sentExamples` e `validatedExamples` distinguem preparação, entrega e revisão. Entrega ao cliente não comprova que ele usou corretamente as fontes. `passed` na crítica é aceite técnico, não certificação de voz; `voiceReview` oferece sinais de frase, perguntas, tratamento da audiência, estruturas e rubrica editorial citando fontes.

O pacote é uma revisão imutável para crítica/salvamento, não um cache global de novas buscas: novo pedido relê métricas e preferências. `capturedAtBasis` informa quando a data é apenas atualização do documento, não sincronização verificada do Instagram. Janelas de resultado de 1/7/30 dias guardam métricas disponíveis observadas naquela faixa de idade (tolerância de 1/2/2 dias); não são snapshots exatos do dia nem preenchimento retrospectivo.

O rollout pode ser revertido com `SCRIPTS_GENERATION_V3_ENABLED=false` na geração dentro da plataforma. As ferramentas MCP v0.5 permanecem protegidas por scopes e devem ser retiradas do manifesto caso o motor v3 seja desabilitado por período prolongado.

Quando a conta interna da OpenAI estiver sem saldo, use `SCRIPTS_OPENAI_FALLBACK_ENABLED=false`. Isso afeta apenas o provedor interno de geração; Claude e ChatGPT continuam acessando o MCP normalmente.

## Avaliação contínua

O conjunto de avaliação deve conter pedidos de atenção, profundidade, conversa, conversão e autoridade, com durações de 15, 30, 45 e 60 segundos. Para cada saída, registrar apenas medidas seguras: aderência de duração, qualidade técnica, presença de fala literal, cobertura do recibo e ausência de cópia. Uma revisão humana cega compara v2 e v3 em tom de voz, especificidade, filmabilidade e novidade antes de ampliar o rollout.

O benchmark controlado (consome Gemini) pode ser executado em lote reduzido:

```bash
npm run benchmark:scripts:v3 -- --user=<ObjectId> --limit=3
```

O gate exige ao menos 80% de aprovação, zero sobreposição literal e média técnica de 0,68. O comando não imprime prompts históricos nem o texto dos roteiros.
