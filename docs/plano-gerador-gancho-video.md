# Plano — gerador de gancho para o vídeo analisado

> Extensão do produto: o plano para recomendar também a reorganização do vídeo, com instruções simples e executáveis, está em [`plano-ajuste-inteligente-roteiro-video.md`](./plano-ajuste-inteligente-roteiro-video.md).

## Status de implementação — 25/08/2026

- Fase 0 concluída: auditoria somente leitura criada e executada; Gastronomia e Beleza estão prontas para beta coletivo, e outros territórios entram somente com fallback por evidência.
- Fase 1 concluída: histórico de aberturas do próprio criador entra antes da geração, contrato versionado e reranking estão ativos, e o gancho virou o primeiro bloco do relatório mobile.
- Fase 2 implementada atrás de `VIDEO_NARRATIVE_TERRITORY_HOOKS_ENABLED=1` e da allowlist `VIDEO_NARRATIVE_TERRITORY_HOOKS_TERRITORIES`: o snapshot guarda somente padrões anônimos e o serviço exige volume, diversidade de criadores e índice relativo positivo.
- Fase 3 base concluída: recomendação e escolha são persistidas; quando o Reel é reconciliado, o resultado e a aderência da abertura escolhida ficam ligados ao diagnóstico.
- Próximo passo operacional: fechar/retropreencher snapshots de gancho, ligar a flag apenas nos territórios aptos (`beleza,cozinha`) e rodar o experimento controlado da Fase 4.

### Rollout operacional de 25/08/2026

- Snapshots W32 e W33 retropreenchidos de forma aditiva para Beleza e Gastronomia; quatro documentos atualizados e verificados, sem sobrescrever rankings congelados.
- Produção configurada com `VIDEO_NARRATIVE_TERRITORY_HOOKS_ENABLED=1` e allowlist `beleza,cozinha`; as variáveis passam a valer no primeiro deploy que contenha esta implementação.
- W34 não foi fechada: 347 posts tiveram a classificação adiada porque a quota da IA estava indisponível. O lote foi reenfileirado, mas o provedor manteve o bloqueio.
- Ingestão corrigida para novos posts sem legenda não ficarem presos em `pending`; dois posts sem legenda da W34 foram reconciliados sem chamada de IA.

## Decisão de produto

Vale evoluir o botão `+` para que a entrega principal seja **um gancho recomendado para aquele vídeo**, mantendo como camadas secundárias o Raio X, a comparação com o histórico e a atualização do Perfil.

A proposta não deve virar uma biblioteca genérica de frases nem prometer viralização. O diferencial da D2C é combinar três evidências:

1. o que realmente existe no vídeo enviado;
2. o que já funcionou para o próprio criador;
3. padrões de abertura que ganham atenção no território do criador.

Na interface, a promessa recomendada é **“Gancho para este vídeo”** ou **“Sua abertura recomendada”**. “Gancho viral” pode ser o nome interno da iniciativa, mas não deve ser apresentado como garantia ao criador.

## Avaliação do estado atual

### O que já existe e deve ser preservado

- Upload temporário, inspeção do arquivo, análise multimodal e descarte do vídeo.
- Leitura dos primeiros 3 e 10 segundos, fala, texto em tela, cenas, promessa e entrega.
- Campo legado `suggestedHook` e uso dele como exemplo do ajuste de maior impacto.
- Comparação com o histórico do criador por meio de `CreatorEngagementBaseline`.
- `Metric.sceneElements.openingLine` e `screenTitle` nos Reels publicados já processados.
- Métricas de alcance, retenção/watch time, comentários, salvamentos e compartilhamentos.
- Território principal vindo do Mapa e pipeline coletivo do relatório de territórios.
- Calibração pós-publicação e persistência da decisão de publicar.

### Limitação central

Hoje o modelo gera `suggestedHook` sem receber os ganchos de melhor resultado do criador. O `CreatorEngagementBaseline` é aplicado **depois** da geração, apenas para enriquecer a comparação do relatório. O prompt recebe médias gerais, narrativas e o território mais ressonante, mas não recebe os padrões de abertura que funcionaram.

