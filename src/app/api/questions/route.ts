import { NextResponse } from "next/server";

export async function GET() {
  const questions = [
    { id: 1, text: "Como criar conteúdo?" },
    { id: 2, text: "Estratégias de marketing?" },
    { id: 3, text: "Como aumentar seguidores?" },
  ];
  return NextResponse.json(questions);
}
