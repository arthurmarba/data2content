import { createHash, randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import Journey, { type AcquisitionJourneyRecord } from '@/app/models/AcquisitionJourney';
import Event, { type AcquisitionEventRecord } from '@/app/models/AcquisitionEvent';
import User from '@/app/models/User';
import { ACQUISITION_COOKIE, isTouchEligible, type AcquisitionStep, type AcquisitionTouch } from '@/lib/analytics/acquisition';
import { normalizeOpenAiOppref } from '@/lib/openAiAdsAttribution';

type Cookies = { get(name: string): { value: string } | undefined };
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const validToken = (token?: string) => token && /^[a-f0-9]{64}$/.test(token) ? token : null;
const expiry = () => new Date(Date.now() + 400 * 86_400_000);
const capiSteps = new Set<AcquisitionStep>(['arrival', 'pricing_viewed', 'account_created', 'checkout_started', 'subscription_started', 'first_payment']);

export async function recordAcquisitionEvent(
  journey: AcquisitionJourneyRecord, step: AcquisitionStep, key: string,
  extra: Partial<Pick<AcquisitionEventRecord, 'at' | 'amount' | 'currency' | 'subscriptionId' | 'touch' | 'firstTouch' | 'oppref' | 'obref'>> = {},
) {
  if (!journey.consent) return;
  try {
    await Event.updateOne({ key }, { $setOnInsert: {
      key, journeyId: journey._id, userId: journey.userId, step, at: new Date(),
      touch: journey.lastPaidTouch, firstTouch: journey.firstTouch, internal: journey.internal,
      followers: journey.followers, oppref: journey.oppref, obref: journey.obref,
      capiState: capiSteps.has(step) && !journey.internal ? 'pending' : 'skipped',
      attempts: 0, nextAttemptAt: new Date(), expiresAt: expiry(), ...extra,
    } }, { upsert: true });
  } catch (error) {
    // Concorrência no mesmo marco não cria duas conversões.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
}

export async function bindAcquisitionUser(cookies: Cookies, userId: string, newAccount?: boolean) {
  if (cookies.get('cookie_consent')?.value !== 'granted' || !Types.ObjectId.isValid(userId)) return null;
  const token = validToken(cookies.get(ACQUISITION_COOKIE)?.value);
  if (!token) return null;
  await connectToDatabase();
  const journey = await Journey.findOne({ tokenHash: hash(token), consent: true });
  if (!journey || (journey.userId && String(journey.userId) !== userId)) return null;
  const user = await User.findById(userId).select('createdAt role email followers_count onboardingCompletedAt isInstagramConnected').lean();
  if (!user) return null;
  const internal = ['admin', 'staff', 'internal'].includes(user.role || '') || /@(data2content\.ai|data2content\.co)$/i.test(user.email || '');
  const firstForUser = await Journey.findOne({ userId, consent: true }).sort({ 'firstTouch.at': 1 }).lean();
  if (firstForUser && firstForUser.firstTouch.at < journey.firstTouch.at) journey.firstTouch = firstForUser.firstTouch;
  journey.userId = new Types.ObjectId(userId);
  journey.internal = internal;
  journey.followers = typeof user.followers_count === 'number' ? user.followers_count : null;
  if (typeof newAccount === 'boolean' && journey.newAccount === undefined) journey.newAccount = newAccount;
  journey.expiresAt = expiry();
  await journey.save();
  await Event.updateMany({ journeyId: journey._id }, { $set: { userId: journey.userId, internal, followers: journey.followers } });
  const createdAt = user.createdAt ? new Date(user.createdAt) : null;
  const isNew = journey.newAccount ?? Boolean(createdAt && createdAt >= journey.firstTouch.at);
  await recordAcquisitionEvent(journey, isNew ? 'account_created' : 'login',
    isNew ? `account:${userId}` : `login:${journey._id}`, createdAt && isNew ? { at: createdAt } : {});
  if (user.onboardingCompletedAt && new Date(user.onboardingCompletedAt) >= journey.firstTouch.at) {
    await recordAcquisitionEvent(journey, 'onboarding_completed', `onboarding:${userId}`, { at: new Date(user.onboardingCompletedAt) });
  }
  if (user.isInstagramConnected) await recordAcquisitionEvent(journey, 'instagram_connected', `instagram:${userId}`);
  return journey;
}

export async function receiveAcquisition(input: { cookies: Cookies; touch: AcquisitionTouch | null; step: 'arrival' | 'pricing_viewed' | 'signup_clicked' | 'sync'; userId?: string }) {
  if (input.cookies.get('cookie_consent')?.value !== 'granted') return null;
  let token = validToken(input.cookies.get(ACQUISITION_COOKIE)?.value);
  if (!token && !input.touch) return null;
  await connectToDatabase();
  let journey = token ? await Journey.findOne({ tokenHash: hash(token), consent: true }) : null;
  if (journey?.userId && input.userId && String(journey.userId) !== input.userId) journey = null;
  const oppref = normalizeOpenAiOppref(input.cookies.get('__oppref')?.value);
  const obref = normalizeOpenAiOppref(input.cookies.get('__obref')?.value);
  if (!journey) {
    if (!input.touch) return null;
    token = randomBytes(32).toString('hex');
    journey = await Journey.create({ tokenHash: hash(token), firstTouch: input.touch, lastPaidTouch: input.touch,
      consent: true, oppref, obref, expiresAt: expiry() });
  } else {
    // Recarregar a mesma URL não renova indefinidamente a janela de atribuição.
    if (input.touch && (input.touch.content !== journey.lastPaidTouch.content || (oppref && oppref !== journey.oppref))) {
      journey.lastPaidTouch = input.touch;
      journey.oppref = oppref;
    }
    if (obref) journey.obref = obref;
    await journey.save();
  }
  const cookieView: Cookies = { get: name => name === ACQUISITION_COOKIE ? { value: token! } : input.cookies.get(name) };
  if (input.userId) journey = await bindAcquisitionUser(cookieView, input.userId) || journey;
  if (input.step !== 'sync' && (!journey.userId || input.userId) && isTouchEligible(journey.lastPaidTouch, new Date())) {
    const key = `${input.step}:${journey._id}:${journey.lastPaidTouch.content}`;
    await recordAcquisitionEvent(journey, input.step, key, input.step === 'arrival' ? { at: journey.lastPaidTouch.at } : {});
  }
  return { token };
}

export async function revokeAcquisition(cookies: Cookies, userId?: string) {
  const token = validToken(cookies.get(ACQUISITION_COOKIE)?.value);
  if (!token && !userId) return;
  await connectToDatabase();
  const filter = userId && Types.ObjectId.isValid(userId) ? { $or: [{ userId: new Types.ObjectId(userId) }, ...(token ? [{ tokenHash: hash(token) }] : [])] } : { tokenHash: hash(token!) };
  const journeys = await Journey.find(filter).select('_id').lean();
  await Journey.updateMany(filter, { $set: { consent: false }, $unset: { oppref: 1, obref: 1 } });
  await Event.updateMany({ journeyId: { $in: journeys.map(j => j._id) }, capiState: { $in: ['pending', 'failed'] } }, { $set: { capiState: 'skipped', capiError: 'consentimento_revogado' } });
  await Event.updateMany({ journeyId: { $in: journeys.map(j => j._id) } }, { $unset: { oppref: 1, obref: 1 } });
}

/** Chamado só após validações do pedido de checkout, antes da chamada ao Stripe. */
export async function prepareAcquisitionCheckout(cookies: Cookies, userId: string): Promise<Record<string, string>> {
  const journey = await bindAcquisitionUser(cookies, userId);
  if (!journey || !isTouchEligible(journey.lastPaidTouch, new Date())) return {};
  await recordAcquisitionEvent(journey, 'checkout_started', `checkout:${journey._id}:${journey.lastPaidTouch.content}`);
  return { d2c_acquisition_journey: String(journey._id) };
}
