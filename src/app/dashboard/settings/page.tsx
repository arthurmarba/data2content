import ChangePlanCard from "../billing/ChangePlanCard";
import CancelRenewalCard from "../billing/CancelRenewalCard";

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Minha Assinatura</h1>
        <p className="text-sm text-gray-600">
          Gerencie seu plano, cobrança e renovação automática.
        </p>
      </section>

      <ChangePlanCard />
      <CancelRenewalCard />
    </div>
  );
}

