/** @jest-environment node */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '@/app/models/User';
import Proposal from '@/app/models/CollabProposal';
import Job from '@/app/models/CollabJob';
import Quota from '@/app/models/ContentIdeaQuota';
import Idea from '@/app/models/CreatorContentIdea';
import { decideProposal, readProposals, proposalPerspective, saveProposal } from './proposals';
import { requestJob, processJob, quotaStatus } from './jobs';
import { updateDiscovery } from './eligibility';

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@upstash/qstash', () => ({ Client: jest.fn(() => ({ publishJSON: jest.fn() })) }));
jest.mock('@/app/lib/whatsappService', () => ({ sendTemplateMessage: jest.fn().mockResolvedValue('wamid.test') }));
jest.mock('./settings', () => ({ canGenerate: jest.fn().mockResolvedValue(true), collabSettings: jest.fn().mockResolvedValue({ generationEnabled: true, maxMatchingJobsPerDay: 4 }) }));
jest.mock('./ideaGeneration', () => ({ generateIdeasForUser: jest.fn().mockResolvedValue({ status: 200, data: { ok: true, ideas: [{ id: 'ready' }] } }) }));
let db: MongoMemoryReplSet;
let a: string, b: string;
async function proposal() {
  return Proposal.create({ key: new Types.ObjectId().toString(), version: 1, participants: [a, b], originUserId: a, sourceIdeaId: new Types.ObjectId().toString(), contextRevision: 'v1',
    idea: { title: 'A mesma compra em duas cozinhas', angle: 'Compare receitas', hook: 'Qual rende mais?', territory: 'Cozinha', status: 'active', assets: [], scriptPoints: [], generatedAt: new Date().toISOString() },
    partnerSnapshot: { id: b, name: 'B', viewerContribution: 'Prepara a receita', partnerContribution: 'Calcula o custo', collabBlueprint: { openingOwner: 'viewer', scenes: [{ owner: 'partner', beat: 'contexto', visual: 'Calculadora', spokenIntent: 'Explica custo' }] } }, expiresAt: new Date(Date.now() + 86400000),
  });
}
beforeAll(async () => {
  // Nenhuma conexão com MONGODB_URI do ambiente: replica set descartável e local.
  db = await MongoMemoryReplSet.create({ binary: { downloadDir: '/private/tmp/collabs-mongodb' }, replSet: { count: 1 } });
  await mongoose.connect(db.getUri('collabs_test'), { autoIndex: false });
  for (const model of [Proposal, Job, Quota]) await model.createIndexes();
}, 180000);
afterAll(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
  for (const model of [User, Proposal, Job, Quota, Idea]) await model.deleteMany({});
  a = new Types.ObjectId().toString(); b = new Types.ObjectId().toString();
  await User.collection.insertMany([a, b].map((id, i) => ({ _id: new Types.ObjectId(id), name: `Pessoa ${i}`, username: `pessoa_${i}`, planStatus: 'active', collabDiscoveryOptIn: true, collabDiscoveryOptInDate: new Date(), collabDiscoveryStatus: 'available' })));
});
it('dois aceites concorrentes confirmam exatamente uma proposta e dois eventos', async () => {
  const doc = await proposal();
  await Promise.all([decideProposal(a, String(doc._id), 1, 'interested'), decideProposal(b, String(doc._id), 1, 'interested')]);
  expect((await Proposal.findById(doc._id))?.matchedAt).toBeInstanceOf(Date);
  expect(await Job.countDocuments({ kind: 'notification' })).toBe(2);
  await decideProposal(a, String(doc._id), 1, 'interested');
  expect(await Job.countDocuments({ kind: 'notification' })).toBe(2);
});
it('versão errada e terceiro não alteram nenhuma escolha', async () => {
  const doc = await proposal();
  await expect(decideProposal(a, String(doc._id), 2, 'interested')).rejects.toThrow('proposal_invalid');
  await expect(decideProposal(new Types.ObjectId().toString(), String(doc._id), 1, 'interested')).rejects.toThrow('proposal_invalid');
  expect((await Proposal.findById(doc._id))?.acceptedBy).toHaveLength(0);
});
it('interesses em duas propostas do mesmo território não confirmam', async () => {
  const first = await proposal(), second = await proposal();
  await decideProposal(a, String(first._id), 1, 'interested');
  await decideProposal(b, String(second._id), 1, 'interested');
  expect(await Proposal.countDocuments({ matchedAt: { $ne: null } })).toBe(0);
});
it('pausa impede confirmação e mantém o snapshot próprio', async () => {
  const doc = await proposal(); await decideProposal(a, String(doc._id), 1, 'interested');
  await updateDiscovery(a, false);
  await expect(decideProposal(b, String(doc._id), 1, 'interested')).rejects.toThrow('proposal_unavailable');
  const state = await readProposals(a);
  expect(state.decisions[0]?.collab.id).toBe(b);
  expect(state.matches).toHaveLength(0);
});
it('a outra pessoa não recebe o interesse nem a recusa unilateral', async () => {
  const doc = await proposal(); await decideProposal(a, String(doc._id), 1, 'interested');
  expect((await readProposals(b)).decisions).toHaveLength(0);
  await decideProposal(a, String(doc._id), 1, 'dismissed');
  const state = await readProposals(b);
  expect(state.decisions).toHaveLength(0);
  expect(state.ideas[0]?.status).toBe('active');
  expect(JSON.stringify(state)).not.toContain('acceptedBy');
});
it('cada participante vê as responsabilidades corretas do mesmo plano', async () => {
  const doc = (await proposal()).toObject();
  expect(proposalPerspective(doc, a, { _id: b }).viewerContribution).toBe('Prepara a receita');
  expect(proposalPerspective(doc, b, { _id: a }).viewerContribution).toBe('Calcula o custo');
  expect(proposalPerspective(doc, b, { _id: a }).collabBlueprint?.scenes[0]?.owner).toBe('viewer');
});
it('expiração e cancelamento não fazem renascer uma confirmação', async () => {
  const doc = await proposal(); await decideProposal(a, String(doc._id), 1, 'interested'); await decideProposal(a, String(doc._id), 1, 'cancelled');
  expect((await readProposals(a)).decisions[0]?.decision).toBe('dismissed');
  await Proposal.updateOne({ _id: doc._id }, { $set: { expiresAt: new Date(0) } });
  await expect(decideProposal(b, String(doc._id), 1, 'interested')).rejects.toThrow('proposal_expired');
});
it('deduplica pedidos simultâneos e reserva apenas uma rodada', async () => {
  const requests = await Promise.all(Array.from({ length: 6 }, () => requestJob(a, 'ideas', { count: 6 }, 'same')));
  expect(new Set(requests.map(job => String(job._id))).size).toBe(1);
  expect((await quotaStatus(a)).reservedBatches).toBe(1);
  await Promise.all(requests.map(job => processJob(String(job._id))));
  expect(await Job.countDocuments({ state: 'completed' })).toBe(1);
  expect((await quotaStatus(a)).usedBatches).toBe(1);
  expect((await quotaStatus(a)).reservedBatches).toBe(0);
});
it('falha libera reserva e não altera a rodada', async () => {
  const { generateIdeasForUser } = await import('./ideaGeneration');
  (generateIdeasForUser as jest.Mock).mockResolvedValueOnce({ status: 422, data: { reason: 'invalid_gemini_response' } });
  const job = await requestJob(a, 'ideas', {}, 'failure'); await processJob(String(job._id));
  expect((await quotaStatus(a)).usedBatches).toBe(0);
  expect((await quotaStatus(a)).reservedBatches).toBe(0);
});
it('cota esgotada bloqueia antes do provedor', async () => {
  const status = await quotaStatus(a); await Quota.updateOne({ _id: status.key }, { $set: { consumed: status.limitBatches } });
  await expect(requestJob(a, 'ideas', {}, 'blocked')).rejects.toThrow('quota_exceeded');
  expect(await Job.countDocuments({})).toBe(0);
});
it('terceiro não salva a proposta alheia', async () => {
  const doc = await proposal();
  expect(await saveProposal(new Types.ObjectId().toString(), String(doc._id), 'saved')).toBeNull();
});

