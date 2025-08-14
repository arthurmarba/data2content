import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/getAdminSession';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  try {
    // 1. Valida a sessão de Admin
    const session = await getAdminSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
    }

    // 2. Obtém o termo de busca da URL
    const { searchParams } = new URL(req.url);
    const nameQuery = searchParams.get('name');

    if (!nameQuery) {
      return NextResponse.json([], { status: 200 });
    }

    await connectToDatabase();

    // 3. Executa a consulta filtrando APENAS por NOME
    const creators = await UserModel.find({
      name: { $regex: nameQuery, $options: 'i' },
    })
      .limit(10)
      .select('name email profile_picture_url')
      .lean();

    // 4. Retorna os resultados formatados
    const formattedCreators = creators.map(c => ({
      id: c._id.toString(),
      name: c.name,
      email: c.email,
      profilePictureUrl: c.profile_picture_url,
    }));

    return NextResponse.json(formattedCreators, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
