"use client"; // Indica que este arquivo é um Client Component

import React, { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";

// Corrija os imports para subir um nível (../) e entrar em components/
import { DashboardProvider } from "../components/DashboardContext";
import MegaCard from "../components/MegaCard";
import ChatCard from "../components/ChatCard";

function UploadMetrics() {
  const { data: session } = useSession();
  const [files, setFiles] = useState<File[]>([]);
  const [postLink, setPostLink] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    let selected = Array.from(e.target.files);
    if (selected.length > 3) {
      alert("Máximo de 3 imagens por envio.");
      selected = selected.slice(0, 3);
    }
    setFiles(selected);
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload() {
    if (!session?.user?.id) {
      alert("Usuário não identificado. Faça login primeiro.");
      return;
    }
    if (files.length === 0) {
      alert("Selecione ao menos 1 arquivo.");
      return;
    }
    setIsLoading(true);

    try {
      const images: { base64File: string; mimeType: string }[] = [];
      for (const file of files) {
        const base64File = await fileToBase64(file);
        images.push({ base64File, mimeType: file.type });
      }

      const payload = {
        userId: session.user.id,
        postLink,
        description,
        images,
      };

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
        setFiles([]);
        setPostLink("");
        setDescription("");
      }
    } catch (err) {
      console.error("Erro no upload:", err);
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
          className="block w-full text-sm border border-gray-300 rounded-lg px-2 py-1
                     focus:ring-1 focus:ring-blue-500"
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
          className="block w-full text-sm border border-gray-300 rounded-lg px-2 py-1
                     focus:ring-1 focus:ring-blue-500"
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
          className="block w-full text-sm border border-gray-300 rounded-lg
                     cursor-pointer focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={isLoading}
        className="px-3 py-1 bg-blue-500 text-white rounded text-sm
                   hover:bg-blue-600 transition disabled:bg-gray-300"
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

function MetricsList() {
  const { data: session } = useSession();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    setIsLoading(true);

    fetch(`/api/metrics?userId=${session.user.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.metrics) setMetrics(data.metrics);
      })
      .catch((err) => console.error("Erro ao buscar métricas:", err))
      .finally(() => setIsLoading(false));
  }, [session?.user?.id]);

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

      {!isLoading && !isOpen && metrics.length > 0 && (
        <p className="text-xs text-gray-500">
          Métricas ocultas. Clique em "Ver" para exibir.
        </p>
      )}

      {isOpen && !isLoading && metrics.map((m) => (
        <div key={m._id} className="text-xs text-gray-700 border-b pb-2 mb-2">
          <p><strong>Link:</strong> {m.postLink}</p>
          <p><strong>Descrição:</strong> {m.description}</p>

          {Array.isArray(m.rawData) && m.rawData.length > 0 && (
            <div className="ml-4 mt-2">
              <p className="text-gray-600">Imagens:</p>
              {m.rawData.map((rd: any, idx: number) => (
                <div key={idx} className="ml-2 border-l pl-2">
                  {rd.Curtidas !== undefined && (
                    <p><strong>Curtidas:</strong> {rd.Curtidas}</p>
                  )}
                  {rd["Comentários"] !== undefined && (
                    <p><strong>Comentários:</strong> {rd["Comentários"]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {m.stats && (
            <div className="mt-2 bg-gray-50 p-2 rounded">
              <p><strong>Stats Calculados:</strong></p>
              {m.stats.taxaEngajamento !== undefined && (
                <p>Taxa Engajamento: {m.stats.taxaEngajamento}%</p>
              )}
            </div>
          )}
        </div>
      ))}

      {isOpen && !isLoading && metrics.length === 0 && (
        <p className="text-xs text-gray-500">Nenhuma métrica cadastrada.</p>
      )}
    </div>
  );
}

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
