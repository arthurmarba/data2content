import PricingCard from "./PricingCard";
import AbortPendingButton from "./AbortPendingButton";

export const dynamic = "force-dynamic"; // garante preços frescos em dev

export default async function BillingPage() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <AbortPendingButton />
      <PricingCard />
    </div>
  );
}

