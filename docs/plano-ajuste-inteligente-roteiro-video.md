# Plano — ajuste inteligente de roteiro para o vídeo analisado

## Estado da implementação — 25 de agosto de 2026

O plano técnico desta primeira versão foi implementado no código e está aguardando publicação:

- contrato versionado, sanitização determinística e fallback seguro;
- recomendação temporal com ordem atual, ordem sugerida e passos executáveis;
- prioridade para aproveitar o vídeo existente e evitar regravação desnecessária;
- personalização separada por histórico do criador e sinais agregados do território;
- interface mobile com leitura progressiva, cópia e marcação dos passos usados;
- persistência da recomendação, da seleção e do resultado associado à publicação;
- telemetria e coortes estáveis para comparar controle, vídeo isolado e personalização;
- auditoria agregada por experimento, sem expor texto, perfil ou vídeo;
- feature flags independentes para desligar recomendação, histórico ou território.

As flags estão preparadas em produção para começar por Beleza e Gastronomia. Elas só terão efeito depois de um deploy do código. O deploy não faz parte deste fechamento porque o worktree contém outras alterações ainda não isoladas.

O corpus editorial de 20–30 exemplos revisados continua sendo uma rotina de calibração humana, não um bloqueio técnico. Ele deve ser preenchido com os primeiros casos internos antes de ampliar o beta.

## Objetivo

Evoluir a análise do botão `+` de uma recomendação de abertura para um **copiloto de edição antes da publicação**.

O resultado deve responder, nesta ordem:

1. **Como começar:** qual gancho usar.
2. **Como organizar:** quais partes manter, cortar, encurtar ou mover.
3. **Como executar:** o que falar, mostrar ou escrever em cada momento.
4. **Por que mudar:** uma explicação curta, baseada no vídeo, no criador ou no território.

O gancho continua sendo a entrega principal. O ajuste de roteiro aparece logo abaixo e só recomenda mudanças que tenham utilidade concreta para aquele vídeo.

## Princípios de produto

- **O vídeo enviado é a matéria-prima.** Priorizar o que já foi gravado.
- **Regravar é exceção.** Só pedir uma nova fala ou cena quando o material atual não consegue cumprir a promessa.
- **Toda orientação precisa ser localizável.** Informar qual trecho deve mudar e onde ele deve entrar.
- **Uma recomendação principal.** Não entregar várias estruturas concorrentes na primeira tela.
- **Explicação sem jargão.** O criador não precisa conhecer retenção, payoff, setup ou pattern interrupt.
- **Sem promessa de viralização.** A ferramenta recomenda uma abertura mais clara e uma sequência com mais chance de manter a atenção.
- **Não inventar conteúdo.** O roteiro sugerido não pode afirmar, provar ou prometer algo ausente no vídeo.

## Experiência proposta

### Hierarquia da resposta

#### 1. Gancho para este vídeo

Manter o bloco atual com:

- frase falada;
- texto na tela;
- primeiro frame;
- justificativa curta;
- alternativas recolhidas.

#### 2. Ajuste de roteiro

Abrir com uma conclusão de uma frase, por exemplo:

> Mostre o erro antes da explicação e encurte a introdução. Você consegue fazer isso sem regravar o vídeo.

Em seguida, mostrar:

- **Como está:** `apresentação → explicação → erro → correção → CTA`;
- **Ordem sugerida:** `erro → gancho → correção → explicação curta → CTA`;
- **Esforço:** `Sem regravar`, `Uma fala nova` ou `Nova versão`;
- **Passos por tempo:** ações ligadas aos trechos reais do vídeo.

Exemplo:

> **0–2s — Abra com a demonstração**  
> Use o trecho de 11–13s, em que o erro aparece com clareza.

> **2–5s — Diga o gancho**  
> “Se você sente a lombar aqui, corrija esta posição.”

> **5–12s — Mostre a correção**  
> Mantenha a demonstração atual, mas retire a primeira explicação repetida.

> **12–18s — Explique em uma frase**  
> Use: “Quando o quadril gira, a lombar assume o esforço.”

Cada passo deve permitir uma ação: `Copiar fala`, `Copiar texto` ou, numa fase posterior, marcar que o ajuste foi usado.

#### 3. Por que esta ordem

Mostrar no máximo duas frases por padrão:

> O erro é a imagem mais fácil de entender no seu vídeo, mas hoje aparece tarde. Antecipá-lo deixa claro, logo no início, por que vale continuar assistindo.

Detalhes de evidência ficam recolhidos em `Como chegamos nisso`.

