// src/app/components/modals/ConfirmActionModal.tsx
"use client";

import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'; // Ícone de alerta

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode; // Permite JSX para a mensagem, para mais flexibilidade
  confirmButtonText?: string;
  cancelButtonText?: string;
  isProcessing?: boolean; // Para mostrar estado de processamento no botão de confirmação
  isDestructiveAction?: boolean; // Para estilizar o botão de confirmação como destrutivo
  secondaryButtonText?: string;
  onSecondaryAction?: () => void;
  secondaryButtonDisabled?: boolean;
  secondaryButtonProcessing?: boolean;
  feedbackMessage?: { type: 'success' | 'error'; text: string } | null;
}

export default function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = "Confirmar",
  cancelButtonText = "Cancelar",
  isProcessing = false,
  isDestructiveAction = false,
  secondaryButtonText,
  onSecondaryAction,
  secondaryButtonDisabled = false,
  secondaryButtonProcessing = false,
  feedbackMessage = null,
}: ConfirmActionModalProps) {
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    {isDestructiveAction && (
                      <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                      </div>
                    )}
                    <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                      <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                        {title}
                      </Dialog.Title>
                      <div className="mt-2">
                        {typeof message === 'string' ? (
                          <p className="text-sm text-gray-500">{message}</p>
                        ) : (
                          message // Renderiza JSX diretamente se for fornecido
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    disabled={isProcessing}
                    className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto
                                ${isProcessing ? 'bg-gray-400 cursor-not-allowed' :
                                 isDestructiveAction ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}
                                transition-colors duration-150 ease-in-out`}
                    onClick={() => {
                      if (!isProcessing) {
                        onConfirm();
                      }
                    }}
                  >
                    {isProcessing ? 'A processar...' : confirmButtonText}
                  </button>
                  {secondaryButtonText && onSecondaryAction && (
                    <button
                      type="button"
                      disabled={secondaryButtonDisabled || secondaryButtonProcessing}
                      className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50"
                      onClick={() => {
                        if (!secondaryButtonDisabled && !secondaryButtonProcessing) {
                          onSecondaryAction();
                        }
                      }}
                    >
                      {secondaryButtonProcessing ? 'Processando...' : secondaryButtonText}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isProcessing}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50"
                    onClick={onClose}
                  >
                    {cancelButtonText}
                  </button>
                </div>
                {feedbackMessage && (
                  <p className={`px-6 pb-4 text-sm ${feedbackMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {feedbackMessage.text}
                  </p>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