No coletivo, `collectTerritory` já calcula rankings de `fala`, retenção e engajamento. Porém o snapshot semanal persistido guarda apenas assets, assuntos, tons, horários e durações; as tabelas abertas, incluindo `fala`, não entram no snapshot. Além disso, frases exatas são esparsas e não são uma representação segura ou reutilizável de um padrão de gancho.

Conclusão: não falta um novo analisador de vídeo. Faltam uma **camada de recuperação de evidências de gancho**, um **contrato de recomendação mais rico** e um **loop de resultado ligado à variante escolhida**.

## Experiência proposta

### Fluxo

1. Criador toca em `+` e envia o vídeo como hoje.
2. O sistema entende promessa, tensão, prova, virada, assunto, território e o material forte que já está dentro do vídeo.
3. O sistema busca padrões relevantes no histórico do criador e no território.
4. A primeira tela do resultado abre com uma única recomendação:
   - frase falada;
   - texto na tela, quando diferente;
   - primeiro frame/ação sugerida;
   - uma justificativa curta e concreta.
5. Duas alternativas ficam abaixo, recolhidas:
   - **Mais a sua cara**;
   - **Mais forte no território** ou **Experimento**.
6. O Raio X atual continua abaixo: potencial, sinais, comparação histórica, desenvolvimento e demais ajustes.
7. Ações principais: `Copiar gancho`, `Usar este` e `Ver outras versões`.

### Princípio de hierarquia

O gancho recomendado é a decisão principal; o restante explica e sustenta a decisão. Não abrir a experiência com uma nota ou com cinco dimensões concorrentes.

### Exemplo de saída

Para um vídeo fitness que mostra o exercício antes de explicar o erro:

> “Se você sente o glúteo menos que a lombar nesse exercício, o problema pode estar aqui.”

- Texto na tela: `Glúteo ou lombar?`
- Primeiro frame: mostrar a execução que causa o erro antes da explicação.
- Por que cabe: usa a dor já demonstrada no vídeo, preserva o tom didático do criador e aplica um padrão de diagnóstico que tem sinal no território.

## Motor de recomendação

### 1. Entendimento do vídeo

Extrair e estruturar antes de escrever:

- promessa real do conteúdo;
- problema, desejo ou tensão reconhecível;
- prova disponível no vídeo;
- melhor fala/cena já existente;
- nível de consciência necessário para entender o assunto;
- tom, formato e território;
- restrições de fidelidade: o gancho não pode prometer algo que o vídeo não entrega.

### 2. Evidência do próprio criador

Recuperar Reels recentes com cena processada e resultado válido. Ordenar por resultado relativo ao próprio histórico, não por alcance absoluto.

Sinais prioritários para abertura:

- watch time relativo à duração;
- retenção, quando disponível;
- visualizações por alcance como proxy de repetição;
- compartilhamentos + salvamentos por alcance;
- comentários por alcance como sinal secundário.

Retornar padrões e exemplos próprios: primeira fala, texto inicial, tipo de abertura, assunto, tom, enquadramento, tamanho da amostra e força relativa. Limitar repetição para que um único post não domine.

### 3. Evidência do território

Criar um agregado versionado de padrões de gancho por território. O agregado deve classificar aberturas em estruturas reutilizáveis, por exemplo:

- diagnóstico de erro;
- pergunta de identificação;
- contradição/crença quebrada;
- resultado antes do processo;
- confissão ou vulnerabilidade;
- comparação antes/depois;
- lista ou número específico;
- tensão/curiosidade com entrega explícita;
- demonstração visual antes da fala.

Cada padrão precisa trazer janela, quantidade de posts, criadores distintos, índice relativo ao território e nível de evidência (`indício`, `sinal`, `tendência`). Aplicar normalização por criador, winsorização e limite de contribuição por pessoa, reaproveitando as regras do relatório semanal.

Não exibir nem enviar ao criador frases identificáveis de terceiros. Frases de outros criadores podem alimentar a classificação em processamento controlado, mas a recomendação deve usar apenas o padrão agregado e o conteúdo do vídeo atual.

### 4. Geração de candidatos

Gerar de 6 a 10 candidatos internos a partir de três estratégias:

