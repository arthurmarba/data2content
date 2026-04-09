import { resolveBillingPricesShape } from "@/app/lib/billing/serverBillingPrices";
import WhatsAppSubscribeInlineShell from "./WhatsAppSubscribeInlineShell";

export default async function WhatsAppUpsellPage() {
  const prices = await resolveBillingPricesShape();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Alertas no WhatsApp · Plano Pro</h1>
        <p className="mt-1 text-sm text-gray-600">
          Receba alertas e notificações no WhatsApp; qualquer dúvida ou conversa com IA acontece dentro do Chat AI da plataforma.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Diferente dos intermediários que ficam com 10%–30% do cachê e pedem exclusividade, aqui você paga só a assinatura e segue livre.
        </p>
      </div>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-2 text-lg font-medium text-gray-800">Vantagens do Plano Pro</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Alertas proativos de performance e oportunidades de conteúdo.</li>
          <li>Resumo semanal automático com destaques e prioridades.</li>
          <li>Link rápido para abrir o Chat AI na plataforma e tirar dúvidas.</li>
          <li>Integração direta com seu Instagram conectado.</li>
          <li>Participação no grupo VIP com mentorias estratégicas semanais exclusivas.</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <WhatsAppSubscribeInlineShell prices={prices} />
      </div>
    </div>
  );
}
