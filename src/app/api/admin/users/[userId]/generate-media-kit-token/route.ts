import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const TAG = '[api/admin/users/[userId]/generate-media-kit-token]';

  const session = await getServerSession({ req, ...authOptions });
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado. Apenas administradores.' }, { status: 403 });
  }

  const { userId } = params;
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: 'ID de usuário inválido.' }, { status: 400 });
  }

  await connectToDatabase();
  const token = uuidv4();
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { mediaKitToken: token },
    { new: true }
  ).select('mediaKitToken');

  if (!updatedUser) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const host = req.headers.get('host') || process.env.NEXTAUTH_URL || '';
  const url = `https://${host.replace(/^https?:\/\//, '')}/mediakit/${token}`;

  return NextResponse.json({ url }, { status: 200 });
}
