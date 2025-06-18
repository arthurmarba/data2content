import { Types } from 'mongoose';
import getCreatorsScatterPlotData, { ScatterPlotMetricConfig } from './getCreatorsScatterPlotData'; // Ajuste

// Mock individual indicator functions
import calculateFollowerGrowthRate from '@/utils/calculateFollowerGrowthRate';
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';

jest.mock('@/utils/calculateFollowerGrowthRate');
jest.mock('@/utils/calculateAverageEngagementPerPost');

// Mock da função getCreatorLabel (simulada)
// Em uma aplicação real, você pode querer mockar o módulo que a contém se ela fizer chamadas de DB.
// Para este teste, como ela é simples e definida no mesmo arquivo (ou seria em utils),
// não precisamos de um mock complexo dela, a menos que queiramos controlar o nome retornado.
// A implementação atual de getCreatorLabel em getCreatorsScatterPlotData.ts é async, então o mock também deve ser.
const mockGetCreatorLabel = jest.fn(async (userId: string | Types.ObjectId) => `MockUser ${userId.toString().slice(-4)}`);

// Temporariamente mockar a função getCreatorLabel que está no mesmo arquivo de getCreatorsScatterPlotData
// Isto é um pouco hacky. Idealmente, getCreatorLabel seria em seu próprio módulo e mockada como as outras.
// Para fazer isso sem alterar o arquivo original agora, vamos apenas garantir que não quebre.
// Em um cenário real, getCreatorLabel seria importada e, portanto, mockável da mesma forma que os outros utils.
// Como não posso editar o arquivo original para exportá-la para mock, e a função é simples,
// vamos confiar que a implementação dela é trivial. O teste focará na lógica de agregação.
// Se `getCreatorLabel` estivesse em `src/utils/userHelpers.ts`, faríamos:
// jest.mock('@/utils/userHelpers', () => ({ getCreatorLabel: mockGetCreatorLabel }));


