import { Configuration, OpenAIApi } from "openai";

/**
 * Em vez de usar uma interface vazia que estenda Record<string, unknown>,
 * definimos um type alias diretamente:
 */
type AggregatedMetrics = Record<string, unknown>;

/**
 * Gera um relatório semanal adaptado aos dados de métricas e período analisado.
 *
 * @param aggregatedMetrics Objeto contendo as métricas agregadas (ex.: top3, bottom3, estatísticas de duração etc.).
 * @param period Texto que indica o período de análise (ex.: "30 dias", "7 dias").
 * @returns Uma string com o relatório gerado pela IA.
 */
export async function generateReport(
  aggregatedMetrics: AggregatedMetrics, // Aceita qualquer chave string
  period: string
): Promise<string> {
  // O 'period' é inserido no prompt para contextualizar o período analisado.
  const prompt = `
Você é um consultor de marketing digital especialista em Instagram e planejamento de conteúdo. 
Período de Análise: ${period}

Utilizando os dados reais do "RELATÓRIO BASE" abaixo, identifique quais são os temas e padrões predominantes no conteúdo do usuário e elabore um relatório semanal detalhado e adaptado, seguindo exatamente o modelo abaixo.  
OBSERVAÇÃO: Os exemplos a seguir são ilustrativos. Utilize os dados do "RELATÓRIO BASE" para substituir os exemplos fixos por informações reais do usuário (por exemplo, se o conteúdo predominante for moda/fitness, adapte o planejamento para esse tema).

------------------------------------------------------------
Relatório Semanal – Planejamento de Conteúdo

1. Planejamento Semanal de Conteúdo

Segunda-Feira: [Tema e Descrição conforme predominância dos dados]  
Formato: [Indicar se Reels ou outro, com duração sugerida]  
Tema/Descrição: [Descrição adaptada aos dados reais, ex.: “Rotina fitness de segunda: 3 dicas para começar a semana com energia”]  
Por que: [Justificativa baseada nos dados, por exemplo, “conteúdo motivacional tem alta receptividade”]  
CTA: [Chamada para ação específica]

Terça-Feira: [Tema e Descrição conforme os dados, ex.: “Looks de verão” ou outro tema identificado]  
Formato: [Indicar formato e duração]  
Tema/Descrição: [Adaptado aos dados reais]  
Por que: [Justificar com base nos dados de engajamento]  
CTA: [Chamada para ação]

Quarta-Feira: [Tema e Descrição]  
Formato: [Ex.: Carrossel (4–5 slides)]  
Tema/Descrição: [Adaptado aos dados]  
Por que: [Racional baseado nas métricas]  
CTA: [Específica e adaptada]

Quinta-Feira: [Tema e Descrição]  
Formato: [Ex.: Reels (~30s)]  
Tema/Descrição: [Adaptado aos dados]  
Por que: [Justificativa dos dados]  
CTA: [Chamada para ação]

Sexta-Feira: [Tema e Descrição]  
Formato: [Ex.: Reels (~30s)]  
Tema/Descrição: [Adaptado aos dados]  
Por que: [Justificação com base nos dados]  
CTA: [Específica e direcionada]

Sábado: [Tema e Descrição]  
Formato: [Ex.: Reels (15–29s)]  
Tema/Descrição: [Adaptado aos dados]  
Por que: [Motivação para o conteúdo do fim de semana]  
CTA: [Chamada para ação]

Domingo: [Tema e Descrição]  
Formato: [Ex.: Reels (15–29s) ou Carrossel]  
Tema/Descrição: [Adaptado aos dados]  
Por que: [Justificativa]  
CTA: [Específica para o dia]

2. Elementos Fundamentais (Alicerces)

- Duração Alvo: Priorizar conteúdos com duração entre 15–29s e testar 60–74s para casos que requeiram mais detalhes.
- Descrição Clara: Assegurar que cada conteúdo tenha tema e proposta definidos, evitando descrições genéricas.
- Consistência dos Temas: Alinhar as recomendações aos temas que se mostram mais indicados nos dados do usuário.
- CTA Direcionada: Incluir chamadas específicas (ex.: “Salve para tentar depois” ou “Compartilhe com quem se identifica”).

3. Métricas-Chave e Duração (Resumo)

- Analisar a relação entre duração e compartilhamentos:
  * 0–14s: [Dados observados]
  * 15–29s: [Dados observados]
  * 30–39s: [Dados observados]
  * 60–74s: [Dados observados]

- Ação: Priorizar a faixa que apresenta melhor equilíbrio entre volume e engajamento.

4. Perguntas para Refinar

- Como adaptar os temas se houver variações no conteúdo do usuário?
- Qual o melhor formato (Reels, Carrossel, etc.) para maximizar o engajamento?
- Que tipo de CTA se mostra mais efetivo?
- Como manter o interesse em conteúdos de fim de semana sem cair na mesmice?

5. Conclusão

Este planejamento semanal deve refletir os dados reais de engajamento do usuário.  
Exemplo:  
- Se os dados indicarem que “moda/fashion” ou “fitness” são os temas predominantes, adapte cada dia para enfatizar esses conteúdos.  
- Use as métricas de engajamento para definir formatos e recomendações ideais, ajustando as sugestões conforme o desempenho observado.

------------------------------------------------------------
RELATÓRIO BASE (Dados Agregados):  
${JSON.stringify(aggregatedMetrics)}

Utilize as informações do relatório base para gerar um relatório adaptado e fiel aos dados reais do usuário.
`;

  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);

  try {
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1800,
    });

    const answer = response.data.choices[0]?.message?.content;
    if (!answer) {
      throw new Error("Nenhuma resposta gerada pela API.");
    }
    return answer;
  } catch (error: unknown) {
    console.error("Erro na geração do relatório:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Desculpe, ocorreu um erro ao gerar o relatório. Detalhes: ${errorMessage}`;
  }
}