- **creator-first**: formato de abertura compatível com o que já funciona para a pessoa;
- **territory-first**: padrão coletivo forte aplicado ao conteúdo real do vídeo;
- **hybrid/experiment**: padrão do território adaptado à voz e aos assets do criador.

### 5. Re-ranking

Reordenar candidatos fora do modelo com critérios explícitos:

- fidelidade ao conteúdo e à entrega do vídeo;
- adequação à voz/narrativa do criador;
- evidência do território;
- clareza nos primeiros 3 segundos;
- presença de tensão, utilidade ou identificação;
- distinção entre candidatos;
- risco de exagero, promessa falsa, clichê ou cópia.

Os pesos devem variar com a confiança disponível:

- histórico forte do criador: mais peso no creator-first;
- histórico parcial: mistura equilibrada;
- cold start: mais peso na estrutura do vídeo e no território;
- território com pouca amostra: reduzir automaticamente a influência coletiva.

O score serve para ordenar e auditar; não aparece para o usuário.

## Novo contrato de dados

Manter `suggestedHook` por compatibilidade e adicionar um contrato versionado:

```ts
type HookRecommendation = {
  version: string;
  primary: HookCandidate;
  alternatives: HookCandidate[];
  basis: {
    creatorPosts: number;
    territoryPosts: number;
    territoryCreators: number;
    windowDays: number;
    confidence: "low" | "medium" | "high";
  };
};

type HookCandidate = {
  id: string;
  spokenLine: string;
  onScreenText: string | null;
  firstFrameDirection: string | null;
  deliveryDirection: string | null;
  strategy: "creator_first" | "territory_first" | "hybrid";
  pattern: string;
  whyForThisVideo: string;
};
```

Persistir também a variante copiada/escolhida e a versão do recomendador. Não persistir frases-fonte de terceiros no diagnóstico do usuário.

## Plano de implementação

### Fase 0 — auditoria de prontidão

Objetivo: saber em quais territórios a promessa já pode ser confiável.

- Medir cobertura de `sceneElements`, `openingLine`, `screenTitle`, duração, watch time e território.
- Medir posts e criadores distintos por território em janelas de 30, 60 e 90 dias.
- Verificar distribuição dos sinais de retenção e intenção.
- Definir mínimos para `indício`, `sinal` e `tendência` e listar territórios sem base.
- Validar LGPD/termos para uso agregado de conteúdo publicado na inteligência coletiva.

Saída: matriz de cobertura por território e decisão de quais entram no beta.

### Fase 1 — recomendação baseada no próprio criador

Objetivo: melhorar a sugestão com baixo risco e validar a nova experiência.

- Evoluir `creatorEngagementBaselineService` para retornar padrões de hook ranqueados, não apenas exemplos soltos.
- Injetar esses padrões no input do provider **antes** da geração.
- Criar `HookRecommendation` e parser/sanitização versionados.
- Re-ranquear candidatos e manter fallback para `suggestedHook` atual.
- Colocar a recomendação no topo de `ContentAnalysisReport`.
- Adicionar `Copiar`, `Usar este` e alternativas.
- Instrumentar exibição, cópia, seleção, troca de variante e feedback.

Critério de saída: melhora de utilidade/cópia sem piora relevante de latência, falha ou abandono.

### Fase 2 — inteligência de território

Objetivo: adicionar aprendizado coletivo sem copiar criadores.

- Extrair um `hookPattern` canônico na classificação de Reels publicados.
- Estender o fechamento semanal ou criar snapshot específico de padrões de gancho por território.
- Aplicar normalização por criador, amostra efetiva, winsorização e evidência coletiva.
- Criar serviço de leitura que resolva território principal e adjacente, com fallback seguro.
- Injetar apenas padrões agregados e estatísticas no recomendador.
- Liberar por território via feature flag, começando pelos de melhor cobertura.

Critério de saída: recomendação coletiva sempre acompanhada de base mínima e sem vazamento/cópia de frase de terceiros.

### Fase 3 — aprendizado da escolha e do resultado

Objetivo: descobrir quais recomendações realmente melhoram a abertura.

