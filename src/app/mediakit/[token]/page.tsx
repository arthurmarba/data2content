// src/app/mediakit/[token]/page.tsx (CORRIGIDO)
import { notFound } from 'next/navigation';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import MediaKitView from './MediaKitView';
import { VideoListItem, PerformanceSummary, KpiComparison } from '@/types/mediakit';

export const revalidate = 300;

// Funções de fetch (sem alterações)
async function fetchSummary(baseUrl: string, userId: string): Promise<PerformanceSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/highlights/performance-summary`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
async function fetchTopVideos(baseUrl: string, userId: string): Promise<VideoListItem[]> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/videos/list?sortBy=views&limit=5`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos;
  } catch { return []; }
}
async function fetchKpis(baseUrl: string, userId:string): Promise<KpiComparison | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/kpis/periodic-comparison`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default async function MediaKitPage({ params }: { params: { token: string } }) {
  await connectToDatabase();
  
  const user = await UserModel.findOne({ mediaKitToken: params.token }).lean();
  if (!user) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  
  const [summary, videos, kpis] = await Promise.all([
    fetchSummary(baseUrl, user._id.toString()),
    fetchTopVideos(baseUrl, user._id.toString()),
    fetchKpis(baseUrl, user._id.toString())
  ]);

  // CORREÇÃO: Converte o objeto do Mongoose para um objeto 100% simples e serializável
  const plainUser = JSON.parse(JSON.stringify(user));

  return (
    <MediaKitView
      user={plainUser} // Passa o objeto simples
      summary={summary}
      videos={videos}
      kpis={kpis}
    />
  );
}