"use client";

import React, { useState, FocusEvent, useCallback, useRef, ChangeEvent, MouseEvent } from "react";
// Ícones: Adicionado FaInfoCircle ao import
import { FaCloudUploadAlt, FaUpload, FaSpinner, FaCheckCircle, FaTimesCircle, FaQuestionCircle, FaInfoCircle } from "react-icons/fa";
// Framer Motion
import { motion, AnimatePresence } from 'framer-motion';

interface MetricResult {
  _id?: string;
  user?: string;
  postLink?: string;
  description?: string;
  rawData?: unknown[];
  stats?: unknown;
  createdAt?: string;
}

interface UploadMetricsProps {
  canAccessFeatures: boolean;
  userId: string;
  onNeedHelp: () => void;
  onActionRedirect: () => void;
  showToast: (message: string, type?: 'info' | 'warning' | 'success' | 'error') => void;
}

export default function UploadMetrics({
  canAccessFeatures,
  userId,
  onNeedHelp,
  onActionRedirect,
  showToast,
}: UploadMetricsProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<MetricResult | null>(null);
  const [postLink, setPostLink] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBlockedInteraction = (event?: React.SyntheticEvent): boolean => {
    if (!canAccessFeatures) {
      if (event) {
        event.preventDefault();
        if (event.currentTarget && typeof (event.currentTarget as HTMLElement).blur === 'function') {
          (event.currentTarget as HTMLElement).blur();
        }
      }
      showToast("Para enviar e analisar suas métricas, um plano premium é necessário.", 'info');
      onActionRedirect();
      return true;
    }
    return false;
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => 
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(event.target.value);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!canAccessFeatures) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFiles([]);
        if (event) event.preventDefault();
        // O toast e redirect já devem ter ocorrido no onClick do input file.
        // Se não ocorreu, handleBlockedInteraction faria isso, mas é melhor evitar chamadas duplas.
        // Apenas garantimos que nenhum arquivo seja processado.
        return;
    }

    if (event.target.files) {
      const selectedFiles = Array.from(event.target.files).slice(0, 4);
      setFiles(selectedFiles);
      setUploadStatus(null);
      setResult(null);
    } else {
      setFiles([]);
    }
  };

  const handleUpload = useCallback(async () => {
    if (!canAccessFeatures) {
        showToast("Para enviar métricas, por favor, assine um plano.", 'info');
        onActionRedirect();
        return;
    }

    if (files.length === 0) {
      setUploadStatus({ message: 'Selecione ao menos um print antes de enviar!', type: 'info' });
      setTimeout(() => setUploadStatus(prev => (prev?.type === 'info' && prev.message === 'Selecione ao menos um print antes de enviar!') ? null : prev), 3000);
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
      const images = await Promise.all(
        currentFiles.map(file => convertFileToBase64(file).then(base64File => ({ base64File, mimeType: file.type })))
      );
      const payload = { images, userId, postLink: currentPostLink, description: currentDescription };
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errorMessage = "Falha ao enviar métricas. Tente novamente.";
        try {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
        } catch (jsonError) { /* Mantém a mensagem padrão */ }
        if (res.status === 401) errorMessage = "Não autenticado. Faça login novamente.";
        else if (res.status === 403) errorMessage = "Seu plano não permite esta ação ou não está ativo.";
        setUploadStatus({ message: errorMessage, type: 'error' });
      } else {
        const data = await res.json();
        setResult(data.metric);
        setUploadStatus({ message: 'Métricas enviadas com sucesso!', type: 'success' });
        uploadSuccessful = true;
        setTimeout(() => setUploadStatus(prev => (prev?.type === 'success' && prev.message === 'Métricas enviadas com sucesso!') ? null : prev), 4000);
      }
    } catch (error: unknown) {
      setUploadStatus({
        message: `Ocorreu um erro inesperado: ${error instanceof Error ? error.message : 'Tente novamente.'}`,
        type: 'error'
      });
    } finally {
      setIsUploading(false);
      if (!uploadSuccessful && canAccessFeatures) {
          setPostLink(currentPostLink);
          setDescription(currentDescription);
      }
    }
  }, [postLink, description, files, userId, canAccessFeatures, onActionRedirect, showToast]);

  const getStatusIcon = () => {
    if (!uploadStatus) return null;
    switch (uploadStatus.type) {
      case 'success': return <FaCheckCircle className="text-green-500 w-4 h-4" />;
      case 'error': return <FaTimesCircle className="text-red-500 w-4 h-4" />;
      case 'info': return <FaInfoCircle className="text-blue-500 w-4 h-4" />; // Agora FaInfoCircle está importado
      default: return null;
    }
  };

  return (
    <div className="space-y-5 relative">
      <div className="flex items-center gap-3">
        <FaCloudUploadAlt className="text-brand-pink w-6 h-6 flex-shrink-0" />
        <div>
            <h3 className="text-base font-semibold text-brand-dark">
            Enviar Print das Métricas
            </h3>
            {/* --- TEXTO ATUALIZADO --- */}
            <p className="text-xs text-gray-500 font-light">
                Ficou faltando algum post antigo? Cadastre as métricas dele por aqui.
            </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="postLinkUpload" className="block text-xs font-medium text-gray-600 mb-1">
            Link do Conteúdo
          </label>
          <input
            id="postLinkUpload"
            type="url"
            value={postLink}
            onClick={handleBlockedInteraction}
            onFocus={handleBlockedInteraction}
            onChange={handleInputChange(setPostLink)}
            disabled={canAccessFeatures && isUploading}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition placeholder-gray-400"
            placeholder="https://instagram.com/p/..."
          />
        </div>

        <div>
          <label htmlFor="descriptionUpload" className="block text-xs font-medium text-gray-600 mb-1">
            Descrição do Conteúdo
          </label>
          <textarea
            id="descriptionUpload"
            value={description}
            onClick={handleBlockedInteraction}
            onFocus={handleBlockedInteraction}
            onChange={handleInputChange(setDescription)}
            rows={2}
            disabled={canAccessFeatures && isUploading}
            className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm shadow-sm focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition placeholder-gray-400"
            placeholder="Ex: Vídeo sobre..."
          />
        </div>

        <div>
          <label htmlFor="metricFilesUpload" className="block text-xs font-medium text-gray-600 mb-1">
            Prints das Métricas (até 4)
          </label>
          <input
            ref={fileInputRef}
            id="metricFilesUpload"
            type="file"
            multiple
            accept="image/png, image/jpeg, image/webp"
            onClick={(e: MouseEvent<HTMLInputElement>) => {
                if (handleBlockedInteraction(e)) {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            }}
            onChange={handleFileChange}
            disabled={canAccessFeatures && isUploading}
            className="block w-full text-sm text-gray-500 border border-gray-300 rounded-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-light file:text-brand-dark hover:file:bg-gray-100"
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

      <div className="flex flex-col items-center gap-3 mt-5">
        <button
          onClick={(e) => { 
            if (handleBlockedInteraction(e)) return;
            handleUpload(); 
          }}
          disabled={canAccessFeatures && ((files.length === 0 && !isUploading) || isUploading)}
          className="w-full sm:w-auto px-8 py-2.5 bg-brand-pink text-white rounded-full text-sm font-semibold hover:opacity-90 transition-default shadow-md flex items-center justify-center gap-2"
        >
          {(canAccessFeatures && isUploading) ? (
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

        <AnimatePresence>
            {uploadStatus && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-center gap-2 text-xs font-medium h-6 py-1 ${
                        uploadStatus.type === 'success' ? 'text-green-600' :
                        uploadStatus.type === 'error' ? 'text-red-600' :
                        'text-blue-600'
                    }`}
                >
                    {getStatusIcon()}
                    <span>{uploadStatus.message}</span>
                </motion.div>
            )}
            {!uploadStatus && <div className="h-6 py-1"></div>}
        </AnimatePresence>

        <button
            onClick={onNeedHelp}
            className="text-xs text-gray-500 hover:text-brand-pink hover:underline mt-2 flex items-center gap-1"
        >
            <FaQuestionCircle className="w-3 h-3" />
            Precisa de ajuda para enviar? Veja o tutorial
        </button>
      </div>

      {canAccessFeatures && result && (
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
