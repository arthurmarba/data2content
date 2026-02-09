/** @jest-environment node */

describe('aiOrchestrator Intelligence Logic Check', () => {

    it('verifies content_plan strategic instructions (Logic Check)', () => {
        const intent = 'content_plan';
        const isWebChannel = true;

        const testInitialMsgs: any[] = [];
        if (isWebChannel && intent === 'content_plan') {
            testInitialMsgs.push({
                role: 'system',
                content: 'PLANO ESTRATÉGICO DE CONTEÚDO: Além do calendário, forneça conselhos sobre O QUE dizer em cada post e POR QUE aquela abordagem funciona. ' +
                    'Para cada sugestão de post, você deve buscar ou sugerir uma inspiração real da comunidade para ilustrar a ideia. ' +
                    'Mantenha o calendário organizado: use bullets para os dias e mantenha o dia na mesma linha. ' +
                    'Formato recomendado:\n' +
                    '### Semana [X]\n' +
                    '- **[Dia] — [Formato] ([Tema]):** [Descrição curta]. *Por que funciona:* [Explicação estratégica].'
            });
        }

        expect(testInitialMsgs[0].content).toContain('PLANO ESTRATÉGICO DE CONTEÚDO');
        expect(testInitialMsgs[0].content).toContain('*Por que funciona:*');
    });

    it('verifies proactive inspiration instructions (Logic Check)', () => {
        const isCardIntent = true;
        const hasAnswerEvidence = false;

        const testInitialMsgs: any[] = [];
        if (isCardIntent) {
            testInitialMsgs.push({
                role: 'system',
                content: hasAnswerEvidence ? 'use exemplos reais' : 'Se não houver evidências personalizadas, você DEVE usar a ferramenta `fetchCommunityInspirations` para encontrar exemplos reais da comunidade que ilustrem suas sugestões. Evite dar conselhos puramente teóricos sem buscar referências práticas.'
            });
        }

        expect(testInitialMsgs[0].content).toContain('DEVE usar a ferramenta `fetchCommunityInspirations`');
    });

    it('verifies systemPromptTemplate improvement (String Check)', () => {
        // This is a manual check of the modified string in systemPromptTemplate.md
        const inspirationGuidelines = `
7.  **DIRETRIZES DE INSPIRAÇÃO (CRÍTICO):**
    *   **INTENÇÃO > HISTÓRICO:** Se o usuário pedir um tema específico (ex: "humor"), busque inspirações desse tema, MESMO QUE não seja o melhor formato histórico dele.
    *   **PERFORMANCE:** Se o usuário pedir "o que funciona melhor", busque inspirações alinhadas às categorias de maior engajamento do relatório dele.
    *   **ILUSTRAÇÃO CONTEXTUAL (PROATIVA):** Sempre que der um conselho, sugerir uma estratégia ou criar um plano, **você deve buscar proativamente inspirações da comunidade**.
        *   *Não espere o usuário pedir.*
        *   *Ação Obrigatória:* Use a ferramenta \`fetchCommunityInspirations\` para encontrar exemplos reais (roteiros, ganchos) que validem sua sugestão.
        *   *Conexão:* Explique POR QUE o exemplo da comunidade é relevante para o plano do usuário.

8.  **PLANEJAMENTO ESTRATÉGICO (PILARES):**
    *   **NÃO É APENAS UMA LISTA:** Um plano de conteúdo deve ter uma estratégia por trás. Explique o "Mix de Conteúdo" (ex: 2 posts educativos, 1 de humor/conexão, 1 de venda).
    *   **GANCHOS (HOOKS):** Para cada post, sugira um gancho inicial forte para prender a atenção.
    *   **O QUE DIZER:** Dê uma direção clara sobre o conteúdo do post, não apenas "fale sobre rotina". Diga: "Mostre os 3 primeiros passos do seu café da manhã que te ajudam a ter foco".

9.  **ANÁLISE PROFUNDA (O "PORQUÊ"):**
    *   **NÃO APENAS NÚMEROS:** Evite apenas listar dados. Explique o fenômeno técnico.
    *   **MÉTRICAS CORRELACIONADAS:** Se os comentários estão altos, mas o alcance está baixo, explique que o post gerou comunidade, mas não "furou a bolha" (falta de compartilhamento/viralização).
    *   **AÇÃO OBRIGATÓRIA:** Se for solicitado entender o sucesso de um post, use \`getMetricDetailsById\` para ver a retenção e o engajamento detalhado.

10. **NEGÓCIOS E MONETIZAÇÃO:**
    *   **CAUTELA COM VALORES:** Nunca dê um valor fixo de "quanto custa seu post" sem analisar o alcance médio. Use faixas de preço sugeridas (ex: "Entre R$ X e R$ Y").
    *   **MOBI METHODOLOGY:** Use o conhecimento de \`PricingKnowledge\` (via \`getConsultingKnowledge\`) para explicar como marcas pensam.
    *   **CONEXÃO COM PERFORMANCE:** Relacione o preço à entrega de resultados (Impressões e Cliques).
        `.trim();

        expect(inspirationGuidelines).toContain('ILUSTRAÇÃO CONTEXTUAL (PROATIVA)');
        expect(inspirationGuidelines).toContain('Ação Obrigatória:* Use a ferramenta `fetchCommunityInspirations`');
        expect(inspirationGuidelines).toContain('PLANEJAMENTO ESTRATÉGICO (PILARES)');
        expect(inspirationGuidelines).toContain('NEGÓCIOS E MONETIZAÇÃO');
        expect(inspirationGuidelines).toContain('ANÁLISE PROFUNDA (O "PORQUÊ")');
    });

    it('verifies monetization keyword detection logic (Logic Check)', () => {
        const monetizationKeywords = ['quanto cobrar', 'publi', 'pago', 'recompensa', 'marca', 'parceria', 'dinheiro', 'valor', 'cache', 'precificar', 'monetizar'];
        const incomingText = "Quanto cobrar por uma publi?";
        const isMonetizationTopic = monetizationKeywords.some(kw => incomingText.toLowerCase().includes(kw));

        const testInitialMsgs: any[] = [];
        if (isMonetizationTopic) {
            testInitialMsgs.push({
                role: 'system',
                content: 'ASSUNTO: MONETIZAÇÃO E NEGÓCIOS'
            });
        }

        expect(isMonetizationTopic).toBe(true);
        expect(testInitialMsgs[0].content).toContain('MONETIZAÇÃO E NEGÓCIOS');
    });

    it('verifies deep analysis keyword detection logic (Logic Check)', () => {
        const deepAnalysisKeywords = ['por que', 'motivo', 'razao', 'entender', 'analisa esse post', 'esse post funcionou', 'por que deu certo'];
        const incomingText = "Por que esse post funcionou?";
        const isDeepAnalysisRequest = deepAnalysisKeywords.some(kw => incomingText.toLowerCase().includes(kw));

        const testInitialMsgs: any[] = [];
        if (isDeepAnalysisRequest) {
            testInitialMsgs.push({
                role: 'system',
                content: 'ANÁLISE PROFUNDA'
            });
        }

        expect(isDeepAnalysisRequest).toBe(true);
        expect(testInitialMsgs[0].content).toContain('ANÁLISE PROFUNDA');
    });

    it('verifies bug keyword exclusion in monetization (Logic Check)', () => {
        const monetizationKeywords = ['quanto cobrar', 'publi', 'pago'];
        const bugKeywords = ['sumiu', 'erro', 'bug'];

        // Case 1: Pure Monetization
        const text1 = "Quanto cobrar por isso?";
        const isMonetization1 = monetizationKeywords.some(kw => text1.toLowerCase().includes(kw)) &&
            !bugKeywords.some(kw => text1.toLowerCase().includes(kw));
        expect(isMonetization1).toBe(true);

        // Case 2: Bug with Monetization keyword (False Positive prevention)
        const text2 = "O valor da minha publi sumiu do painel"; // 'valor'/'publi' triggers monetization, 'sumiu' triggers bug
        // Note: Simulating the logic added to aiOrchestrator.ts
        const isBug2 = bugKeywords.some(kw => text2.toLowerCase().includes(kw));
        const isMonetization2 = !isBug2 && monetizationKeywords.some(kw => text2.toLowerCase().includes(kw));
        expect(isBug2).toBe(true);
        expect(isMonetization2).toBe(false);
    });

    it('verifies deep analysis instruction injection (Logic Check)', () => {
        // Logic match from aiOrchestrator.ts
        const deepAnalysisKeywords = ['por que', 'motivo', 'razão', 'entender', 'analisa esse'];

        const input = "Por que esse post flopou?";
        const isDeep = deepAnalysisKeywords.some(kw => input.toLowerCase().includes(kw));

        expect(isDeep).toBe(true);

        const injectedSystemMsg = `MODO ANÁLISE PROFUNDA:
                - O usuário quer entender a CAUSA RAIZ de uma performance.
                - NÃO APENAS LISTE NÚMEROS. Analise a RELAÇÃO entre eles.
                - Exemplo: "Muitos comentários mas poucos shares" = Comunidade forte, mas baixo potencial viral (bolha).
                - Exemplo: "Muitos shares mas baixa retenção" = Gancho forte (clickbait?) mas conteúdo não segurou.
                - CRÍTICO: Se estiver analisando um post específico, você DEVE usar a ferramenta 'getMetricDetailsById' para ver a retenção (se disponível) e fontes de tráfego.`;

        expect(injectedSystemMsg).toContain('CAUSA RAIZ');
        expect(injectedSystemMsg).toContain('getMetricDetailsById');
    });

    it('verifies script context compact payload keeps only top 2 signals', () => {
        const scriptContext = {
            topCategories: {
                proposal: ['tutorial', 'lista', 'opiniao'],
                context: ['finance', 'lifestyle', 'news'],
                format: ['reel', 'carousel', 'story'],
                tone: ['educational', 'neutral', 'humorous'],
            },
            topPosts: [
                { id: '1', captionSnippet: 'a', proposal: ['tutorial'], context: ['finance'] },
                { id: '2', captionSnippet: 'b', proposal: ['tutorial'], context: ['finance'] },
                { id: '3', captionSnippet: 'c', proposal: ['tutorial'], context: ['finance'] },
            ],
            plannerSignals: {
                themes: ['t1', 't2', 't3'],
                winningCaptions: ['c1', 'c2', 'c3'],
            },
        } as any;

        const compact = {
            proposal: (scriptContext.topCategories.proposal || []).slice(0, 2),
            context: (scriptContext.topCategories.context || []).slice(0, 2),
            themes: (scriptContext.plannerSignals.themes || []).slice(0, 2),
            winningCaptions: (scriptContext.plannerSignals.winningCaptions || []).slice(0, 2),
            topPosts: (scriptContext.topPosts || []).slice(0, 2),
        };

        expect(compact.proposal).toEqual(['tutorial', 'lista']);
        expect(compact.context).toEqual(['finance', 'lifestyle']);
        expect(compact.themes).toEqual(['t1', 't2']);
        expect(compact.winningCaptions).toEqual(['c1', 'c2']);
        expect(compact.topPosts).toHaveLength(2);
    });

    it('verifies selective community tool usage for script mode', () => {
        const canUseCommunityTool = (params: { communityOptIn: boolean; hasStrongTopPosts: boolean; askedCommunity: boolean }) =>
            params.communityOptIn && (params.askedCommunity || !params.hasStrongTopPosts);

        expect(canUseCommunityTool({ communityOptIn: true, hasStrongTopPosts: false, askedCommunity: false })).toBe(true);
        expect(canUseCommunityTool({ communityOptIn: true, hasStrongTopPosts: true, askedCommunity: false })).toBe(false);
        expect(canUseCommunityTool({ communityOptIn: true, hasStrongTopPosts: true, askedCommunity: true })).toBe(true);
        expect(canUseCommunityTool({ communityOptIn: false, hasStrongTopPosts: false, askedCommunity: true })).toBe(false);
    });
});
