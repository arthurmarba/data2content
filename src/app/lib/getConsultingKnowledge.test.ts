import { functionExecutors } from './aiFunctions';
import { GetConsultingKnowledgeArgsSchema } from './aiFunctionSchemas.zod';
import { Types } from 'mongoose';

jest.mock('./logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

jest.mock('./knowledge/metricsKnowledge', () => ({
  analyzeFollowerGrowth: jest.fn(() => 'Follower growth analysis'),
  explainPropagationIndex: jest.fn(() => 'Propagation index explanation'),
}));

describe('getConsultingKnowledge', () => {
  const user = { _id: new Types.ObjectId() } as any;

  test('schema accepts new knowledge topics', () => {
    expect(() => GetConsultingKnowledgeArgsSchema.parse({ topic: 'metrics_follower_growth' })).not.toThrow();
    expect(() => GetConsultingKnowledgeArgsSchema.parse({ topic: 'metrics_propagation_index' })).not.toThrow();
  });

  test('dispatches follower growth knowledge', async () => {
    const result = await functionExecutors.getConsultingKnowledge({ topic: 'metrics_follower_growth' }, user) as any;
    expect(result.knowledge).toBe('Follower growth analysis');
  });

  test('dispatches propagation index knowledge', async () => {
    const result = await functionExecutors.getConsultingKnowledge({ topic: 'metrics_propagation_index' }, user) as any;
    expect(result.knowledge).toBe('Propagation index explanation');
  });
});
