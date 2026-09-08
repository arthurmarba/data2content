import type Stripe from 'stripe';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import Journey from '@/app/models/AcquisitionJourney';
import Event from '@/app/models/AcquisitionEvent';
import { recordAcquisitionEvent } from './journey';
import { isTouchEligible } from '@/lib/analytics/acquisition';

const id = (value: unknown): string | null => typeof value === 'string' ? value : (value as { id?: string })?.id || null;
export function acquisitionStripeFacts(event: Stripe.Event) {
  const object = event.data.object as unknown as Record<string, any>;
  const customerId = id(object.customer);
  if (!customerId) return null;
  if (['customer.subscription.created', 'customer.subscription.updated'].includes(event.type)) {
    if (!['active', 'trialing'].includes(object.status)) return null;
    return { customerId, subscriptionId: object.id as string, started: true, at: new Date((object.start_date || object.created || event.created) * 1000), metadata: object.metadata };
  }
  if (event.type === 'checkout.session.completed' && object.mode === 'subscription' && ['paid', 'no_payment_required'].includes(object.payment_status)) {
    const subscriptionId = id(object.subscription);
    return subscriptionId ? { customerId, subscriptionId, started: true, at: new Date(event.created * 1000), metadata: object.metadata } : null;
  }
  if (event.type === 'invoice.payment_succeeded') {
    const subscriptionId = id(object.subscription) || id(object.parent?.subscription_details?.subscription)
      || id(object.lines?.data?.[0]?.parent?.subscription_item_details?.subscription);
    if (!subscriptionId || object.paid === false) return null;
    return { customerId, subscriptionId, started: object.billing_reason === 'subscription_create',
      at: new Date((object.status_transitions?.paid_at || event.created) * 1000),
      metadata: object.parent?.subscription_details?.metadata || object.subscription_details?.metadata,
      invoiceId: object.id as string, amount: Number(object.amount_paid || 0), currency: String(object.currency || '').toUpperCase() };
  }
  return null;
}

/** Persistência independente da contabilidade: a repetição do webhook repara o funil. */
export async function recordAcquisitionStripeEvent(event: Stripe.Event) {
  if (!event.livemode && process.env.NODE_ENV === 'production') return;
  const facts = acquisitionStripeFacts(event);
  if (!facts) return;
  await connectToDatabase();
  const user = await User.findOne({ stripeCustomerId: facts.customerId }).select('_id').lean();
  if (!user) return;
  const subscriptionKey = `d2c_subscription_${facts.subscriptionId}`;
  let enrollment = await Event.findOne({ key: subscriptionKey }).lean();
  let journey = enrollment ? await Journey.findOne({ _id: enrollment.journeyId, userId: user._id, consent: true }).lean() : null;
  if (!enrollment && facts.started) {
    const pinned = facts.metadata?.d2c_acquisition_journey;
    journey = await Journey.findOne({ userId: user._id, consent: true,
      ...(pinned && Types.ObjectId.isValid(pinned) ? { _id: new Types.ObjectId(pinned) } : {}),
      'lastPaidTouch.at': { $lte: facts.at, $gte: new Date(facts.at.getTime() - 30 * 86400_000) },
    }).sort({ 'lastPaidTouch.at': -1 }).lean();
    if (!journey || !isTouchEligible(journey.lastPaidTouch, facts.at)) return;
    await recordAcquisitionEvent(journey, 'subscription_started', subscriptionKey, { at: facts.at, subscriptionId: facts.subscriptionId });
    enrollment = await Event.findOne({ key: subscriptionKey }).lean();
  }
  if (!journey || !enrollment) return;
  if ('invoiceId' in facts && facts.invoiceId && facts.amount! > 0) {
    const extra = { at: facts.at, amount: facts.amount, currency: facts.currency, subscriptionId: facts.subscriptionId,
      touch: enrollment.touch, firstTouch: enrollment.firstTouch, oppref: enrollment.oppref, obref: enrollment.obref };
    await recordAcquisitionEvent(journey, 'payment_received', `invoice:${facts.invoiceId}`, extra);
    // Atribuição congelada na assinatura: renovação orgânica não troca o anúncio vencedor.
    await recordAcquisitionEvent(journey, 'first_payment', `first_payment:${facts.subscriptionId}`, extra);
    // Entrega fora de ordem: a primeira fatura cronológica prevalece, não a primeira requisição.
    await Event.updateOne({ key: `first_payment:${facts.subscriptionId}`, at: { $gt: facts.at } }, { $set: extra });
  }
}
