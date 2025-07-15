import { NextRequest, NextResponse } from 'next/server';
import MetricModel from '@/app/models/Metric';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { addDays, formatDateYYYYMMDD } from '@/utils/dateHelpers';
import { Types } from 'mongoose';
import { getAdminSession } from '@/lib/getAdminSession';

interface MovingAverageDataPoint { date: string; movingAverageEngagement: number | null; }
interface ResponseData { series: MovingAverageDataPoint[]; insightSummary?: string; }
const DEFAULT_DATA_WINDOW_DAYS = 30;
const DEFAULT_MOVING_AVERAGE_WINDOW_DAYS = 7;
const MAX_DATA_WINDOW_DAYS = 365;
const MAX_MOVING_AVERAGE_WINDOW_DAYS = 90;

export async function GET(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  let dataWindowInDays = DEFAULT_DATA_WINDOW_DAYS;
  const dwParam = searchParams.get('dataWindowInDays');
  if (dwParam) {
    const parsed = parseInt(dwParam,10);
    if (isNaN(parsed) || parsed <= 0 || parsed > MAX_DATA_WINDOW_DAYS) {
      return NextResponse.json({ error: `Parâmetro dataWindowInDays inválido. Deve ser um número positivo até ${MAX_DATA_WINDOW_DAYS}.` }, { status: 400 });
    }
    dataWindowInDays = parsed;
  }
  let movingWindow = DEFAULT_MOVING_AVERAGE_WINDOW_DAYS;
  const mwParam = searchParams.get('movingAverageWindowInDays');
  if (mwParam) {
    const parsed = parseInt(mwParam,10);
    if (isNaN(parsed) || parsed <= 0 || parsed > MAX_MOVING_AVERAGE_WINDOW_DAYS) {
      return NextResponse.json({ error: `Parâmetro movingAverageWindowInDays inválido. Deve ser um número positivo até ${MAX_MOVING_AVERAGE_WINDOW_DAYS}.` }, { status: 400 });
    }
    movingWindow = parsed;
  }
  if (movingWindow > dataWindowInDays) {
    return NextResponse.json({ error: 'movingAverageWindowInDays não pode ser maior que dataWindowInDays.' }, { status: 400 });
  }
  try {
    await connectToDatabase();
    const agencyUsers = await UserModel.find({ planStatus: 'active' }).select('_id').lean();
    if (!agencyUsers.length) {
      return NextResponse.json({ series: [], insightSummary: 'Nenhum usuário encontrado.' }, { status: 200 });
    }
    const userIds = agencyUsers.map(u => u._id);
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23,59,59,999);
    const startDateForQuery = new Date(today);
    startDateForQuery.setDate(startDateForQuery.getDate() - (dataWindowInDays + movingWindow));
    startDateForQuery.setHours(0,0,0,0);

    const agg = await MetricModel.aggregate([
      { $match: { user: { $in: userIds }, postDate: { $gte: startDateForQuery, $lte: endDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$postDate' } }, dailyEngagement: { $sum: { $add: [ { $ifNull: ['$stats.likes',0] }, { $ifNull: ['$stats.comments',0] }, { $ifNull: ['$stats.shares',0] }, { $ifNull: ['$stats.saved',0] } ] } } } },
      { $sort: { _id: 1 } }
    ]);
    const map = new Map<string, number>(agg.map(it => [it._id, it.dailyEngagement]));
    const complete: { date: string; total: number }[] = [];
    let cursor = new Date(startDateForQuery);
    while (cursor <= endDate) {
      const key = formatDateYYYYMMDD(cursor);
      complete.push({ date: key, total: map.get(key) || 0 });
      cursor = addDays(cursor,1);
    }
    const series: MovingAverageDataPoint[] = [];
    for (let i=movingWindow-1; i<complete.length; i++) {
      const window = complete.slice(i-movingWindow+1, i+1);
      const sum = window.reduce((a,b)=>a+b.total,0);
      
      // CORREÇÃO: Adicionada uma verificação para garantir que o item existe
      // antes de tentar acessar suas propriedades.
      const currentEntry = complete[i];
      if (currentEntry) {
        series.push({ date: currentEntry.date, movingAverageEngagement: sum / movingWindow });
      }
    }
    const displayStart = new Date(today); displayStart.setDate(displayStart.getDate()-dataWindowInDays+1); displayStart.setHours(0,0,0,0);
    const finalSeries = series.filter(p => new Date(p.date) >= displayStart);
    const insight = `Média móvel de ${movingWindow} dias do engajamento diário das contas nos últimos ${dataWindowInDays} dias.`;
    return NextResponse.json({ series: finalSeries, insightSummary: finalSeries.length ? insight : 'Dados insuficientes para calcular a média móvel.' }, { status: 200 });
  } catch (error) {
    logger.error('[API AGENCY/TRENDS/MOVING-AVERAGE-ENGAGEMENT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json({ error: 'Erro ao calcular a média móvel.', details: errorMessage }, { status: 500 });
  }
}
