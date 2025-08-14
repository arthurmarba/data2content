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

  const wantedApi = "2022-11-15";
  const api = process.env.STRIPE_API_VERSION ?? wantedApi;
  if (api !== wantedApi) {
    const msg = `STRIPE_API_VERSION divergente (${api}). Use ${wantedApi}.`;
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    console.warn(msg);
  }
}

