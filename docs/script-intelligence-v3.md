# Inteligência de roteiros v3

## Resultado esperado

Todo roteiro gerado na plataforma, no Claude ou no ChatGPT passa pelo mesmo motor Data2Content. O motor aprende padrões do próprio creator sem prometer causalidade e sem entregar o corpus histórico bruto ao cliente MCP.

## Pipeline

1. O classificador multimodal v4 assiste ao Reel com Gemini e extrai transcrição integral, segmentos temporais, cenas, fala, texto em tela, cenário, objetos, enquadramento, assunto, gancho, promessa, CTA e estrutura narrativa.
2. `PublishedContentEvidence` guarda essa evidência fora de `Metric`, junto de duração, watch time, retenção, alcance, interações e vínculo com roteiro salvo.
3. O vínculo é confirmado quando o usuário ligou o roteiro ao post. Caso contrário, usa similaridade lexical dentro de uma janela temporal e marca a confiança como `high`, `possible` ou `unlinked`.
4. `CreatorScriptDnaProfile` agrega até 500 conteúdos dos últimos 365 dias: voz, ritmo, expressões recorrentes, estruturas vencedoras, assuntos, padrões visuais, duração e demografia engajada/followers.
5. Para cada pedido, o retrieval ranqueia todo o acervo e carrega no máximo três textos integrais vencedores relevantes e um contraste. O restante entra somente como DNA agregado.
6. Gemini gera o roteiro com fala literal por cena. OpenAI/local é fallback configurável se o Gemini estiver indisponível.
7. O validador mede duração, gancho, CTA, filmabilidade e sobreposição literal. Até duas revisões gerais são feitas quando duração ou cópia falha; se o tempo continuar fora, um ajuste estruturado reescreve somente as falas com orçamento validado por cena.
8. O resultado inclui um recibo de evidência. Baixa cobertura reduz a confiança e aparece como aviso, nunca como informação inventada.

## Privacidade e segurança

- Transcrições integrais e roteiros históricos não são retornados por `get_creator_content_dna`.
- O prompt enviado pelo host MCP nunca é registrado; apenas seu tamanho, objetivo e duração são auditados.
- Demografia é sempre agregada e serve para clareza/contexto, nunca para estereótipos.
- `save_generated_script` exige `scripts:write`, pedido explícito e chave idempotente.
- Nenhuma ferramenta publica no Instagram.
- Assinatura é revalidada em toda chamada MCP. DNA e geração também exigem Instagram conectado.

## Operação e backfill

Auditar cobertura de um creator:

```bash
npm run audit:script-evidence -- --user=<ObjectId> --days=180
```

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

- `complete`: pelo menos dois exemplos integrais e DNA com confiança média/alta.
- `partial`: existe ao menos um exemplo integral ou a cobertura ainda é pequena.
- `insufficient`: nenhum texto integral vencedor; o motor usa apenas padrões agregados e regras-base, declarando a limitação.

O rollout pode ser revertido com `SCRIPTS_GENERATION_V3_ENABLED=false` na geração dentro da plataforma. As ferramentas MCP v0.5 permanecem protegidas por scopes e devem ser retiradas do manifesto caso o motor v3 seja desabilitado por período prolongado.

Quando a conta interna da OpenAI estiver sem saldo, use `SCRIPTS_OPENAI_FALLBACK_ENABLED=false`. Isso afeta apenas o provedor interno de geração; Claude e ChatGPT continuam acessando o MCP normalmente.

## Avaliação contínua

O conjunto de avaliação deve conter pedidos de atenção, profundidade, conversa, conversão e autoridade, com durações de 15, 30, 45 e 60 segundos. Para cada saída, registrar apenas medidas seguras: aderência de duração, qualidade técnica, presença de fala literal, cobertura do recibo e ausência de cópia. Uma revisão humana cega compara v2 e v3 em tom de voz, especificidade, filmabilidade e novidade antes de ampliar o rollout.

O benchmark controlado (consome Gemini) pode ser executado em lote reduzido:

```bash
npm run benchmark:scripts:v3 -- --user=<ObjectId> --limit=3
```

O gate exige ao menos 80% de aprovação, zero sobreposição literal e média técnica de 0,68. O comando não imprime prompts históricos nem o texto dos roteiros.