#### 4. Raio X atual

Preservar abaixo do novo bloco as análises já existentes. O Raio X sustenta a recomendação, mas não compete com ela no topo da resposta.

## Padrão obrigatório de linguagem

Todos os textos direcionais devem obedecer a estas regras:

1. **Começar com um verbo de ação:** `Use`, `Corte`, `Mostre`, `Mova`, `Diga`, `Escreva`, `Mantenha`.
2. **Uma ação por instrução.** Se houver duas mudanças, criar dois passos.
3. **Apontar o trecho:** usar tempos como `11–13s` sempre que a análise tiver segurança suficiente.
4. **Ser específico:** trocar “deixe mais dinâmico” por “retire a pausa de 2 segundos antes da demonstração”.
5. **Usar palavras comuns:** `começo`, `explicação`, `prova`, `demonstração`, `final`.
6. **Explicar o motivo em uma frase curta.** Primeiro a ação; depois o motivo.
7. **Não culpar o criador:** descrever o vídeo, não julgar a pessoa.
8. **Não apresentar hipótese como certeza:** usar `pode ajudar`, `a melhor opção encontrada` ou `vale testar` quando a confiança for baixa.

### Termos que não devem aparecer para o usuário

- `payoff`, `setup`, `pattern interrupt`, `creator-first`, `territory-first`;
- `score`, `reranking`, `embedding`, `baseline`, `winsorização`;
- “isso vai viralizar”, “resultado garantido” ou equivalentes;
- frases vagas como “melhore a retenção”, “gere mais conexão” ou “deixe mais envolvente” sem dizer como.

### Validação automática de clareza

Antes de exibir a resposta, aplicar um sanitizador determinístico:

- limite de tamanho por título, instrução e justificativa;
- remoção de jargões e promessas absolutas;
- exigência de verbo de ação nas instruções;
- rejeição de instruções vagas sem trecho ou objeto concreto;
- divisão de instruções com várias ações;
- fallback humano pré-escrito quando a resposta não passa na validação.

O prompt também deve pedir linguagem simples, mas o produto não pode depender apenas da obediência do modelo.

## Como a inteligência funciona

### 1. Mapear o vídeo

Combinar transcrição, cenas, texto na tela e sinais temporais para criar blocos:

- abertura atual;
- contexto;
- problema ou desejo;
- demonstração;
- prova;
- explicação;
- conclusão;
- chamada final.

Cada bloco deve guardar início, fim, resumo, força visual, clareza da fala e relação com a promessa do vídeo.

### 2. Encontrar o material mais forte

Identificar:

- a imagem que se entende mais rápido;
- a fala mais clara;
- o momento em que a promessa é cumprida;
- repetições, pausas e introduções dispensáveis;
- informações necessárias que estão ausentes;
- trechos que não podem ser movidos sem perder sentido.

### 3. Recuperar evidências relevantes

Reutilizar a infraestrutura já criada para o gancho:

- estruturas que funcionaram para o próprio criador;
- padrões agregados do território;
- tom e duração habituais;
- resultado relativo, sem deixar um único post ou criador dominar a decisão.

Além de padrões de abertura, a evolução deve aprender padrões de sequência, como:

- demonstração antes da explicação;
- resultado antes do processo;
- erro → consequência → correção;
- pergunta → prova → resposta;
- antes/depois → causa → orientação.

### 4. Gerar planos internos

Gerar internamente até três alternativas:

- **ajuste rápido:** cortes, texto na tela e mudança de abertura;
- **reorganização:** mover trechos já gravados;
- **nova versão:** regravar apenas o que estiver faltando.

Essas alternativas são internas. A interface mostra primeiro o plano de menor esforço que preserve clareza, fidelidade e potencial de atenção.

### 5. Reordenar com regras explícitas

Ordenar os planos por:

- fidelidade ao que o vídeo entrega;
- possibilidade de usar material existente;
- clareza da sequência;
- força do primeiro momento visual;
- compatibilidade com a voz do criador;
- evidência do território;
- quantidade de mudanças e esforço exigido;
- ausência de repetição, exagero e clichê.

Portões obrigatórios:

- nenhum passo pode citar um trecho inexistente;
- toda nova fala precisa estar alinhada ao conteúdo;
- a ordem proposta deve ser temporalmente possível;
- se a análise não souber os tempos com segurança, deve orientar por cena, sem inventar segundos;
- confiança baixa reduz a ambição da mudança e usa linguagem de teste.

## Contrato de dados proposto