describe('getCreatorsScatterPlotData', () => {
  const userId1 = new Types.ObjectId().toString();
  const userId2 = new Types.ObjectId().toString();
  const userId3 = new Types.ObjectId().toString();

  const xAxisConfig_Followers: ScatterPlotMetricConfig = {
    id: "totalFollowers",
    label: "Seguidores Totais",
    calculationLogic: "getFollowersCount_current",
    params: [{ periodInDays: 0 }]
  };
  const yAxisConfig_AvgEng: ScatterPlotMetricConfig = {
    id: "avgEngagementPerPost",
    label: "Engajamento Médio/Post",
    calculationLogic: "getAverageEngagementPerPost_avgPerPost",
    params: [{ periodInDays: 30 }]
  };

  beforeEach(() => {
    (calculateFollowerGrowthRate as jest.Mock).mockReset();
    (calculateAverageEngagementPerPost as jest.Mock).mockReset();
    mockGetCreatorLabel.mockClear(); // Se estivéssemos usando o mock importado
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
     jest.spyOn(console, 'log').mockImplementation(() => {}); // Para suprimir o log de omissão
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
    (console.log as jest.Mock).mockRestore();
  });

  test('Plota múltiplos criadores com dados válidos para X e Y', async () => {
    // User 1
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: 10000 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 150 });
    // User 2
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: 20000 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 120 });

    const result = await getCreatorsScatterPlotData([userId1, userId2], xAxisConfig_Followers, yAxisConfig_AvgEng);

    expect(result.plotData.length).toBe(2);
    expect(result.xAxisMetricLabel).toBe("Seguidores Totais");
    expect(result.yAxisMetricLabel).toBe("Engajamento Médio/Post");

    expect(result.plotData[0].id).toBe(userId1);
    // expect(result.plotData[0].label).toBe(await mockGetCreatorLabel(userId1)); // Se mockGetCreatorLabel fosse injetado/mockável
    expect(result.plotData[0].x).toBe(10000);
    expect(result.plotData[0].y).toBe(150);

    expect(result.plotData[1].id).toBe(userId2);
    // expect(result.plotData[1].label).toBe(await mockGetCreatorLabel(userId2));
    expect(result.plotData[1].x).toBe(20000);
    expect(result.plotData[1].y).toBe(120);
    expect(result.insightSummary).toContain("Comparando 2 criador(es)");
  });

  test('Omite criador se a métrica X for nula', async () => {
    // User 1 (X nulo)
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: null });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 150 });
    // User 2 (OK)
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: 20000 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 120 });

    const result = await getCreatorsScatterPlotData([userId1, userId2], xAxisConfig_Followers, yAxisConfig_AvgEng);
    expect(result.plotData.length).toBe(1);
    expect(result.plotData[0].id).toBe(userId2);
    expect(result.plotData[0].x).toBe(20000);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`Omitindo criador ${userId1} do scatter plot devido a dados ausentes`));
  });

  test('Omite criador se a métrica Y for nula', async () => {
    // User 1 (OK)
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: 10000 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 150 });
    // User 2 (Y nulo)
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: 20000 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: null });

    const result = await getCreatorsScatterPlotData([userId1, userId2], xAxisConfig_Followers, yAxisConfig_AvgEng);
    expect(result.plotData.length).toBe(1);
    expect(result.plotData[0].id).toBe(userId1);
    expect(result.plotData[0].y).toBe(150);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(`Omitindo criador ${userId2} do scatter plot devido a dados ausentes`));
  });

  test('Nenhum criador na lista de entrada', async () => {
    const result = await getCreatorsScatterPlotData([], xAxisConfig_Followers, yAxisConfig_AvgEng);
    expect(result.plotData.length).toBe(0);
    expect(result.insightSummary).toBe("Comparativo de criadores."); // Ou poderia ser "Nenhum criador selecionado."
  });

  test('Todos os criadores têm dados ausentes para uma das métricas', async () => {
    // User 1 (X nulo)
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: null });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 150 });
    // User 2 (X nulo)
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: null });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 120 });

    const result = await getCreatorsScatterPlotData([userId1, userId2], xAxisConfig_Followers, yAxisConfig_AvgEng);
    expect(result.plotData.length).toBe(0);
    expect(result.insightSummary).toBe("Nenhum criador com dados suficientes para ambas as métricas selecionadas.");
  });

  test('Erro em uma função de cálculo de indicador para um usuário', async () => {
    // User 1 (Erro em X)
    (calculateFollowerGrowthRate as jest.Mock).mockRejectedValueOnce(new Error("Calc X failed for User1"));
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 150 });
    // User 2 (OK)
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValueOnce({ currentFollowers: 20000 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 120 });

    const result = await getCreatorsScatterPlotData([userId1, userId2], xAxisConfig_Followers, yAxisConfig_AvgEng);

    expect(result.plotData.length).toBe(1); // User1 omitido devido ao erro (resultando em xValue=null)
    expect(result.plotData[0].id).toBe(userId2);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Lógica de cálculo desconhecida para Eixo X: getFollowersCount_current"), expect.any(Error)); // O erro é pego e logado pela switch default
  });

  test('Erro geral na função (ex: DB indisponível para getCreatorLabel, se fosse real)', async () => {
    // Para simular um erro mais fundamental, vamos fazer o primeiro getCreatorLabel falhar
    // No entanto, getCreatorLabel é uma simulação no arquivo de origem.
    // Vamos simular um erro em uma das primeiras chamadas de cálculo.
    (calculateFollowerGrowthRate as jest.Mock).mockRejectedValue(new Error("Fundamental DB Error"));

    const result = await getCreatorsScatterPlotData([userId1, userId2], xAxisConfig_Followers, yAxisConfig_AvgEng);
    expect(result.plotData).toEqual([]);
    expect(result.insightSummary).toBe("Erro ao buscar dados para o gráfico de dispersão.");
    expect(console.error).toHaveBeenCalledWith("Error in getCreatorsScatterPlotData:", expect.any(Error));
  });
});