it('aviso externo é único e uma resposta ambígua fica para revisão', async () => {
  const { collabSettings } = await import('./settings');
  const { sendTemplateMessage } = await import('@/app/lib/whatsappService');
  (collabSettings as jest.Mock).mockResolvedValueOnce({ whatsappTemplateApproved: true, whatsappTemplate: 'collab_test', whatsappApiVersion: 'v23.0' });
  (sendTemplateMessage as jest.Mock).mockRejectedValueOnce(new Error('resposta perdida'));
  await User.updateOne({ _id: a }, { $set: { whatsappVerified: true, whatsappPhone: '+5511999999999' } });
  const doc = await proposal(); await Proposal.updateOne({ _id: doc._id }, { $set: { matchedAt: new Date() } });
  const job = await Job.create({ userId: a, key: 'notify-test', kind: 'notification', payload: { proposalId: String(doc._id) } });
  await Promise.all([processJob(String(job._id)), processJob(String(job._id))]);
  expect(sendTemplateMessage).toHaveBeenCalledTimes(1);
  expect((await Job.findById(job._id))?.result?.reason).toBe('delivery_needs_review');
});
it('o orçamento de matching limita novos pedidos mesmo depois de liberar a trava ativa', async () => {
  for (let i = 0; i < 4; i++) { const job = await requestJob(a, 'matching', {}, `round-${i}`); await Job.updateOne({ _id: job._id }, { $set: { state: 'completed' }, $unset: { activeKey: 1 } }); }
  await expect(requestJob(a, 'matching', {}, 'fifth')).rejects.toThrow('matching_budget_exceeded');
});

it('não contabiliza novamente uma entrega de job na inicialização do mês', async () => {
  await Idea.collection.insertMany([{ userId: new Types.ObjectId(a), generatedAt: new Date(), generationJobId: 'pedido-reservado-no-mes-anterior' }, { userId: new Types.ObjectId(a), generatedAt: new Date() }]);
  expect((await quotaStatus(a)).usedBatches).toBe(1);
});