Manter `HookRecommendation` e adicionar um contrato separado, também versionado:

```ts
type ScriptAdjustmentRecommendation = {
  version: string;
  summary: string;
  effort: "no_rerecord" | "one_pickup" | "new_version";
  canUseExistingFootage: boolean;
  currentStructure: StructureBlock[];
  recommendedStructure: StructureBlock[];
  steps: ScriptAdjustmentStep[];
  rationale: string;
  basis: {
    video: true;
    creatorPosts: number;
    territoryPosts: number;
    territoryCreators: number;
    confidence: "low" | "medium" | "high";
  };
};

type StructureBlock = {
  id: string;
  label: string;
  sourceStartMs: number | null;
  sourceEndMs: number | null;
};

type ScriptAdjustmentStep = {
  id: string;
  action: "keep" | "cut" | "shorten" | "move" | "overlay" | "rerecord";
  sourceStartMs: number | null;
  sourceEndMs: number | null;
  targetOrder: number;
  title: string;
  instruction: string;
  suggestedCopy: string | null;
  reason: string;
  confidence: "low" | "medium" | "high";
};
```

Persistir a versão recomendada e as ações escolhidas. Não persistir o arquivo de vídeo além da política temporária atual.

## Plano de desenvolvimento

### Fase 0 — contrato, linguagem e exemplos de ouro

Objetivo: definir o que é uma boa resposta antes de ampliar o modelo.

- Criar `ScriptAdjustmentRecommendation` e sanitizador.
- Criar catálogo de ações e seus rótulos leigos.
- Montar 20–30 exemplos revisados manualmente, cobrindo territórios, vídeos curtos/longos, fala ausente e baixa confiança.
- Definir exemplos de respostas proibidas: vagas, técnicas, agressivas, impossíveis ou com promessa falsa.
- Criar testes de contrato, limites, linguagem e compatibilidade com diagnósticos antigos.
- Prototipar o bloco mobile com conteúdo fixo e validar leitura rápida.

Critério de saída: uma pessoa sem experiência em criação consegue explicar o que deve mudar depois de uma leitura.

### Fase 1 — MVP inteligente baseado no vídeo

Objetivo: recomendar ajustes úteis usando somente evidências presentes no arquivo analisado.

- Evoluir o schema do provider para devolver blocos temporais e plano de ajuste.
- Atualizar o prompt para separar observação, decisão e texto exibido.
- Validar referências de tempo contra a duração real do vídeo.
- Implementar ranking que priorize material existente e menor esforço.
- Adicionar fallback: se não houver mudança segura, responder `Mantenha a estrutura atual` e sugerir apenas o gancho.
- Persistir a recomendação no diagnóstico.
- Mostrar `Ajuste de roteiro` abaixo do gancho, recolhido quando a mudança for mínima.

Critério de saída: nenhum passo impossível, nenhum tempo fora do vídeo e nenhuma fala que contradiga a entrega.

### Fase 2 — personalização por criador e território

Objetivo: escolher a sequência mais adequada, não apenas uma sequência genericamente correta.

- Extrair padrões canônicos de estrutura dos conteúdos publicados.
- Calcular performance relativa da sequência no histórico do criador.
- Adicionar padrões agregados de estrutura aos snapshots de território.
- Exigir amostra mínima e diversidade de criadores para usar o coletivo.
- Ajustar o ranking conforme força das evidências.
- Mostrar a origem em linguagem simples: `Baseado neste vídeo`, `Também considera conteúdos seus` ou `Também considera sinais do seu território`.

Critério de saída: a personalização muda a decisão apenas quando existe evidência suficiente e nunca copia o roteiro de terceiros.

### Fase 3 — ações e aprendizado da escolha

Objetivo: entender quais recomendações o criador realmente usa.

- Instrumentar visualização, expansão, cópia de fala/texto e marcação de passo usado.
- Permitir escolher `Ajuste rápido` ou `Reorganizar vídeo` quando ambos forem seguros.
- Salvar passos adotados ou ignorados.
- Vincular a publicação ao diagnóstico e à versão recomendada.
- Diferenciar `gancho escolhido` de `estrutura adotada`.

Critério de saída: saber qual recomendação foi usada antes de relacioná-la ao resultado do post.

### Fase 4 — resultado e experimento controlado

Objetivo: medir utilidade e melhorar os pesos sem confundir correlação com causa.

