// src/app/components/AdDealForm.tsx
"use client";

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { FaPaperPlane, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// Interface simplificada para o estado do formulário (evita importar IAdDeal completa)
interface AdDealFormData {
  brandName: string;
  brandSegment: string;
  dealDate: string; // Usar string para input date
  campaignStartDate: string;
  campaignEndDate: string;
  deliverables: string; // Usar string para textarea, separar no backend/submit
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'Blog' | 'Outro' | 'Múltiplas';
  compensationType: 'Valor Fixo' | 'Comissão' | 'Permuta' | 'Misto' | ''; // Adiciona '' para estado inicial
  compensationValue: string; // Usar string para input number
  compensationCurrency: string;
  productValue: string; // Usar string para input number
  notes: string;
  relatedPostId: string; // Opcional
}

// Interface para props (se precisar passar algo, ex: userId)
interface AdDealFormProps {
    userId: string; // Passar o ID do usuário logado
    onDealAdded?: () => void; // Callback opcional após sucesso
}

const AdDealForm: React.FC<AdDealFormProps> = ({ userId, onDealAdded }) => {
  const initialState: AdDealFormData = {
    brandName: '',
    brandSegment: '',
    // --- CORREÇÃO AQUI ---
    dealDate: new Date().toISOString().split('T')[0] ?? '', // Garante que é string
    // --- FIM DA CORREÇÃO ---
    campaignStartDate: '',
    campaignEndDate: '',
    deliverables: '', // Inicialmente vazio
    platform: 'Instagram',
    compensationType: '', // Vazio inicialmente para forçar seleção
    compensationValue: '',
    compensationCurrency: 'BRL',
    productValue: '',
    notes: '',
    relatedPostId: '',
  };

  const [formData, setFormData] = useState<AdDealFormData>(initialState);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitStatus(null);

    // Validação básica extra (além do required do HTML)
    if (!formData.compensationType) {
        setSubmitStatus({ type: 'error', message: 'Por favor, selecione o Tipo de Compensação.' });
        setIsLoading(false);
        return;
    }
    if (!formData.deliverables.trim()) {
        setSubmitStatus({ type: 'error', message: 'Por favor, liste pelo menos uma entrega.' });
        setIsLoading(false);
        return;
    }

    // Prepara os dados para enviar (converte números, trata deliverables)
    const dataToSend = {
        ...formData,
        // Converte valores numéricos de string para number, ou null se vazio/inválido
        compensationValue: formData.compensationValue ? parseFloat(formData.compensationValue) : undefined,
        productValue: formData.productValue ? parseFloat(formData.productValue) : undefined,
        // Separa deliverables por linha e remove linhas vazias
        deliverables: formData.deliverables.split('\n').map(d => d.trim()).filter(d => d.length > 0),
        // Converte datas para objetos Date (API espera Date) - Mongoose também aceita string ISO
        // dealDate: new Date(formData.dealDate + 'T00:00:00'), // Adiciona hora para evitar problemas de fuso
        // campaignStartDate: formData.campaignStartDate ? new Date(formData.campaignStartDate + 'T00:00:00') : undefined,
        // campaignEndDate: formData.campaignEndDate ? new Date(formData.campaignEndDate + 'T00:00:00') : undefined,
        // Nota: Enviar como string ISO 8601 (YYYY-MM-DD) também funciona com Mongoose
        dealDate: formData.dealDate,
        campaignStartDate: formData.campaignStartDate || undefined,
        campaignEndDate: formData.campaignEndDate || undefined,
        relatedPostId: formData.relatedPostId || undefined,
    };

    try {
      const response = await fetch('/api/ads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();

      if (!response.ok) {
        // Tenta extrair detalhes do erro, senão usa mensagem genérica
        const errorMsg = result.details ? result.details.join(', ') : (result.error || `Erro ${response.status}`);
        throw new Error(errorMsg);
      }

      // Sucesso
      setSubmitStatus({ type: 'success', message: 'Parceria registada com sucesso!' });
      setFormData(initialState); // Limpa o formulário
      if (onDealAdded) {
        onDealAdded(); // Chama o callback se fornecido
      }
      // Limpa a mensagem de sucesso após alguns segundos
      setTimeout(() => setSubmitStatus(null), 4000);

    } catch (error) {
      console.error("Erro ao registar parceria:", error);
      setSubmitStatus({ type: 'error', message: `Erro ao registar: ${error instanceof Error ? error.message : String(error)}` });
       // Não limpar a mensagem de erro automaticamente
    } finally {
      setIsLoading(false);
    }
  };

  // Estilização base Tailwind (ajuste conforme seu design system)
  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-brand-pink focus:ring-1 focus:ring-brand-pink disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 disabled:shadow-none";
  const labelClasses = "block text-sm font-medium text-gray-700";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Linha 1: Nome da Marca e Segmento */}
      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <div>
          <label htmlFor="brandName" className={labelClasses}>
            Nome da Marca <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="brandName"
            id="brandName"
            value={formData.brandName}
            onChange={handleChange}
            className={inputClasses}
            required
            placeholder="Ex: Marca Incrível"
          />
        </div>
        <div>
          <label htmlFor="brandSegment" className={labelClasses}>
            Segmento da Marca (Opcional)
          </label>
          <input
            type="text"
            name="brandSegment"
            id="brandSegment"
            value={formData.brandSegment}
            onChange={handleChange}
            className={inputClasses}
            placeholder="Ex: Moda, Beleza, Tecnologia"
          />
        </div>
      </div>

      {/* Linha 2: Datas */}
      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
        <div>
           <label htmlFor="dealDate" className={labelClasses}>
             Data do Acordo <span className="text-red-500">*</span>
           </label>
           <input
             type="date"
             name="dealDate"
             id="dealDate"
             value={formData.dealDate}
             onChange={handleChange}
             className={inputClasses}
             required
           />
         </div>
         <div>
           <label htmlFor="campaignStartDate" className={labelClasses}>
             Início da Campanha (Opcional)
           </label>
           <input
             type="date"
             name="campaignStartDate"
             id="campaignStartDate"
             value={formData.campaignStartDate}
             onChange={handleChange}
             className={inputClasses}
           />
         </div>
         <div>
           <label htmlFor="campaignEndDate" className={labelClasses}>
             Fim da Campanha (Opcional)
           </label>
           <input
             type="date"
             name="campaignEndDate"
             id="campaignEndDate"
             value={formData.campaignEndDate}
             onChange={handleChange}
             className={inputClasses}
           />
         </div>
      </div>

       {/* Linha 3: Entregas e Plataforma */}
       <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
                <label htmlFor="deliverables" className={labelClasses}>
                    Entregas (uma por linha) <span className="text-red-500">*</span>
                </label>
                <textarea
                    id="deliverables"
                    name="deliverables"
                    rows={3}
                    value={formData.deliverables}
                    onChange={handleChange}
                    className={inputClasses}
                    required
                    placeholder="Ex:&#10;1 Reel 60s&#10;3 Stories (sequência)&#10;1 Post Carrossel (5 fotos)"
                />
                 <p className="mt-1 text-xs text-gray-500">Liste cada entrega numa linha separada.</p>
            </div>
            <div>
                <label htmlFor="platform" className={labelClasses}>
                    Plataforma Principal
                </label>
                <select
                    id="platform"
                    name="platform"
                    value={formData.platform}
                    onChange={handleChange}
                    className={inputClasses}
                >
                    <option>Instagram</option>
                    <option>TikTok</option>
                    <option>YouTube</option>
                    <option>Blog</option>
                    <option>Múltiplas</option>
                    <option>Outro</option>
                </select>
            </div>
       </div>

        {/* Linha 4: Compensação */}
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
                <label htmlFor="compensationType" className={labelClasses}>
                    Tipo de Compensação <span className="text-red-500">*</span>
                </label>
                <select
                    id="compensationType"
                    name="compensationType"
                    value={formData.compensationType}
                    onChange={handleChange}
                    className={inputClasses}
                    required
                >
                    <option value="" disabled>Selecione...</option>
                    <option>Valor Fixo</option>
                    <option>Comissão</option>
                    <option>Permuta</option>
                    <option>Misto</option>
                </select>
            </div>
            <div className="sm:col-span-2">
                <label htmlFor="compensationValue" className={labelClasses}>
                    Valor Monetário (Opcional)
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                     <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                       <span className="text-gray-500 sm:text-sm">{formData.compensationCurrency}</span>
                     </div>
                     <input
                       type="number"
                       name="compensationValue"
                       id="compensationValue"
                       value={formData.compensationValue}
                       onChange={handleChange}
                       className={`${inputClasses} pl-12`} // Padding left para moeda
                       placeholder="0.00"
                       step="0.01"
                       min="0"
                     />
                 </div>
            </div>
             <div className="sm:col-span-2">
                <label htmlFor="productValue" className={labelClasses}>
                    Valor Produto/Permuta (Opcional)
                </label>
                 <div className="relative mt-1 rounded-md shadow-sm">
                     <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                       <span className="text-gray-500 sm:text-sm">{formData.compensationCurrency}</span>
                     </div>
                    <input
                        type="number"
                        name="productValue"
                        id="productValue"
                        value={formData.productValue}
                        onChange={handleChange}
                        className={`${inputClasses} pl-12`}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                    />
                 </div>
            </div>
        </div>

        {/* Linha 5: Notas e Post Relacionado */}
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div>
                <label htmlFor="notes" className={labelClasses}>
                    Notas Adicionais (Opcional)
                </label>
                <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleChange}
                    className={inputClasses}
                    placeholder="Ex: Contato da agência, detalhes específicos do acordo..."
                />
            </div>
             <div>
                <label htmlFor="relatedPostId" className={labelClasses}>
                    ID do Post Relacionado (Opcional)
                </label>
                <input
                    type="text"
                    name="relatedPostId"
                    id="relatedPostId"
                    value={formData.relatedPostId}
                    onChange={handleChange}
                    className={inputClasses}
                    placeholder="Cole o ID do post (se aplicável)"
                />
                 <p className="mt-1 text-xs text-gray-500">Se esta publi corresponde a um post específico já registado.</p>
            </div>
        </div>

      {/* Botão de Submissão e Mensagens de Status */}
      <div className="pt-5">
        <div className="flex justify-end items-center gap-4">
          {/* Mensagem de Status */}
          <AnimatePresence>
            {submitStatus && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-center gap-2 text-sm font-medium ${
                  submitStatus.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {submitStatus.type === 'success' ? <FaCheckCircle /> : <FaTimesCircle />}
                {submitStatus.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botão */}
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center items-center gap-2 py-2.5 px-6 border border-transparent shadow-sm text-sm font-semibold rounded-full text-white bg-brand-pink hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink disabled:opacity-50 transition-default"
          >
            {isLoading ? (
              <>
                <FaSpinner className="animate-spin -ml-1 mr-2 h-4 w-4" />
                A registar...
              </>
            ) : (
              <>
                <FaPaperPlane className="-ml-1 mr-2 h-4 w-4" />
                Registar Parceria
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default AdDealForm;
