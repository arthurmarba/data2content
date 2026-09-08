/** @jest-environment node */
import { Client } from '@upstash/qstash';
import { publishVideoAnalysis } from './jobs';
jest.mock('@upstash/qstash', () => ({ Client: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { warn: jest.fn() } }));
const originalEnv = process.env;
afterEach(() => { process.env = originalEnv; jest.clearAllMocks(); });
it('publica identificador aceito pela QStash, sem dois-pontos', async () => {
  process.env = { ...originalEnv, QSTASH_TOKEN: 'test', APP_BASE_URL: 'https://example.test' };
  const publish = jest.fn().mockImplementation(async input => { if (input.deduplicationId.includes(':')) throw new Error('DeduplicationId cannot contain colon'); return { messageId: 'ok' }; });
  (Client as jest.Mock).mockImplementation(() => ({ publishJSON: publish }));
  expect(await publishVideoAnalysis('video-temp-upload-session-test')).toBe(true);
  expect(publish).toHaveBeenCalledWith(expect.objectContaining({ deduplicationId: expect.stringMatching(/^[a-f0-9]{64}$/), body: { jobId: 'video-temp-upload-session-test' } }));
});
it('preserva a pendência recuperável quando a fila recusa a publicação', async () => {
  process.env = { ...originalEnv, QSTASH_TOKEN: 'test', APP_BASE_URL: 'https://example.test' };
  (Client as jest.Mock).mockImplementation(() => ({ publishJSON: jest.fn().mockRejectedValue(Object.assign(new Error('unavailable'), { status: 503 })) }));
  expect(await publishVideoAnalysis('video-temp-upload-session-test')).toBe(false);
});
