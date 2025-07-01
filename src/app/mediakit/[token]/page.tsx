import { notFound } from 'next/navigation';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { headers } from 'next/headers';
import { logMediaKitAccess } from '@/lib/logMediaKitAccess';
import MediaKitView from './MediaKitView';

// Tipos centralizados para garantir consistência em todo o fluxo de dados.
import { VideoListItem, PerformanceSummary, KpiComparison } from '@/types/mediakit';

// A revalidação garante que os dados do Mídia Kit sejam atualizados periodicamente.
export const revalidate = 300; // 5 minutos

// --- MÓDULO DE BUSCA DE DADOS (DATA FETCHING) ---

/**
 * Busca o resumo de performance (melhores formatos e contextos).
 */
async function fetchSummary(baseUrl: string, userId: string): Promise<PerformanceSummary | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/highlights/performance-summary`, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.error(`[MediaKitPage] Falha ao buscar summary: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('[MediaKitPage] Erro de rede ao buscar summary:', error);
    return null;
  }
}

/**
 * Busca os vídeos de melhor performance (Top 5 por views).
 */
async function fetchTopVideos(baseUrl: string, userId: string): Promise<VideoListItem[]> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/videos/list?sortBy=views&limit=5`, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.error(`[MediaKitPage] Falha ao buscar top videos: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.videos || [];
  } catch (error) {
    console.error('[MediaKitPage] Erro de rede ao buscar top videos:', error);
    return [];
  }
}

/**
 * Busca os dados de KPI para o período padrão (inicial).
 */
async function fetchKpis(baseUrl: string, userId: string): Promise<KpiComparison | null> {
  try {
    // A API usará o período padrão (ex: 30 dias) nesta busca inicial no servidor.
    const res = await fetch(`${baseUrl}/api/v1/users/${userId}/kpis/periodic-comparison`, { next: { revalidate: 300 } });
    if (!res.ok) {
      console.error(`[MediaKitPage] Falha ao buscar kpis: ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error('[MediaKitPage] Erro de rede ao buscar kpis:', error);
    return null;
  }
}

// --- COMPONENTE DE PÁGINA (SERVER COMPONENT) ---

export default async function MediaKitPage({ params }: { params: { token: string } }) {
  await connectToDatabase();
  
  const user = await UserModel.findOne({ mediaKitSlug: params.token }).lean();
  
  if (!user) {
    notFound();
  }

  const reqHeaders = headers();
  const ip = reqHeaders.get('x-real-ip') || reqHeaders.get('x-forwarded-for') || '';
  const referer = reqHeaders.get('referer') || undefined;
  await logMediaKitAccess(user._id.toString(), ip, referer);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  
  const [summary, videos, kpis] = await Promise.all([
    fetchSummary(baseUrl, user._id.toString()),
    fetchTopVideos(baseUrl, user._id.toString()),
    fetchKpis(baseUrl, user._id.toString())
  ]);

  // CORREÇÃO: O erro de tipo ocorre porque 'VideoListItem' não possui 'tone' e 'references'.
  // Ao fazer o cast de 'video' para 'any', podemos acessar essas propriedades (que esperamos que
  // a API retorne) sem causar um erro de compilação. Isso garante que todos os dados de
  // classificação sejam transformados em arrays antes de serem passados para a view.
  const compatibleVideos = videos.map((video: any) => ({
    ...video,
    format: video.format ? [video.format] : [],
    proposal: video.proposal ? [video.proposal] : [],
    context: video.context ? [video.context] : [],
    tone: video.tone ? [video.tone] : [],
    references: video.references ? [video.references] : [],
  }));

  const plainUser = JSON.parse(JSON.stringify(user));

  return (
    <MediaKitView
      user={plainUser}
      summary={summary}
      videos={compatibleVideos}
      kpis={kpis}
    />
  );
}
