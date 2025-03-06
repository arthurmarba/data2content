"use client";

import React from "react";
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
  if (!isOpen) return null; // Se o modal não estiver aberto, não renderiza

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 relative">
        {/* Botão para fechar */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          &times;
        </button>

        <div className="p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">Gerenciar Pagamentos</h2>
          {/* Aqui, chamamos o componente que gerencia dados bancários e exibe os saques */}
          <PaymentSettings userId={userId} />
        </div>
      </div>
    </div>
  );
}
