import { connectToDatabase } from '@/app/lib/mongoose';
import Event from '@/app/models/AcquisitionEvent';
import Journey from '@/app/models/AcquisitionJourney';
import { ACQUISITION_ADS, ACQUISITION_CAMPAIGN_ID, type AcquisitionStep } from '@/lib/analytics/acquisition';

type Delivery = { available: boolean; through: string; rows: { ad_id: string; spend?: number; clicks?: number; impressions?: number }[] };
const cache = new Map<string, { at: number; data: Delivery }>();
async function deliveryInsights(from: Date, to: Date): Promise<Delivery> {
  const end = Math.floor(Math.min(to.getTime(), Date.now()) / 3600_000) * 3600;
  const start = Math.floor(from.getTime() / 3600_000) * 3600;
  const empty: Delivery = { available: false, through: new Date(end * 1000).toISOString(), rows: [] };
  const key = process.env.OPENAI_ADS_API_KEY;
  if (!key || end <= start) return empty;
  const cacheKey = `${start}:${end}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < 60_000) return cached.data;
  const params = new URLSearchParams({ aggregation_level: 'ad', time_granularity: 'none', limit: '100' });
  for (const field of ['ad.id', 'ad.spend', 'ad.clicks', 'ad.impressions']) params.append('fields[]', field);
  params.append('time_ranges[]', JSON.stringify({ type: 'unix_range', start, end }));
  try {
    const response = await fetch(`https://api.ads.openai.com/v1/campaigns/${ACQUISITION_CAMPAIGN_ID}/insights?${params}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return empty;
    const body = await response.json();
    if (!Array.isArray(body.data) || body.has_more) return empty;
    const data: Delivery = { ...empty, available: true, rows: body.data };
    if (cache.size > 20) cache.clear();
    cache.set(cacheKey, { at: Date.now(), data });
    return data;
  } catch { return empty; }
}

export async function acquisitionReport(from: Date, to: Date, qualifiedOnly = false) {
  await connectToDatabase();
  // Coorte de chegada; pagamento futuro continua atribuído à coorte original.
  const match = { internal: false, 'touch.at': { $gte: from, $lt: to }, ...(qualifiedOnly ? { followers: { $gt: 20_000 } } : {}) };
  const [counts, timelines, capi, delivery] = await Promise.all([
    Event.aggregate<{ _id: { content: string; step: AcquisitionStep }; count: number; amountBRL: number }>([
      { $match: match },
      { $group: { _id: { content: '$touch.content', step: '$step', person: { $ifNull: ['$userId', '$journeyId'] } },
        amountBRL: { $sum: { $cond: [{ $eq: ['$currency', 'BRL'] }, '$amount', 0] } } } },
      { $group: { _id: { content: '$_id.content', step: '$_id.step' }, count: { $sum: 1 }, amountBRL: { $sum: '$amountBRL' } } },
    ]),
    Event.aggregate([
      { $match: match }, { $sort: { at: -1 } },
      { $group: { _id: { $ifNull: ['$userId', '$journeyId'] }, journeyId: { $first: '$journeyId' }, lastAt: { $first: '$at' },
        firstTouch: { $first: '$firstTouch' }, touch: { $first: '$touch' }, followers: { $first: '$followers' },
        steps: { $push: { step: '$step', at: '$at' } } } },
      { $sort: { lastAt: -1 } }, { $limit: 100 },
      { $project: { firstTouch: 1, touch: 1, followers: 1, lastAt: 1, journeyId: 1, steps: { $slice: ['$steps', 40] } } },
    ]),
    Event.aggregate([{ $match: match }, { $group: { _id: '$capiState', count: { $sum: 1 } } }]),
    deliveryInsights(from, to),
  ]);
  const rows = ACQUISITION_ADS.map(ad => {
    const stats = delivery.rows.find(row => row.ad_id === ad.id);
    const steps: Partial<Record<AcquisitionStep, number>> = {};
    for (const row of counts.filter(c => c._id.content === ad.content)) steps[row._id.step] = row.count;
    const spend = delivery.available ? Number(stats?.spend ?? 0) : null;
    return { ...ad, steps, spend, clicks: delivery.available ? Number(stats?.clicks ?? 0) : null,
      impressions: delivery.available ? Number(stats?.impressions ?? 0) : null,
      grossRevenue: (counts.find(c => c._id.content === ad.content && c._id.step === 'payment_received')?.amountBRL ?? 0) / 100,
      costPerSubscription: spend !== null && steps.subscription_started ? spend / steps.subscription_started : null,
      costPerPayer: spend !== null && steps.first_payment ? spend / steps.first_payment : null,
    };
  });
  const journeyIds = timelines.map(t => t.journeyId);
  const consents = await Journey.find({ _id: { $in: journeyIds } }).select('_id consent').lean();
  return { from: from.toISOString(), to: to.toISOString(), qualifiedOnly, deliveryAvailable: delivery.available,
    deliveryThrough: delivery.through, rows, capi,
    timelines: timelines.map(t => ({
      // Não expor e-mail, nome ou identificador completo no relatório.
      id: String(t._id).slice(-8), firstTouch: t.firstTouch, touch: t.touch, followers: t.followers,
      lastAt: t.lastAt, steps: t.steps, consent: consents.find(c => String(c._id) === String(t.journeyId))?.consent ?? false,
    })),
  };
}
