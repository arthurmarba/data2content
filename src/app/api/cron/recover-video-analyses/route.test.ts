/** @jest-environment node */
import { POST } from './route';
import { recoverVideoAnalyses } from '@/app/lib/videoAnalysis/jobs';
jest.mock('@/app/lib/videoAnalysis/jobs', () => ({ recoverVideoAnalyses: jest.fn().mockResolvedValue({ recovered: 0 }) }));
const originalEnv = process.env;
beforeEach(() => { jest.clearAllMocks(); process.env = { ...originalEnv, CRON_SECRET: 'test' }; delete process.env.QSTASH_CURRENT_SIGNING_KEY; delete process.env.QSTASH_NEXT_SIGNING_KEY; });
afterAll(() => { process.env = originalEnv; });
it('não reconcilia arquivos sem autenticação', async () => { expect((await POST(new Request('https://app.test/cron', { method: 'POST' }))).status).toBe(401); expect(recoverVideoAnalyses).not.toHaveBeenCalled(); });
it('aceita o segredo do cron', async () => { expect((await POST(new Request('https://app.test/cron', { method: 'POST', headers: { authorization: 'Bearer test' } }))).status).toBe(200); expect(recoverVideoAnalyses).toHaveBeenCalledTimes(1); });
