// Caminho: src/app/dashboard/settings/page.tsx (ou src/app/settings/page.tsx)
"use client";

import React, { useState, useEffect, Fragment } from 'react';
// import Head from 'next/head'; // Removido, usar metadata para App Router
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ConfirmActionModal from '@/app/components/modals/ConfirmActionModal'; // Ajuste o caminho se necessário

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
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [modalCancelLoading, setModalCancelLoading] = useState(false);
  const [modalCancelMessage, setModalCancelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastPaymentError, setLastPaymentError] = useState<{ statusDetail: string; at: string } | null>(null);

  useEffect(() => {
    // Definir o título da página dinamicamente no cliente
    document.title = 'Configurações da Conta - Data2Content';

    if (status === "unauthenticated") {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      try {
        const res = await fetch('/api/plan/last-error');
        if (res.ok) {
          const data = await res.json();
          setLastPaymentError(data.lastPaymentError);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [status]);

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

  const userPlanStatus = session.user.planStatus;
  const planExpiresFormatted = session.user.planExpiresAt
    ? new Date(session.user.planExpiresAt).toLocaleDateString('pt-BR')
    : null;

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

  const handleCancelRenewal = async () => {
    setCancelMessage(null);
    setIsCancelling(true);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Settings] Chamando /api/plan/cancel');
    }
    try {
      const res = await fetch('/api/plan/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCancelMessage({ type: 'error', text: data.error || 'Falha ao cancelar renovação.' });
      } else {
        const newSession = await update();
        const expires = newSession?.user?.planExpiresAt
          ? new Date(newSession.user.planExpiresAt).toLocaleDateString('pt-BR')
          : undefined;
        setCancelMessage({
          type: 'success',
          text: `Renovação cancelada. Seu acesso permanece até o fim do período já pago${
            expires ? ` (${expires})` : ''
          }.`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido ao cancelar.';
      setCancelMessage({ type: 'error', text: msg });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleModalCancelRenewal = async () => {
    setModalCancelMessage(null);
    setModalCancelLoading(true);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DeleteModal] Chamando /api/plan/cancel');
    }
    try {
      const res = await fetch('/api/plan/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setModalCancelMessage({ type: 'error', text: data.error || 'Falha ao cancelar renovação.' });
      } else {
        const newSession = await update();
        const expires = newSession?.user?.planExpiresAt
          ? new Date(newSession.user.planExpiresAt).toLocaleDateString('pt-BR')
          : undefined;
        setModalCancelMessage({
          type: 'success',
          text: `Renovação cancelada. Seu acesso permanece até o fim do período já pago${
            expires ? ` (${expires})` : ''
          }.`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido ao cancelar.';
      setModalCancelMessage({ type: 'error', text: msg });
    } finally {
      setModalCancelLoading(false);
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
        <h4 className="text-sm font-semibold text-yellow-800">Importante sobre Assinaturas Ativas</h4>
        <p className="text-xs text-yellow-700 mt-1">
          A exclusão da sua conta não cancela automaticamente a sua assinatura recorrente.
        </p>
        <p className="text-xs text-yellow-700 mt-1">
          Para evitar cobranças futuras, cancele a renovação aqui pelo app antes de excluir sua conta. Seu acesso permanece até o fim do período já pago.
        </p>
      </div>
    </>
  );

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
            <section aria-labelledby="subscription-management-title" id="subscription-management-title">
              <h2 className="text-xl font-semibold text-gray-700">Minha Assinatura</h2>
              <div className="mt-4 space-y-3">
                {lastPaymentError && (
                  <>
                    <p className="text-sm text-red-600">
                      Última tentativa de pagamento foi recusada ({lastPaymentError.statusDetail}) em {new Date(lastPaymentError.at).toLocaleDateString('pt-BR')}.
                    </p>
                    <a href="/dashboard#payment-section" className="text-sm text-brand-pink underline">
                      Tentar novamente
                    </a>
                  </>
                )}
                {planExpiresFormatted && (
                  <p className="text-sm text-gray-600">
                    Seu acesso expira em <strong className="font-medium">{planExpiresFormatted}</strong>.
                  </p>
                )}
                {userPlanStatus === 'active' && (
                  <button
                    type="button"
                    onClick={handleCancelRenewal}
                    disabled={isCancelling}
                    className={`px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-pink hover:bg-brand-pink/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-pink transition-colors duration-150 ease-in-out disabled:opacity-50`}
                  >
                    {isCancelling ? 'Cancelando...' : 'Cancelar renovação'}
                  </button>
                )}
                {userPlanStatus === 'non_renewing' && (
                  <button
                    type="button"
                    disabled
                    title="A renovação já foi cancelada"
                    className="px-5 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-400 cursor-not-allowed"
                  >
                    Cancelar renovação
                  </button>
                )}
                {cancelMessage && (
                  <p className={`text-sm mt-2 ${cancelMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {cancelMessage.text}
                  </p>
                )}
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
                      A exclusão da sua conta não cancela automaticamente a sua assinatura recorrente.
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Para evitar cobranças futuras, cancele a renovação aqui pelo app antes de excluir sua conta. Seu acesso permanece até o fim do período já pago.
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
          secondaryButtonText="Cancelar renovação agora"
          onSecondaryAction={handleModalCancelRenewal}
          secondaryButtonDisabled={modalCancelLoading || userPlanStatus !== 'active'}
          secondaryButtonProcessing={modalCancelLoading}
          feedbackMessage={modalCancelMessage}
        />
      )}
    </div>
  );
}
