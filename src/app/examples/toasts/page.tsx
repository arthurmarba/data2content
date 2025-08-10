"use client";
import { useToast } from "@/app/components/ui/ToastA11yProvider";

export default function ToastExamples() {
  const { toast, dismissAll } = useToast();

  const onSuccess = () =>
    toast({
      title: "Plano atualizado",
      description: "Mudança aplicada com sucesso.",
      variant: "success",
      priority: "normal",
    });

  const onError = () =>
    toast({
      title: "Falha ao processar pagamento",
      description: "Tente novamente em instantes.",
      variant: "error",
      priority: "high", // vira assertive + role="alert"
      duration: 7000, // opcional (override)
    });

  const onInfo = () =>
    toast({
      title: "Checando status…",
      description: "Isso pode levar alguns segundos.",
      variant: "info",
      priority: "low",
    });

  return (
    <div className="flex gap-2 p-4">
      <button onClick={onSuccess} className="px-3 py-2 rounded bg-green-600 text-white">Success</button>
      <button onClick={onError} className="px-3 py-2 rounded bg-red-600 text-white">Error</button>
      <button onClick={onInfo} className="px-3 py-2 rounded bg-gray-900 text-white">Info</button>
      <button onClick={() => dismissAll()} className="px-3 py-2 rounded border">Limpar</button>
    </div>
  );
}

