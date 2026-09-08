/** @jest-environment node */
import { POST } from './route';
import { processVideoAnalysis } from '@/app/lib/videoAnalysis/jobs';
import { Receiver } from '@upstash/qstash';
jest.mock('@/app/lib/videoAnalysis/jobs', () => ({ processVideoAnalysis: jest.fn().mockResolvedValue({ processed: true }) }));
jest.mock('@upstash/qstash', () => ({ Receiver: jest.fn() }));
const originalEnv = process.env;
beforeEach(() => { jest.clearAllMocks(); process.env = { ...originalEnv, QSTASH_CURRENT_SIGNING_KEY: 'test', QSTASH_NEXT_SIGNING_KEY: 'next' }; });
afterAll(() => { process.env = originalEnv; });
it('não executa trabalho sem assinatura válida', async () => { (Receiver as unknown as jest.Mock).mockImplementation(() => ({ verify: async () => false })); expect((await POST(new Request('https://app.test/worker', { method: 'POST', body: '{"jobId":"id"}' }))).status).toBe(401); expect(processVideoAnalysis).not.toHaveBeenCalled(); });
it('executa somente o identificador entregue pela fila autenticada', async () => { (Receiver as unknown as jest.Mock).mockImplementation(() => ({ verify: async () => true })); expect((await POST(new Request('https://app.test/worker', { method: 'POST', body: '{"jobId":"id"}', headers: { 'upstash-signature': 'signed' } }))).status).toBe(200); expect(processVideoAnalysis).toHaveBeenCalledWith('id'); });
