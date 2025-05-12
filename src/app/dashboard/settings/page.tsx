// Caminho: src/app/dashboard/settings/page.tsx (ou src/app/settings/page.tsx)
"use client";

import React, { useState, useEffect, Fragment } from 'react';
// import Head from 'next/head'; // Removido, usar metadata para App Router
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ConfirmActionModal from '@/app/components/modals/ConfirmActionModal'; // Ajuste o caminho se necessário
import Link from 'next/link';
import { FaCreditCard, FaExternalLinkAlt } from 'react-icons/fa';

// Placeholder para logger
const logger = {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
};

// Para definir o título da página no App Router, você exportaria metadata.
// Se este ficheiro for src/app/dashboard/settings/page.tsx:
// export const metadata = { // Removido porque este é um client component
//   title: 'Configurações da Conta - Data2Content',
// };

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    // Definir o título da página dinamicamente no cliente
    document.title = 'Configurações da Conta - Data2Content';

    if (status === "unauthenticated") {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>A carregar...</p>
      </div>
    );
  }

  if (status !== "authenticated" || !session?.user) {
    return null;
  }

  const handleDeleteAccountClick = () => {
    setDeleteError(null);
    setShowConfirmDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    logger.info(`[SettingsPage] Utilizador ${session?.user?.id} confirmou a exclusão da conta. A chamar API...`);
    try {
      const response = await fetch('/api/user/account', { method: 'DELETE' });
      if (!response.ok) {
        let errorData;
        try { errorData = await response.json(); }
        catch (e) { errorData = { message: `Erro ${response.status}: ${response.statusText || 'Falha ao excluir a conta.'}` }; }
        logger.error(`[SettingsPage] Falha na API de exclusão de conta: Status ${response.status}`, errorData);
        throw new Error(errorData.message || 'Ocorreu um erro desconhecido ao tentar excluir a sua conta.');
      }
      logger.info(`[SettingsPage] Conta para o utilizador ${session?.user?.id} excluída com sucesso no backend.`);
      await signOut({ redirect: false, callbackUrl: "/?accountDeleted=true" });
      router.push("/?accountDeleted=true");
    } catch (error: any) {
      logger.error("[SettingsPage] Erro durante a chamada à API de exclusão:", error);
      setDeleteError(error.message || 'Um erro inesperado ocorreu.');
      setIsDeleting(false);
    }
  };

  const modalMessage = (
    <>
      <p className="text-sm text-gray-600">
        Você tem <strong className="font-semibold">ABSOLUTA CERTEZA</strong> que deseja excluir permanentemente a sua conta Data2Content e todos os seus dados associados (métricas, insights, histórico, etc.)?
      </p>
      <p className="text-sm text-gray-600 mt-2">
        Esta ação é <strong className="font-semibold text-red-600">IRREVERSÍVEL</strong>.
      </p>
      <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 rounded-md">
        <h4 className="text-sm font-semibold text-yellow-800">Importante sobre Assinaturas Ativas!</h4>
        <p className="text-xs text-yellow-700 mt-1">
          A exclusão da sua conta Data2Content <strong className="font-bold">NÃO</strong> cancela automaticamente qualquer assinatura ativa que você possa ter no Mercado Pago (ou outra plataforma de pagamento).
        </p>
        <p className="text-xs text-yellow-700 mt-1">
          Para evitar cobranças futuras, por favor, <strong className="font-bold">CANCELE A SUA ASSINATURA DIRETAMENTE NA PLATAFORMA DE PAGAMENTO</strong> (ex: Mercado Pago) antes ou imediatamente após excluir os seus dados aqui.
        </p>
      </div>
    </>
  );

  // <<< URL ATUALIZADA AQUI >>>
  const MERCADO_PAGO_SUBSCRIPTION_MANAGEMENT_URL = "https://www.mercadopago.com.br/subscriptions";

  return (
    <div className="min-h-screen bg-gray-100 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      {/* <Head> foi removido, use metadata exportada se necessário num Server Component pai ou layout */}
      <header className="mb-8 sm:mb-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 tracking-tight">
            Configurações da Conta
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto">
        <div className="bg-white shadow-xl rounded-lg overflow-hidden">
          <div className="p-6 sm:p-8">
            {/* Secção de Informações do Utilizador */}
            <section aria-labelledby="user-information-title">
              <h2 id="user-information-title" className="text-xl font-semibold text-gray-700">
                Informações do Utilizador
              </h2>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800">Nome:</span> {session?.user?.name || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-800">Email:</span> {session?.user?.email || 'N/A'}
                </p>
              </div>
            </section>

            <hr className="my-6 sm:my-8 border-gray-200" />

            {/* Secção Gerir Assinatura */}
            <section aria-labelledby="subscription-management-title" id="subscription-management-title"> {/* Adicionado ID para o hash link */}
              <h2 className="text-xl font-semibold text-gray-700">
                Minha Assinatura
              </h2>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-600">
                  Para visualizar detalhes do seu plano, histórico de pagamentos ou para cancelar a sua assinatura, por favor, aceda à sua conta no Mercado Pago.
                </p>
                <p className="text-sm text-gray-600">
                  Lembre-se: o cancelamento da sua assinatura deve ser feito diretamente na plataforma de pagamento.
                </p>
                <div className="mt-5">
                  <a
                    href={MERCADO_PAGO_SUBSCRIPTION_MANAGEMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-150 ease-in-out"
                  >
                    <FaCreditCard className="w-4 h-4 mr-2" />
                    Gerir Assinatura no Mercado Pago
                    <FaExternalLinkAlt className="w-3 h-3 ml-2 opacity-70" />
                  </a>
                </div>
              </div>
            </section>

            <hr className="my-6 sm:my-8 border-gray-200" />

            {/* Secção de Exclusão de Conta */}
            <section aria-labelledby="delete-account-title">
              <h2 id="delete-account-title" className="text-xl font-semibold text-red-600">
                Excluir Conta Permanentemente
              </h2>
              <div className="mt-4 space-y-3">
                <p className="text-sm text-gray-600">
                  Ao excluir a sua conta, todos os seus dados pessoais, métricas, insights,
                  contribuições para a comunidade e outras informações associadas à sua conta
                  Data2Content serão permanentemente removidos.
                </p>
                <p className="text-sm text-red-500 font-medium">
                  Atenção: Esta ação é irreversível e não pode ser desfeita.
                </p>
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded-md">
                  <h3 className="text-sm font-semibold text-yellow-800">Importante sobre Assinaturas Ativas</h3>
                  <p className="text-xs text-yellow-700 mt-1">
                    Se você possui uma assinatura ativa connosco através do Mercado Pago (ou outra plataforma de pagamento),
                    a exclusão da sua conta e dados da Data2Content <strong className="font-bold">NÃO</strong> cancela automaticamente
                    a sua assinatura na plataforma de pagamento.
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Para evitar cobranças futuras, por favor, cancele a sua assinatura diretamente
                    na plataforma de pagamento (ex: Mercado Pago) <strong className="font-bold">antes ou imediatamente após</strong> excluir os seus dados aqui.
                  </p>
                </div>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleDeleteAccountClick}
                    disabled={isDeleting}
                    className={`px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                                ${isDeleting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'}
                                transition-colors duration-150 ease-in-out`}
                  >
                    {isDeleting ? 'A excluir...' : 'Excluir Minha Conta e Dados da Data2Content'}
                  </button>
                </div>
                {deleteError && (
                  <p className="mt-3 text-xs text-red-600">{deleteError}</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {showConfirmDeleteModal && (
        <ConfirmActionModal
          isOpen={showConfirmDeleteModal}
          onClose={() => {
            if (!isDeleting) {
              setShowConfirmDeleteModal(false);
            }
          }}
          onConfirm={handleConfirmDelete}
          title="Confirmar Exclusão Permanente da Conta"
          message={modalMessage}
          confirmButtonText="Sim, Excluir Tudo"
          cancelButtonText="Cancelar"
          isProcessing={isDeleting}
          isDestructiveAction={true}
        />
      )}
    </div>
  );
}
