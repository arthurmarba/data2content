"use client";

import React from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface DemographicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: Record<string, number> | undefined;
}

const DemographicsModal: React.FC<DemographicsModalProps> = ({ isOpen, onClose, title, data }) => {
  if (!isOpen) return null;

  const entries = Object.entries(data || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-4 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-center text-sm text-gray-500">Nenhum dado disponível.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {entries.map(([k, v]) => (
                <li key={k} className="flex justify-between items-center gap-4 py-1">
                  <span className="truncate" title={k}>{k}</span>
                  <span className="font-medium flex-shrink-0">{v.toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DemographicsModal);