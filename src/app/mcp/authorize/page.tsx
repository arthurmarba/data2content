import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMcpAppBaseUrl, getMcpUpgradeUrl } from "@/app/lib/mcp/config";
import { getMcpEntitlement } from "@/app/lib/mcp/entitlement";
import { readMcpConsentRequest } from "@/app/lib/mcp/oauth/service";
import { readMcpOAuthSessionUserId } from "@/app/lib/mcp/oauth/session";

export const metadata: Metadata = {
  title: "Autorizar MCP — Data2Content",
  description: "Autorize um assistente a consultar sua conta Data2Content.",
  robots: { index: false, follow: false },
};

const SCOPE_LABELS: Record<string, string> = {
  "profile:read": "Consultar seu perfil de creator",
  "metrics:read": "Consultar métricas e performance do Instagram",
  "strategy:read": "Consultar análises e inteligência estratégica",
  "content:read": "Consultar posts, pautas e roteiros salvos",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-5 py-12 text-[#17191d]">
      <section className="mx-auto w-full max-w-lg rounded-3xl border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#17191d] text-sm font-black text-white">D2C</div>
          <div>
            <p className="text-sm font-semibold text-black/50">Data2Content</p>
            <h1 className="text-xl font-bold tracking-tight">Conexão MCP</h1>
          </div>
        </div>
        {children}
      </section>
    </main>
  );
}

export default async function McpAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request: requestToken } = await searchParams;
  if (!requestToken) {
    return <Shell><p className="text-sm text-red-700">Solicitação de autorização ausente.</p></Shell>;
  }

  const userId = await readMcpOAuthSessionUserId(await cookies());
  if (!userId) {
    const callbackUrl = new URL("/mcp/authorize", getMcpAppBaseUrl());
    callbackUrl.searchParams.set("request", requestToken);
    const login = new URL("/login", getMcpAppBaseUrl());
    login.searchParams.set("callbackUrl", callbackUrl.toString());
    redirect(login.toString());
  }

  let consent;
  try {
    consent = await readMcpConsentRequest(requestToken);
  } catch {
    return <Shell><p className="text-sm text-red-700">Esta solicitação expirou ou já foi utilizada.</p></Shell>;
  }
  if (String(consent.userId) !== userId) {
    return <Shell><p className="text-sm text-red-700">Esta solicitação pertence a outra conta Data2Content.</p></Shell>;
  }

  const entitlement = await getMcpEntitlement(userId);
  if (!entitlement.eligible) {
    return (
      <Shell>
        <h2 className="text-2xl font-bold tracking-tight">Assinatura necessária</h2>
        <p className="mt-3 text-sm leading-6 text-black/60">
          A conexão MCP é exclusiva para assinantes Data2Content. Assine para conectar sua conta ao {consent.clientName}.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a className="rounded-xl bg-[#17191d] px-5 py-3 text-center text-sm font-semibold text-white" href={getMcpUpgradeUrl()}>
            Ver planos
          </a>
          <form action="/api/mcp/oauth/authorize" method="post">
            <input type="hidden" name="request" value={requestToken} />
            <button className="w-full rounded-xl border border-black/15 px-5 py-3 text-sm font-semibold" name="decision" value="deny">
              Cancelar conexão
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f51d8]">Autorizar acesso</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight">{consent.clientName} quer acessar sua conta</h2>
      <p className="mt-3 text-sm leading-6 text-black/60">
        O assistente poderá apenas consultar os dados abaixo. Ele não poderá publicar, editar ou excluir conteúdos.
      </p>
      <ul className="mt-6 space-y-3">
        {consent.scope.map((scope) => (
          <li className="flex gap-3 rounded-2xl bg-[#f6f7f9] px-4 py-3 text-sm" key={scope}>
            <span aria-hidden className="mt-0.5 text-[#2a9d62]">✓</span>
            <span>{SCOPE_LABELS[scope] || scope}</span>
          </li>
        ))}
      </ul>
      {!entitlement.instagramConnected && consent.scope.includes("metrics:read") ? (
        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          Você pode conectar agora. As métricas ficarão disponíveis depois que conectar o Instagram na Data2Content.
        </p>
      ) : null}
      <p className="mt-5 text-xs leading-5 text-black/45">
        Você pode revogar esta conexão a qualquer momento. A assinatura será revalidada em todas as chamadas.
      </p>
      <form action="/api/mcp/oauth/authorize" className="mt-7 grid gap-3 sm:grid-cols-2" method="post">
        <input type="hidden" name="request" value={requestToken} />
        <button className="rounded-xl border border-black/15 px-5 py-3 text-sm font-semibold" name="decision" value="deny">
          Cancelar
        </button>
        <button className="rounded-xl bg-[#17191d] px-5 py-3 text-sm font-semibold text-white" name="decision" value="approve">
          Autorizar conexão
        </button>
      </form>
    </Shell>
  );
}