- Salvar qual candidato foi escolhido, copiado ou editado.
- Pedir confirmação simples após a publicação ou permitir vincular o Reel exato.
- Substituir o vínculo ambíguo “único Reel em sete dias” por associação explícita sempre que possível.
- Capturar resultado normalizado da publicação e ligar à variante/padrão usado.
- Atualizar pesos do recomendador somente com volume mínimo e de forma conservadora.
- Separar performance do gancho de performance total do post.

Critério de saída: conjunto confiável de recomendações com variante e resultado vinculados.

### Fase 4 — experimento controlado

Comparar:

- controle: `suggestedHook` atual;
- tratamento A: histórico do criador;
- tratamento B: histórico do criador + território.

Estratificar por território e maturidade do histórico. Não comparar somente alcance bruto.

## Métricas

### Adoção

- recomendação exibida / análises concluídas;
- cópia ou escolha / recomendação exibida;
- troca entre alternativas;
- vínculo com publicação;
- nova análise no período.

### Qualidade percebida

- “serve para o meu vídeo”;
- “parece a minha voz”;
- feedback de intenção não compreendida;
- taxa de edição antes de copiar/usar;
- duplicidade e clichês entre recomendações.

### Resultado

- watch time relativo à duração versus baseline do criador;
- retenção relativa, quando disponível;
- visualizações por alcance;
- compartilhamentos + salvamentos por alcance;
- resultado por padrão, território e faixa de confiança.

### Guardrails

- latência p50/p95 e custo por análise;
- taxa de parse/fallback/falha;
- abandono do fluxo;
- promessa não entregue pelo vídeo;
- exposição de texto de terceiros;
- concentração excessiva em um único criador ou post.

## Arquivos e áreas principais

- `src/app/dashboard/boards/videoUpload/creatorEngagementBaselineService.ts`
- `src/app/dashboard/boards/videoUpload/videoNarrativeAiProviderTypes.ts`
- `src/app/dashboard/boards/videoUpload/videoNarrativeGeminiPromptBuilder.ts`
- `src/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisOrchestrator.ts`
- novo módulo de contrato/ranking de recomendação de gancho
- `src/app/dashboard/boards/components/videoUpload/appPreview/ContentAnalysisReport.tsx`
- `src/app/dashboard/boards/components/videoUpload/appPreview/MobileStrategicProfileAnalyzeFlow.tsx`
- `src/app/models/CreatorVideoNarrativeDiagnosis.ts`
- `src/app/models/Metric.ts` e pipeline de `sceneEvaluation`
- `src/app/lib/relatorio/collectTerritory.ts`
- `src/app/lib/relatorio/weeklyReportService.ts`
- `src/app/models/WeeklyTerritoryReport.ts` ou novo snapshot específico
- `src/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry.ts`
- fluxo de `publish-intent` e reconciliação de resultado

## Riscos e decisões

1. **Confundir correlação com causa.** Um gancho aparece em posts bons, mas pode não ser a causa. Mitigar com linguagem de evidência, resultado relativo e teste controlado.
2. **Copiar outro criador.** Trabalhar com arquétipos agregados; nunca entregar frase de terceiro como sugestão.
3. **Um criador grande dominar o território.** Normalizar dentro de cada perfil e limitar contribuição por pessoa.
4. **Prometer viralização.** Posicionar como recomendação de abertura para aumentar clareza e chance de atenção, sem garantia.
5. **Gancho forte, vídeo fraco.** Fidelidade à promessa é portão de qualidade: nenhum candidato pode abrir uma promessa que o vídeo não entrega.
6. **Cold start.** Declarar base baixa e usar estrutura do vídeo + território; não inventar personalização.
7. **Latência.** Recuperar agregados prontos em paralelo com o upload/análise e evitar agregação de toda a base na requisição.

## Ordem recomendada

Começar pela Fase 0 e pela Fase 1. Elas corrigem a falha mais objetiva do fluxo atual: os próprios ganchos do criador existem, mas não participam da geração. Em seguida, ligar o motor coletivo do território por snapshot agregado. Só depois otimizar pesos com performance, porque sem saber qual variante foi usada qualquer aprendizado pós-publicação será frágil.
