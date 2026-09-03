import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMcpAppBaseUrl, isMcpAdminResource } from "@/app/lib/mcp/config";
import { getMcpAccountState } from "@/app/lib/mcp/accountState";
import { getMcpAdminAuthorization } from "@/app/lib/mcp/adminAuthorization";
import { readMcpConsentRequest } from "@/app/lib/mcp/oauth/service";
import { readMcpOAuthSessionUserId } from "@/app/lib/mcp/oauth/session";
import { enforceCurrentLegalAcceptance } from "@/lib/auth/enforceCurrentLegalAcceptance";

export const metadata: Metadata = {
  title: "Conectar Data2Content ao ChatGPT",
  description: "Autorize um assistente a consultar sua conta Data2Content.",
  robots: { index: false, follow: false },
};

const SCOPE_LABELS: Record<string, string> = {
  "profile:read": "Consultar seu perfil de creator",
  "profile:write": "Registrar ou atualizar o seu Norte",
  "metrics:read": "Consultar métricas e performance do Instagram",
  "strategy:read": "Consultar análises e inteligência estratégica",
  "content:read": "Consultar posts, pautas e roteiros salvos",
  "content:write": "Salvar roteiros somente após sua confirmação explícita",
  "intelligence:read": "Consultar cenas, ganchos, assuntos, tom e padrões criativos",
  "audience:read": "Consultar dados agregados e demografia da sua audiência",
  "collabs:read": "Pesquisar criadores e sugestões de colaboração",
  "scripts:generate": "Gerar rascunhos personalizados com sua inteligência",
  "scripts:write": "Salvar roteiros somente após sua confirmação explícita",
  "campaigns:read": "Consultar oportunidades públicas revisadas para creators",
  "admin:creators:search": "Pesquisar qualquer creator cadastrado na plataforma",
  "admin:creator:read": "Consultar perfil e cobertura de dados de creators",
  "admin:content:read": "Consultar conteúdos, transcrições e classificações disponíveis",
  "admin:metrics:read": "Consultar métricas e performance de creators",
  "admin:intelligence:read": "Consultar inteligência estratégica, criativa e de tom de voz",
  "admin:audience:read": "Consultar demografia agregada da audiência",
  "admin:creators:compare": "Comparar creators e padrões de conteúdo",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-5 py-12 text-[#17191d]">
      <section className="mx-auto w-full max-w-lg rounded-3xl border border-black/10 bg-white p-7 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#17191d] text-sm font-black text-white">D2C</div>
          <div>
            <p className="text-sm font-semibold text-black/50">Data2Content</p>
            <h1 className="text-xl font-bold tracking-tight">Conectar ao ChatGPT</h1>
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
    const callbackUrl = `/mcp/authorize?${new URLSearchParams({ request: requestToken }).toString()}`;
    const login = new URL("/login", getMcpAppBaseUrl());
    login.searchParams.set("callbackUrl", callbackUrl);
    login.searchParams.set("mcp", "1");
    redirect(login.toString());
  }

  const legalCallbackUrl = `/mcp/authorize?${new URLSearchParams({ request: requestToken }).toString()}`;
  await enforceCurrentLegalAcceptance(legalCallbackUrl);

  let consent;
  try {
    consent = await readMcpConsentRequest(requestToken);
  } catch {
    return <Shell><p className="text-sm text-red-700">Esta solicitação expirou ou já foi utilizada.</p></Shell>;
  }
  if (String(consent.userId) !== userId) {
    return <Shell><p className="text-sm text-red-700">Esta solicitação pertence a outra conta Data2Content.</p></Shell>;
  }

  const adminConsent = isMcpAdminResource(consent.resource);
  const [accountState, adminAuthorization] = await Promise.all([
    adminConsent ? Promise.resolve(null) : getMcpAccountState(userId),
    adminConsent ? getMcpAdminAuthorization(userId) : Promise.resolve(null),
  ]);
  if (adminConsent && !adminAuthorization?.authorized) {
    return (
      <Shell>
        <h2 className="text-2xl font-bold tracking-tight">Acesso administrativo necessário</h2>
        <p className="mt-3 text-sm leading-6 text-black/60">
          Esta conexão permite consultar dados de outros creators da plataforma e só pode ser autorizada por uma conta administradora habilitada.
        </p>
        <form action="/api/mcp/oauth/authorize" className="mt-7" method="post">
          <input type="hidden" name="request" value={requestToken} />
          <button className="w-full rounded-xl border border-black/15 px-5 py-3 text-sm font-semibold" name="decision" value="deny">
            Cancelar conexão
          </button>
        </form>
      </Shell>
    );
  }
  if (!adminConsent && !accountState?.accountAvailable) {
    return (
      <Shell>
        <h2 className="text-2xl font-bold tracking-tight">Não foi possível validar sua conta</h2>
        <p className="mt-3 text-sm leading-6 text-black/60">
          Entre novamente na Data2Content e tente conectar sua conta ao {consent.clientName}.
        </p>
        <div className="mt-7">
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

  const canSaveScripts = consent.scope.some(
    (scope) => scope === "scripts:write" || scope === "content:write",
  );

  return (
    <Shell>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6f51d8]">Autorizar acesso</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight">{consent.clientName} quer acessar sua conta</h2>
      <p className="mt-3 text-sm leading-6 text-black/60">
        O assistente poderá consultar os dados abaixo
        {canSaveScripts ? " e salvar roteiros somente depois da sua confirmação explícita" : ""}.
        {adminConsent
          ? " Esta conexão é administrativa, somente leitura, e permite selecionar creators da plataforma."
          : " Ele não poderá publicar, editar ou excluir conteúdos do Instagram."}
      </p>
      <ul className="mt-6 space-y-3">
        {consent.scope.map((scope) => (
          <li className="flex gap-3 rounded-2xl bg-[#f6f7f9] px-4 py-3 text-sm" key={scope}>
            <span aria-hidden className="mt-0.5 text-[#2a9d62]">✓</span>
            <span>{SCOPE_LABELS[scope] || scope}</span>
          </li>
        ))}
      </ul>
      {!adminConsent && accountState && !accountState.instagramConnected && consent.scope.includes("metrics:read") ? (
        <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          Você pode conectar agora e usar os recursos disponíveis na sua conta. Algumas análises individuais também dependem da conexão opcional com o Instagram.
        </p>
      ) : null}
      <p className="mt-5 text-xs leading-5 text-black/45">
        {adminConsent
          ? "Você pode revogar esta conexão a qualquer momento. O papel de administrador será revalidado em todas as chamadas."
          : "Você pode revogar esta conexão a qualquer momento. As permissões e o estado da conta serão revalidados em todas as chamadas."}
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
