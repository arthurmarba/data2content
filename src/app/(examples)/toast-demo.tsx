"use client";
import { useToast } from "@/app/components/ui/ToastA11yProvider";

export default function ToastDemo() {
  const { toast, dismissAll } = useToast();

  const simulateRetry = async () => {
    // simula uma ação de retry (ex.: refazer requisição de pagamento)
    await new Promise((r) => setTimeout(r, 800));
    // feedback após retry
    toast({
      title: "Tentativa enviada",
      description: "Estamos reprocessando sua solicitação.",
      variant: "info",
      priority: "normal",
    });
  };

  const onPaymentError = () =>
    toast({
      title: "Falha no pagamento",
      description: "Não conseguimos processar. Tente novamente.",
      variant: "error",
      priority: "high",
      // duração default p/ high = 6000ms (pode sobrescrever)
      action: {
        label: "Tentar novamente",
        onClick: simulateRetry,
        closeOnAction: false, // mantém o toast aberto ao clicar
      },
    });

  const onSuccess = () =>
    toast({
      title: "Plano atualizado",
      description: "Mudança aplicada com sucesso.",
      variant: "success",
      priority: "normal",
      duration: 5000, // opcional
    });

  const onInfo = () =>
    toast({
      title: "Aguardando confirmação",
      description: "Isso pode levar poucos segundos.",
      variant: "info",
      priority: "low",
    });

  return (
    <div className="flex gap-2">
      <button onClick={onPaymentError} className="px-3 py-2 rounded bg-red-600 text-white">Erro + Retry</button>
      <button onClick={onSuccess} className="px-3 py-2 rounded bg-green-600 text-white">Success</button>
      <button onClick={onInfo} className="px-3 py-2 rounded bg-gray-900 text-white">Info</button>
      <button onClick={() => dismissAll()} className="px-3 py-2 rounded border">Limpar</button>
    </div>
  );
}
