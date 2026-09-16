"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  UserRound,
  BriefcaseBusiness,
  Users,
  MessagesSquare,
  ArrowUpRight,
  SlidersHorizontal,
  Play,
  ChevronLeft,
  ChevronRight,
  Search,
  DollarSign,
  Video,
  Building2,
  BadgeCheck,
} from "lucide-react";
import type { DiagnosticoPageData } from "../boards/videoUpload/diagnosticoPageData";
import type { DashboardOpportunity } from "@/app/lib/campaignRadar/dashboardCatalog";
import type { LandingCreatorHighlight } from "@/types/landing";
import type { PaywallContext } from "@/types/paywall";
import type {
  RecordedMeetingCatalogItem,
  RecordedMeetingPlayback,
} from "@/app/lib/community/recordedMeetingsService";
import dynamic from "next/dynamic";
const RecordedMeetingPlayerDialog = dynamic(() => import("../recorded-meetings/RecordedMeetingPlayerDialog"));
const CollabsPinnedBoard = dynamic(() => import("../boards/CollabsPinnedBoard"), { loading: () => <p role="status">Carregando collabs…</p> });
import { COMMUNITY_PRO_JOIN_ROUTE } from "@/app/lib/communityLinks";
import { promptGroups } from "./prompts";
import { filterOpportunities } from "./opportunityFilters";
import { communityThemes, creatorThemeKeys } from "./communityThemes";

