import { connectToDatabase } from '@/app/lib/mongoose';
import Journey from '@/app/models/AcquisitionJourney';
import Event, { type AcquisitionEventRecord } from '@/app/models/AcquisitionEvent';

export function acquisitionConversionPayload(event: AcquisitionEventRecord, refs: { oppref?: string | null; obref?: string | null }) {
  const types: Record<string, string> = { arrival: 'page_viewed', pricing_viewed: 'contents_viewed', account_created: 'registration_completed', checkout_started: 'checkout_started', subscription_started: 'subscription_created', first_payment: 'order_created' };
  const type = types[event.step];
  if (!type) return null;
  return {
    id: event.key, type, timestamp_ms: event.at.getTime(), action_source: 'web',
    opt_out: true,
    source_url: 'https://data2content.ai/',
    ...(refs.oppref ? { oppref: refs.oppref } : {}),
    ...(refs.obref ? { user: { obref: refs.obref } } : {}),
    data: type === 'registration_completed' ? { type: 'customer_action' }
      : type === 'subscription_created' ? { type: 'plan_enrollment', plan_id: 'd2c_pro' }
      : { type: 'contents', ...(type === 'order_created' ? { amount: event.amount, currency: event.currency } : {}),
        contents: [{ id: event.step === 'pricing_viewed' ? 'precos_d2c' : 'd2c_pro', content_type: 'subscription' }] },
  };
}

export async function deliverAcquisitionConversions() {
  const pixelId = process.env.OPENAI_ADS_PIXEL_ID, key = process.env.OPENAI_ADS_CONVERSIONS_API_KEY;
  if (!pixelId || !key) return { configured: false, sent: 0, failed: 0 };
  await connectToDatabase();
  let sent = 0, failed = 0, skipped = 0;
  for (let i = 0; i < 20; i++) {
    const now = new Date();
    const event = await Event.findOneAndUpdate({ capiState: 'pending', nextAttemptAt: { $lte: now },
      $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }],
    }, { $set: { leaseUntil: new Date(Date.now() + 120_000) }, $inc: { attempts: 1 } }, { new: true, sort: { at: 1 } }).lean();
    if (!event) break;
    const journey = await Journey.findById(event.journeyId).lean();
    const payload = acquisitionConversionPayload(event, event);
    // Sem SDK: não varrer formulários nem enviar nomes, e-mails, IP ou texto de IA.
    if (!journey?.consent || journey.internal || !payload || (!event.oppref && !event.obref)) {
      await Event.updateOne({ _id: event._id }, { $set: { capiState: 'skipped', leaseUntil: null, capiError: !journey?.consent ? 'sem_consentimento' : 'sem_identificador_ou_interno' } });
      skipped++; continue;
    }
    if (Date.now() - event.at.getTime() > 7 * 86400_000) {
      await Event.updateOne({ _id: event._id }, { $set: { capiState: 'failed', leaseUntil: null, capiError: 'evento_fora_da_janela_de_envio' } });
      failed++; continue;
    }
    try {
      const response = await fetch(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(pixelId)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration_source: 'data2content', events: [payload] }), signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) throw new Error(`http_${response.status}`);
      await Event.updateOne({ _id: event._id }, { $set: { capiState: 'sent', capiSentAt: new Date(), leaseUntil: null }, $unset: { capiError: 1 } });
      sent++;
    } catch (error) {
      await Event.updateOne({ _id: event._id }, { $set: {
        capiState: event.attempts >= 12 ? 'failed' : 'pending', leaseUntil: null,
        nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** event.attempts)),
        capiError: error instanceof Error && /^http_\d+$/.test(error.message) ? error.message : 'erro_de_transporte',
      } });
      failed++;
    }
  }
  return { configured: true, sent, failed, skipped };
}
