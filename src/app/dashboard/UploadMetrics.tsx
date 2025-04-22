"use client";

import React, { useState, FocusEvent, useCallback, useRef } from "react";
// Ícones: Adicionados Spinner, Check, Times para feedback
import { FaCloudUploadAlt, FaUpload, FaSpinner, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
// Framer Motion para animações de feedback
import { motion, AnimatePresence } from 'framer-motion';

/** Popup simples para “Exclusivo para Assinantes” */
function UpgradePopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full text-center">
        <h2 className="text-lg font-bold mb-3 text-brand-dark">Exclusivo para Assinantes</h2>
        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          Assine agora para desbloquear o envio de métricas e aproveitar todos os recursos!
        </p>
        {/* Ajuste de estilo do botão para combinar */}
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
 * - Recebe userId como prop.
 * - Bloqueia ações se o usuário não for assinante (popup).
 * - Inclui estado de carregamento e feedback visual.
 * - Limpa campos durante o upload e restaura após (exceto arquivos em caso de sucesso).
 */
export default function UploadMetrics({
  canAccessFeatures,
  userId,
}: UploadMetricsProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<MetricResult | null>(null);
  const [postLink, setPostLink] = useState("");
  const [description, setDescription] = useState("");
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  // Ref para o input de arquivo para poder limpá-lo programaticamente se necessário
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

  // Lida com a seleção de arquivos
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
    // Não limpamos event.target.value aqui, pois pode interferir
    // se o usuário cancelar a seleção após escolher arquivos.
  };


  // Função para lidar com o upload
  const handleUpload = useCallback(async () => {
    console.log("handleUpload disparado");

    if (handleBlockFeature()) return;

    if (files.length === 0) {
      setUploadStatus({ message: 'Selecione ao menos um print antes de enviar!', type: 'info' });
      setTimeout(() => setUploadStatus(prev => prev?.type === 'info' ? null : prev), 3000);
      return;
    }

    // --- Inicia o processo de upload ---
    setIsUploading(true);
    setUploadStatus(null);
    setResult(null);

    // --- Salva os valores atuais antes de limpar o estado ---
    const currentPostLink = postLink;
    const currentDescription = description;
    const currentFiles = files; // Guarda a referência aos arquivos que serão enviados

    // --- Limpa os campos VISUALMENTE (estado) logo ao iniciar ---
    setPostLink("");
    setDescription("");
    setFiles([]); // Limpa a lista visual de arquivos

    // Limpa o valor do input de arquivo programaticamente
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }


    let uploadSuccessful = false; // Flag para controlar restauração

    try {
      console.log("Iniciando conversão dos arquivos para base64.");
      // --- Usa os arquivos da variável 'currentFiles' para conversão ---
      const images = await Promise.all(
        currentFiles.map(async (file) => {
          console.log("Convertendo arquivo:", file.name);
          const base64File = await convertFileToBase64(file);
          console.log("Arquivo convertido com sucesso:", file.name);
          return { base64File, mimeType: file.type };
        })
      );

      // Monta o payload com os dados salvos
      const payload = {
        images: images,
        userId,
        postLink: currentPostLink, // Usa o valor salvo
        description: currentDescription, // Usa o valor salvo
      };
      console.log("Payload montado:", payload);

      // --- Chamada Real da API ---
      const res = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      // --- Fim Chamada API ---

      console.log("Resposta da API recebida, status:", res.status);

      if (!res.ok) {
        // Tratamento de erro da API (mantido)
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
        // Não define uploadSuccessful como true
        return; // Interrompe aqui em caso de erro da API
      }

      // Sucesso
      const data = await res.json();
      console.log("Métricas salvas com sucesso:", data.metric);
      setResult(data.metric);
      setUploadStatus({ message: 'Métricas enviadas com sucesso!', type: 'success' });
      uploadSuccessful = true; // Marca como sucesso

      // Limpa a mensagem de sucesso após alguns segundos
      setTimeout(() => setUploadStatus(prev => prev?.type === 'success' ? null : prev), 4000);

    } catch (error: unknown) {
      console.error("Erro inesperado no upload:", error);
      setUploadStatus({
        message: `Ocorreu um erro inesperado: ${error instanceof Error ? error.message : 'Tente novamente.'}`,
        type: 'error'
      });
      // Não define uploadSuccessful como true
    } finally {
      // --- Finaliza o processo de upload ---
      setIsUploading(false);

      // --- Restaura os campos de Link e Descrição ---
      // Restaura sempre, exceto se o upload foi bem sucedido (nesse caso já foram limpos)
      // A intenção original era restaurar após o fim do processamento.
      setPostLink(currentPostLink);
      setDescription(currentDescription);

      // Os arquivos (`files` state) permanecem limpos se o upload foi bem sucedido,
      // caso contrário, eles já foram limpos no início do `handleUpload`.
      // O input de arquivo (`fileInputRef`) também já foi limpo.
    }
  }, [postLink, description, files, userId, canAccessFeatures]); // Dependências

  // Define o ícone com base no tipo de status
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

      {/* Título e Descrição */}
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

      {/* Campos de Input */}
      <div className="space-y-4">
        <div>
          <label htmlFor="postLink" className="block text-xs font-medium text-gray-600 mb-1">
            Link do Conteúdo
          </label>
          <input
            id="postLink"
            type="url"
            value={postLink} // Controlado pelo estado
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
            value={description} // Controlado pelo estado
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
            ref={fileInputRef} // Adiciona a ref ao input
            id="metricFiles"
            type="file"
            multiple
            accept="image/png, image/jpeg, image/webp"
            onFocus={handleBlockFeature}
            onChange={handleFileChange}
            disabled={isUploading || !canAccessFeatures}
            className="block w-full text-sm text-gray-500 border border-gray-300 rounded-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-pink focus:border-brand-pink transition file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brand-light file:text-brand-dark hover:file:bg-gray-100 disabled:opacity-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
           {/* Mostra nomes dos arquivos selecionados (agora controlado pelo estado 'files') */}
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
          // Desabilita se não houver arquivos NO ESTADO INICIAL ou se estiver carregando/sem acesso
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

        {/* Mensagem de Status Animada */}
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

        {/* Mensagem de bloqueio se não for assinante */}
        {!canAccessFeatures && (
             <p className="text-xs text-center text-red-600 font-medium mt-2 px-4">
                Assine um plano para poder enviar suas métricas e liberar esta funcionalidade.
             </p>
        )}
      </div>


      {/* Exibição do resultado JSON (opcional) */}
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
      const base64 = dataUrl.split(',')[1];
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
