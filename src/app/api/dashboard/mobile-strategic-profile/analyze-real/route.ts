import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { requestVideoAnalysis, readVideoAnalysis, acknowledgeVideoAnalysis } from '@/app/lib/videoAnalysis/jobs';
import { isVideoNarrativeRealAnalysisE2EEnabled } from '@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisFeatureFlag';
import { isMobileStrategicProfileEnabled } from '@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag';
import { isRealUploadEnabled, isTemporaryUploadSessionEnabled } from '@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag';
export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';
async function userId() { const session = await getServerSession(await resolveAuthOptions()) as { user?: { id?: string } } | null; return session?.user?.id; }
export async function POST(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ message: 'Entre novamente para analisar o vídeo.', retryable: false }, { status: 401 });
  try {
    const body = await request.json();
    if (body?.acknowledge && typeof body.jobId === 'string') {
      await acknowledgeVideoAnalysis(id, body.jobId);
      return NextResponse.json({ ok: true });
    }
    if (!isVideoNarrativeRealAnalysisE2EEnabled() || !isMobileStrategicProfileEnabled() || !isRealUploadEnabled() || !isTemporaryUploadSessionEnabled()) return NextResponse.json({ message: 'A análise de vídeos está indisponível no momento.', retryable: false }, { status: 403 });
    const result = await requestVideoAnalysis(id, body);
    return NextResponse.json(result.data, { status: result.status });
  } catch {
    return NextResponse.json({ message: 'Não foi possível confirmar o pedido. Abra o botão + para consultar o andamento.', retryable: false }, { status: 503 });
  }
}
export async function GET(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ message: 'Entre novamente para acompanhar a análise.' }, { status: 401 });
  try {
    const job = await readVideoAnalysis(id, new URL(request.url).searchParams.get('jobId'));
    return NextResponse.json({ job }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ message: 'Não foi possível consultar a análise agora.' }, { status: 503 }); }
}
export async function PUT() { return NextResponse.json({ message: 'Método não permitido.' }, { status: 405 }); }
export const PATCH = PUT;
export const DELETE = PUT;
