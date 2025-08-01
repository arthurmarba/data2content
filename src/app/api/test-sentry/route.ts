// src/app/api/test-sentry/route.ts

import { NextResponse } from 'next/server';
// Não precisamos do logger customizado para este teste direto
// import { logger } from '@/app/lib/logger'; 
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  const TAG = '[API_TEST_SENTRY_DIRECT]';
  
  try {
    // Esta linha vai intencionalmente causar um erro
    throw new Error('Este é um erro de TESTE DIRETO para o Sentry!');
  
  } catch (error) {
    // TESTE: Capturando a exceção diretamente com o Sentry, sem passar pelo logger.
    // Isso ajuda a isolar o problema. Se este erro aparecer no Sentry, o problema está
    // na interação entre o seu logger e o Sentry. Se não aparecer, o problema é na
    // configuração geral do Sentry (DSN, inicialização, etc.).
    if (error instanceof Error) {
        Sentry.captureException(error);
    } else {
        Sentry.captureException(new Error('Um erro não-padrão foi capturado no teste direto do Sentry.'));
    }

    // Adicionado Sentry.flush() para garantir que o evento de erro
    // seja enviado antes que a função do servidor termine.
    await Sentry.flush(2000);

    // Retorna uma resposta amigável para o navegador
    return NextResponse.json(
      { message: 'Erro de teste DIRETO enviado para o Sentry. Verifique seu painel.' },
      { status: 500 }
    );
  }
}
