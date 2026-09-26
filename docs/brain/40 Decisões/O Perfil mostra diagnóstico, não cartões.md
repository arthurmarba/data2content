---
tipo: decisão
área: produto
status: decidido em 26/09/2026 · etapa 1 construída, desligada por chave
---

# O Perfil mostra um diagnóstico, não cartões

## A decisão

A aba Perfil deixa de exibir os cartões de padrão ("O que já é regra", "O que vale testar", "Esperando mais posts") e passa a mostrar **um diagnóstico curto, escrito toda segunda**, no tom de uma resposta do Claude. Ele termina numa pergunta que fica em aberto — o gancho para a pessoa continuar a conversa no Claude pelo conector.

Três escolhas do Arthur, em 26/09/2026:

1. **Os cartões saem de vez.** Não ficam atrás de "ver os números".
2. **Escrito na segunda e congelado a semana inteira.** Post novo no meio da semana não reescreve o texto.
3. **O Gemini escreve**, pelo núcleo `src/app/lib/llm/` (escopo `DIAGNOSIS`, sem cair no OpenAI). Considerado e recusado: o próprio Claude pela API, para ter a mesma voz na continuação — ficaria mais um fornecedor para manter, e o Gemini já está todo configurado.

## Enxuto e com a porta do Claude (26/09/2026, segunda rodada)

O Arthur pediu o card mais enxuto e o conector em primeiro plano: "a plataforma vai rodar muito mais no dia a dia pelo Claude do que pelo site". Ficou assim:

- **Ordem do Perfil (ajustada pelo Arthur no mesmo dia):** primeiro quem a pessoa é (foto, nome e narrativa), depois o campo da situação da conta (pagamento, assinatura, conexão do Instagram — e, com tudo em dia, a confirmação "Instagram conectado · lido hoje"), e só então o diagnóstico, que é o que a leitura achou por causa dessa conexão. O campo aparece sempre, inclusive a confirmação, que na Jornada ficava escondida.
- **Manchete, um parágrafo e a pergunta.** O teste da semana sai da tela e vai junto para o Claude.
- **O gancho fecha o card.** Com o conector ativo: um botão, "Continuar no Claude", e a marca "Claude conectado". Sem conector: o passo a passo de três passos no próprio card, com o endereço para copiar, e o mesmo botão no fim.
- **O botão copia o próprio diagnóstico** (manchete, parágrafo, teste e pergunta) e abre uma conversa nova. O pedido manda o Claude partir dele em vez de refazer a análise. Isso resolve a consistência entre site e conversa sem ferramenta nova no conector.
- O link `claude.ai/new?q=` (conversa já escrita) ficou de fora: há relatos de que foi retirado. Copiar e abrir funciona sempre.

## O texto (ajustado em 26/09/2026 depois do primeiro diagnóstico real)

O primeiro diagnóstico real (conta do Arthur) acertou os números e a amostra, mas terminava em "Quer avaliar se vale testar…?" — convite de sim ou não, que não puxa conversa — e tinha manchete genérica ("pistas claras", contradizendo "testes a confirmar"). Regras que ficaram (`diagnosisWriter.ts`, versão `diagnostico_v3`):

- **A pergunta é uma dúvida real** que os fatos ainda não resolvem ("É o sábado ou o enquadramento…?"). Pergunta que começa com "Quer", "Gostaria", "Que tal", "Vamos"… é recusada.
- **A manchete diz a coisa concreta** e concorda com o parágrafo. "Pistas", "insights", "oportunidades" e "potencial" são recusados.
- **Território só quando é evidente.** Os fatos levam os assuntos que a leitura reconheceu; o texto nomeia o território do mapa quando as palavras batem, e não força quando não batem.

## Por quê

Os cartões eram verdadeiros, mas deixavam a síntese para quem lia: dez respostas de peso visual igual, e a pessoa tinha que descobrir sozinha o que aquilo dizia sobre ela. E a gaveta "Peça ao Claude" tinha 26 pedidos genéricos, nenhum nascido do que a pessoa acabou de ler. Uma pergunta aberta sobre os posts dela é motivo mais forte para abrir o Claude.

## O que não mudou

- **O número continua.** Ele vai dentro do texto, sempre com a amostra ("2,3× o seu normal, em 6 posts"), e o multiplicador em negrito. A linha de amostra no pé do card é calculada, nunca escrita pelo modelo. Isto desvia de uma regra da interface ("o índice é o maior tipo do card") por decisão do Arthur, não por descuido.
- **O modelo não descobre nada.** Recebe os fatos já decididos pelo cálculo — a mesma régua de regra/aposta dos cartões (`patternSections.ts`) e as palavras do mapa. Todo número do texto tem de existir nos fatos; se não, a escrita é recusada.

## Consequências aceitas

- Quem não tem o conector fica só com o resumo: os números por trás passam a morar na conversa.
- Se o diagnóstico da semana falhar, a tela mostra o da semana anterior, com a data dele, e diz que atrasou. Nunca texto sem a conferência dos números.
- O diagnóstico só é tão bom quanto o relatório embaixo dele, e o relatório só conta post já classificado — o que ainda depende do saldo do Gemini.

## Etapas

1. **Feita (desligada):** escrever, conferir, guardar e mostrar. Ver [[Jornada e Perfil]].
2. **Parte feita (desligada):** o botão e o passo a passo, com o diagnóstico copiado para a conversa. **Pendente:** a ferramenta do conector que devolve o mesmo diagnóstico guardado (para quem pergunta direto no Claude, sem passar pelo Perfil) e o atalho `weekly_review` partindo dele.
3. **Pendente:** memória — cada semana retoma a pergunta da anterior.

## Ligações

[[Jornada e Perfil]] · [[Relatório Semanal]] · [[MCP — ChatGPT e Claude]] · [[Custo de IA é decisão de arquitetura]]
