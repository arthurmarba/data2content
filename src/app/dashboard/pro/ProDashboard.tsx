"use client"; // Indica que este arquivo é um Client Component

import React, { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { DashboardProvider } from "../components/DashboardContext";
import MegaCard from "../components/MegaCard";
import ChatCard from "../components/ChatCard";
// Certifique-se de que o arquivo "types.ts" existe no caminho correto ou ajuste o import
import { ExtendedUser, MetricItem, MetricResult } from "../types";

/** ===================== */
/** Componente: UploadMetrics */
/** ===================== */
function UploadMetrics() {
  const { data: session } = useSession();

  // Estados para upload
  const [files, setFiles] = useState<File[]>([]);
  const [postLink, setPostLink] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<MetricResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Lida com a seleção de arquivos, limitando a 3
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    let selected = Array.from(e.target.files);
    if (selected.length > 3) {
      alert("Máximo de 3 imagens por envio.");
      selected = selected.slice(0, 3);
    }
    setFiles(selected);
  }

  // Converte um File em base64 (validando que o resultado não seja undefined)
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const parts = dataUrl.split(",");
        if (parts.length < 2 || !parts[1]) {
          reject(new Error("Formato inválido de data URL"));
        } else {
          resolve(parts[1]);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Envia arquivos + link/descrição para /api/metrics
  async function handleUpload() {
    // Faz o cast de session.user para ExtendedUser
    const user = session?.user as ExtendedUser | undefined;
    if (!user?.id) {
      alert("Usuário não identificado. Faça login primeiro.");
      return;
    }
    const userId = user.id;
    if (files.length === 0) {
      alert("Selecione ao menos 1 arquivo.");
      return;
    }
    setIsLoading(true);
    try {
      // Converte cada File em base64
      const images: { base64File: string; mimeType: string }[] = [];
      for (const file of files) {
        const base64File = await fileToBase64(file);
        images.push({ base64File, mimeType: file.type });
      }
      // Monta payload
      const payload = {
        userId,
        postLink,
        description,
        images,
      };
      // Faz requisição para criar métricas
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Erro ao enviar métricas:", data.error);
        setResult(null);
      } else {
        console.log("Métricas criadas:", data.metric);
        setResult(data.metric);
        // Limpa campos
        setFiles([]);
        setPostLink("");
        setDescription("");
      }
    } catch (error) {
      console.error("Erro no upload:", error);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white/90 border border-gray-200 rounded-2xl shadow-sm p-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        Enviar Print (Métricas)
      </h3>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Link do Conteúdo
        </label>
        <input
          type="text"
          value={postLink}
          onChange={(e) => setPostLink(e.target.value)}
          placeholder="https://instagram.com/p/abc"
          className="block w-full text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descrição
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Reels com dicas de marketing..."
          className="block w-full text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Selecione até 3 imagens:
        </label>
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          className="block w-full text-sm border border-gray-300 rounded-lg cursor-pointer focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={isLoading}
        className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition disabled:bg-gray-300"
      >
        {isLoading ? "Enviando..." : "Enviar"}
      </button>

      {result && (
        <pre className="mt-3 bg-gray-100 p-2 rounded text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** ===================== */
/** Componente: MetricsList */
/** ===================== */
function MetricsList() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const user = session?.user as ExtendedUser | undefined;
    if (!user?.id) return;
    const userId = user.id;
    async function fetchMetrics() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/metrics?userId=${userId}`);
        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        const data = await res.json();
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      } catch (err) {
        console.error("Erro ao buscar métricas:", err);
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchMetrics();
  }, [session?.user]);

  return (
    <div className="border p-4 rounded bg-white space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800">Métricas Salvas</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-blue-500 underline"
        >
          {isOpen ? "Ocultar" : "Ver"}
        </button>
      </div>

      {isLoading && <p className="text-xs text-gray-400">Carregando...</p>}
      {error && !isLoading && (
        <p className="text-xs text-red-500">
          Ocorreu um erro ao buscar métricas: {error}
        </p>
      )}
      {!isLoading && !error && !isOpen && metrics.length > 0 && (
        <p className="text-xs text-gray-500">
          Métricas ocultas. Clique em &quot;Ver&quot; para exibir.
        </p>
      )}

      {isOpen &&
        !isLoading &&
        !error &&
        metrics.map((m) => (
          <div key={m._id} className="text-xs text-gray-700 border-b pb-2 mb-2">
            <p>
              <strong>Link:</strong> {m.postLink}
            </p>
            <p>
              <strong>Descrição:</strong> {m.description}
            </p>

            {Array.isArray(m.rawData) && m.rawData.length > 0 && (
              <div className="ml-4 mt-2">
                <p className="text-gray-600">Imagens:</p>
                {m.rawData.map((rd: unknown, idx: number) => {
                  const rdObj = rd as Record<string, unknown>;
                  return (
                    <div key={idx} className="ml-2 border-l pl-2">
                      {rdObj["Curtidas"] != null && (
                        <p>
                          <strong>Curtidas:</strong>{" "}
                          {typeof rdObj["Curtidas"] === "object"
                            ? JSON.stringify(rdObj["Curtidas"])
                            : rdObj["Curtidas"].toString()}
                        </p>
                      )}
                      {rdObj["Comentários"] != null && (
                        <p>
                          <strong>Comentários:</strong>{" "}
                          {typeof rdObj["Comentários"] === "object"
                            ? JSON.stringify(rdObj["Comentários"])
                            : rdObj["Comentários"].toString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {m.stats && (
              <div className="mt-2 bg-gray-50 p-2 rounded">
                <p>
                  <strong>Stats Calculados:</strong>
                </p>
                {m.stats["taxaEngajamento"] !== undefined && (
                  <p>
                    Taxa Engajamento:{" "}
                    {typeof m.stats["taxaEngajamento"] === "object" ||
                    m.stats["taxaEngajamento"] === null
                      ? JSON.stringify(m.stats["taxaEngajamento"])
                      : m.stats["taxaEngajamento"].toString()}
                    %
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

      {isOpen && !isLoading && !error && metrics.length === 0 && (
        <p className="text-xs text-gray-500">Nenhuma métrica cadastrada.</p>
      )}
    </div>
  );
}

/** ===================== */
/** Componente ProDashboard principal */
/** ===================== */
export default function ProDashboard() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p className="text-center mt-10">Carregando sessão...</p>;
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="mb-4 text-gray-700">Você não está logado.</p>
        <button
          onClick={() => signIn()}
          className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition"
        >
          Fazer Login
        </button>
      </div>
    );
  }

  return (
    <DashboardProvider>
      <div className="flex flex-col min-h-screen bg-white text-gray-900">
        <div className="container mx-auto flex-1 p-8">
          <div className="flex gap-8">
            <div className="w-3/4 flex flex-col gap-4">
              <MegaCard />
              <MetricsList />
            </div>
            <div className="w-1/4 flex flex-col gap-4">
              <UploadMetrics />
              <ChatCard />
            </div>
          </div>
        </div>
        <footer className="p-4 text-center text-sm text-gray-500">
          © 2023 D2C Academy. Todos os direitos reservados.
        </footer>
      </div>
    </DashboardProvider>
  );
}
