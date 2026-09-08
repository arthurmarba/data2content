/** @jest-environment node */
import { POST } from './route';
import { getServerSession } from 'next-auth/next';
import { collabsState } from '@/app/lib/collabs/apiService';
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/resolveAuthOptions', () => ({ resolveAuthOptions: jest.fn() }));
jest.mock('@/app/lib/collabs/apiService', () => ({ collabsState: jest.fn() }));
it('exige sessão', async () => { (getServerSession as jest.Mock).mockResolvedValue(null); expect((await POST()).status).toBe(401); });
it('serve apenas propostas persistidas do dono e limita o adaptador a três', async () => {
 (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'owner' } });
 (collabsState as jest.Mock).mockResolvedValue({ suggestions: { a: { id: 'a' }, b: { id: 'b' }, c: { id: 'c' }, d: { id: 'd' } }, decisions: [{ pautaId: 'b', decision: 'dismissed' }] });
 const data = await (await POST()).json(); expect(data.items.map((item: any) => item.id)).toEqual(['a','c','d']); expect(collabsState).toHaveBeenCalledWith('owner');
});