- Comparar análise com gancho apenas versus gancho + ajuste de roteiro.
- Estratificar por território, duração, presença de fala e maturidade do histórico.
- Medir adoção e performance relativa ao próprio criador.
- Atualizar pesos apenas com amostra mínima.
- Manter revisão periódica dos textos e dos casos com baixa avaliação.

Critério de saída: ganho de utilidade percebida e adoção sem aumento relevante de abandono, latência ou regravações desnecessárias.

## Arquitetura sugerida

### Novos módulos

- `scriptAdjustmentRecommendation.ts`: contrato, sanitização e fallback.
- `videoNarrativeTimeline.ts`: blocos temporais validados.
- `scriptAdjustmentRanking.ts`: regras e escolha do plano principal.
- `directionalCopyPolicy.ts`: linguagem simples, termos proibidos e validação.
- `creatorStructureEvidence.ts`: padrões do próprio criador.
- `territoryStructureEvidenceService.ts`: padrões coletivos agregados.
- `ScriptAdjustmentCard.tsx`: apresentação mobile e ações.

### Pontos existentes a evoluir

- `videoNarrativeAiProviderTypes.ts` e schema do provider;
- `videoNarrativeGeminiPromptBuilder.ts`;
- `videoNarrativeGeminiResponseParser.ts`;
- `videoNarrativeRealAnalysisOrchestrator.ts`;
- `CreatorVideoNarrativeDiagnosis.ts` e sanitizador;
- `ContentAnalysisReport.tsx`;
- `mobileNarrativeTelemetry.ts`;
- endpoint de escolha e reconciliação do diagnóstico com o Reel publicado.

O Route Handler continua responsável por autenticação, limite e orquestração. A validação e o ranking ficam em módulos de domínio testáveis, sem serem acoplados ao componente React.

## Testes obrigatórios

- contrato e sanitização de cada ação;
- referências de tempo dentro da duração do vídeo;
- passos ordenados e sem conflito de trechos;
- rejeição de promessa não sustentada;
- remoção de jargão e afirmações absolutas;
- fallback de baixa confiança;
- diagnóstico antigo sem `scriptAdjustmentRecommendation`;
- renderização mobile com instruções longas, sem fala e sem regravação;
- telemetria de expansão, cópia, escolha e uso;
- fluxo completo: upload → análise → recomendação → persistência → seleção.

## Métricas

### Utilidade

- abertura do bloco de ajuste;
- cópia de fala ou texto;
- passo marcado como usado;
- avaliação `Isso me ajudou a editar`;
- nova análise após uma edição.

### Clareza

- avaliação `Entendi o que fazer`;
- abandono após abrir a recomendação;
- respostas reprovadas pelo sanitizador;
- instruções editadas antes de serem usadas;
- chamados ou feedbacks indicando dúvida.

### Resultado

- watch time relativo à duração;
- retenção inicial, quando disponível;
- compartilhamentos e salvamentos por alcance;
- resultado por tipo de mudança e confiança;
- diferença entre usar apenas o gancho e usar gancho + estrutura.

### Guardrails

- latência e custo adicionais;
- taxa de parse e fallback;
- regravações sugeridas e efetivamente adotadas;
- tempos inválidos ou ações impossíveis;
- promessa que o vídeo não entrega;
- exposição de conteúdo identificável de terceiros.

## Rollout recomendado

1. Liberar internamente com exemplos reais e revisão humana.
2. Beta pequeno usando apenas o vídeo, sem personalização coletiva.
3. Ligar histórico do criador para perfis com base suficiente.
4. Ligar território apenas em Beleza e Gastronomia, seguindo a prontidão já auditada.
5. Expandir territórios somente após amostra, diversidade e qualidade mínimas.

Usar feature flags separadas para `script adjustment`, personalização do criador e inteligência de território. Isso permite desligar a camada problemática sem remover o gancho já estável.

## Fora do primeiro escopo

- editar ou renderizar automaticamente o vídeo;
- criar uma cópia completa do vídeo sem confirmação;
- gerar roteiro do zero quando o upload não contém material suficiente;
- prometer aumento de alcance ou viralização;
- aprender pesos automaticamente sem volume mínimo e avaliação.

## Definição de pronto da primeira versão

A primeira versão está pronta quando, após analisar um vídeo, o criador recebe:

- um gancho claro;
- uma conclusão simples sobre o que mudar;
- uma ordem sugerida comparável à ordem atual;
- de três a seis passos executáveis e ligados ao vídeo;
- indicação honesta sobre a necessidade de regravar;
- uma justificativa curta e compreensível;
- nenhuma instrução vaga, técnica, impossível ou incompatível com o conteúdo.
