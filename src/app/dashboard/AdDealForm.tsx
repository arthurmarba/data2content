"use client";

import React, { useState, ChangeEvent, FormEvent, FocusEvent, MouseEvent } from 'react'; // Adicionado FocusEvent, MouseEvent
import { FaPaperPlane, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

interface AdDealFormData {
  brandName: string;
  brandSegment: string;
  dealDate: string;
  campaignStartDate: string;
  campaignEndDate: string;
  deliverables: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube' | 'Blog' | 'Outro' | 'Múltiplas';
  compensationType: 'Valor Fixo' | 'Comissão' | 'Permuta' | 'Misto' | '';
  compensationValue: string;
  compensationCurrency: string;
  productValue: string;
  notes: string;
  relatedPostId: string;
}

// Props atualizadas
interface AdDealFormProps {
    userId: string;
    canAccessFeatures: boolean; // Nova prop
    onActionRedirect: () => void; // Nova prop
    showToast: (message: string, type?: 'info' | 'warning' | 'success' | 'error') => void; // Nova prop
    onDealAdded?: () => void;
}

const AdDealForm: React.FC<AdDealFormProps> = ({
  userId,
  canAccessFeatures,
  onActionRedirect,
  showToast,
  onDealAdded
}) => {
  const initialState: AdDealFormData = {
    brandName: '',
    brandSegment: '',
    dealDate: new Date().toISOString().split('T')[0] ?? '',
    campaignStartDate: '',
    campaignEndDate: '',
    deliverables: '',
    platform: 'Instagram',
    compensationType: '',
    compensationValue: '',
    compensationCurrency: 'BRL',
    productValue: '',
    notes: '',
    relatedPostId: '',
  };

  const [formData, setFormData] = useState<AdDealFormData>(initialState);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Função unificada para lidar com interações bloqueadas para não assinantes
  const handleBlockedInteraction = (event?: React.SyntheticEvent): boolean => {
    if (!canAccessFeatures) {
      if (event) {
        event.preventDefault(); // Previne a ação padrão (foco, clique, mudança, submissão)
        if (event.currentTarget && typeof (event.currentTarget as HTMLElement).blur === 'function') {
          (event.currentTarget as HTMLElement).blur(); // Tenta remover o foco
        }
      }
      showToast("Para registrar e analisar suas parcerias, um plano premium é necessário.", 'info');
      onActionRedirect();
      return true; // Interação bloqueada
    }
    return false; // Interação permitida
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    // O bloqueio da digitação em si será tratado por onFocus/onClick nos campos.
    // Esta função apenas atualiza o estado se a interação for permitida.
    if (!canAccessFeatures) return; // Segurança adicional, mas o foco principal é bloquear antes

    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Previne submissão padrão primeiro
    if (handleBlockedInteraction(e)) return; // Se bloqueado, não continua

    // Lógica de submissão para assinantes
    setIsLoading(true);
    setSubmitStatus(null);

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

    const dataToSend = {
        userId: userId,
        ...formData,
        compensationValue: formData.compensationValue ? parseFloat(formData.compensationValue) : undefined,
        productValue: formData.productValue ? parseFloat(formData.productValue) : undefined,
        deliverables: formData.deliverables.split('\n').map(d => d.trim()).filter(d => d.length > 0),
        campaignStartDate: formData.campaignStartDate || undefined,
        campaignEndDate: formData.campaignEndDate || undefined,
        relatedPostId: formData.relatedPostId || undefined,
    };

    try {
      const response = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const result = await response.json();
      if (!response.ok) {
        const errorMsg = result.details ? result.details.join(', ') : (result.error || `Erro ${response.status}`);
        throw new Error(errorMsg);
      }
      setSubmitStatus({ type: 'success', message: 'Parceria registada com sucesso!' });
      setFormData(initialState);
      if (onDealAdded) onDealAdded();
      setTimeout(() => setSubmitStatus(null), 4000);
    } catch (error) {
      console.error("Erro ao registar parceria:", error);
      setSubmitStatus({ type: 'error', message: `Erro ao registar: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-brand-pink focus:ring-1 focus:ring-brand-pink";
  // Removido: disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200 disabled:shadow-none
  // A prop `disabled` nos inputs será condicional apenas para `isLoading` em assinantes.
  const labelClasses = "block text-sm font-medium text-gray-700";

  // Função para aplicar aos eventos de campos que devem ser bloqueados
  const fieldEventHandlers = {
    onClick: (e: MouseEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => handleBlockedInteraction(e),
    onFocus: (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => handleBlockedInteraction(e),
  };

  return (
    // O formulário em si não precisa de onClick/onFocus para bloqueio, o onSubmit já trata.
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      {/* Linha 1: Nome da Marca e Segmento */}
      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
        <div>
          <label htmlFor="adFormBrandName" className={labelClasses}> {/* ID Atualizado */}
            Nome da Marca <span className="text-red-500">*</span>
          </label>
          <input
            type="text" name="brandName" id="adFormBrandName" value={formData.brandName}
            {...fieldEventHandlers} // Aplica bloqueio
            onChange={handleChange}
            className={inputClasses} required placeholder="Ex: Marca Incrível"
            disabled={canAccessFeatures && isLoading} // Só desabilita para assinante durante loading
          />
        </div>
        <div>
          <label htmlFor="adFormBrandSegment" className={labelClasses}> {/* ID Atualizado */}
            Segmento da Marca (Opcional)
          </label>
          <input
            type="text" name="brandSegment" id="adFormBrandSegment" value={formData.brandSegment}
            {...fieldEventHandlers}
            onChange={handleChange}
            className={inputClasses} placeholder="Ex: Moda, Beleza, Tecnologia"
            disabled={canAccessFeatures && isLoading}
          />
        </div>
      </div>

      {/* Linha 2: Datas */}
      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
        <div>
           <label htmlFor="adFormDealDate" className={labelClasses}> {/* ID Atualizado */}
             Data do Acordo <span className="text-red-500">*</span>
           </label>
           <input
             type="date" name="dealDate" id="adFormDealDate" value={formData.dealDate}
             {...fieldEventHandlers}
             onChange={handleChange}
             className={inputClasses} required
             disabled={canAccessFeatures && isLoading}
           />
         </div>
         <div>
           <label htmlFor="adFormCampaignStartDate" className={labelClasses}> {/* ID Atualizado */}
             Início da Campanha (Opcional)
           </label>
           <input
             type="date" name="campaignStartDate" id="adFormCampaignStartDate" value={formData.campaignStartDate}
             {...fieldEventHandlers}
             onChange={handleChange}
             className={inputClasses}
             disabled={canAccessFeatures && isLoading}
           />
         </div>
         <div>
           <label htmlFor="adFormCampaignEndDate" className={labelClasses}> {/* ID Atualizado */}
             Fim da Campanha (Opcional)
           </label>
           <input
             type="date" name="campaignEndDate" id="adFormCampaignEndDate" value={formData.campaignEndDate}
             {...fieldEventHandlers}
             onChange={handleChange}
             className={inputClasses}
             disabled={canAccessFeatures && isLoading}
           />
         </div>
      </div>

       {/* Linha 3: Entregas e Plataforma */}
       <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
                <label htmlFor="adFormDeliverables" className={labelClasses}> {/* ID Atualizado */}
                    Entregas (uma por linha) <span className="text-red-500">*</span>
                </label>
                <textarea
                    id="adFormDeliverables" name="deliverables" rows={3} value={formData.deliverables}
                    {...fieldEventHandlers}
                    onChange={handleChange}
                    className={inputClasses} required
                    placeholder="Ex:&#10;1 Reel 60s&#10;3 Stories (sequência)&#10;1 Post Carrossel (5 fotos)"
                    disabled={canAccessFeatures && isLoading}
                />
                 <p className="mt-1 text-xs text-gray-500">Liste cada entrega numa linha separada.</p>
            </div>
            <div>
                <label htmlFor="adFormPlatform" className={labelClasses}> {/* ID Atualizado */}
                    Plataforma Principal
                </label>
                <select
                    id="adFormPlatform" name="platform" value={formData.platform}
                    {...fieldEventHandlers} // Select também precisa
                    onChange={handleChange}
                    className={inputClasses}
                    disabled={canAccessFeatures && isLoading}
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
                <label htmlFor="adFormCompensationType" className={labelClasses}> {/* ID Atualizado */}
                    Tipo de Compensação <span className="text-red-500">*</span>
                </label>
                <select
                    id="adFormCompensationType" name="compensationType" value={formData.compensationType}
                    {...fieldEventHandlers}
                    onChange={handleChange}
                    className={inputClasses} required
                    disabled={canAccessFeatures && isLoading}
                >
                    <option value="" disabled>Selecione...</option>
                    <option>Valor Fixo</option>
                    <option>Comissão</option>
                    <option>Permuta</option>
                    <option>Misto</option>
                </select>
            </div>
            <div className="sm:col-span-2">
                <label htmlFor="adFormCompensationValue" className={labelClasses}> {/* ID Atualizado */}
                    Valor Monetário (Opcional)
                </label>
                <div className="relative mt-1 rounded-md shadow-sm">
                     <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                       <span className="text-gray-500 sm:text-sm">{formData.compensationCurrency}</span>
                     </div>
                     <input
                       type="number" name="compensationValue" id="adFormCompensationValue"
                       value={formData.compensationValue}
                       {...fieldEventHandlers}
                       onChange={handleChange}
                       className={`${inputClasses} pl-12`}
                       placeholder="0.00" step="0.01" min="0"
                       disabled={canAccessFeatures && isLoading}
                     />
                 </div>
            </div>
             <div className="sm:col-span-2">
                <label htmlFor="adFormProductValue" className={labelClasses}> {/* ID Atualizado */}
                    Valor Produto/Permuta (Opcional)
                </label>
                 <div className="relative mt-1 rounded-md shadow-sm">
                     <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                       <span className="text-gray-500 sm:text-sm">{formData.compensationCurrency}</span>
                     </div>
                    <input
                        type="number" name="productValue" id="adFormProductValue"
                        value={formData.productValue}
                        {...fieldEventHandlers}
                        onChange={handleChange}
                        className={`${inputClasses} pl-12`}
                        placeholder="0.00" step="0.01" min="0"
                        disabled={canAccessFeatures && isLoading}
                    />
                 </div>
            </div>
        </div>

        {/* Linha 5: Notas e Post Relacionado */}
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div>
                <label htmlFor="adFormNotes" className={labelClasses}> {/* ID Atualizado */}
                    Notas Adicionais (Opcional)
                </label>
                <textarea
                    id="adFormNotes" name="notes" rows={3} value={formData.notes}
                    {...fieldEventHandlers}
                    onChange={handleChange}
                    className={inputClasses}
                    placeholder="Ex: Contato da agência, detalhes específicos do acordo..."
                    disabled={canAccessFeatures && isLoading}
                />
            </div>
             <div>
                <label htmlFor="adFormRelatedPostId" className={labelClasses}> {/* ID Atualizado */}
                    ID do Post Relacionado (Opcional)
                </label>
                <input
                    type="text" name="relatedPostId" id="adFormRelatedPostId" value={formData.relatedPostId}
                    {...fieldEventHandlers}
                    onChange={handleChange}
                    className={inputClasses}
                    placeholder="Cole o ID do post (se aplicável)"
                    disabled={canAccessFeatures && isLoading}
                />
                 <p className="mt-1 text-xs text-gray-500">Se esta publi corresponde a um post específico já registado.</p>
            </div>
        </div>

      {/* Botão de Submissão e Mensagens de Status */}
      <div className="pt-5">
        <div className="flex justify-end items-center gap-4">
          <AnimatePresence>
            {/* Mostra status de submissão apenas para assinantes */}
            {canAccessFeatures && submitStatus && (
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

          <button
            type="submit" // O onSubmit do form já chama handleBlockedInteraction
            // `disabled` só se aplica a assinantes durante o loading
            disabled={canAccessFeatures && isLoading}
            className="inline-flex justify-center items-center gap-2 py-2.5 px-6 border border-transparent shadow-sm text-sm font-semibold rounded-full text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition duration-150 ease-in-out"
            // Estilo visual de "desabilitado" não será aplicado para não assinantes aqui.
          >
            {(canAccessFeatures && isLoading) ? (
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
