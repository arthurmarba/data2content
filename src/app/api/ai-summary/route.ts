import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const data = {
    name: "AI Summary",
    description: "Summary of the application's AI capabilities.",
    features: [
      "Summarizes content",
      "Provides insights",
      "Answers questions",
    ],
    faq: [
      {
        question: "O que é o AI Summary?",
        answer: "É um endpoint que descreve os recursos de IA do Data2Content.",
      },
      {
        question: "Como posso usar?",
        answer: "Consuma esta rota para obter informações sobre os recursos disponíveis.",
      },
    ],
  };

  return NextResponse.json(data);
}
