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
  const d7  = new Date(now.getTime() -  7 * 24 * 3600 * 1000);
  const d90 = new Date(now.getTime() - 90 * 24 * 3600 * 1000);

  // --- Usuários ---
  const totalUsers   = await db.collection('users').countDocuments();
  const planDist     = await db.collection('users').aggregate([
    { $group: { _id: '$planStatus', total: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]).toArray();

  // --- Atividade (proxy composto últimos 90d) ---
  const activitySources = [
    { col: 'creatorcontentideas',           user: 'userId', date: 'createdAt' },
    { col: 'publicalculations',             user: 'userId', date: 'createdAt' },
    { col: 'chat_sessions',                 user: 'userId', date: 'lastActivityAt' },
    { col: 'threads',                       user: 'userId', date: 'lastActivityAt' },
    { col: 'post_creation_funnel_events',   user: 'userId', date: 'createdAt' },
    { col: 'creatormapconfirmations',       user: 'userId', date: 'createdAt' },
    { col: 'creatorvideonarrativediagnoses',user: 'userId', date: 'createdAt' },
  ];

  const events: { userId: string; date: string }[] = [];
  for (const s of activitySources) {
    const docs = await db.collection(s.col).find(
      { [s.date]: { $gte: d90 } },
      { projection: { [s.user]: 1, [s.date]: 1, _id: 0 } },
    ).toArray();
    for (const d of docs) {
      const uid = d[s.user];
      const dt  = d[s.date];
      if (uid && dt) events.push({ userId: uid.toString(), date: new Date(dt).toISOString().slice(0, 10) });
    }
  }

  const byDay: Record<string, Set<string>> = {};
  const byMonth: Record<string, Set<string>> = {};
  for (const e of events) {
    if (!byDay[e.date]) byDay[e.date] = new Set();
    byDay[e.date]!.add(e.userId);
    const m = e.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = new Set();
    byMonth[m].add(e.userId);
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

  // --- Mídia Kit ---
  const mkBotPattern = /^(unknown|69\.171\.|157\.240\.|173\.252\.|31\.13\.)/;
  const mkHuman30d = await db.collection('mediakitaccesslogs').countDocuments({
    ip: { $not: mkBotPattern },
    timestamp: { $gte: d30 },
  });
  const mkHumanTotal = await db.collection('mediakitaccesslogs').countDocuments({
    ip: { $not: mkBotPattern },
  });

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
    users: { total: totalUsers, planDist },
    activity: { avgDau30, peakDau, mau30, mauByMonth },
    features: {
      pautas: { total30d: pautas30d, users30d: pautasUsers30d, byWeek: pautasByWeek },
      publi:  { total: publiTotal, total30d: publi30d, users30d: publiUsers30d },
      video:  { total30d: uploads30d },
      mapa:   { total: mapaTotal, confirmations30d: confirma30d },
    },
    mediakit: {
      humanTotal: mkHumanTotal,
      human30d:   mkHuman30d,
      byMonth:    mkByMonth,
      ranking:    mkRankingFull,
    },
  });
}
