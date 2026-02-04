import { Types } from 'mongoose';
import getTopPerformingContext from './getTopPerformingContext'; // Ajuste
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric'; // Ajuste
import { getNestedValue } from "./dataAccessHelpers"; // Importar a função compartilhada
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));
jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn() },
}));
jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));


describe('getTopPerformingContext', () => {
  const userId = new Types.ObjectId().toString();
  const periodInDays = 30;
  const performanceMetricField = "stats.total_interactions";

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
  });

  const setupFindMock = (result: any, isError = false) => {
    (MetricModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: isError
          ? () => Promise.reject(result)
          : () => Promise.resolve(result),
      }),
    });
  };

  const mockPostWithContext = (id: string, context: string | null | undefined, interactions: number | null): Partial<IMetric> => {
    const resolvedId = Types.ObjectId.isValid(id) ? id : new Types.ObjectId().toString();
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
      _id: new Types.ObjectId(resolvedId),
      user: new Types.ObjectId(userId),
      postDate: new Date(),
      context: typeof context === 'string' ? [context] : context,
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
    setupFindMock(posts);
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).not.toBeNull();
    expect(result?.context).toBe("Entertainment");
    expect(result?.averagePerformance).toBe(225);
    expect(result?.postsCount).toBe(2);
    expect(result?.metricUsed).toBe(performanceMetricField);
  });

  test('Retorna null se não houver posts', async () => {
    setupFindMock([]);
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).toBeNull();
  });

  test('Retorna null se nenhum post tiver a métrica de performance válida', async () => {
    const posts = [
      mockPostWithContext('p1', "Educational", null),
      mockPostWithContext('p2', "Entertainment", null),
    ];
    setupFindMock(posts);
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).toBeNull();
  });

  test('Retorna null se nenhum post tiver um contexto válido (null ou undefined)', async () => {
    const posts = [
      mockPostWithContext('p1', null, 100),
      mockPostWithContext('p2', undefined, 150),
    ];
    setupFindMock(posts);
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).toBeNull();
  });

  test('Lida com um único contexto', async () => {
    const posts = [
      mockPostWithContext('p1', "Educational", 100),
      mockPostWithContext('p2', "Educational", 150), // Avg Educational = 125
    ];
    setupFindMock(posts);
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result?.context).toBe("Educational");
    expect(result?.averagePerformance).toBe(125);
  });

   test('Erro no DB retorna null', async () => {
    setupFindMock(new Error("DB Error"), true);
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).toBeNull();
    expect((logger as any).error).toHaveBeenCalled();
  });

  test('Ignora posts com contexto nulo/undefined ao calcular médias', async () => {
    const posts = [
      mockPostWithContext('p1', "Educational", 100),
      mockPostWithContext('p2', "Educational", 150), // Avg Educational = 125
      mockPostWithContext('p3', null, 500), // Este será ignorado
      mockPostWithContext('p4', undefined, 600), // Este também
      mockPostWithContext('p5', "Entertainment", 200), // Avg Entertainment = 200
    ];
    setupFindMock(posts);
    const result = await getTopPerformingContext(userId, periodInDays, performanceMetricField);
    expect(result).not.toBeNull();
    // Esperado que Entertainment seja o top, pois Educational tem média 125 e Entertainment 200.
    // Os posts com contexto nulo ou indefinido não devem formar um grupo nem afetar outros.
    expect(result?.context).toBe("Entertainment");
    expect(result?.averagePerformance).toBe(200);
    expect(result?.postsCount).toBe(1);
  });
});
