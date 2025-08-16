export function assertBillingEnv() {
  const missing: string[] = [];
  const required = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "NEXTAUTH_URL",
  ];
  for (const k of required) if (!process.env[k]) missing.push(k);

  if (missing.length) {
    const msg = `Variáveis ausentes: ${missing.join(", ")}. Configure o .env.`;
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    console.warn(msg);
  }

  // Alinhado à versão pinada pelo stripe@18.4.0
  const wantedApi = "2025-07-30.basil";
  const api = process.env.STRIPE_API_VERSION ?? wantedApi;

  if (process.env.NODE_ENV === "production") {
    if (api !== wantedApi) {
      throw new Error(`STRIPE_API_VERSION divergente (${api}). Use ${wantedApi}.`);
    }
  } else {
    if (api !== wantedApi) {
      console.warn(`[boot-sanity] Aviso: STRIPE_API_VERSION=${api}. Recomendada: ${wantedApi}.`);
    }
  }
}
