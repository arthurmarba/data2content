"use client";

import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { useParams } from "next/navigation";
import SearchBar from "../../components/SearchBar";
import VideoCarousel from "../../components/VideoCarousel";

export default function AnswerPage() {
  // useParams() pode retornar string, string[] ou undefined
  const params = useParams();
  const rawQuery = params.query; // "query" => string | string[] | undefined

  // Converte para string, garantindo que safeQuery seja sempre uma string
  const safeQuery = Array.isArray(rawQuery) ? rawQuery[0] ?? "" : rawQuery ?? "";

  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Requisição para a resposta da IA, enviando safeQuery como string
        const answerRes = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include", // Envia cookie de sessão
          body: JSON.stringify({ query: safeQuery }),
        });

        if (!answerRes.ok) {
          // Se não estiver ok, checamos status
          if (answerRes.status === 401) {
            setAnswer("Não autenticado. Faça login novamente.");
          } else if (answerRes.status === 403) {
            setAnswer("Acesso negado ou plano inativo.");
          } else {
            // Tenta ler a mensagem de erro do JSON, se existir
            const errData = await answerRes.json();
            setAnswer(errData.error || "Não foi possível obter resposta.");
          }
        } else {
          // Se estiver ok, parseia normalmente
          const answerData = await answerRes.json();
          setAnswer(answerData.answer || "Resposta vazia.");
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        setAnswer("Ocorreu um erro ao obter a resposta.");
      } finally {
        setLoading(false);
      }
    }

    // Chama a API mesmo que safeQuery esteja vazio (ajuste conforme sua necessidade)
    fetchData();
  }, [safeQuery]);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <Head>
        <title>Resposta - data2content</title>
        <meta
          name="description"
          content="Veja a resposta personalizada da D2C AI"
        />
      </Head>

      <main className="px-8 py-16 pt-24 space-y-8">
        {/* Cabeçalho e Área de Apresentação */}
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2 font-poppins">
            data2content
          </h1>
          <div className="mx-auto" style={{ maxWidth: "400px" }}>
            <p className="text-sm text-gray-500">
              Aqui está a resposta da D2C AI para sua pergunta.
            </p>
          </div>
        </div>

        {/* Campo de Busca */}
        <div className="w-full max-w-lg mx-auto">
          <SearchBar placeholder="Pergunte para d2c AI" />
        </div>

        {/* Contêiner de Resposta */}
        <div className="w-full max-w-lg mx-auto border border-gray-200 rounded p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Resposta</h2>
          {loading ? (
            <p className="text-gray-700">Carregando resposta...</p>
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {answer}
            </p>
          )}
          <div className="mt-4 text-right">
            <Link href="/" className="text-blue-500 hover:underline">
              Voltar à Home
            </Link>
          </div>
        </div>

        {/* Carrossel de Vídeos Relacionados */}
        {/* Passa safeQuery (garantido como string) para o prop "query" */}
        <VideoCarousel
          title="Vídeos Relacionados"
          query={safeQuery}
          maxResults={4}
        />
      </main>
    </div>
  );
}
