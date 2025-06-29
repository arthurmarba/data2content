import { notFound } from 'next/navigation';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import VideosTable, { VideoListItem } from '@/app/admin/creator-dashboard/components/VideosTable';
import IndicatorCard from '@/app/dashboard/components/IndicatorCard';
import MetricCardWithTrend from '@/app/dashboard/components/MetricCardWithTrend';
import { UserAvatar } from '@/app/components/UserAvatar';

export const revalidate = 300;

interface PerformanceSummary {
  topPerformingFormat?: { name: string; metricName: string; valueFormatted: string } | null;
  lowPerformingFormat?: { name: string; metricName: string; valueFormatted: string } | null;
  topPerformingContext?: { name: string; metricName: string; valueFormatted: string } | null;
  insightSummary?: string;
}

interface KpiComparison {
  followerGrowth: {
    currentValue: number | null;
    previousValue: number | null;
    percentageChange: number | null;
    chartData?: { name: string; value: number }[];
  };
  totalEngagement: {
    currentValue: number | null;
    previousValue: number | null;
    percentageChange: number | null;
    chartData?: { name: string; value: number }[];
  };
  postingFrequency: {
    currentValue: number | null;
    previousValue: number | null;
    percentageChange: number | null;
    chartData?: { name: string; value: number }[];
  };
  insightSummary?: {
    followerGrowth?: string;
    totalEngagement?: string;
    postingFrequency?: string;
  };
}

async function fetchSummary(baseUrl: string, userId: string): Promise<PerformanceSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/highlights/performance-summary`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as PerformanceSummary;
  } catch {
    return null;
  }
}

async function fetchTopVideos(baseUrl: string, userId: string): Promise<VideoListItem[]> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/videos/list?sortBy=views&limit=5`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos as VideoListItem[];
  } catch {
    return [];
  }
}

async function fetchKpis(baseUrl: string, userId: string): Promise<KpiComparison | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/kpis/periodic-comparison`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as KpiComparison;
  } catch {
    return null;
  }
}

export default async function MediaKitPage({ params }: { params: { token: string } }) {
  await connectToDatabase();
  const user = await UserModel.findOne({ mediaKitToken: params.token }).lean();
  if (!user) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const summary = await fetchSummary(baseUrl, user._id.toString());
  const videos = await fetchTopVideos(baseUrl, user._id.toString());
  const kpis = await fetchKpis(baseUrl, user._id.toString());

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-6">
        <UserAvatar name={user.name || 'Criador'} src={user.profile_picture_url || '/images/default-profile.png'} size={96} />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{user.name}</h1>
          {user.username && <p className="text-gray-600">@{user.username}</p>}
          {user.biography && <p className="text-gray-600 mt-2 whitespace-pre-line">{user.biography}</p>}
        </div>
      </div>

      {summary && (
        <div className="grid sm:grid-cols-3 gap-4">
          {summary.topPerformingFormat && (
            <IndicatorCard
              title={`Melhor Formato: ${summary.topPerformingFormat.name}`}
              value={summary.topPerformingFormat.valueFormatted}
              description={`Média de ${summary.topPerformingFormat.metricName}`}
            />
          )}
          {summary.topPerformingContext && (
            <IndicatorCard
              title={`Melhor Contexto: ${summary.topPerformingContext.name}`}
              value={summary.topPerformingContext.valueFormatted}
              description={`Média de ${summary.topPerformingContext.metricName}`}
            />
          )}
          {summary.lowPerformingFormat && (
            <IndicatorCard
              title={`Pior Formato: ${summary.lowPerformingFormat.name}`}
              value={summary.lowPerformingFormat.valueFormatted}
              description={`Média de ${summary.lowPerformingFormat.metricName}`}
            />
          )}
        </div>
      )}

      {kpis && (
        <div className="grid sm:grid-cols-3 gap-4">
          <MetricCardWithTrend
            label="Crescimento de Seguidores"
            value={kpis.followerGrowth.currentValue ?? undefined}
            trendData={kpis.followerGrowth.chartData?.map(c => c.value)}
            recommendation={kpis.insightSummary?.followerGrowth || ''}
          />
          <MetricCardWithTrend
            label="Engajamento Médio"
            value={kpis.totalEngagement.currentValue ?? undefined}
            trendData={kpis.totalEngagement.chartData?.map(c => c.value)}
            recommendation={kpis.insightSummary?.totalEngagement || ''}
          />
          <MetricCardWithTrend
            label="Frequência de Posts (/sem)"
            value={kpis.postingFrequency.currentValue ?? undefined}
            trendData={kpis.postingFrequency.chartData?.map(c => c.value)}
            recommendation={kpis.insightSummary?.postingFrequency || ''}
          />
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Posts</h2>
        <VideosTable
          videos={videos}
          sortConfig={{ sortBy: 'stats.views', sortOrder: 'desc' }}
          onSort={() => {}}
          primaryMetric="stats.views"
          readOnly
        />
      </div>

      <div className="bg-indigo-600 text-white text-center p-6 rounded-xl">
        <h3 className="text-2xl font-semibold mb-2">Vamos trabalhar juntos?</h3>
        <p className="mb-4">Entre em contato para parcerias e oportunidades.</p>
        <a
          href={`mailto:${user.email}`}
          className="bg-white text-indigo-700 px-6 py-3 rounded-lg font-semibold"
        >
          Fale Conosco
        </a>
      </div>
    </div>
  );
}
