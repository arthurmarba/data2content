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
} from "lucide-react";
import type { DiagnosticoPageData } from "../boards/videoUpload/diagnosticoPageData";
import type { DashboardOpportunity } from "@/app/lib/campaignRadar/dashboardCatalog";
import type { LandingCreatorHighlight } from "@/types/landing";
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
  onUpgrade: () => void;
  onOpenCreatorMediaKit: (slug: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("perfil");
  useEffect(() => {
    const sync = () => {
      const value = new URLSearchParams(window.location.search).get("view");
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
    <div className="j-workspace">
      <div className="j-content" key={tab}>
        {tab !== "perfil" && (
          <header className="j-page-heading">
            <span>data2content</span>
            <h1>{tabs.find((t) => t.id === tab)?.label}</h1>
          </header>
        )}
        {tab === "perfil" && (
          <>
            {profile}
            <Prompts />
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
            <Opportunities />
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
function Prompts() {
  const [status, setStatus] = useState("");
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copiado. Cole na sua conversa com a D2C habilitada.");
    } catch {
      setStatus(
        "Não foi possível copiar. Selecione o texto e copie manualmente.",
      );
    }
  }
  return (
    <div className="j-prompts">
      <section className="j-meeting">
        <h2>Seu perfil dentro do Claude.</h2>
        <p>Configure uma vez. Depois, escolha o que quer pedir.</p>
        <details>
          <summary>Como conectar a Data2Content</summary>
          <ol>
            <li>
              No Claude, abra Personalizar → Conectores → Adicionar conector
              personalizado.
            </li>
            <li>Use o nome Data2Content e o endereço abaixo.</li>
            <li>Conecte sua conta D2C e confira as permissões.</li>
            <li>Na conversa, habilite a Data2Content em + → Conectores.</li>
          </ol>
          <code>https://data2content.ai/api/mcp</code>
          <button onClick={() => copy("https://data2content.ai/api/mcp")}>
            Copiar endereço
          </button>
        </details>
      </section>
      <p role="status" aria-live="polite">
        {status}
      </p>
      {promptGroups.map((group) => (
        <Carousel key={group.title} title={group.title}>
          {group.prompts.map((prompt) => (
            <article className="j-prompt" key={prompt.title}>
              <h3>{prompt.title}</h3>
              <p>{prompt.request}</p>
              <small>{prompt.scope}</small>
              <div>
                <button
                  onClick={() =>
                    copy(
                      prompt.title +
                        "\n\n" +
                        prompt.request +
                        "\n\nInforme o período e quantos posts conseguiu analisar. Se faltarem dados, explique. Não invente números ou parcerias.",
                    )
                  }
                >
                  Copiar pedido
                </button>
                <a
                  href="https://claude.ai/new"
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir Claude ↗
                </a>
              </div>
            </article>
          ))}
        </Carousel>
      ))}
    </div>
  );
}
function Opportunities() {
  const resource = useResource<{ opportunities: DashboardOpportunity[] }>(
    "/api/dashboard/opportunities",
  );
  const [query, setQuery] = useState(""),
    [source, setSource] = useState(""),
    [territory, setTerritory] = useState(""),
    [payment, setPayment] = useState(""),
    [format, setFormat] = useState(""),
    [availability, setAvailability] = useState(""),
    [order, setOrder] = useState("deadline"),
    [filters, setFilters] = useState(false);
  const items = resource.data?.opportunities ?? [],
    visible = filterOpportunities(
      items,
      query,
      source,
      territory,
      payment,
      format,
      order,
      availability,
    );
  const options = (values: string[]) =>
    Array.from(new Set(values))
      .sort()
      .map((v) => <option key={v}>{v}</option>);
  return (
    <section className="j-section" aria-label="Oportunidades">
      <div className="j-search">
        <input
          aria-label="Buscar oportunidades"
          placeholder="Marca, campanha ou tema"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          aria-expanded={filters}
          aria-controls="j-filters"
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={17} /> Filtros
          {source || territory || payment || format || availability || order !== "deadline"
            ? " •"
            : ""}
        </button>
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
              <header className="j-opportunity-brand">
                <span className="j-opportunity-monogram" aria-hidden="true">{(item.brand || item.source).slice(0, 1).toUpperCase()}</span>
                <div><strong>{item.brand || item.source}</strong>{item.brand && item.brand !== item.source && <small>{item.source}</small>}</div>
              </header>
              {item.availability !== "open" && <small className="j-opportunity-status">{item.availability === "closed" ? "Prazo encerrado" : "Confirmar disponibilidade"}</small>}
              <h3 title={item.title}>{item.title}</h3>
              <div className="j-opportunity-facts">
                <div><small>Pagamento</small><strong>{item.compensation}</strong></div>
                <div><small>Inscrições</small><strong>{item.deadline
                  ? `Até ${new Date(item.deadline).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
                  : "Prazo a confirmar"}</strong></div>
              </div>
              <details>
                <summary>Sobre a oportunidade <span aria-hidden="true">＋</span></summary>
                <div className="j-opportunity-detail">
                  <h4>{item.title}</h4>
                  <p>{item.summary}</p>
                  {item.formats.length > 0 && <div className="j-chips">{item.formats.map((f) => <span key={f}>{f}</span>)}</div>}
                  {(item.deliverables.length > 0 || item.requirements.length > 0) && <ul>
                    {[...item.deliverables, ...item.requirements].map((v, i) => <li key={i}>{v}</li>)}
                  </ul>}
                </div>
              </details>
              <footer>
                <a className="j-primary" href={item.url} target="_blank" rel="noreferrer">Ver oportunidade ↗</a>
              </footer>
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
    </section>
  );
}
function Community({
  isPro,
  onUpgrade,
  onOpenCreator,
}: {
  isPro: boolean;
  onUpgrade: () => void;
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
      onUpgrade();
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
    themes = communityThemes(all),
    themeLabel = new Map(themes.map((t) => [t.key, t.label]));
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
      <section className="j-meeting">
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
          <button className="j-primary" onClick={onUpgrade}>
            Entrar na comunidade
          </button>
        )}
        <small className="j-center">O link das reuniões fica no grupo.</small>
      </section>
      <Carousel title="Gravações">
        {recordings.error || !recordings.data ? (
          <LoadState {...recordings} />
        ) : recordings.data.meetings.length ? (
          recordings.data.meetings.map((m, i) => (
            <button
              className={`j-recording j-tone-${i % 3}`}
              key={m.id}
              onClick={() => void play(m.id)}
              disabled={loading !== null}
            >
              <span>
                <Play size={22} />
                {loading === m.id
                  ? "Abrindo…"
                  : new Date(m.publishedAt).toLocaleDateString("pt-BR")}
              </span>
              <h3>{m.title}</h3>
              <small>Assistir à reunião ↗</small>
            </button>
          ))
        ) : (
          <p className="j-state">As próximas gravações aparecerão aqui.</p>
        )}
      </Carousel>
      <p role="status">{status}</p>
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
                  {c.username
                    ? `@${c.username.replace(/^@/, "")}`
                    : "Criador D2C"}
                </small>
                <p>
                  {creatorThemeKeys(c)
                    .map((k) => themeLabel.get(k))
                    .filter(Boolean)
                    .slice(0, 3)
                    .join(" · ")}
                </p>
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
      <RecordedMeetingPlayerDialog
        meeting={playing}
        onClose={() => setPlaying(null)}
      />
    </>
  );
}
