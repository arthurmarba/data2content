/** @jest-environment node */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type Stripe from 'stripe';
import User from '@/app/models/User';
import Journey from '@/app/models/AcquisitionJourney';
import Event from '@/app/models/AcquisitionEvent';
import { ACQUISITION_CAMPAIGN, ACQUISITION_COOKIE, acquisitionStepFromAnalytics, parseAcquisitionTouch, isTouchEligible } from '@/lib/analytics/acquisition';
import { bindAcquisitionUser, prepareAcquisitionCheckout, receiveAcquisition, revokeAcquisition } from './journey';
import { recordAcquisitionStripeEvent, acquisitionStripeFacts } from './stripe';
import { deliverAcquisitionConversions } from './delivery';
import { acquisitionReport } from './report';
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));

let db: MongoMemoryServer;
let userId: string;
const jar = (values: Record<string, string>) => ({ get: (name: string) => values[name] ? { value: values[name]! } : undefined });
const touch = (content = 'roteiros_1', at = new Date(Date.now() - 2000)) => parseAcquisitionTouch(new URLSearchParams({
  utm_source: 'chatgpt', utm_medium: 'paid', utm_campaign: ACQUISITION_CAMPAIGN, utm_content: content,
}), at)!;
const stripeEvent = (type: string, object: Record<string, unknown>): Stripe.Event => ({ id: 'evt_test', type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object } } as Stripe.Event);
async function arrive(content = 'roteiros_1') {
  const cookies: Record<string, string> = { cookie_consent: 'granted', __oppref: 'opaque_reference' };
  const result = await receiveAcquisition({ cookies: jar(cookies), step: 'arrival', touch: touch(content) });
  cookies[ACQUISITION_COOKIE] = result!.token!;
  return cookies;
}
beforeAll(async () => {
  db = await MongoMemoryServer.create({ binary: { downloadDir: '/private/tmp/collabs-mongodb' } });
  await mongoose.connect(db.getUri('acquisition_isolated_test'), { autoIndex: false });
  await Journey.createIndexes(); await Event.createIndexes();
}, 180000);
afterAll(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([Journey.deleteMany({}), Event.deleteMany({}), User.deleteMany({})]);
  userId = new Types.ObjectId().toString();
  await User.collection.insertOne({ _id: new Types.ObjectId(userId), role: 'user', email: 'qa@example.test', createdAt: new Date(), stripeCustomerId: 'cus_test', followers_count: 21000 });
});
it('não aceita parâmetros desconhecidos nem garante conversão com evento do navegador', () => {
  expect(touch('inventado')).toBeNull();
  expect(acquisitionStepFromAnalytics('subscription_activated')).toBeNull();
  expect(acquisitionStepFromAnalytics('landing_section_view', { section: 'pricing' })).toBe('pricing_viewed');
  expect(isTouchEligible(touch(), new Date(Date.now() + 31 * 86400_000))).toBe(false);
});
it('recusa rastreamento antes do consentimento e no tráfego sem anúncio', async () => {
  expect(await receiveAcquisition({ cookies: jar({ cookie_consent: 'denied' }), touch: touch(), step: 'arrival' })).toBeNull();
  expect(await receiveAcquisition({ cookies: jar({ cookie_consent: 'granted' }), touch: null, step: 'sync' })).toBeNull();
  expect(await Journey.countDocuments()).toBe(0);
});
it('recarregar a página não duplica chegada nem muda a primeira origem', async () => {
  const cookies = await arrive();
  const original = await Journey.findOne().lean();
  await Promise.all(Array.from({ length: 3 }, () => receiveAcquisition({ cookies: jar(cookies), touch: touch(), step: 'arrival' })));
  expect(await Journey.countDocuments()).toBe(1);
  expect(await Event.countDocuments({ step: 'arrival' })).toBe(1);
  expect((await Journey.findOne())!.lastPaidTouch.at).toEqual(original!.lastPaidTouch.at);
});
it('mantém primeiro anúncio, troca último anúncio e sobrevive ao Google sem UTMs', async () => {
  const cookies = await arrive();
  await receiveAcquisition({ cookies: jar(cookies), touch: touch('ideias_2'), step: 'arrival' });
  const result = await bindAcquisitionUser(jar(cookies), userId, true);
  expect(result!.firstTouch.content).toBe('roteiros_1');
  expect(result!.lastPaidTouch.content).toBe('ideias_2');
  expect(String(result!.userId)).toBe(userId);
  expect(await Event.countDocuments({ step: 'account_created' })).toBe(1);
  expect((await prepareAcquisitionCheckout(jar(cookies), userId)).d2c_acquisition_journey).toBe(String(result!._id));
});
it('conta login existente separadamente e não toma jornada de outra conta', async () => {
  const cookies = await arrive();
  await bindAcquisitionUser(jar(cookies), userId, false);
  await bindAcquisitionUser(jar(cookies), userId);
  expect(await Event.countDocuments({ step: 'account_created' })).toBe(0);
  expect(await Event.countDocuments({ step: 'login' })).toBe(1);
  expect(await bindAcquisitionUser(jar(cookies), new Types.ObjectId().toString())).toBeNull();
});
it('checkout abandonado e assinatura incompleta não são assinatura ou pagamento', async () => {
  const cookies = await arrive(); await prepareAcquisitionCheckout(jar(cookies), userId);
  await recordAcquisitionStripeEvent(stripeEvent('customer.subscription.created', { id: 'sub_test', customer: 'cus_test', status: 'incomplete' }));
  expect(await Event.countDocuments({ step: 'checkout_started' })).toBe(1);
  expect(await Event.countDocuments({ step: { $in: ['subscription_started', 'first_payment'] } })).toBe(0);
});
it('mês grátis gera assinatura, mas só fatura positiva gera pagante', async () => {
  const cookies = await arrive(); await bindAcquisitionUser(jar(cookies), userId);
  const invoice = { id: 'in_zero', customer: 'cus_test', subscription: 'sub_test', paid: true, amount_paid: 0, currency: 'brl', billing_reason: 'subscription_create' };
  await recordAcquisitionStripeEvent(stripeEvent('invoice.payment_succeeded', invoice));
  expect(await Event.countDocuments({ step: 'subscription_started' })).toBe(1);
  expect(await Event.countDocuments({ step: 'first_payment' })).toBe(0);
  const payment = stripeEvent('invoice.payment_succeeded', { ...invoice, id: 'in_paid', billing_reason: 'subscription_cycle', amount_paid: 9700 });
  await Promise.all([recordAcquisitionStripeEvent(payment), recordAcquisitionStripeEvent(payment)]);
  expect(await Event.countDocuments({ step: 'first_payment' })).toBe(1);
  expect(await Event.countDocuments({ step: 'payment_received' })).toBe(1);
  expect((await Event.findOne({ step: 'first_payment' }))!.amount).toBe(9700);
});
it('renovações conservam anúncio e identificador congelados na assinatura', async () => {
  const cookies = await arrive(); await bindAcquisitionUser(jar(cookies), userId);
  await recordAcquisitionStripeEvent(stripeEvent('customer.subscription.created', { id: 'sub_test', customer: 'cus_test', status: 'trialing' }));
  cookies.__oppref = 'another_reference';
  await receiveAcquisition({ cookies: jar(cookies), touch: touch('ideias_1'), step: 'arrival', userId });
  await recordAcquisitionStripeEvent(stripeEvent('invoice.payment_succeeded', { id: 'in_one', customer: 'cus_test', subscription: 'sub_test', paid: true, amount_paid: 9700, currency: 'brl', billing_reason: 'subscription_cycle' }));
  const payment = await Event.findOne({ step: 'first_payment' }).lean();
  expect(payment!.touch.content).toBe('roteiros_1'); expect(payment!.oppref).toBe('opaque_reference');
});
it('identifica fatura na estrutura atual do Stripe', () => {
  expect(acquisitionStripeFacts(stripeEvent('invoice.payment_succeeded', { customer: 'cus_test', id: 'in_test', paid: true,
    parent: { subscription_details: { subscription: 'sub_test' } }, amount_paid: 9700 }))?.subscriptionId).toBe('sub_test');
});
it('recupera envio falho com mesmo ID e não envia duas vezes', async () => {
  await arrive();
  process.env.OPENAI_ADS_PIXEL_ID = 'pixel_test'; process.env.OPENAI_ADS_CONVERSIONS_API_KEY = 'key_test';
  const fetchMock = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'))
    .mockResolvedValue({ ok: true } as Response);
  expect((await deliverAcquisitionConversions()).failed).toBe(1);
  await Event.updateMany({}, { $set: { nextAttemptAt: new Date(0) } });
  expect((await deliverAcquisitionConversions()).sent).toBe(1);
  expect((await deliverAcquisitionConversions()).sent).toBe(0);
  const bodies = fetchMock.mock.calls.map(c => JSON.parse(c[1]!.body as string));
  expect(bodies[0].events[0].id).toBe(bodies[1].events[0].id);
  expect(bodies[1].events[0].opt_out).toBe(true);
  expect(JSON.stringify(bodies)).not.toMatch(/qa@example|emails_sha256|ip_address/);
});
it('revogação bloqueia fila e pagamentos posteriores e apaga referências externas', async () => {
  const cookies = await arrive(); await bindAcquisitionUser(jar(cookies), userId);
  await revokeAcquisition(jar(cookies), userId);
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
  await deliverAcquisitionConversions();
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await Journey.findOne())!.consent).toBe(false);
  expect(await Event.countDocuments({ oppref: { $exists: true } })).toBe(0);
});
it('relatório separa cliques de chegadas e mostra indisponibilidade sem inventar gasto zero', async () => {
  const cookies = await arrive(); await bindAcquisitionUser(jar(cookies), userId);
  process.env.OPENAI_ADS_API_KEY = 'test_report_key';
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
  const result = await acquisitionReport(new Date(Date.now() - 86400_000), new Date(Date.now() + 86400_000), true);
  expect(result.deliveryAvailable).toBe(false);
  expect(result.rows[0]!.spend).toBeNull();
  expect(result.rows[0]!.steps.arrival).toBe(1);
  expect(result.rows[0]!.steps.account_created).toBe(1);
  expect(result.timelines[0]!.followers).toBe(21000);
  expect(JSON.stringify(result)).not.toContain('qa@example');
});
it('marcos de cadastro e Instagram podem ser reconciliados independentemente', async () => {
  const cookies = await arrive();
  await User.updateOne({ _id: userId }, { $set: { onboardingCompletedAt: new Date(), isInstagramConnected: true } });
  await bindAcquisitionUser(jar(cookies), userId);
  await bindAcquisitionUser(jar(cookies), userId);
  expect(await Event.countDocuments({ step: 'onboarding_completed' })).toBe(1);
  expect(await Event.countDocuments({ step: 'instagram_connected' })).toBe(1);
  expect(await Event.countDocuments({ step: 'subscription_started' })).toBe(0);
});