const tabs = [
  { id: "perfil", label: "Perfil", icon: UserRound },
  { id: "publis", label: "Publis", icon: BriefcaseBusiness },
  { id: "collabs", label: "Collabs", icon: Users },
  { id: "comunidade", label: "Comunidade", icon: MessagesSquare },
] as const;
type Tab = (typeof tabs)[number]["id"];
export async function readJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? "Este recurso está disponível no Pro."
        : response.status === 401
          ? "Sua sessão expirou. Entre novamente."
          : "Não foi possível carregar. Tente novamente.",
    );
  return response.json();
}
function useResource<T>(url: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    readJson<T>(url, controller.signal)
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [url, version]);
  return { data, error, retry: () => setVersion((v) => v + 1) };
}
function LoadState({ error, retry }: { error: string; retry: () => void }) {
  return error ? (
    <div role="alert" className="j-state">
      {error} <button onClick={retry}>Tentar novamente</button>
    </div>
  ) : (
    <p role="status" className="j-state">
      Carregando…
    </p>
  );
}
export function Carousel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="j-section">
      <div className="j-section-heading">
        <h2>{title}</h2>
        <div>
          <button
            aria-label={`Voltar em ${title}`}
            onClick={() =>
              ref.current?.scrollBy({
                left: -ref.current.clientWidth,
                behavior: "smooth",
              })
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label={`Avançar em ${title}`}
            onClick={() =>
              ref.current?.scrollBy({
                left: ref.current.clientWidth,
                behavior: "smooth",
              })
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div ref={ref} className="j-carousel" tabIndex={0}>
        {children}
      </div>
    </section>
  );
}
export default function JourneyWorkspace({
  data,
  profile,
  onOpenMediaKit,
  onOpenCalculator,
  onUpgrade,
  onOpenCreatorMediaKit,
}: {
  data: DiagnosticoPageData;
  profile: ReactNode;
  onOpenMediaKit: () => void;
  onOpenCalculator: () => void;
  // O assunto viaja junto: é ele que escolhe o texto do modal e o destino depois
  // do pagamento (comunidade volta para a comunidade).
  onUpgrade: (context?: PaywallContext) => void;
  onOpenCreatorMediaKit: (slug: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("perfil");
  const [promptsOpen, setPromptsOpen] = useState(false);
  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      // `tab=collabs` é o pedido de aba das telas antigas (links e retornos de checkout).
      const value = params.get("view") ?? (params.get("tab") === "collabs" ? "collabs" : null);
      if (tabs.some((t) => t.id === value)) setTab(value as Tab);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  function select(value: Tab) {
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("view", value);
    window.history.pushState(null, "", url);
    document
      .querySelector("[data-mobile-profile-scroll-container]")
      ?.scrollTo(0, 0);
  }
  return (
    <div className={`j-workspace ${tab === "collabs" ? "j-workspace-collabs" : ""}`}>
      <div className="j-content" key={tab}>
        {/* O nome do app já está na barra de abas: repetir aqui empurrava o
            título da aba para baixo sem informar nada. */}
        {tab !== "perfil" && (
          <header className="j-page-heading">
            <h1>{tabs.find((t) => t.id === tab)?.label}</h1>
          </header>
        )}
        {tab === "perfil" && (
          <>
            {profile}
            {/* Nove carrosséis de pedidos dobravam a altura do Perfil. Viram um
                card: quem quer pedir algo ao Claude abre a gaveta. */}
            <button className="j-prompts-card" onClick={() => setPromptsOpen(true)}>
              <span>Peça ao Claude</span>
              <strong>{promptCount} pedidos prontos</strong>
              <span className="j-tool-action">
                {promptGroups.length} assuntos · copiar e colar
                <ArrowUpRight size={16} aria-hidden="true" />
              </span>
            </button>
            {promptsOpen && <PromptsDetail onClose={() => setPromptsOpen(false)} />}
          </>
        )}
        {tab === "publis" && (
          <>
            <div className="j-tools">
              <button onClick={onOpenMediaKit}>
                <span>Apresente seu trabalho</span>
                <strong>Mídia kit</strong>
                <span className="j-tool-action">Abrir <ArrowUpRight size={16} aria-hidden="true" /></span>
              </button>
              <button onClick={onOpenCalculator}>
                <span>Prepare seu orçamento</span>
                <strong>Calculadora</strong>
                <span className="j-tool-action">Precificar <ArrowUpRight size={16} aria-hidden="true" /></span>
              </button>
            </div>
            <Opportunities
              isPro={data.userInfo.plan === "Pro" || data.accessState === "admin"}
              onUpgrade={onUpgrade}
            />
          </>
        )}
        {tab === "collabs" && (
          <CollabsPinnedBoard
            embedded
            compact
            onBackToPerfil={() => select("perfil")}
          />
        )}
        {tab === "comunidade" && (
          <Community
            isPro={data.userInfo.plan === "Pro" || data.accessState === "admin"}
            onUpgrade={onUpgrade}
            onOpenCreator={onOpenCreatorMediaKit}
          />
        )}
      </div>
      <nav className="j-nav" aria-label="Navegação principal">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => select(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
const promptCount = promptGroups.reduce((total, group) => total + group.prompts.length, 0);
/** Instrução que vai junto de todo pedido: o Claude responde com o que existe. */
const PROMPT_FOOTER =
  "\n\nInforme o período e quantos posts conseguiu analisar. Se faltarem dados, explique. Não invente números ou parcerias.";
const groupAnchor = (title: string) => `prompt-grupo-${promptGroups.findIndex((group) => group.title === title)}`;
/**
 * Gaveta dos pedidos ao Claude. Os dois primeiros grupos ficam em carrossel —
 * são escolha, e o carrossel mostra o pedido inteiro. Os outros sete viram
 * lista: com sete carrosséis, achar o sétimo dava sete rolagens.
 */
function PromptsDetail({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    // Focar a janela, não o primeiro botão: senão o "← Voltar" abre com o anel
    // de foco desenhado em volta, inclusive quando a pessoa tocou na tela.
    element?.focus();
    return () => element?.close();
  }, []);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copiado. Cole na sua conversa com a D2C habilitada.");
    } catch {
      setStatus("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }
  const actions = (prompt: { title: string; request: string }) => (
    <div>
      <button onClick={() => copy(`${prompt.title}\n\n${prompt.request}${PROMPT_FOOTER}`)}>
        Copiar pedido
      </button>
      <a href="https://claude.ai/new" target="_blank" rel="noreferrer">Abrir Claude ↗</a>
    </div>
  );
  return (
    <dialog ref={dialog} onCancel={onClose} className="j-publi-dialog" tabIndex={-1} aria-label="Pedidos para o Claude">
      <div className="j-workspace">
        <header className="j-kit-toolbar">
          <button onClick={onClose}>← Voltar</button>
          <strong>Peça ao Claude</strong>
          <span />
        </header>
        <div className="j-content j-prompts">
          <section className="j-meeting j-connect">
            <h2>Seu perfil dentro do Claude<span>uma vez só</span></h2>
            <p>Depois, é só escolher o pedido e colar na conversa.</p>
            <details>
              <summary>Como conectar · 4 passos<span aria-hidden="true">›</span></summary>
              {/* Números de verdade: quatro passos em sequência, não quatro bolinhas. */}
              <ol className="j-connect-steps">
                <li>No Claude, abra Personalizar → Conectores → Adicionar conector personalizado.</li>
                <li>Use o nome Data2Content e o endereço abaixo.</li>
                <li>Conecte sua conta D2C e confira as permissões.</li>
                <li>Na conversa, habilite a Data2Content em + → Conectores.</li>
              </ol>
              {/* Copiar endereço é utilidade, não ação principal: vira campo com botão pequeno. */}
              <div className="j-connect-address">
                <code>https://data2content.ai/api/mcp</code>
                <button className="j-connect-copy" onClick={() => copy("https://data2content.ai/api/mcp")}>
                  Copiar
                </button>
              </div>
            </details>
          </section>
          <p role="status" aria-live="polite">{status}</p>
          {/* Atalhos por assunto: nove grupos são muitos para rolar às cegas. */}
          <nav className="j-prompt-jumps" aria-label="Assuntos">
            {promptGroups.map((group) => (
              <a key={group.title} href={`#${groupAnchor(group.title)}`}>{group.title}</a>
            ))}
          </nav>
          {promptGroups.slice(0, 2).map((group) => (
            <section key={group.title} id={groupAnchor(group.title)}>
              <Carousel title={group.title}>
                {group.prompts.map((prompt) => (
                  <article className="j-prompt" key={prompt.title}>
                    <h3>{prompt.title}</h3>
                    <p>{prompt.request}</p>
                    <small>{prompt.scope}</small>
                    {actions(prompt)}
                  </article>
                ))}
              </Carousel>
            </section>
          ))}
          {promptGroups.slice(2).map((group) => (
            <section key={group.title} id={groupAnchor(group.title)} className="j-prompt-list">
              {/* O grupo é um bloco: soltos na página, os pedidos liam como texto corrido. */}
              <h2>{group.title} <small>· {group.prompts.length}</small></h2>
              <div className="j-prompt-rows">
                {group.prompts.map((prompt) => (
                  <details key={prompt.title}>
                    <summary>{prompt.title}<span aria-hidden="true">›</span></summary>
                    <p>{prompt.request}</p>
                    <small>{prompt.scope}</small>
                    {actions(prompt)}
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </dialog>
  );
}
const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" }) : null;
const deadlineLabel = (item: DashboardOpportunity) =>
  item.deadline ? `Inscrições até ${shortDate(item.deadline)}` : "Prazo a confirmar";
/** Novidade é dado, não enfeite: só quando o radar achou a chamada nos últimos 3 dias. */
const isNew = (item: DashboardOpportunity) =>
  Boolean(item.discoveredAt) && Date.now() - Date.parse(item.discoveredAt!) < 3 * 86400000;
/** O ícone vem do nosso domínio; se a fonte não tem site, fica a letra dela. */
function SourceIcon({ item }: { item: DashboardOpportunity }) {
  const [broken, setBroken] = useState(false);
  const letter = (item.source || item.brand || "?").slice(0, 1).toUpperCase();
  return (
    <span className="j-opportunity-icon" aria-hidden="true">
      {item.sourceId && !broken ? (
        <img src={`/api/radar/source-icon/${encodeURIComponent(item.sourceId)}`} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : letter}
    </span>
  );
}
function Opportunities({ isPro, onUpgrade }: { isPro: boolean; onUpgrade: (context?: PaywallContext) => void }) {
  const resource = useResource<{ opportunities: DashboardOpportunity[] }>(
    "/api/dashboard/opportunities",
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [source, setSource] = useState(""),
    [territory, setTerritory] = useState(""),
    [payment, setPayment] = useState(""),
    [format, setFormat] = useState(""),
    [availability, setAvailability] = useState(""),
    [order, setOrder] = useState("deadline"),
    [filters, setFilters] = useState(false);
  const items = resource.data?.opportunities ?? [],
    // Livres primeiro: com a ordem escolhida pelo criador, as trancadas
    // intercaladas faziam a lista parecer um mural de cadeados.
    visible = filterOpportunities(
      items,
      query,
      source,
      territory,
      payment,
      format,
      order,
      availability,
    ).sort((a, b) => Number(a.locked) - Number(b.locked)),
    lockedCount = visible.filter((item) => item.locked).length;
  const options = (values: string[]) =>
    Array.from(new Set(values))
      .sort()
      .map((v) => <option key={v}>{v}</option>);
  return (
    <section className="j-section" aria-label="Oportunidades">
      <div className="j-search">
        <span className="j-search-field">
          <input
            aria-label="Buscar oportunidades"
            placeholder="Marca, campanha ou tema"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search size={17} aria-hidden="true" />
        </span>
        <button
          aria-expanded={filters}
          aria-controls="j-filters"
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={17} /> Filtros
          {source || territory || format || order !== "deadline" ? " •" : ""}
        </button>
      </div>
      {/* Os dois cortes que o criador faz sempre ficam à vista; o resto mora no painel. */}
      <div className="j-quick-filters">
        {([
          ["Todas", !payment && !availability, () => { setPayment(""); setAvailability(""); }],
          ["Com cachê", payment === "paid", () => { setPayment("paid"); setAvailability(""); }],
          ["Permuta", payment === "barter", () => { setPayment("barter"); setAvailability(""); }],
          ["Encerradas", availability === "closed", () => { setAvailability("closed"); setPayment(""); }],
        ] as const).map(([label, active, apply]) => (
          <button key={label} aria-pressed={active} onClick={apply}>{label}</button>
        ))}
      </div>
      {filters && (
        <div id="j-filters" className="j-filters">
          <label>
            Plataforma
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">Todas</option>
              {options(items.map((i) => i.source))}
            </select>
          </label>
          <label>
            Território
            <select
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
            >
              <option value="">Todos</option>
              {options(items.flatMap((i) => i.territories))}
            </select>
          </label>
          <label>
            Pagamento
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="paid">Cachê confirmado</option>
              <option value="barter">Permuta</option>
              <option value="unknown">A confirmar</option>
            </select>
          </label>
          <label>
            Formato
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Todos</option>
              {options(items.flatMap((i) => i.formats))}
            </select>
          </label>
          <label>
            Situação
            <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="">Todas</option><option value="open">Prazo em aberto</option><option value="recheck">Confirmar disponibilidade</option><option value="closed">Prazo encerrado</option>
            </select>
          </label>
          <label>
            Exibir primeiro
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="deadline">Prazo mais próximo</option>
              <option value="recent">Verificadas recentemente</option>
              <option value="payment">Maior cachê confirmado</option>
            </select>
          </label>
          <button
            onClick={() => {
              setQuery("");
              setSource("");
              setTerritory("");
              setPayment("");
              setFormat("");
              setOrder("deadline");
              setAvailability("");
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
      {resource.error || !resource.data ? (
        <LoadState {...resource} />
      ) : visible.length ? (
        <div className="j-opportunities">
          {visible.map((item) => (
            <article key={item.id}>
              {isNew(item) && <span className="j-opportunity-new">Novo</span>}
              {/* O cartão inteiro é o alvo de toque: quem lê a linha quer abrir a linha. */}
              <button className="j-opportunity-open" onClick={() => setOpenId(item.id)}>
                <SourceIcon item={item} />
                <div>
                  <header className="j-opportunity-brand">
                    <strong>{item.brand || item.source}</strong>
                    {item.brand && item.brand !== item.source && <small>{item.source}</small>}
                  </header>
                  <h3 title={item.title}>{item.title}</h3>
                  {/* Pílula = dado (valor, prazo); botão = verbo. Forte só quando o pagamento está definido. */}
                  <div className="j-opportunity-pills">
                    <span className={`j-pill ${item.payment === "unknown" ? "is-soft" : "is-strong"}`} title={item.compensation}>
                      {item.payment === "unknown" ? "Cachê a confirmar" : item.compensation}
                    </span>
                    <span className="j-pill is-soft">{deadlineLabel(item)}</span>
                  </div>
                  {item.availability !== "open" && <small className={`j-opportunity-status ${item.availability === "closed" ? "is-closed" : "is-pending"}`}><i aria-hidden="true" />{item.availability === "closed" ? "Prazo encerrado" : "Confirmar disponibilidade"}</small>}
                </div>
                <i aria-hidden="true"><ChevronRight size={16} /></i>
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="j-state">
          {items.length
            ? "Nenhuma oportunidade com esses filtros."
            : "Nenhuma oportunidade revisada e aberta no momento."}
        </p>
      )}
      {/* A contagem é real: mostra o tamanho do que o Pro abre, sem número inventado. */}
      {!isPro && lockedCount > 0 && (
        <section className="j-meeting j-opportunities-locked">
          <h2>{lockedCount === 1 ? "Mais 1 publi aberta agora" : `Mais ${lockedCount} publis abertas agora`}</h2>
          <p>No Pro você abre a inscrição de todas e vê o que cada marca pede.</p>
          <button className="j-primary" onClick={() => onUpgrade("publis")}>Assinar para ver todas</button>
        </section>
      )}
      {openId && visible.some((item) => item.id === openId) && (
        <PubliDetail
          item={visible.find((item) => item.id === openId)!}
          onClose={() => setOpenId(null)}
          onUpgrade={onUpgrade}
        />
      )}
    </section>
  );
}
/**
 * Detalhe da publi em tela cheia. A D2C é o radar, não a plataforma: a inscrição
 * acontece no site de quem publicou, e a ação diz isso em vez de prometer uma
 * candidatura que não existe aqui dentro.
 */
function PubliDetail({
  item,
  onClose,
  onUpgrade,
}: {
  item: DashboardOpportunity;
  onClose: () => void;
  onUpgrade: (context?: PaywallContext) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.focus();
    return () => element?.close();
  }, []);
  const pagamento = item.payment === "paid"
    ? { valor: item.compensation, nota: "Cachê individual confirmado na chamada" }
    : item.payment === "barter"
      ? { valor: item.includesProduct ? "Permuta com produto" : "Permuta", nota: "Sem cachê em dinheiro" }
      : { valor: "Cachê a confirmar", nota: "A chamada não confirma valor individual" };
  const entregas = item.deliverables[0] ?? (item.formats.length ? item.formats.join(" · ") : null);
  return (
    <dialog ref={dialog} onCancel={onClose} className="j-publi-dialog" tabIndex={-1} aria-label="Detalhe da publi">
      <div className="j-workspace">
        <header className="j-kit-toolbar">
          <button onClick={onClose}>← Voltar</button>
          <strong>Publi</strong>
          <span />
        </header>
        <div className="j-content">
          <div className="j-publi-head">
            <SourceIcon item={item} />
            <div>
              <small>{item.brand || item.source}</small>
              <h1>{item.title}</h1>
              <span className="j-pill is-soft">{deadlineLabel(item)}</span>
            </div>
          </div>

          <div className="j-publi-facts">
            <div className="j-publi-fact">
              <span><DollarSign size={17} aria-hidden="true" /></span>
              <div><strong>{pagamento.valor}</strong><small>{pagamento.nota}</small></div>
            </div>
            {entregas && (
              <div className="j-publi-fact">
                <span><Video size={17} aria-hidden="true" /></span>
                <div><strong>{entregas}</strong><small>{item.platforms.length ? `no seu ${item.platforms.join(" e ")}` : "formato pedido pela marca"}</small></div>
              </div>
            )}
            <div className="j-publi-fact">
              <span><Building2 size={17} aria-hidden="true" /></span>
              <div><strong>{item.source}</strong><small>{item.requiresAccount ? "A inscrição exige conta na plataforma" : "Inscrição aberta no site da plataforma"}</small></div>
            </div>
            <div className="j-publi-fact">
              <span><BadgeCheck size={17} aria-hidden="true" /></span>
              <div>
                <strong>Conferida em {shortDate(item.verifiedAt)}</strong>
                <small>{item.discoveredAt ? `No radar desde ${shortDate(item.discoveredAt)}` : "Entrada no radar não registrada"}</small>
              </div>
            </div>
          </div>

          {item.locked ? (
            <section className="j-publi-block">
              <h2>O briefing fica no Pro</h2>
              <p>Assine para ler o que a marca pede, os requisitos e abrir a inscrição.</p>
            </section>
          ) : (
            <>
              {item.summary && (
                <section className="j-publi-block">
                  <h2>Sobre a oportunidade</h2>
                  <p>{item.summary}</p>
                  {item.territories.length > 0 && <div className="j-chips">{item.territories.map((t) => <span key={t}>{t}</span>)}</div>}
                </section>
              )}
              {item.requirements.length > 0 && (
                <section className="j-publi-block">
                  <h2>Requisitos da chamada</h2>
                  <ul>{item.requirements.map((value, index) => <li key={index}>{value}</li>)}</ul>
                </section>
              )}
              {item.deliverables.length > 1 && (
                <section className="j-publi-block">
                  <h2>Entregas</h2>
                  <ul>{item.deliverables.map((value, index) => <li key={index}>{value}</li>)}</ul>
                </section>
              )}
              {item.evidence.length > 0 && (
                <section className="j-publi-block j-publi-evidence">
                  <h2>O que a fonte diz</h2>
                  <p>Trechos do texto original da chamada, sem edição nossa.</p>
                  {item.evidence.slice(0, 4).map((entry, index) => <blockquote key={index}>{entry.excerpt}</blockquote>)}
                </section>
              )}
            </>
          )}

          <footer>
            {item.locked ? (
              <button className="j-primary" onClick={() => onUpgrade("publis")}>Ver com o Pro</button>
            ) : (
              <a className="j-primary" href={item.url} target="_blank" rel="noreferrer">
                {item.applicationLabel || "Ver no site da plataforma"} ↗
              </a>
            )}
            <small className="j-publi-note">A inscrição acontece no site da {item.source}.</small>
          </footer>
        </div>
      </div>
    </dialog>
  );
}
function Community({
  isPro,
  onUpgrade,
  onOpenCreator,
}: {
  isPro: boolean;
  onUpgrade: (context?: PaywallContext) => void;
  onOpenCreator: (slug: string) => void;
}) {
  const recordings = useResource<{ meetings: RecordedMeetingCatalogItem[] }>(
      "/api/dashboard/recorded-meetings",
    ),
    creators = useResource<{ creators: LandingCreatorHighlight[] }>(
      "/api/landing/casting?mode=full&surface=board",
    );
  const [query, setQuery] = useState(""),
    [theme, setTheme] = useState(""),
    [playing, setPlaying] = useState<RecordedMeetingPlayback | null>(null),
    [status, setStatus] = useState(""),
    [loading, setLoading] = useState<string | null>(null);
  async function play(id: string) {
    if (!isPro) {
      onUpgrade("recorded_meetings");
      return;
    }
    setLoading(id);
    setStatus("");
    try {
      const payload = await readJson<{ meeting: RecordedMeetingPlayback }>(
        `/api/dashboard/recorded-meetings/${encodeURIComponent(id)}/playback`,
      );
      setPlaying(payload.meeting);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setLoading(null);
    }
  }
  const all = creators.data?.creators ?? [],
    themes = communityThemes(all);
  const shown = all.filter(
    (c) =>
      (!query ||
        `${c.name} ${c.username ?? ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR"))) &&
      (!theme || creatorThemeKeys(c).includes(theme)),
  );
  return (
    <>
      {/* Descoberta primeiro: quem abre a Comunidade quer ver gente. O acesso ao
          grupo e as gravações vêm depois, quando já houve com quem se importar. */}
      <section>
        <div className="j-search">
          <input
            aria-label="Buscar criadores"
            placeholder="Buscar nome ou @perfil"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="Filtrar criadores por território"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="">Todos os territórios</option>
            {themes.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <Carousel title="Criadores da comunidade">
          {creators.error || !creators.data ? (
            <LoadState {...creators} />
          ) : shown.length ? (
            shown.map((c) => (
              <article className="j-creator" key={c.id}>
                {c.avatarUrl ? (
                  <img src={c.avatarUrl} alt={c.name} loading="lazy" />
                ) : (
                  <div className="j-avatar">{c.name.charAt(0)}</div>
                )}
                <h3>{c.name}</h3>
                <small>
                  {c.username ? `@${c.username.replace(/^@/, "")}` : "Criador D2C"}
                </small>
                {/* O território fica no filtro e no mídia kit: aqui só esticava o card. */}
                {c.mediaKitSlug && (
                  <button onClick={() => onOpenCreator(c.mediaKitSlug!)}>
                    Conhecer perfil ↗
                  </button>
                )}
              </article>
            ))
          ) : (
            <p>Nenhum criador encontrado.</p>
          )}
        </Carousel>
      </section>
      <section className="j-meeting j-community-meeting">
        <h2>Nos encontramos aqui.</h2>
        <small>Horário de Brasília</small>
        <div className="j-times">
          <div>
            <span>Segunda</span>
            <strong>17h às 19h</strong>
          </div>
          <div>
            <span>Quinta</span>
            <strong>09h30 às 11h30</strong>
          </div>
        </div>
        <div className="j-month">
          <div>
            <strong>1×</strong>
            <small>por mês</small>
          </div>
          <div>
            <b>No escritório do Grupo Dreamers</b>
            <p>
              Grupo de comunicação com atuação em Rock in Rio, The Town e
              Lollapalooza Brasil.
            </p>
            <small>Data a confirmar</small>
          </div>
        </div>
        {isPro ? (
          <a
            className="j-primary"
            href={COMMUNITY_PRO_JOIN_ROUTE}
            target="_blank"
            rel="noreferrer"
          >
            Abrir grupo da comunidade ↗
          </a>
        ) : (
          <button className="j-primary" onClick={() => onUpgrade("community")}>
            Entrar na comunidade
          </button>
        )}
        <small className="j-center">O link das reuniões fica no grupo.</small>
      </section>
      {/* A capa vem do nosso endereço: ela não revela o código do vídeo, então a
          trava do Pro segue de pé mesmo com a imagem à vista. */}
      <Carousel title="Reuniões gravadas">
        {recordings.error || !recordings.data ? (
          <LoadState {...recordings} />
        ) : recordings.data.meetings.length ? (
          recordings.data.meetings.map((m) => (
            <button
              className="j-recording"
              key={m.id}
              onClick={() => void play(m.id)}
              disabled={loading !== null}
            >
              <span className="j-recording-cover">
                <img src={m.thumbnailUrl} alt="" loading="lazy" />
                <i aria-hidden="true"><Play size={20} /></i>
              </span>
              <small>{loading === m.id ? "Abrindo…" : new Date(m.publishedAt).toLocaleDateString("pt-BR")}</small>
              <h3>{m.title}</h3>
              <small className="j-recording-action">Assistir à reunião ↗</small>
            </button>
          ))
        ) : (
          <p className="j-state">As próximas gravações aparecerão aqui.</p>
        )}
      </Carousel>
      <p role="status">{status}</p>
      <RecordedMeetingPlayerDialog
        meeting={playing}
        onClose={() => setPlaying(null)}
      />
    </>
  );
}
