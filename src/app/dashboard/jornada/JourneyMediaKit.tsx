"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { DiagnosticoPageData } from "../boards/videoUpload/diagnosticoPageData";
import { track } from "@/lib/track";
import { useUtmAttribution } from "@/hooks/useUtmAttribution";
import { buildAffiliateSignupLink } from "@/app/lib/mediakit/affiliateLink";
import type { MediaKitViewProps } from "@/types/mediakit";
import { Carousel, readJson } from "./JourneyWorkspace";
import { idsToLabels, type CategoryType } from "@/app/lib/classification";
const number = (n: unknown) =>
  typeof n === "number" && Number.isFinite(n)
    ? new Intl.NumberFormat("pt-BR", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n)
    : "—";
// Mesmo formulário do kit antigo: a proposta chega ao criador pelo sistema,
// sem expor o e-mail da conta. Carregado só quando a marca abre o formulário.
const ProposalForm = dynamic(
  () => import("@/app/mediakit/[token]/MediaKitView").then((m) => m.PublicProposalForm),
  { ssr: false, loading: () => <p role="status">Carregando formulário…</p> },
);
export default function JourneyMediaKit({
  slug,
  owner,
  onClose,
  onEdit,
  initialData,
  inline = false,
}: {
  slug: string;
  owner?: DiagnosticoPageData;
  initialData?: MediaKitViewProps;
  inline?: boolean;
  onClose?: () => void;
  onEdit?: () => void;
}) {
  const [data, setData] = useState<MediaKitViewProps | null>(initialData ?? null),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [brand, setBrand] = useState(false),
    [status, setStatus] = useState(""),
    [proposal, setProposal] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    tracked = useRef(false),
    proposalRef = useRef<HTMLDivElement>(null);
  const { utm } = useUtmAttribution({ captureReferrer: true });
  useEffect(() => {
    const element = dialog.current;
    if (!inline) element?.showModal();
    return () => element?.close();
  }, [inline]);
  useEffect(() => {
    if (initialData) return;
    const c = new AbortController();
    setError("");
    readJson<MediaKitViewProps>(
      `/api/mediakit/${encodeURIComponent(slug)}/view-data`,
      c.signal,
    )
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [slug, version, initialData]);
  const publicUser = data?.user;
  const info = owner?.userInfo ?? {name: publicUser?.name || "", imageUrl: publicUser?.profile_picture_url || publicUser?.image || publicUser?.instagramProfilePictureUrl, handle: publicUser?.username || publicUser?.instagramUsername};
  const handle = typeof info.handle === "string" && info.handle.trim() ? info.handle.trim().replace(/^@/, "") : null;
  const affiliateCode = typeof publicUser?.affiliateCode === "string" ? publicUser.affiliateCode.trim() : "";
  const affiliateLink = !owner && affiliateCode ? buildAffiliateSignupLink({ affiliateCode, mediaKitSlug: slug, affiliateHandle: handle }) : null;
  // Visita de marca/visitante conta no funil; o dono vendo o próprio kit não.
  useEffect(() => {
    const creatorId = publicUser?._id ? String(publicUser._id) : null;
    if (owner || tracked.current || !creatorId) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1" || params.get("print") === "true") return;
    tracked.current = true;
    track("media_kit_viewed", {
      creator_id: creatorId,
      media_kit_id: slug,
      referrer: utm.referrer ?? (document.referrer || null),
      utm_source: utm.utm_source ?? null,
      utm_medium: utm.utm_medium ?? null,
      utm_campaign: utm.utm_campaign ?? null,
      utm_content: utm.utm_content ?? null,
      utm_term: utm.utm_term ?? null,
    });
    // Links antigos com ?proposal=1 abriam o formulário direto.
    if (["1", "true", "open"].includes(params.get("proposal") ?? "")) setProposal(true);
  }, [owner, publicUser?._id, slug, utm]);
  useEffect(() => {
    if (proposal) proposalRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [proposal]);
  const map = owner?.mapaSeed ?? {narrativa_central: data?.presentation?.narrative || publicUser?.biography || publicUser?.bio || "", territorios: data?.presentation?.territories || [] as string[]},
    k = data?.kpis;
  const metrics = [
    ["Visualizações por post", k?.avgViewsPerPost?.currentValue],
    ["Alcance por post", k?.avgReachPerPost?.currentValue],
    ["Interações no período", k?.totalEngagement?.currentValue],
    ["Curtidas por post", k?.avgLikesPerPost?.currentValue],
    ["Comentários por post", k?.avgCommentsPerPost?.currentValue],
    ["Compartilhamentos por post", k?.avgSharesPerPost?.currentValue],
    ["Salvamentos por post", k?.avgSavesPerPost?.currentValue],
  ] as const;
  const formats = new Map<string, { count: number; views: number[]; interactions: number[] }>();
  for (const post of data?.videos ?? []) {
    const id = Array.isArray(post.format) ? post.format[0] : post.format;
    if (!id) continue;
    const label = idsToLabels([id], "format")[0] || id;
    const group = formats.get(label) ?? { count: 0, views: [], interactions: [] };
    group.count++;
    const stats = post.stats;
    if (typeof stats?.views === "number") group.views.push(stats.views);
    const values = [stats?.likes, stats?.comments, stats?.shares, stats?.saves];
    if (values.every((v): v is number => typeof v === "number" && Number.isFinite(v))) {
      group.interactions.push(values.reduce((sum, v) => sum + v, 0));
    }
    formats.set(label, group);
  }
  const average = (values: number[]) => values.length ? number(values.reduce((sum, v) => sum + v, 0) / values.length) : "—";
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/mediakit/${encodeURIComponent(slug)}`,
      );
      setStatus("Link público copiado.");
    } catch {
      setStatus("Não foi possível copiar o link.");
    }
  }
  const Container = inline ? "div" : "dialog";
  return (
    <Container
      ref={inline ? undefined : dialog as any}
      onCancel={onClose}
      className={inline ? "j-kit-inline" : "j-kit-dialog"}
      aria-label="Mídia kit"
    >
      <div className="j-workspace">
        <header className="j-kit-toolbar">
          {onClose ? <button onClick={onClose}>← Voltar</button> : <span>data2content</span>}
          <strong>Mídia kit</strong>
          {owner && <button onClick={() => setBrand(!brand)}>
            {brand ? "Voltar à edição" : "Ver como a marca"}
          </button>}
        </header>
        <div className="j-content">
          {!brand && owner && (
            <div className="j-kit-actions">
              <button className="j-primary" onClick={() => void copy()}>Copiar link ↗</button>
              <button onClick={onEdit}>Editar</button>
              <button onClick={() => window.print()}>Salvar PDF ↗</button>
            </div>
          )}
          <p className="j-kit-notice" role="status">{status}</p>
          <section className="j-kit-hero">
            {info.imageUrl && (
              <img src={info.imageUrl} alt={info.name || "Criador"} />
            )}
            <div className="j-kit-identity">
              <strong className="j-kit-name">{info.name}</strong>
              <small>
                {info.handle
                  ? `@${info.handle.replace(/^@/, "")}`
                  : "Criador D2C"}
              </small>
              <h1>{map?.narrativa_central || "Minha narrativa"}</h1>
              {!map?.narrativa_central && (
                <p>
                  {owner ? "Complete sua narrativa para apresentar o que você quer contar." : "Conheça meu trabalho nos conteúdos abaixo."}
                </p>
              )}
              <div className="j-chips">
                {map?.territorios.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          </section>
          {error ? (
            <div role="alert">
              {error}
              <button onClick={() => setVersion((v) => v + 1)}>
                Tentar novamente
              </button>
            </div>
          ) : !data ? (
            <p role="status">Carregando métricas…</p>
          ) : (
            <>
              {data.videos.length > 0 && (
                <section className="j-kit-section"><span className="j-kit-chapter">01 · Conteúdo</span><Carousel title="Histórias que eu conto">
                  {data.videos.map((video) => (
                    <a
                      className="j-kit-post"
                      key={video._id}
                      href={video.permalink || undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {(video.thumbnailUrl ||
                        video.thumbnail_url ||
                        video.coverUrl) && (
                        <img
                          loading="lazy"
                          src={
                            (video.thumbnailUrl ||
                              video.thumbnail_url ||
                              video.coverUrl)!
                          }
                          alt="Capa do post"
                        />
                      )}
                      <p>{video.description || video.caption || "Ver post"}</p>
                      <small>
                        {number(video.stats?.views)} visualizações ↗
                      </small>
                    </a>
                  ))}
                </Carousel></section>
              )}
              {data.demographics?.follower_demographics && (
                <section className="j-kit-section">
                  <span className="j-kit-chapter">02 · Audiência</span>
                  <h2>Quem acompanha</h2>
                  <div className="j-kit-numbers">
                    <div><strong>{number(data.user?.followersCount ?? data.user?.followers_count)}</strong><small>seguidores</small></div>
                    <div><strong>{number(k?.avgViewsPerPost?.currentValue)}</strong><small>visualizações por post</small></div>
                    <div><strong>{number(k?.avgReachPerPost?.currentValue)}</strong><small>alcance por post</small></div>
                  </div>
                  <div className="j-kit-demographics">
                    {Object.entries({
                      Gênero: data.demographics.follower_demographics.gender,
                      Idade: data.demographics.follower_demographics.age,
                      Cidades: data.demographics.follower_demographics.city,
                    }).map(([label, values]) => {
                      const entries = Object.entries(values ?? {})
                        .filter(([, v]) => Number.isFinite(v) && v >= 0)
                        .sort((a, b) => b[1] - a[1]);
                      const total = entries.reduce((sum, [, v]) => sum + v, 0);
                      return entries.length ? (
                        <div key={label}>
                          <h3>{label}</h3>
                          {entries.slice(0, 5).map(([name, value]) => (
                            <div className="j-demo-row" key={name}>
                              <span>
                                {name === "F"
                                  ? "Mulheres"
                                  : name === "M"
                                    ? "Homens"
                                    : name === "U" ? "Não informado" : name}
                              </span>
                              <b>
                                {total ? Math.round((value / total) * 100) : 0}%
                              </b>
                              <div>
                                <i
                                  style={{
                                    width: `${total ? (value / total) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })}
                  </div>
                </section>
              )}
              <section className="j-kit-section">
                <span className="j-kit-chapter">03 · Desempenho</span>
                <h2>Resultados em números</h2>
                <p>Últimos 30 dias · médias por post, quando indicado.</p>
                <div className="j-kit-metrics">
                  <div>
                    <strong>
                      {number(
                        data.user?.followersCount ?? data.user?.followers_count,
                      )}
                    </strong>
                    <small>Seguidores atuais</small>
                  </div>
                  {metrics.map(([label, value]) => (
                    <div key={label}>
                      <strong>{number(value)}</strong>
                      <small>{label}</small>
                    </div>
                  ))}
                </div>
              </section>
              {data.premiumAccess?.canViewCategories !== false && formats.size > 0 && <section className="j-kit-section">
                <span className="j-kit-chapter">04 · Formatos</span>
                <h2>Formatos e resposta do público</h2>
                <p>Comparação dos posts exibidos neste mídia kit. Médias calculadas apenas com métricas disponíveis.</p>
                <div className="j-kit-formats">
                  {Array.from(formats, ([label, group]) => <article className="j-kit-format-card" key={label}>
                    <header><h3>{label}</h3><small>{group.count} {group.count === 1 ? "post" : "posts"}</small></header>
                    <dl>
                      <div><dt>Views por post</dt><dd>{average(group.views)}</dd><small>{group.views.length} com dados</small></div>
                      <div><dt>Interações por post</dt><dd>{average(group.interactions)}</dd><small>{group.interactions.length} com dados</small></div>
                    </dl>
                  </article>)}
                </div>
              </section>}
              {data.premiumAccess?.canViewCategories !== false && data.summary && (
                <section className="j-kit-section">
                  <span className="j-kit-chapter">05 · Meu jeito de criar</span>
                  <h2>O que meu conteúdo revela</h2>
                  <p>
                    Leituras dos posts disponíveis. São sinais observados, sem
                    atribuir o resultado a uma única escolha.
                  </p>
                  {[
                    data.summary.topPerformingFormat,
                    data.summary.topPerformingContext,
                    data.summary.topPerformingTone,
                  ]
                    .map((item, i) => item ? (
                      <div className="j-kit-insight" key={i}>
                        <small className="j-kit-insight-label">{["Formato em destaque", "Assunto em destaque", "Tom em destaque"][i]}</small>
                        <h3>{idsToLabels([item!.name], (["format", "context", "tone"] as CategoryType[])[i]!)[0]}</h3>
                        <span>
                          {item!.valueFormatted} · {item!.metricName}
                        </span>
                        {item!.postsCount != null && (
                          <small>{item!.postsCount} {item!.postsCount === 1 ? "post na análise" : "posts na análise"}</small>
                        )}
                      </div>
                    ) : null)}
                </section>
              )}
              {data.pricingPublished && data.packages?.length ? (
                <section className="j-kit-section">
                  <span className="j-kit-chapter">06 · Parcerias</span>
                  <h2>O que podemos criar juntos</h2>
                  {data.packages.map((pack, i) => (
                    <div className="j-kit-insight" key={i}>
                      <h3>{pack.name}</h3>
                      <p>{pack.deliverables.join(" · ")}</p>
                      <strong>
                        {pack.price.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: pack.currency || "BRL",
                        })}
                      </strong>
                    </div>
                  ))}
                </section>
              ) : <section className="j-kit-section">
                <span className="j-kit-chapter">06 · Parcerias</span>
                <h2>O que podemos criar juntos</h2>
                <p>Vamos construir uma proposta que conecte a sua marca aos assuntos que fazem parte do meu conteúdo.</p>
                <div className="j-kit-insight"><h3>Uma ideia com a minha narrativa</h3><p>Assunto, formato e entregas definidos em conversa, de acordo com a campanha.</p></div>
              </section>}
            </>
          )}
          <section className="j-meeting j-kit-contact">
            <span className="j-kit-chapter">Vamos conversar</span>
            {info.imageUrl && <img src={info.imageUrl} alt="" />}
            <h2>Sua marca tem uma história que combina com a minha?</h2>
            <p>Me conte sobre a marca, a ideia e o prazo da campanha.</p>
            {owner ? (
              <p>As marcas enviam a proposta por este espaço, sem ver o e-mail da sua conta.</p>
            ) : proposal ? (
              <div className="j-kit-proposal" ref={proposalRef}>
                <ProposalForm
                  mediaKitSlug={slug}
                  utmContext={utm}
                  pricing={data?.pricingPublished ? data.pricing : null}
                  packages={data?.pricingPublished ? data.packages ?? [] : []}
                />
              </div>
            ) : (
              <button className="j-primary" onClick={() => setProposal(true)}>
                Enviar proposta
              </button>
            )}
            {affiliateLink && (
              <a className="j-kit-affiliate" href={affiliateLink}>
                Quer um mídia kit como este? Crie o seu ↗
              </a>
            )}
          </section>
        </div>
      </div>
    </Container>
  );
}
