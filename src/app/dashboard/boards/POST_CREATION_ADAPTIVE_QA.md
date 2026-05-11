# QA da experiencia adaptativa do Board de Criacao de Post

Este checklist valida a experiencia adaptativa como jogo estrategico antes de liberar a feature flag para teste interno real.

## Objetivo

Garantir que o fluxo adaptativo:

- aparece apenas quando a feature flag ou override permitido estiver ativo;
- transforma o input livre em quiz estrategico;
- usa o gabarito do AnswerKey e contratos GameQuestion validos;
- trava a resposta apos a primeira escolha;
- mostra feedback com motivo e evidencias reais;
- cai na tela final antiga com pauta, score, collabs, marcas e acoes;
- nao altera endpoints, planner, eventos ou fluxo legado quando a flag esta off.

## Pre-condicoes

- Rodar localmente com usuario autenticado.
- Ter um usuario comum e um usuario com `role` igual a `admin` ou `dev`.
- Abrir o Board de Criacao de Post no dashboard.
- Usar DevTools para inspecionar `localStorage`, Network, responsividade e chamadas de draft/eventos.
- Para testar flag OFF, confirmar que `NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED` nao esta definido como `"1"`.

## Como ativar

### Env global

```bash
NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED=1
```

Resultado esperado: a experiencia adaptativa aparece para todos os usuarios autorizados pelo fluxo atual.

### Query para admin/dev

Abrir o board com:

```text
?adaptiveBoard=1
```

Resultado esperado:

- o board entra na experiencia adaptativa;
- `localStorage["d2c:postCreationAdaptiveEnabled"]` fica igual a `"1"`;
- o fluxo legado continua disponivel quando a flag/override nao estiver ativo.

### LocalStorage para admin/dev

```js
localStorage.setItem("d2c:postCreationAdaptiveEnabled", "1");
```

Recarregar a pagina.

Resultado esperado: a experiencia adaptativa aparece.

## Como desativar

Abrir com:

```text
?adaptiveBoard=0
```

Resultado esperado:

- o override local e removido;
- a experiencia adaptativa deixa de aparecer;
- o fluxo legado segue funcional.

Tambem e possivel executar:

```js
localStorage.removeItem("d2c:postCreationAdaptiveEnabled");
```

## Regressao automatizada

Rodar a bateria minima da experiencia adaptativa:

```bash
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveRegression.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveFeatureFlag.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveSnapshot.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveDecisionViewModel.test.ts src/app/dashboard/boards/postCreationAdaptiveAnswerKey.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveStudyContext.test.ts src/app/dashboard/boards/postCreationAdaptiveGameContract.test.ts src/app/dashboard/boards/postCreationAdaptiveQuizGameCompatibility.test.ts
npm test -- --runInBand src/app/dashboard/boards/postCreationAdaptiveRouter.test.ts src/app/dashboard/boards/postCreationAdaptiveQuizBuilder.test.ts src/app/dashboard/boards/postCreationAdaptivePlanPresentation.test.ts
npm test -- --runInBand src/app/dashboard/boards/components/PostCreationAdaptiveNativeQuestionStage.test.tsx src/app/dashboard/boards/components/PostCreationAdaptiveNativeFlow.test.tsx src/app/dashboard/boards/components/PostCreationAdaptiveNativePlanStage.test.tsx
npm run typecheck
npm run build
```

Esperado:

- todos os modos geram perguntas com 4 opcoes;
- todos os contratos GameQuestion ficam validos;
- respostas ideais fazem score 100%;
- respostas erradas continuam gerando feedback seguro;
- snapshots antigos e atuais continuam normalizando;
- feature flag e overrides continuam respeitados.

## Cenario A: flag OFF

Passos:

1. Garantir que `NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED` nao e `"1"`.
2. Abrir o board sem `adaptiveBoard=1`.
3. Usar usuario comum.

Esperado:

- a experiencia adaptativa nao aparece;
- o fluxo legado continua igual;
- nao ha chamadas adaptativas iniciadas por UI escondida;
- `?adaptiveBoard=1` ou localStorage nao habilitam a experiencia para usuario comum.

## Cenario B: tela inicial IA

Passos:

1. Ativar a experiencia como admin/dev.
2. Abrir o board.

Esperado:

- a tela inicial mostra "Teste sua leitura estrategica";
- o campo parece um composer de IA, nao um formulario comum;
- as sugestoes prontas preenchem o campo sem submeter automaticamente;
- o CTA principal e "Montar meu jogo estrategico".

## Cenario C: format_guidance

Inputs:

```text
Quero saber qual formato usar
Melhor reels ou carrossel?
Qual formato usar para falar sobre skincare no verao?
```

Esperado:

- o router cai em `format_guidance`;
- o quiz e especifico de formato;
- toda pergunta tem exatamente 4 opcoes;
- ao clicar em uma opcao, a resposta vira aposta final;
- nao e possivel trocar a resposta;
- voltar para uma pergunta respondida mostra a resposta marcada e bloqueia as demais;
- o feedback mostra "Boa aposta" ou "Quase";
- o feedback mostra motivo da resposta certa/errada quando GameContract estiver disponivel;
- a final antiga comeca com "Formato recomendado".

## Cenario D: validate_pauta

Input:

```text
Quero gravar um POV sobre minha familia fazendo barulho quando tento relaxar
```

Esperado:

- detecta `validate_pauta`;
- o PromptContextCard mostra "Voce perguntou";
- o quiz mostra feedback com evidencias quando houver StudyContext;
- a resposta trava apos selecao;
- ao terminar, cai na tela final antiga;
- a final comeca com "Pauta refinada";
- salvar pauta, gerar roteiro/acoes finais e gerar outra pauta continuam visiveis conforme o fluxo antigo.

