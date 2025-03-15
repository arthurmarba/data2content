import { NextResponse } from "next/server";

// Garante que essa rota use Node.js em vez de Edge (opcional se não usar Mongoose/Node APIs)
export const runtime = "nodejs";

/**
 * GET /api/questions
 * Retorna uma lista simples de perguntas (mock).
 */
export async function GET() {
  const questions = [
    { id: 1, text: "Como criar conteúdo?" },
    { id: 2, text: "Estratégias de marketing?" },
    { id: 3, text: "Como aumentar seguidores?" },
  ];

  return NextResponse.json(questions);
}
