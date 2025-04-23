"use client";

import React from "react";
// Importando Framer Motion
import { motion, AnimatePresence } from "framer-motion";
// Importando Ícone
import { FaTimes } from "react-icons/fa";
// Importando o componente de conteúdo
import PaymentSettings from "./PaymentSettings";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  userId,
}: PaymentModalProps) {
  // Usa AnimatePresence para animar entrada/saída
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          // Fundo semi-transparente
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Fechar modal ao clicar fora (no backdrop)
          onClick={onClose}
          // Adicionando role para acessibilidade
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-modal-title" // Referencia o título abaixo
        >
          {/* Container do Modal com animação de escala */}
          <motion.div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-auto relative overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            // Impedir que clique dentro do modal feche o modal
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-200">
               <h2 id="payment-modal-title" className="text-lg font-semibold text-brand-dark">
                 Gerenciar Pagamentos de Afiliado
               </h2>
               {/* Botão Fechar com Ícone */}
                <button
                    onClick={onClose}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-pink"
                    aria-label="Fechar modal" // Label para acessibilidade
                >
                    <FaTimes className="w-5 h-5" />
                </button>
            </div>

            {/* Conteúdo do Modal com Scroll */}
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[75vh]"> {/* Altura máxima e scroll */}
              {/* Componente que gerencia dados bancários e exibe o histórico de saques */}
              <PaymentSettings userId={userId} />
            </div>

          </motion.div> {/* Fim motion.div container */}
        </motion.div> // Fim motion.div backdrop
      )}
    </AnimatePresence>
  );
}