## Cenario E: discover_pauta

Input:

```text
Nao sei o que postar essa semana
```

Esperado:

- detecta `discover_pauta`;
- gera quiz e gabarito estrategico;
- final comeca com "Pauta recomendada";
- score nao substitui ProjectionSummaryCard, collabs, marcas ou acoes.

## Cenario F: brand_match

Input:

```text
Quero atrair marcas de beleza
```

Esperado:

- detecta `brand_match`;
- o gabarito pode usar sinais comerciais do StudyContext;
- final comeca com "Match de marca recomendado";
- BrandNarrativeMatchesPanel continua aparecendo quando houver dados;
- abrir relatorio de marca segue funcionando quando disponivel.

## Cenario G: collab_match

Input:

```text
Quero uma ideia de collab
```

Esperado:

- detecta `collab_match`;
- o quiz usa decisoes de collab;
- final comeca com "Collab recomendada";
- CollabCreatorsCard continua aparecendo quando houver dados.

## Cenario H: comment_to_post

Input:

```text
Transforma esse comentario em post: como lidar com barulho em casa?
```

Esperado:

- detecta `comment_to_post`;
- o comentario original acompanha a estrategia;
- final comeca com "Comentario transformado em pauta";
- nao gera roteiro automaticamente.

## Cenario I: weekly_plan

Input:

```text
Quero organizar minha semana de conteudo
```

Esperado:

- detecta `weekly_plan`;
- o quiz orienta cadencia e intencao da semana;
- final comeca com "Direcao semanal recomendada".

## Cenario J: feedback e trava da aposta

Passos:

1. Responder a primeira pergunta.
2. Tentar clicar em outra alternativa da mesma pergunta.
3. Avancar.
4. Voltar para a pergunta respondida.
5. Tentar trocar a resposta.

Esperado:

- a primeira escolha permanece marcada;
- as outras opcoes ficam bloqueadas, mas legiveis;
- nenhuma nova chamada ou mutacao de resposta ocorre por clique bloqueado;
- o botao "Proxima decisao" continua avancando;
- a ultima pergunta continua finalizando o jogo.

## Cenario K: tela final antiga

Ao terminar qualquer modo, validar:

- PromptContextCard com "A partir da sua pergunta", quando houver prompt;
- PostCreationAdaptiveScoreCard compacto;
- ProjectionSummaryCard;
- CollabCreatorsCard;
- BrandNarrativeMatchesPanel;
- IdeaActionButtons;
- salvar pauta;
- gerar outra pauta/estrategia;
- abrir relatorio de marca, se existir;
- o score nao rouba protagonismo da pauta.

## Cenario L: snapshot e restauracao

Passos:

1. Iniciar fluxo adaptativo.
2. Responder pelo menos uma pergunta.
3. Aguardar autosave.
4. Recarregar a pagina.
5. Continuar o quiz.
6. Finalizar.
7. Recarregar novamente, se houver plano em snapshot.

Esperado:

- input, detection, perguntas e respostas sao restaurados;
- respostas ja dadas continuam travadas;
- snapshots antigos sem campos novos continuam abrindo;
- o contrato persistido de `answers` nao muda.

## Cenario M: mobile

Validar pelo menos em `390x844` e `375x667`. Se possivel, validar tambem Safari mobile real.

- o composer inicial nao ocupa a tela inteira;
- o CTA "Montar meu jogo estrategico" fica visivel e clicavel;
- opcoes do quiz ficam legiveis em uma coluna;
- feedback com motivo/evidencias nao quebra layout;
- pills de evidencia fazem wrap sem scroll horizontal;
- CTA de proxima decisao nao fica coberto por overlay;
- CTA continua acessivel depois de feedback longo;
- voltar para pergunta respondida mantem a resposta travada e o CTA acessivel;
- acoes finais continuam acessiveis.

Checklist de overlay/safe area:

- nao existe zoom horizontal;
- o final do fluxo tem respiro abaixo dos botoes;
- bottom navigation, sidebar ou overlay do dashboard nao cobrem "Proxima decisao", "Ver plano estrategico" ou acoes finais;
- textos longos em prompt, feedback, evidencias e proxima acoes quebram linha dentro do card.

## Cenario N: Network e efeitos colaterais

Com DevTools > Network:

- cliques bloqueados nao geram chamadas extras;
- nao ha chamada OpenAI;
- nao ha salvamento automatico no planner;
- nao ha geracao automatica de roteiro;
- endpoints adaptativos existentes nao recebem contrato novo de resposta.

## Limitacoes conhecidas

- StudyContext ainda e client-side e usa dados ja disponiveis no board.
- Nao ha busca direta no banco real nesta fase.
- A experiencia nao usa IA generativa.
- O QA de mobile/overlay pode demandar fase propria se aparecer problema visual.
- Marcas e collabs dependem dos dados que a tela antiga ja possui.
- O score/evidencias nao sao persistidos como entidade propria no draft nesta fase.

## Criterios de bloqueio

Bloquear liberacao interna se qualquer item ocorrer:

- usuario comum consegue ativar a experiencia sem permissao;
- flag OFF mostra UI adaptativa para usuario comum;
- qualquer modo gera pergunta fora do contrato de 4 opcoes;
- GameQuestion invalido aparece em fluxo real;
- resposta pode ser trocada apos selecao;
- feedback revela gabarito antes da resposta;
- final nao cai na tela antiga;
- salvar pauta, collabs, marcas ou acoes finais desaparecem sem intencao;
- build, typecheck ou bateria adaptativa quebram.
