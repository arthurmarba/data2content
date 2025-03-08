"use client";

import React, { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  FaCopy,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaLock,
  FaTrophy,
  FaGift,
  FaMoneyBillWave,
} from "react-icons/fa";

import PaymentPanel from "./PaymentPanel";
import UploadMetrics from "./UploadMetrics";
import ChatPanel from "./ChatPanel";
import WhatsAppPanel from "./WhatsAppPanel";

/** =================== */
/** Interface para cada saque (resgate) */
interface Redemption {
  _id: string;
  createdAt: string;
  amount: number;
  status: string;
}

/** =================== */
/** MODAL PARA PAGAMENTOS E DADOS BANCÁRIOS */
/** =================== */
function PaymentModal({
  isOpen,
  onClose,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          &times;
        </button>
        <div className="p-4 sm:p-6">
          <h2 className="text-xl font-bold mb-4">Gerenciar Pagamentos</h2>
          <PaymentSettings userId={userId} />
        </div>
      </div>
    </div>
  );
}

/** =================== */
/** FORM + LISTA DE SAQUES */
/** =================== */
function PaymentSettings({ userId }: { userId: string }) {
  const router = useRouter(); // Para router.refresh()

  // Campos do formulário de pagamento
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Mensagem de retorno de resgate
  const [redeemMessage, setRedeemMessage] = useState("");

  // Histórico de saques
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  // Carrega dados de pagamento e lista de saques ao montar
  useEffect(() => {
    if (!userId) return;
    fetchPaymentInfo();
    fetchRedemptions();
  }, [userId]);

  // Busca dados de pagamento (Pix, conta, etc.)
  async function fetchPaymentInfo() {
    try {
      const res = await fetch(`/api/affiliate/paymentinfo?userId=${userId}`);
      const data = await res.json();
      if (!data.error) {
        setPixKey(data.pixKey || "");
        setBankName(data.bankName || "");
        setBankAgency(data.bankAgency || "");
        setBankAccount(data.bankAccount || "");
      }
    } catch (error: unknown) {
      console.error("Erro ao buscar paymentInfo:", error);
    }
  }

  // Busca histórico de saques
  async function fetchRedemptions() {
    setLoadingRedemptions(true);
    try {
      const res = await fetch(`/api/affiliate/redeem?userId=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRedemptions(data);
      }
    } catch (error: unknown) {
      console.error("Erro ao buscar redemptions:", error);
    } finally {
      setLoadingRedemptions(false);
    }
  }

  // Salva dados de pagamento
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/affiliate/paymentinfo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          pixKey,
          bankName,
          bankAgency,
          bankAccount,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(`Erro: ${data.error}`);
      } else {
        setMessage(data.message || "Dados salvos com sucesso!");
        // Força atualização do session e re-fetch do user
        router.refresh();
      }
    } catch (error: unknown) {
      let errorMsg = "Ocorreu um erro.";
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      setMessage(`Ocorreu um erro: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  }

  // Resgatar saldo
  async function handleRedeem() {
    setRedeemMessage("Processando resgate...");
    try {
      const res = await fetch("/api/affiliate/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.error) {
        setRedeemMessage(`Erro: ${data.error}`);
      } else {
        setRedeemMessage(data.message || "Resgate solicitado com sucesso!");
        // Atualiza a lista de saques e o saldo do usuário
        fetchRedemptions();
        router.refresh();
      }
    } catch (error: unknown) {
      let errorMsg = "Ocorreu um erro.";
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      setRedeemMessage(`Ocorreu um erro: ${errorMsg}`);
    }
  }

  // Verifica se todos os dados bancários estão vazios (para feedback)
  const hasPaymentInfo = !!(pixKey || bankName || bankAgency || bankAccount);

  return (
    <div className="space-y-6">
      {/* Form de dados bancários/Pix */}
      <form onSubmit={handleSave} className="border border-gray-200 p-4 rounded">
        <h3 className="text-sm font-semibold mb-3">Seus Dados de Pagamento</h3>

        <label className="block mb-2 text-xs font-medium text-gray-700">
          Chave Pix
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>

        <label className="block mb-2 text-xs font-medium text-gray-700">
          Banco
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>

        <label className="block mb-2 text-xs font-medium text-gray-700">
          Agência
          <input
            type="text"
            value={bankAgency}
            onChange={(e) => setBankAgency(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>

        <label className="block mb-2 text-xs font-medium text-gray-700">
          Conta
          <input
            type="text"
            value={bankAccount}
            onChange={(e) => setBankAccount(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>

        {message && <p className="text-xs text-blue-600 mt-2">{message}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-3 px-3 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
        >
          {saving ? "Salvando..." : "Salvar Dados"}
        </button>
      </form>

      {/* Resgatar saldo */}
      <div>
        {!hasPaymentInfo && (
          <p className="text-xs text-red-500 mb-1">
            É preciso preencher os dados bancários antes de solicitar o saque.
          </p>
        )}
        <button
          onClick={handleRedeem}
          disabled={!hasPaymentInfo}
          className={`px-3 py-1 text-xs rounded ${
            hasPaymentInfo
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Resgatar Saldo
        </button>
        {redeemMessage && (
          <p className="text-xs text-blue-600 mt-2">{redeemMessage}</p>
        )}
      </div>

      {/* Histórico de Saques */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Histórico de Resgates</h3>
        {loadingRedemptions ? (
          <p className="text-xs text-gray-500">Carregando saques...</p>
        ) : redemptions.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum saque realizado ainda.</p>
        ) : (
          <table className="w-full text-xs border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">Data</th>
                <th className="px-2 py-1 text-left">Valor</th>
                <th className="px-2 py-1 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((r) => (
                <tr key={r._id}>
                  <td className="px-2 py-1">
                    {new Date(r.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-2 py-1">R${r.amount.toFixed(2)}</td>
                  <td className="px-2 py-1 capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Popup simples para Upgrade */
function UpgradePopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full text-center">
        <h2 className="text-lg font-bold mb-3">Exclusivo para Assinantes</h2>
        <p className="text-sm text-gray-600 mb-4">
          Assine agora para desbloquear este recurso e aproveitar todos os benefícios!
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

/** Mensagem de feedback após resgate de saldo */
const Testimonial = React.memo(({ message }: { message: string }) => {
  if (!message) return null;
  return (
    <p className="text-sm mt-2 text-green-600 font-semibold">
      {message}
    </p>
  );
});

export default function MainDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter(); // Para router.refresh()
  const [redeemMessage, setRedeemMessage] = useState("");
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);

  // Modal de pagamento (dados bancários e histórico)
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Enquanto carrega a sessão
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-sm text-gray-600">Carregando sessão...</p>
      </div>
    );
  }

  // Se não estiver logado, exibe tela de login simples
  if (!session?.user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
        <p className="mb-4 text-gray-700">Você não está logado.</p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition text-sm"
        >
          Fazer Login com Google
        </button>
      </div>
    );
  }

  // Dados do plano
  const planStatus = session.user.planStatus || "inactive";
  const canAccessFeatures = planStatus === "active";

  // Anel de status em volta da foto
  function getStatusRingColor() {
    if (planStatus === "active") return "ring-green-500";
    if (planStatus === "pending") return "ring-yellow-500";
    return "ring-red-500";
  }

  // Ícone de status
  function getStatusIcon() {
    if (planStatus === "active") {
      return <FaCheckCircle className="text-green-600 w-4 h-4" />;
    }
    if (planStatus === "pending") {
      return <FaClock className="text-yellow-600 w-4 h-4" />;
    }
    return <FaTimesCircle className="text-red-600 w-4 h-4" />;
  }

  // Resgatar saldo de afiliado (rápido)
  async function handleRedeemBalance() {
    try {
      setRedeemMessage("Processando resgate...");
      const res = await fetch("/api/affiliate/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const data = await res.json();

      if (data.message && !data.error) {
        setRedeemMessage("Saldo resgatado com sucesso!");
        // Força revalidação da session e recarrega a página
        router.refresh();
      } else {
        setRedeemMessage(`Erro: ${data.error || "Falha ao resgatar saldo."}`);
      }
    } catch (error: unknown) {
      console.error("Erro ao resgatar saldo:", error);
      setRedeemMessage("Ocorreu um erro ao processar o resgate.");
    }
  }

  // Copiar cupom de afiliado
  function copyAffiliateCode() {
    if (!session.user.affiliateCode) return;
    navigator.clipboard.writeText(session.user.affiliateCode).then(() => {
      alert("Cupom copiado para a área de transferência!");
    });
  }

  // Gamificação
  const userRank = session.user.affiliateRank || 1;
  const userInvites = session.user.affiliateInvites || 0;
  const invitesNeeded = 5 - userInvites > 0 ? 5 - userInvites : 0;
  const progressPercent = Math.min((userInvites / 5) * 100, 100);

  return (
    <>
      {/* Popup se não for assinante e tentar usar algo bloqueado */}
      {showUpgradePopup && <UpgradePopup onClose={() => setShowUpgradePopup(false)} />}

      {/* Modal de pagamento */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        userId={session.user.id}
      />

      <div className="min-h-screen bg-animated-gradient font-poppins pt-16 pb-8 px-4">
        <div className="mx-auto max-w-lg bg-white rounded-2xl shadow-2xl p-6 md:p-10 text-gray-800 relative">
          {/* DECORAÇÃO SUTIL */}
          <div className="absolute inset-0 pointer-events-none opacity-5 bg-topography bg-cover bg-no-repeat" />

          {/* Topo: Foto, Nome e Status */}
          <div className="flex items-center gap-4 mb-10">
            {session.user.image && (
              <div
                className={`rounded-full border-2 border-white shadow-md flex-shrink-0 ring-4 ${getStatusRingColor()} hover:scale-105 transition-transform animate-pulse`}
              >
                <img
                  src={session.user.image}
                  alt={session.user.name || "Usuário"}
                  className="w-20 h-20 rounded-full object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-800 hover:underline cursor-pointer">
                {session.user.name || "Usuário"}
              </h1>
              <div className="flex items-center gap-1 mt-1">
                {getStatusIcon()}
                {planStatus === "active" ? (
                  <p className="text-sm text-green-600 font-semibold">Plano Ativo</p>
                ) : planStatus === "pending" ? (
                  <p className="text-sm text-yellow-600 font-semibold">Pagamento Pendente</p>
                ) : (
                  <p className="text-sm text-red-600 font-semibold">Plano Inativo</p>
                )}
              </div>
            </div>
          </div>

          {/* Card de Afiliado */}
          <section className="mt-10 mb-6 border border-gray-100 rounded-lg p-4 bg-white shadow relative hover:shadow-lg transition-shadow">
            {/* Selo Afiliado */}
            <div className="absolute top-[-10px] left-4 bg-gradient-to-r from-green-300 to-green-500 text-white text-[10px] sm:text-xs px-2 py-1 rounded-full shadow-sm uppercase font-bold tracking-wider drop-shadow-lg animate-bounce-slow">
              Afiliado
            </div>

            {/* Título + Rank */}
            <div className="flex items-center justify-between mt-4 mb-2">
              <h2 className="text-sm font-bold text-gray-800">Ganhe 10% por Venda</h2>
              <div className="flex items-center gap-1 text-yellow-500">
                <FaTrophy className="w-4 h-4" />
                <span className="text-xs font-bold">Rank {userRank}</span>
              </div>
            </div>

            {/* Descrição breve */}
            <p className="text-xs text-gray-600 leading-snug mb-3">
              Cada assinatura usando seu cupom gera{" "}
              <span className="font-semibold">10% de comissão</span>. Suba de rank
              conforme suas indicações aumentam!
            </p>

            {/* Barra de progresso */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2 overflow-hidden">
              <div
                className="bg-green-500 h-2 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Indicações: <span className="font-bold">{userInvites}</span> | Faltam{" "}
              <span className="font-bold">{invitesNeeded}</span> para Rank {userRank + 1}
            </p>

            {/* Cupom + Saldo */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4">
              {/* Cupom */}
              <div className="flex items-center gap-1 text-xs sm:text-sm">
                <FaGift className="text-pink-400 w-4 h-4" />
                <span className="font-medium text-gray-700">Cupom:</span>
                <div className="flex items-center gap-2 px-2 py-1 rounded-full border border-pink-200 bg-gradient-to-r from-pink-50 to-pink-100 text-pink-700 shadow-sm hover:shadow transition">
                  <span>{session.user.affiliateCode || "N/A"}</span>
                  {session.user.affiliateCode && (
                    <button
                      onClick={copyAffiliateCode}
                      className="hover:text-pink-900 transition"
                      title="Copiar Cupom"
                    >
                      <FaCopy className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Saldo */}
              <div className="flex items-center gap-1 text-xs sm:text-sm">
                <FaMoneyBillWave className="text-green-400 w-4 h-4" />
                <span className="font-medium text-gray-700">Saldo:</span>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-green-200 bg-gradient-to-r from-green-50 to-green-100 text-green-700 shadow-sm hover:shadow transition">
                  <span className="font-semibold">
                    R${session.user.affiliateBalance?.toFixed(2) || "0.00"}
                  </span>
                </div>
              </div>
            </div>

            {/* Resgatar Saldo rápido */}
            <Testimonial message={redeemMessage} />
            <button
              onClick={handleRedeemBalance}
              className={`
                mt-4 px-3 py-1 rounded text-xs sm:text-sm font-medium
                transition-transform shimmer-button
                bg-indigo-600 text-white hover:bg-indigo-700 hover:-translate-y-0.5
              `}
            >
              Resgatar Saldo
            </button>

            {/* Botão para abrir modal de Gerenciar Pagamentos */}
            <button
              onClick={() => setShowPaymentModal(true)}
              className="mt-2 ml-2 px-3 py-1 rounded text-xs sm:text-sm bg-gray-200 hover:bg-gray-300 text-gray-700"
            >
              Gerenciar Pagamentos
            </button>
          </section>

          {/* Se não for assinante, exibe PaymentPanel; se for assinante, oculta */}
          {!canAccessFeatures && (
            <section className="mb-6">
              <PaymentPanel user={session.user} />
            </section>
          )}

          {/* Upload de Métricas */}
          <section className="mb-6">
            <UploadMetrics
              canAccessFeatures={canAccessFeatures}
              userId={session.user.id}
            />
          </section>

          {/* Card dedicado ao WhatsApp */}
          <section className="mb-6">
            <WhatsAppPanel userId={session.user.id} canAccessFeatures={canAccessFeatures} />
          </section>

          {/* Chat IA (exclusivo para assinantes) */}
          <section>
            {canAccessFeatures ? (
              <div className="border border-gray-200 rounded-md shadow-sm bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  Consultor de Métricas (IA)
                </h3>
                <div className="h-64">
                  <ChatPanel />
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md p-4 shadow-sm text-center text-red-600 flex items-center justify-center gap-2">
                <FaLock />
                <p className="text-sm font-semibold">Exclusivo para assinantes</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* CSS customizado (mesmo do HomePage) */}
      <style jsx>{`
        .bg-animated-gradient {
          background: linear-gradient(45deg, #8e2de2, #4a00e0, #0f9b0f, #00c6ff);
          background-size: 400% 400%;
          animation: gradientAnimation 15s ease infinite;
        }
        @keyframes gradientAnimation {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        @keyframes bounce-slow {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s infinite;
        }
        .bg-topography {
          background-image: url("https://www.transparenttextures.com/patterns/cubes.png");
        }

        /* Efeito "shimmer" no botão de Resgatar Saldo */
        .shimmer-button {
          position: relative;
          overflow: hidden;
        }
        .shimmer-button::before {
          content: "";
          position: absolute;
          top: 0;
          left: -150%;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-20deg);
        }
        .shimmer-button:hover::before {
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
          0% {
            left: -150%;
          }
          50% {
            left: 100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </>
  );
}
