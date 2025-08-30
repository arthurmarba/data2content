"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

export default function SuccessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { update } = useSession();

  // Estado para controlar a UI: verificando, sucesso ou falha.
  const [status, setStatus] = useState<"checking" | "succeeded" | "failed">(
    "checking"
  );

  // Usamos useRef para evitar recriar o intervalo em cada renderização.
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Função para verificar o status da assinatura no backend.
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/billing/status");
        const data = await res.json();

        // Se o plano estiver ativo, o processo terminou com sucesso.
        if (data.planStatus === "active") {
          setStatus("succeeded");
          if (intervalRef.current) clearInterval(intervalRef.current); // Para o polling.
          toast.success("Assinatura confirmada!");
          await update(); // Força a atualização final da sessão.
          router.push("/dashboard/chat"); // Redireciona para o painel.
        }
      } catch (error) {
        console.error("Failed to check status:", error);
        setStatus("failed"); // Se houver erro, marca como falha.
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    // Inicia o polling: verifica o status a cada 2 segundos.
    intervalRef.current = setInterval(checkStatus, 2000);

    // Define um tempo máximo de espera (ex: 30 segundos).
    const timeout = setTimeout(() => {
      if (status === "checking") {
        setStatus("failed");
        if (intervalRef.current) clearInterval(intervalRef.current);
        toast.error("A confirmação está demorando. Verifique em alguns instantes.");
      }
    }, 30000);

    // Limpa o intervalo e o timeout quando o componente é desmontado.
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
  }, [update, router, status]); // Adicionado 'status' para reavaliar o efeito.

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      {status === "checking" && (
        <>
          <h1 className="text-2xl font-semibold">Confirmando seu pagamento...</h1>
          <p className="text-gray-600 mt-2">
            Isso pode levar alguns segundos. Por favor, aguarde.
          </p>
          {/* Você pode adicionar um spinner de loading aqui */}
        </>
      )}

      {status === "succeeded" && (
        <>
          <h1 className="text-2xl font-semibold text-green-600">
            Pagamento confirmado! ✅
          </h1>
          <p className="text-gray-600 mt-2">
            Sua assinatura está ativa. Redirecionando para o painel...
          </p>
        </>
      )}

      {status === "failed" && (
        <>
          <h1 className="text-2xl font-semibold text-red-600">
            Ocorreu um problema
          </h1>
          <p className="text-gray-600 mt-2">
            Não conseguimos confirmar sua assinatura no momento. <br />
            Por favor, verifique a página de cobrança ou tente novamente.
          </p>
          <div className="flex gap-2 mt-4">
            <Link
              href="/dashboard/billing"
              className="px-4 py-2 rounded bg-black text-white"
            >
              Verificar minha assinatura
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
