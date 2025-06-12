/**
 * @fileoverview Testes unitários para o módulo de funções da IA do Administrador.
 * @version 2.0.0
 * @description Este arquivo contém testes para cada uma das ferramentas exportadas
 * por `adminAiFunctions.ts`. Ele utiliza mocks para isolar a lógica de cada
 * executor e garantir que eles se comportem como esperado.
 * ## Melhorias na Versão 2.0.0:
 * - Testes atualizados para corresponder à assinatura de função que espera um
 * único objeto de argumentos (ex: `fetchTopCreators({ context, ... })`).
 */

// --- Configuração dos Mocks ---
// Simula os módulos que são importados pelo adminAiFunctions
jest.mock('./logger', () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  }));
  
  jest.mock('./knowledge/algorithmKnowledge', () => ({ getAlgorithmOverview: jest.fn(() => "Visão geral do algoritmo.") }));
  jest.mock('./knowledge/pricingKnowledge', () => ({ getInstagramPricingRanges: jest.fn(() => "Faixas de preço do Instagram.") }));
  // Adicione mocks para os outros arquivos de conhecimento conforme necessário.
  
  jest.mock('./dataService/marketAnalysisService', () => ({
    ...jest.requireActual('./dataService/marketAnalysisService'), // Mantém os enums e tipos reais
    fetchMarketPerformance: jest.fn(),
    fetchTopCreators: jest.fn(),
    getAvailableContexts: jest.fn(),
    findGlobalPostsByCriteria: jest.fn(),
    getCreatorProfile: jest.fn(),
  }));
  
  // --- Importações ---
  import { adminFunctionExecutors } from './adminAiFunctions';
  import {
      fetchMarketPerformance, 
      fetchTopCreators,
      getCreatorProfile
  } from './dataService/marketAnalysisService';
  
  // Tipando os mocks para facilitar o uso nos testes
  const mockedFetchTopCreators = fetchTopCreators as jest.Mock;
  const mockedFetchMarketPerformance = fetchMarketPerformance as jest.Mock;
  const mockedGetCreatorProfile = getCreatorProfile as jest.Mock;
  
  describe('Admin AI Function Executors', () => {
  
    // Limpa os mocks antes de cada teste para garantir isolamento
    beforeEach(() => {
      jest.clearAllMocks();
    });
  
    // --- Testes para getTopCreators ---
    describe('getTopCreators', () => {
      it('deve chamar o serviço de dados com o objeto de argumentos correto e formatar a resposta', async () => {
        const mockResult = [{ creatorName: 'Admin', creatorId: '1', metricValue: 100 }];
        mockedFetchTopCreators.mockResolvedValue(mockResult);
  
        const args = { context: 'Humor', metric: 'shares', limit: 1, periodDays: 30 };
        const response = await adminFunctionExecutors.getTopCreators(args) as any;
  
        // ATUALIZADO: Verifica se a função foi chamada com um único objeto.
        expect(mockedFetchTopCreators).toHaveBeenCalledWith({
          context: 'Humor',
          metricToSortBy: 'shares',
          days: 30,
          limit: 1
        });
        expect(response.summary).toContain("Ranking dos top 1 criadores");
        expect(response.visualizations[0].type).toBe('bar_chart');
        expect(response.visualizations[0].data[0].name).toBe('Admin');
      });
  
      it('deve retornar um erro se os argumentos forem inválidos', async () => {
        const args = { metric: 'metrica_invalida' }; // Métrica não permitida pelo Zod enum
        const response = await adminFunctionExecutors.getTopCreators(args) as any;
        expect(response.error).toContain("Argumentos inválidos");
      });
    });
  
    // --- Testes para getCreatorProfile ---
    describe('getCreatorProfile', () => {
      it('deve retornar o perfil formatado de um criador quando encontrado', async () => {
          const mockProfile = {
              creatorName: 'Admin User',
              postCount: 50,
              avgLikes: 1500,
              avgShares: 200,
              avgEngagementRate: 0.055,
              topPerformingContext: 'Tecnologia'
          };
          mockedGetCreatorProfile.mockResolvedValue(mockProfile);
  
          const args = { creatorName: 'Admin User' };
          const response = await adminFunctionExecutors.getCreatorProfile(args) as any;
          
          expect(mockedGetCreatorProfile).toHaveBeenCalledWith({ name: 'Admin User' });
          expect(response.summary).toContain('Admin User tem 50 posts analisados');
          expect(response.visualizations.length).toBe(3);
          expect(response.visualizations[0].data.value).toBe('5.50');
      });
  
      it('deve retornar uma mensagem de sumário se o criador não for encontrado', async () => {
          mockedGetCreatorProfile.mockResolvedValue(null);
  
          const args = { creatorName: 'Inexistente' };
          const response = await adminFunctionExecutors.getCreatorProfile(args) as any;
          
          expect(response.summary).toContain("Não foi possível encontrar um perfil");
          expect(response.visualizations).toBeUndefined();
      });
    });
    
    // --- Testes para getMarketPerformance ---
    describe('getMarketPerformance', () => {
       it('deve calcular e formatar corretamente a performance do mercado', async () => {
          const mockPerformance = { postCount: 100, avgEngagementRate: 0.0475 };
          mockedFetchMarketPerformance.mockResolvedValue(mockPerformance);
  
          const args = { format: 'Reel', proposal: 'Educativo', periodDays: 90 };
          const response = await adminFunctionExecutors.getMarketPerformance(args) as any;
  
          // ATUALIZADO: Verifica se a função foi chamada com um único objeto.
          expect(mockedFetchMarketPerformance).toHaveBeenCalledWith({
            format: 'Reel',
            proposal: 'Educativo',
            days: 90
          });
          expect(response.summary).toContain('Análise de 100 posts');
          expect(response.visualizations[0].type).toBe('kpi');
          expect(response.visualizations[0].data.value).toBe('4.75');
       });
    });
  });
  