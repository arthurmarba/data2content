import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import mongoose from 'mongoose';

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const d60 = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
  const d7  = new Date(now.getTime() -  7 * 24 * 3600 * 1000);
  const d90 = new Date(now.getTime() - 90 * 24 * 3600 * 1000);

  // --- Usuários ---
  const totalUsers   = await db.collection('users').countDocuments();
  const [newUsers7d, newUsers30d, newUsersPrevious30d] = await Promise.all([
    db.collection('users').countDocuments({ createdAt: { $gte: d7 } }),
    db.collection('users').countDocuments({ createdAt: { $gte: d30 } }),
    db.collection('users').countDocuments({ createdAt: { $gte: d60, $lt: d30 } }),
  ]);
  const planDist     = await db.collection('users').aggregate([
    { $group: { _id: '$planStatus', total: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]).toArray();

  // --- Atividade (log canônico de eventos — usage_events) ---
  const usageEvents = await db.collection('usage_events').find(
    { createdAt: { $gte: d90 } },
    { projection: { userId: 1, createdAt: 1, _id: 0 } },
  ).toArray();

  const byDay: Record<string, Set<string>> = {};
  const eventsByDay: Record<string, number> = {};
  const byMonth: Record<string, Set<string>> = {};
  for (const e of usageEvents) {
    const uid = e.userId?.toString();
    const dt  = e.createdAt;
    if (!uid || !dt) continue;
    const day = new Date(dt).toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = new Set();
    byDay[day]!.add(uid);
    eventsByDay[day] = (eventsByDay[day] ?? 0) + 1;
    const m = day.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = new Set();
    byMonth[m].add(uid);
  }

  const mauByMonth = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, users]) => {
      const daysInMonth = Object.entries(byDay)
        .filter(([d]) => d.startsWith(month))
        .map(([, u]) => u.size);
      const avgDau = daysInMonth.length
        ? +(daysInMonth.reduce((a, b) => a + b, 0) / daysInMonth.length).toFixed(1)
        : 0;
      return { month, mau: users.size, avgDau };
    });

  const last30days = Object.entries(byDay).filter(([d]) => d >= d30.toISOString().slice(0, 10));
  const dauValues  = last30days.map(([, u]) => u.size);
  const avgDau30   = dauValues.length ? +(dauValues.reduce((a, b) => a + b, 0) / dauValues.length).toFixed(1) : 0;
  const peakDau    = dauValues.length ? Math.max(...dauValues) : 0;
  const curMonthKey = new Date(now.getTime() - 5 * 24 * 3600 * 1000).toISOString().slice(0, 7);
  const mau30      = byMonth[curMonthKey]?.size ?? 0;
  const actionUsers30d = new Set(
    usageEvents
      .filter(e => e.createdAt && new Date(e.createdAt) >= d30)
      .map(e => e.userId?.toString())
      .filter((uid): uid is string => Boolean(uid)),
  ).size;
  const events30d = usageEvents.filter(e => e.createdAt && new Date(e.createdAt) >= d30).length;
  const dauByDay = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(now.getTime() - (29 - index) * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    return {
      date,
      users: byDay[date]?.size ?? 0,
      events: eventsByDay[date] ?? 0,
    };
  });

  // --- DAU/MAU por login (users.lastActiveAt) — complementa a visão por ação.
  // lastActiveAt guarda só o valor mais recente por usuário, então serve para
  // janelas "até agora" (hoje / últimos 30d), não para reconstruir meses passados.
  const d1 = new Date(now.getTime() - 24 * 3600 * 1000);
  const dauLogin      = await db.collection('users').countDocuments({ lastActiveAt: { $gte: d1 } });
  const mauLogin30d   = await db.collection('users').countDocuments({ lastActiveAt: { $gte: d30 } });

  // --- Features ---
  const pautas30d      = await db.collection('creatorcontentideas').countDocuments({ createdAt: { $gte: d30 } });
  const pautasUsers30d = (await db.collection('creatorcontentideas').distinct('userId', { createdAt: { $gte: d30 } })).length;

  const publiTotal    = await db.collection('publicalculations').countDocuments();
  const publi30d      = await db.collection('publicalculations').countDocuments({ createdAt: { $gte: d30 } });
  const publiUsers30d = (await db.collection('publicalculations').distinct('userId', { createdAt: { $gte: d30 } })).length;

  const pautasByWeek = await db.collection('creatorcontentideas').aggregate([
    { $match: { createdAt: { $gte: new Date(now.getTime() - 56 * 24 * 3600 * 1000) } } },
    { $group: {
        _id: { year: { $isoWeekYear: '$createdAt' }, week: { $isoWeek: '$createdAt' } },
        total: { $sum: 1 },
        users: { $addToSet: '$userId' },
    }},
    { $addFields: { uniqueUsers: { $size: '$users' } } },
    { $project: { users: 0 } },
    { $sort: { '_id.year': 1, '_id.week': 1 } },
  ]).toArray();

  const uploads30d = await db.collection('creatorvideonarrativediagnoses').countDocuments({ createdAt: { $gte: d30 } });
  const mapaTotal  = await db.collection('mapasseed').countDocuments();
  const confirma30d = await db.collection('creatormapconfirmations').countDocuments({ createdAt: { $gte: d30 } });

  // --- Por ferramenta (log canônico, 30d) — leitura refinada por tool/plataforma ---
  const toolStats = await db.collection('usage_events').aggregate([
    { $match: { createdAt: { $gte: d30 } } },
    { $group: {
        _id: '$eventName',
        total: { $sum: 1 },
        users: { $addToSet: '$userId' },
        mobileTotal: { $sum: { $cond: [{ $eq: ['$metadata.platform', 'mobile'] }, 1, 0] } },
        mobileUsers: { $addToSet: { $cond: [{ $eq: ['$metadata.platform', 'mobile'] }, '$userId', '$$REMOVE'] } },
    }},
    { $addFields: { uniqueUsers: { $size: '$users' }, mobileUniqueUsers: { $size: '$mobileUsers' } } },
    { $project: { users: 0, mobileUsers: 0 } },
    { $sort: { total: -1 } },
  ]).toArray();

  // --- Mídia Kit ---
  const mkBotPattern = /^(unknown|69\.171\.|157\.240\.|173\.252\.|31\.13\.)/;
  const mkHuman30d = await db.collection('mediakitaccesslogs').countDocuments({
    ip: { $not: mkBotPattern },
    timestamp: { $gte: d30 },
  });
  const mkHumanTotal = await db.collection('mediakitaccesslogs').countDocuments({
    ip: { $not: mkBotPattern },
  });
  const [mkHumanPrevious30d, mkUniqueVisitors30d, mkCreators30d] = await Promise.all([
    db.collection('mediakitaccesslogs').countDocuments({
      ip: { $not: mkBotPattern },
      timestamp: { $gte: d60, $lt: d30 },
    }),
    db.collection('mediakitaccesslogs').distinct('ip', {
      ip: { $not: mkBotPattern },
      timestamp: { $gte: d30 },
    }).then(values => values.length),
    db.collection('mediakitaccesslogs').distinct('user', {
      ip: { $not: mkBotPattern },
      timestamp: { $gte: d30 },
    }).then(values => values.length),
  ]);

  const mkByMonth = await db.collection('mediakitaccesslogs').aggregate([
    { $match: { ip: { $not: mkBotPattern } } },
    { $group: {
        _id: { year: { $year: '$timestamp' }, month: { $month: '$timestamp' } },
        acessos: { $sum: 1 },
        visitantes: { $addToSet: '$ip' },
    }},
    { $addFields: { visitantesUnicos: { $size: '$visitantes' } } },
    { $project: { visitantes: 0 } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]).toArray();

  const mkRanking = await db.collection('mediakitaccesslogs').aggregate([
    { $match: { ip: { $not: mkBotPattern } } },
    { $group: {
        _id: '$user',
        acessosTotais: { $sum: 1 },
        visitantesUnicos: { $addToSet: '$ip' },
    }},
    { $addFields: { visitantesUnicosCount: { $size: '$visitantesUnicos' } } },
    { $project: { visitantesUnicos: 0 } },
    { $sort: { visitantesUnicosCount: -1 } },
    { $limit: 20 },
  ]).toArray();

  const mkIds = mkRanking
    .map(r => { try { return new mongoose.Types.ObjectId(r._id as string); } catch { return null; } })
    .filter((id): id is mongoose.Types.ObjectId => id !== null);
  const mkUsers = await db.collection('users').find(
    { _id: { $in: mkIds } },
    { projection: { name: 1, username: 1, planStatus: 1, followers_count: 1 } },
  ).toArray();
  const mkUserMap: Record<string, typeof mkUsers[0]> = {};
  for (const u of mkUsers) mkUserMap[u._id.toString()] = u;

  const mkRankingFull = mkRanking.map(r => ({
    userId: r._id,
    name: mkUserMap[r._id]?.name ?? '—',
    username: mkUserMap[r._id]?.username ?? null,
    planStatus: mkUserMap[r._id]?.planStatus ?? '—',
    followers: mkUserMap[r._id]?.followers_count ?? null,
    visitantesUnicos: r.visitantesUnicosCount,
    acessosTotais: r.acessosTotais,
  }));

  return NextResponse.json({
    generatedAt: now.toISOString(),
    users: {
      total: totalUsers,
      planDist,
      new7d: newUsers7d,
      new30d: newUsers30d,
      previous30d: newUsersPrevious30d,
    },
    activity: {
      avgDau30,
      peakDau,
      mau30,
      mauByMonth,
      dauLogin,
      mauLogin30d,
      actionUsers30d,
      events30d,
      dauByDay,
    },
    features: {
      pautas: { total30d: pautas30d, users30d: pautasUsers30d, byWeek: pautasByWeek },
      publi:  { total: publiTotal, total30d: publi30d, users30d: publiUsers30d },
      video:  { total30d: uploads30d },
      mapa:   { total: mapaTotal, confirmations30d: confirma30d },
      byTool: toolStats.map(t => ({
        eventName: t._id as string,
        total: t.total as number,
        uniqueUsers: t.uniqueUsers as number,
        mobileTotal: t.mobileTotal as number,
        mobileUniqueUsers: t.mobileUniqueUsers as number,
      })),
    },
    mediakit: {
      humanTotal: mkHumanTotal,
      human30d:   mkHuman30d,
      humanPrevious30d: mkHumanPrevious30d,
      uniqueVisitors30d: mkUniqueVisitors30d,
      creators30d: mkCreators30d,
      byMonth:    mkByMonth,
      ranking:    mkRankingFull,
    },
  });
}
