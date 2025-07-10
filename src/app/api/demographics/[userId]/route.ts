// Local: src/app/api/demographics/[userId]/route.ts

import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import AudienceDemographicSnapshot from '@/app/models/demographics/AudienceDemographicSnapshot';
import { logger } from '@/app/lib/logger';

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const TAG = '[API_GET_DEMOGRAPHICS]';
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    logger.warn(`${TAG} Tentativa de acesso com ID de usuário inválido: ${userId}`);
    return NextResponse.json({ error: 'ID de usuário inválido.' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    logger.info(`${TAG} Buscando dados demográficos para o usuário: ${userId}`);

    // Busca o snapshot mais recente para o usuário
    const snapshot = await AudienceDemographicSnapshot.findOne({ user: new Types.ObjectId(userId) })
      .sort({ recordedAt: -1 }) // Garante que pegamos o mais recente
      .lean();

    if (!snapshot) {
      logger.warn(`${TAG} Nenhum snapshot demográfico encontrado para o usuário: ${userId}`);
      return NextResponse.json({ error: 'Dados demográficos não encontrados.' }, { status: 404 });
    }

    logger.info(`${TAG} Dados demográficos encontrados e retornados para o usuário: ${userId}`);
    // Retorna apenas o objeto 'demographics' que contém os dados de age, gender, etc.
    return NextResponse.json(snapshot.demographics, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Erro ao buscar dados demográficos para o usuário ${userId}:`, error);
    return NextResponse.json({ error: 'Erro interno do servidor ao buscar dados.' }, { status: 500 });
  }
}
