"use client";

import React, { useState, FocusEvent } from "react";
import { FaCloudUploadAlt } from "react-icons/fa";

/** Popup simples para “Exclusivo para Assinantes” */
function UpgradePopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full text-center">
        <h2 className="text-lg font-bold mb-3">Exclusivo para Assinantes</h2>
        <p className="text-sm text-gray-600 mb-4">
          Assine agora para desbloquear o envio de métricas e aproveitar todos os recursos!
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

/** Estrutura mínima para o objeto retornado pela API ao criar métricas */
interface MetricResult {
  _id?: string;
  user?: string;
  postLink?: string;
  description?: string;
  rawData?: unknown[];
  stats?: unknown;
  createdAt?: string;
}

/** Props para o componente UploadMetrics */
interface UploadMetricsProps {
  canAccessFeatures: boolean;
  userId: string; // Recebe o ID real do usuário logado
}

/**
 * Componente de Envio de Métricas (Upload)
 * - Recebe userId como prop (em vez de usar placeholder).
 * - Bloqueia ações se o usuário não for assinante (popup).
 */
export default function UploadMetrics({
  canAccessFeatures,
  userId,
}: UploadMetricsProps) {
  // Agora armazenamos um array de arquivos, permitindo múltiplos uploads
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<MetricResult | null>(null);
  const [postLink, setPostLink] = useState("");
  const [description, setDescription] = useState("");
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Se não for assinante, exibe popup ao focar/clicar
  function handleBlockFeature(e?: FocusEvent<HTMLElement>) {
    if (!canAccessFeatures) {
      if (e) e.currentTarget.blur();
      setShowUpgradePopup(true);
      return true;
    }
    return false;
  }

  async function handleUpload() {
    console.log("handleUpload disparado", { files, postLink, description });

    // Verifica se é assinante (bloqueio de feature)
    if (!canAccessFeatures) {
      console.warn("Usuário não tem acesso às features. Exibindo popup.");
      setShowUpgradePopup(true);
      return;
    }

    if (files.length === 0) {
      alert("Selecione ao menos um arquivo antes de enviar!");
      return;
    }

    setErrorMessage(""); // Reseta mensagens de erro anteriores

    try {
      console.log("Iniciando conversão dos arquivos para base64.");
      // Converte cada arquivo em base64 usando Promise.all
      const images = await Promise.all(
        files.map(async (file) => {
          console.log("Convertendo arquivo:", file.name);
          const base64File = await convertFileToBase64(file);
          console.log("Arquivo convertido com sucesso:", file.name);
          return {
            base64File,
            mimeType: file.type,
          };
        })
      );

      // Limita o envio a no máximo 4 imagens
      const imagesToSend = images.slice(0, 4);
      console.log("Imagens a enviar (máximo 4):", imagesToSend);

      // Monta o payload com userId correto
      const payload = {
        images: imagesToSend,
        userId, // Agora usamos o ID do usuário logado
        postLink,
        description,
      };
      console.log("Payload montado:", payload);

      // Envia para /api/metrics
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Envia o cookie de sessão
        body: JSON.stringify(payload),
      });

      console.log("Resposta da API:", res);

      if (!res.ok) {
        console.error("Erro na resposta da API, status:", res.status);
        if (res.status === 401) {
          setErrorMessage("Não autenticado. Faça login novamente.");
        } else if (res.status === 403) {
          setErrorMessage("Seu plano não está ativo ou você não tem acesso.");
        } else {
          const data = await res.json();
          console.error("Erro retornado pela API:", data);
          setErrorMessage(data.error || "Falha ao enviar métricas.");
        }
        setResult(null);
        return;
      }

      const data = await res.json();
      console.log("Métricas salvas com sucesso:", data.metric);
      setResult(data.metric);
    } catch (error: unknown) {
      console.error("Erro no upload:", error);
      setErrorMessage("Ocorreu um erro ao enviar as métricas.");
      setResult(null);
    }
  }

  return (
    <div className="border rounded-lg shadow p-4 sm:p-6 bg-white/90 relative">
      {showUpgradePopup && (
        <UpgradePopup onClose={() => setShowUpgradePopup(false)} />
      )}

      <div className="flex items-center gap-2 mb-2">
        <FaCloudUploadAlt className="text-blue-500 w-5 h-5" />
        <h3 className="text-lg sm:text-xl font-bold text-gray-800">
          Enviar Print das Métricas
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-gray-600 mb-4">
        Carregue até 4 prints das métricas, e informe o link e descrição do conteúdo.
      </p>

      <div className="aspect-w-16 aspect-h-9 mb-4 rounded-md border border-gray-200 overflow-hidden">
        <iframe
          className="w-full h-full"
          src="https://www.youtube.com/embed/We4-PuDJ4wc"
          title="Tutorial de Envio"
          allowFullScreen
        />
      </div>

      {errorMessage && (
        <div className="mb-3 bg-red-50 p-2 rounded text-red-600 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Link do Conteúdo
        </label>
        <input
          type="text"
          value={postLink}
          onFocus={handleBlockFeature}
          onChange={(e) => {
            console.log("Atualizando postLink:", e.target.value);
            setPostLink(e.target.value);
          }}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 transition"
          placeholder="https://instagram.com/p/abc..."
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descrição do Conteúdo
        </label>
        <textarea
          value={description}
          onFocus={handleBlockFeature}
          onChange={(e) => {
            console.log("Atualizando description:", e.target.value);
            setDescription(e.target.value);
          }}
          rows={2}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 transition"
          placeholder="Breve descrição do conteúdo..."
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Prints das Métricas (até 4)
        </label>
        <input
          type="file"
          multiple
          onFocus={handleBlockFeature}
          onChange={(e) => {
            if (e.target.files) {
              console.log("Arquivos selecionados:", e.target.files);
              setFiles(Array.from(e.target.files));
            }
          }}
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 transition file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <button
        onClick={handleUpload}
        onFocus={handleBlockFeature}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition"
      >
        Enviar
      </button>

      {result && (
        <pre className="mt-4 bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Converte um arquivo em base64 (string).
 */
async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string | undefined;
      if (!dataUrl) {
        console.error("Erro: resultado do FileReader é indefinido para", file.name);
        reject("Erro: resultado do FileReader é indefinido.");
        return;
      }
      const parts = dataUrl.split(",");
      const base64 = parts[1];
      if (!base64) {
        console.error("Erro: não foi possível extrair a parte base64 para", file.name);
        reject("Erro: não foi possível extrair a parte base64.");
        return;
      }
      resolve(base64);
    };
    reader.onerror = (err) => {
      console.error("Erro no FileReader para", file.name, err);
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}
