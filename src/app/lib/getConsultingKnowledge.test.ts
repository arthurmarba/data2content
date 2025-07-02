import { functionExecutors } from './aiFunctions';
import { GetConsultingKnowledgeArgsSchema } from './aiFunctionSchemas.zod';
import { Types } from 'mongoose';

jest.mock('./logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

describe('getConsultingKnowledge', () => {
  const user = { _id: new Types.ObjectId() } as any;
  const topics = (GetConsultingKnowledgeArgsSchema.shape.topic as any)._def.values as string[];

  it('returns a non-empty string for every topic', async () => {
    for (const topic of topics) {
      const result = await functionExecutors.getConsultingKnowledge({ topic }, user) as any;
      expect(typeof result.knowledge).toBe('string');
      expect(result.knowledge.length).toBeGreaterThan(0);
    }
  });
});
