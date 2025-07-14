import { NextRequest, NextResponse } from 'next/server';
import { getAgencySession } from '@/lib/getAgencySession';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';

export async function GET(req: NextRequest) {
  try {
    // 1. Valida a sessão e obtém o ID da agência
    const session = await getAgencySession(req);
    if (!session || !session.user || !session.user.agencyId) {
      return NextResponse.json({ error: 'Acesso não autorizado' }, { status: 401 });
    }
    const agencyId = session.user.agencyId;

    // 2. Obtém o termo de busca da URL
    const { searchParams } = new URL(req.url);
    const nameQuery = searchParams.get('name');

    if (!nameQuery) {
      return NextResponse.json([], { status: 200 }); // Retorna vazio se não houver busca
    }

    await connectToDatabase();

    // 3. Executa a consulta filtrando por NOME e AGÊNCIA
    const creators = await UserModel.find({
      name: { $regex: nameQuery, $options: 'i' }, // Filtra pelo nome (case-insensitive)
      agency: agencyId                           // E TAMBÉM pelo ID da agência
    })
    .limit(10) // Limita a 10 resultados para a lista de sugestões
    .select('name email profile_picture_url') // Seleciona apenas os campos necessários
    .lean();

    // 4. Retorna os resultados formatados
    const formattedCreators = creators.map(c => ({
        id: c._id.toString(),
        name: c.name,
        email: c.email,
        profilePictureUrl: c.profile_picture_url
    }));

    return NextResponse.json(formattedCreators, { status: 200 });

  } catch (error) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
