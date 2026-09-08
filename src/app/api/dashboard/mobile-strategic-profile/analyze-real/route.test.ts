/** @jest-environment node */
import { POST, GET, PUT } from './route';
import { getServerSession } from 'next-auth/next';
import { requestVideoAnalysis, readVideoAnalysis } from '@/app/lib/videoAnalysis/jobs';
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/resolveAuthOptions', () => ({ resolveAuthOptions: jest.fn() }));
jest.mock('@/app/lib/videoAnalysis/jobs', () => ({ requestVideoAnalysis: jest.fn(), readVideoAnalysis: jest.fn(), acknowledgeVideoAnalysis: jest.fn() }));
jest.mock('@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisFeatureFlag', () => ({ isVideoNarrativeRealAnalysisE2EEnabled: () => true }));
jest.mock('@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag', () => ({ isMobileStrategicProfileEnabled: () => true }));
jest.mock('@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag', () => ({ isRealUploadEnabled: () => true, isTemporaryUploadSessionEnabled: () => true }));
const request = () => new Request('https://app.test/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uploadSessionId: 'abc' }) });
beforeEach(() => { jest.clearAllMocks(); (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } }); });
it('recusa anônimo sem enfileirar', async () => { (getServerSession as jest.Mock).mockResolvedValue(null); expect((await POST(request())).status).toBe(401); expect(requestVideoAnalysis).not.toHaveBeenCalled(); });
it('aceita o trabalho sem executar a análise na requisição', async () => { (requestVideoAnalysis as jest.Mock).mockResolvedValue({ status: 202, data: { jobId: 'abc', state: 'queued' } }); const result = await POST(request()); expect(result.status).toBe(202); expect(requestVideoAnalysis).toHaveBeenCalledWith('owner', { uploadSessionId: 'abc' }); });
it('consulta usa o proprietário autenticado e não permite cache', async () => { (readVideoAnalysis as jest.Mock).mockResolvedValue(null); const result = await GET(new Request('https://app.test/api/analyze?jobId=other')); expect(readVideoAnalysis).toHaveBeenCalledWith('owner', 'other'); expect(result.headers.get('Cache-Control')).toContain('no-store'); });
it('recusa PUT', async () => { expect((await PUT()).status).toBe(405); });
