import { NextRequest, NextResponse } from 'next/server';
import { fetchRedemptions } from '@/lib/services/adminCreatorService';
import { getAdminSession } from '@/lib/getAdminSession';
import { AdminRedemptionListParams } from '@/types/admin/redemptions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeCsvValue(value: any, delimiter = ';'): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session?.user) {
    return NextResponse.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const exportType = searchParams.get('export');

  const statusParam = searchParams.get('status') || undefined;
  const params: AdminRedemptionListParams = {
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
    search: searchParams.get('search') || undefined,
    status: statusParam && statusParam !== 'all' ? (statusParam as any) : undefined,
    sortBy: (searchParams.get('sortBy') as any) || undefined,
    sortOrder: (searchParams.get('sortOrder') as any) || undefined,
    dateFrom: searchParams.get('dateFrom') || undefined,
    dateTo: searchParams.get('dateTo') || undefined,
  };

  try {
    const { redemptions, totalRedemptions, totalPages } = await fetchRedemptions(params);

    if (exportType === 'csv') {
      const delimiter = ';';
      const headers = ['createdAt', 'name', 'email', 'amount', 'currency', 'status', 'transactionId', 'notes'];
      let csv = headers.join(delimiter) + '\r\n';
      redemptions.forEach(r => {
        csv += [
          r.createdAt ? new Date(r.createdAt).toISOString() : '',
          r.user.name || '',
          r.user.email || '',
          (r.amountCents / 100).toFixed(2).replace('.', ','),
          r.currency,
          r.status,
          r.transactionId || '',
          r.notes || ''
        ].map(v => escapeCsvValue(v, delimiter)).join(delimiter) + '\r\n';
      });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="redemptions.csv"`,
        }
      });
    }

    return NextResponse.json({
      items: redemptions,
      totalItems: totalRedemptions,
      totalPages,
      currentPage: params.page ?? 1,
      perPage: params.limit ?? 10,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno.' }, { status: 500 });
  }
}
