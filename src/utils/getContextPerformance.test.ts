import { Types } from 'mongoose';
import getTopPerformingContext from './getTopPerformingContext'; // Ajuste
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric'; // Ajuste
import { getNestedValue } from "./dataAccessHelpers"; // Importar a função compartilhada

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));


describe('getTopPerformingContext', () => {
  const userId = new Types.ObjectId().toString();
  const periodInDays = 30;
  const performanceMetricField = "stats.total_interactions";

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
  });

  const mockPostWithContext = (id: string, context: string | null | undefined, interactions: number | null): Partial<IMetric> => {
    const stats: Partial<IMetricStats> = {};
    if (interactions !== null) {
      // Usar o helper getNestedValue para definir o valor pode ser um exagero aqui,
      // é mais para ler. Definimos diretamente para o mock.
      if (performanceMetricField === "stats.total_interactions") {
        stats.total_interactions = interactions;
      }
       // Adicionar outros campos conforme necessário para diferentes performanceMetricField
    }
    return {
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
      postDate: new Date(),
      context: context,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  test('Identifica corretamente o contexto com maior média de performance', async () => {
    const posts = [
      mockPostWithContext('p1', "Educational", 100),
      mockPostWithContext('p2', "Educational", 150), // Avg Educational = 125
      mockPostWithContext('p3', "Entertainment", 200),
      mockPostWithContext('p4', "Entertainment", 250),  // Avg Entertainment = 225 (Top)
      mockPostWithContext('p5', "Inspirational", 50),   // Avg Inspirational = 50
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).not.toBeNull();
    expect(result?.context).toBe("Entertainment");
    expect(result?.averagePerformance).toBe(225);
    expect(result?.postsCount).toBe(2);
    expect(result?.metricUsed).toBe(performanceMetricField);
  });

  test('Retorna null se não houver posts', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).toBeNull();
  });

  test('Retorna null se nenhum post tiver a métrica de performance válida', async () => {
    const posts = [
      mockPostWithContext('p1', "Educational", null),
      mockPostWithContext('p2', "Entertainment", null),
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).toBeNull();
  });

  test('Retorna null se nenhum post tiver um contexto válido (null ou undefined)', async () => {
    const posts = [
      mockPostWithContext('p1', null, 100),
      mockPostWithContext('p2', undefined, 150),
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).toBeNull();
  });

  test('Lida com um único contexto', async () => {
    const posts = [
      mockPostWithContext('p1', "Educational", 100),
      mockPostWithContext('p2', "Educational", 150), // Avg Educational = 125
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result?.context).toBe("Educational");
    expect(result?.averagePerformance).toBe(125);
  });

   test('Erro no DB retorna null', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.reject(new Error("DB Error")) });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test('Ignora posts com contexto nulo/undefined ao calcular médias', async () => {
    const posts = [
      mockPostWithContext('p1', "Educational", 100),
      mockPostWithContext('p2', "Educational", 150), // Avg Educational = 125
      mockPostWithContext('p3', null, 500), // Este será ignorado
      mockPostWithContext('p4', undefined, 600), // Este também
      mockPostWithContext('p5', "Entertainment", 200), // Avg Entertainment = 200
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).not.toBeNull();
    // Esperado que Entertainment seja o top, pois Educational tem média 125 e Entertainment 200.
    // Os posts com contexto nulo ou indefinido não devem formar um grupo nem afetar outros.
    expect(result?.context).toBe("Entertainment");
    expect(result?.averagePerformance).toBe(200);
    expect(result?.postsCount).toBe(1);
  });
});
```
