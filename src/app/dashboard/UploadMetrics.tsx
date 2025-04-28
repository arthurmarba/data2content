// src/app/dashboard/UploadMetrics.tsx
"use client";

import React, { useState, FocusEvent, useCallback, useRef } from "react";
// Ícones: Adicionados Spinner, Check, Times, QuestionCircle
import { FaCloudUploadAlt, FaUpload, FaSpinner, FaCheckCircle, FaTimesCircle, FaQuestionCircle } from "react-icons/fa";
// Framer Motion para animações de feedback
import { motion, AnimatePresence } from 'framer-motion';

// --- Popup Upgrade (mantido como estava) ---
function UpgradePopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center">
        <h2 className="text-lg font-bold mb-3 text-brand-dark">Exclusivo para Assinantes</h2>
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          Assine agora para desbloquear o envio de métricas e aproveitar todos os recursos!
        </p>
        <button
          onClick={onClose}
          className="px-5 py-2 bg-brand-pink text-white rounded-full text-sm font-semibold hover:opacity-90 transition-default shadow-sm"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// --- Interface MetricResult (mantida) ---
interface MetricResult {
  _id?: string;
  user?: string;
  postLink?: string;
  description?: string;
  rawData?: unknown[];
  stats?: unknown;
  createdAt?: string;
}

// --- Props para o componente UploadMetrics ---
interface UploadMetricsProps {
  canAccessFeatures: boolean;
  userId: string;
  onNeedHelp: () => void; // <<< NOVO: Função para chamar quando o usuário precisar de ajuda
}

/**
 * Componente de Envio de Métricas (Upload)
 * - Recebe userId e onNeedHelp como props.
 * - Bloqueia ações se o usuário não for assinante (popup).
 * - Inclui estado de carregamento e feedback visual.
 * - Limpa campos durante o upload e restaura após.
 * - Adiciona link para tutorial em vídeo.
 */
