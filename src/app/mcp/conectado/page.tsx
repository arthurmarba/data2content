import type { Metadata } from "next";
import { cookies } from "next/headers";
import { readMcpOAuthSessionUserId } from "@/app/lib/mcp/oauth/session";
import { connectOfferPath, loadClaudeConnectOffer } from "@/app/lib/mcp/oauth/connectOffer";
import { ConnectOfferPlansButton } from "./ConnectOfferPlansButton";

export const metadata: Metadata = {
  title: "Data2Content conectada ao Claude",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PRO_IN_CLAUDE = [
  "Pautas novas toda semana, ancoradas nos seus territórios",
  "A leitura dos seus posts: o que funciona para você, medido contra a sua própria mediana",
  "Collabs com criadores que dividem território com você, com pauta para gravarem juntos",
  "Roteiros escritos a partir dos seus vídeos que funcionaram",
];

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-white px-4 pb-16 pt-8 text-[#171717] sm:px-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">Data2Content + Claude</p>
        {children}
      </div>
    </main>
  );
}

export default async function ClaudeConnectOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request: token } = await searchParams;
  const userId = await readMcpOAuthSessionUserId(await cookies());
  const offer = token && userId ? await loadClaudeConnectOffer(token, userId) : null;

  if (!token || !offer) {
    return (
      <Frame>
        <section className="rounded-3xl bg-[#f5f5f4] p-6">
          <h1 className="text-2xl font-black tracking-tight">A conexão expirou</h1>
          <p className="mt-3 text-sm leading-6 text-black/60">
            Volte ao Claude e conecte a Data2Content de novo. Leva poucos segundos.
          </p>
        </section>
      </Frame>
    );
  }

  const continueForm = (label: string, primary: boolean) => (
    <form action="/api/mcp/oauth/authorize" method="post">
      <input type="hidden" name="request" value={token} />
      <input type="hidden" name="offer" value="done" />
      <button
        name="decision"
        value="approve"
        className={
          primary
            ? "inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#171717] px-6 text-sm font-bold text-white transition hover:bg-black"
            : "inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#3d3d3d] px-6 text-sm font-bold text-[#171717] transition hover:bg-[#f5f5f4]"
        }
      >
        {label}
      </button>
    </form>
  );

  return (
    <Frame>
      <section className="rounded-3xl bg-[#f5f5f4] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Sua narrativa</p>
        <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight">{offer.narrative}</h1>
        {offer.territories.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Territórios">
            {offer.territories.map((territory) => (
              <li key={territory} className="rounded-full border border-[#3d3d3d] px-3 py-1 text-xs font-semibold">
                {territory}
              </li>
            ))}
          </ul>
        ) : null}
        {!offer.narrativeIsFirm ? (
          <p className="mt-4 text-sm leading-6 text-black/55">
            Primeira leitura, a partir do que você contou. Ela se afina conforme a Data2Content lê seus conteúdos.
          </p>
        ) : null}
      </section>

      {offer.accessLevel === "pro" ? (
        <section className="rounded-3xl bg-[#f5f5f4] p-6">
          <h2 className="text-lg font-black tracking-tight">Seu Pro está ativo</h2>
          <p className="mt-2 text-sm leading-6 text-black/60">
            A Data2Content no Claude já usa tudo o que o seu plano inclui.
          </p>
          <div className="mt-6">{continueForm("Continuar no Claude", true)}</div>
        </section>
      ) : (
        <section className="rounded-3xl bg-[#f5f5f4] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Plano Pro</p>
          <h2 className="mt-3 text-lg font-black tracking-tight">O que o Pro faz com a sua narrativa no Claude</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {PRO_IN_CLAUDE.map((benefit) => (
              <li key={benefit} className="flex gap-3 text-sm leading-6">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#171717]" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <ConnectOfferPlansButton returnTo={connectOfferPath(token)} />
            {continueForm("Continuar grátis no Claude", false)}
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-black/45">
            A conta gratuita continua com o seu Norte, a narrativa e os padrões da comunidade.
          </p>
        </section>
      )}
    </Frame>
  );
}