export default function UploadMetrics({
  canAccessFeatures,
  userId,
  onNeedHelp, // <<< Recebe a função como prop
}: UploadMetricsProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<MetricResult | null>(null);
  const [postLink, setPostLink] = useState("");
  const [description, setDescription] = useState("");
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Se não for assinante, exibe popup ao focar/clicar
  function handleBlockFeature(e?: FocusEvent<HTMLElement>) {
    if (!canAccessFeatures) {
      if (e) e.currentTarget.blur();
      setShowUpgradePopup(true);
      return true;
    }
    return false;
  }

  // Lida com a seleção de arquivos (mantido)
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files).slice(0, 4);
      setFiles(selectedFiles);
      setUploadStatus(null);
      setResult(null);
      console.log("Arquivos selecionados (máx 4):", selectedFiles);
    } else {
      setFiles([]);
    }
  };


  // Função para lidar com o upload (lógica principal mantida)
  const handleUpload = useCallback(async () => {
    console.log("handleUpload disparado");
    if (handleBlockFeature()) return;
    if (files.length === 0) {
      setUploadStatus({ message: 'Selecione ao menos um print antes de enviar!', type: 'info' });
      setTimeout(() => setUploadStatus(prev => prev?.type === 'info' ? null : prev), 3000);
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    setResult(null);
    const currentPostLink = postLink;
    const currentDescription = description;
    const currentFiles = files;
    setPostLink("");
    setDescription("");
    setFiles([]);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }

    let uploadSuccessful = false;

    try {
      console.log("Iniciando conversão dos arquivos para base64.");
      const images = await Promise.all(
        currentFiles.map(async (file) => {
          const base64File = await convertFileToBase64(file);
          return { base64File, mimeType: file.type };
        })
      );

      const payload = { images, userId, postLink: currentPostLink, description: currentDescription };
      console.log("Payload montado:", payload);

      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      console.log("Resposta da API recebida, status:", res.status);

      if (!res.ok) {
        let errorMessage = "Falha ao enviar métricas. Tente novamente.";
        try {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
            console.error("Erro retornado pela API:", data);
        } catch (jsonError) {
            console.error("Não foi possível parsear JSON da resposta de erro:", jsonError);
        }
        if (res.status === 401) errorMessage = "Não autenticado. Faça login novamente.";
        else if (res.status === 403) errorMessage = "Seu plano não permite esta ação ou não está ativo.";
        setUploadStatus({ message: errorMessage, type: 'error' });
        return;
      }

      const data = await res.json();
      console.log("Métricas salvas com sucesso:", data.metric);
      setResult(data.metric);
      setUploadStatus({ message: 'Métricas enviadas com sucesso!', type: 'success' });
      uploadSuccessful = true;
      setTimeout(() => setUploadStatus(prev => prev?.type === 'success' ? null : prev), 4000);

    } catch (error: unknown) {
      console.error("Erro inesperado no upload:", error);
      setUploadStatus({
        message: `Ocorreu um erro inesperado: ${error instanceof Error ? error.message : 'Tente novamente.'}`,
        type: 'error'
      });
    } finally {
      setIsUploading(false);
      // Restaura os campos se o upload falhou (se teve sucesso, já foram limpos intencionalmente)
      if (!uploadSuccessful) {
          setPostLink(currentPostLink);
          setDescription(currentDescription);
          // Os arquivos já foram limpos visualmente do estado `files`
          // O input `fileInputRef` já foi limpo
          // Considerar se deve restaurar a lista de arquivos `files` em caso de erro?
          // Por ora, mantém limpo para evitar reenvio acidental do mesmo lote.
      }
    }
  }, [postLink, description, files, userId, canAccessFeatures]); // Dependências

  // Define o ícone com base no tipo de status (mantido)
  const getStatusIcon = () => {
    if (!uploadStatus) return null;
    switch (uploadStatus.type) {
      case 'success': return <FaCheckCircle className="text-green-500 w-4 h-4" />;
      case 'error': return <FaTimesCircle className="text-red-500 w-4 h-4" />;
      default: return null;
    }
  };


  return (
    <div className="space-y-5 relative">
      {showUpgradePopup && (
        <UpgradePopup onClose={() => setShowUpgradePopup(false)} />
      )}

      {/* Título e Descrição (mantidos) */}
      <div className="flex items-center gap-3">
        <FaCloudUploadAlt className="text-brand-pink w-6 h-6 flex-shrink-0" />
        <div>
            <h3 className="text-base font-semibold text-brand-dark">
            Enviar Print das Métricas
            </h3>
            <p className="text-xs text-gray-500 font-light">
                Carregue até 4 prints, informe o link e descrição.
            </p>
        </div>
      </div>

      {/* Campos de Input (mantidos) */}
      <div className="space-y-4">
        <div>
          <label htmlFor="postLink" className="block text-xs font-medium text-gray-600 mb-1">
            Link do Conteúdo
          </label>
          <input
            id="postLink"
            type="url"
            value={postLink}
            onFocus={handleBlockFeature}
            onChange={(e) => setPostLink(e.target.value)}
            disabled={isUploading || !canAccessFeatures}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="https://instagram.com/p/..."
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-xs font-medium text-gray-600 mb-1">
            Descrição do Conteúdo
          </label>
          <textarea
            id="description"
            value={description}
            onFocus={handleBlockFeature}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={isUploading || !canAccessFeatures}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="Ex: Vídeo sobre..."
          />
        </div>

        <div>
          <label htmlFor="metricFiles" className="block text-xs font-medium text-gray-600 mb-1">
            Prints das Métricas (até 4)
          </label>
          <input
            ref={fileInputRef}
            id="metricFiles"
            type="file"
            multiple
            accept="image/png, image/jpeg, image/webp"
            onFocus={handleBlockFeature}
            onChange={handleFileChange}
            disabled={isUploading || !canAccessFeatures}
            className="block w-full text-sm text-gray-500 border border-gray-300 rounded-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-light file:text-brand-dark hover:file:bg-gray-100 disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
           {files.length > 0 && (
             <div className="mt-2 space-y-1">
               {files.map(file => (
                 <p key={file.name} className="text-xs text-gray-500 truncate"> - {file.name}</p>
               ))}
             </div>
           )}
        </div>
      </div>

      {/* Botão de Envio e Feedback */}
      <div className="flex flex-col items-center gap-3 mt-5">
        <button
          onClick={handleUpload}
          disabled={(files.length === 0 && !isUploading) || isUploading || !canAccessFeatures}
          className="w-full sm:w-auto px-8 py-2.5 bg-brand-pink text-white rounded-full text-sm font-semibold hover:opacity-90 transition-default disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <FaSpinner className="animate-spin w-4 h-4" />
              <span>Processando...</span>
            </>
          ) : (
            <>
              <FaUpload className="w-4 h-4" />
              <span>Enviar Métricas</span>
            </>
          )}
        </button>

        {/* Mensagem de Status Animada (mantida) */}
        <AnimatePresence>
            {uploadStatus && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-center gap-2 text-xs font-medium h-4 ${
                        uploadStatus.type === 'success' ? 'text-green-600' :
                        uploadStatus.type === 'error' ? 'text-red-600' :
                        'text-gray-600'
                    }`}
                >
                    {getStatusIcon()}
                    <span>{uploadStatus.message}</span>
                </motion.div>
            )}
            {!uploadStatus && <div className="h-4"></div>}
        </AnimatePresence>

        {/* <<< NOVO: Link/Botão para Ajuda >>> */}
        <button
            onClick={onNeedHelp} // Chama a função recebida por prop
            className="text-xs text-gray-500 hover:text-brand-pink hover:underline mt-2 flex items-center gap-1"
        >
            <FaQuestionCircle className="w-3 h-3" />
            Precisa de ajuda para enviar? Veja o tutorial
        </button>

        {/* Mensagem de bloqueio se não for assinante (mantida) */}
        {!canAccessFeatures && (
             <p className="text-xs text-center text-red-600 font-medium mt-2 px-4">
                Assine um plano para poder enviar suas métricas e liberar esta funcionalidade.
             </p>
        )}
      </div>


      {/* Exibição do resultado JSON (mantido) */}
      {result && (
        <details className="mt-6">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-brand-dark">Ver dados retornados (debug)</summary>
            <pre className="mt-2 bg-gray-50 p-3 rounded text-xs overflow-auto max-h-48 border border-gray-200">
            {JSON.stringify(result, null, 2)}
            </pre>
        </details>
      )}
    </div>
  );
}

// --- Função convertFileToBase64 (mantida) ---
async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string | undefined;
      if (!dataUrl) {
        reject("Erro: resultado do FileReader é indefinido."); return;
      }
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject("Erro: não foi possível extrair a parte base64."); return;
      }
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
