import Image from "next/image";

/* Seção 06 — quem conduz. A reunião é o assunto; os sócios são a credencial de
   quem conduz, não o título da seção. Os horários ao vivo ganham peso
   tipográfico real: são entrega da assinatura, não etiqueta. */

const SESSIONS = [
  {
    kind: "ao vivo",
    day: "Segunda",
    time: "17h às 19h",
    detail: "Os sócios mostram o que os dados da semana revelaram.",
  },
  {
    kind: "ao vivo",
    day: "Quinta",
    time: "9h às 11h",
    detail: "Análise dos posts de quem assina, caso por caso.",
  },
  {
    kind: "no Dreamers",
    day: "Uma vez por mês",
    time: "presencial",
    detail:
      "Os criadores se encontram pessoalmente no Dreamers, grupo de agências do Rock in Rio, Lollapalooza e The Town.",
  },
];

const PARTNERS = [
  {
    photo: "/images/community/avatars/arthur-marba.jpg",
    kicker: "Creators · dados · estratégia",
    name: "Arthur Marbá",
    bio: "Fundador da D2C e estrategista de creators. Há mais de dez anos transforma conteúdo, dados e comportamento em decisão prática.",
  },
  {
    photo: "/images/community/avatars/ronaldo-fonseca-jr.jpg",
    kicker: "Narrativas · cultura · negócios",
    name: "Ronaldo Fonseca",
    bio: "Sócio da D2C e CEO da A-Lab, do Grupo Dreamers. Conecta histórias, cultura e oportunidades de negócio.",
  },
];

export function WhoLeads() {
  return (
    <section
      className="d2c-v6-section d2c-v6-section--dark d2c-v6-leads"
      id="quem-conduz"
      data-landing-section="authority"
    >
      <div className="d2c-v6-shell">
        <div className="d2c-v6-head d2c-v6-reveal" data-leads-block="head">
          <span className="d2c-v6-label">a reunião da semana</span>
          <h2 className="d2c-v6-title">
            Alguém senta com você <span className="d2c-v6-answer__soft">para entender sua narrativa.</span>
          </h2>
          <p className="d2c-v6-lead">
            Duas vezes por semana os sócios da D2C entram ao vivo com os criadores para revisar o
            que foi postado, entender sua narrativa e o interesse da sua audiência, e ajudar a
            posicionar você para atrair marcas, serviços e engajamento. Os números entram só para
            contextualizar as tendências.
          </p>
        </div>

        <ul className="d2c-v6-sessions d2c-v6-rail d2c-v6-reveal" data-leads-block="days">
          {SESSIONS.map((session) => (
            <li className="d2c-v6-session" key={session.day + session.time}>
              <span className="d2c-v6-session__kind">{session.kind}</span>
              <b className="d2c-v6-session__when">
                {session.day}
                <span>{session.time}</span>
              </b>
              <span className="d2c-v6-session__detail">{session.detail}</span>
            </li>
          ))}
        </ul>

        <div className="d2c-v6-partners d2c-v6-rail d2c-v6-reveal" data-leads-block="people">
          {PARTNERS.map((partner) => (
            <article className="d2c-v6-partner" key={partner.name}>
              <figure>
                <Image
                  src={partner.photo}
                  alt={partner.name}
                  fill
                  sizes="(max-width: 860px) 40vw, 220px"
                />
              </figure>
              <div>
                <span className="d2c-v6-label">{partner.kicker}</span>
                <h3>{partner.name}</h3>
                <p>{partner.bio}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="d2c-v6-meetups d2c-v6-reveal">
        <div className="d2c-v6-meetups__copy">
          <span className="d2c-v6-label">os encontros</span>
          <p>
            Uma vez por mês, presencialmente no Dreamers, no Rio de Janeiro. É o grupo de
            agências dos eventos Rock in Rio, Lollapalooza e The Town, considerado o maior grupo
            independente de comunicação, entretenimento e experiência de marketing do Brasil.
          </p>
        </div>
        <div className="d2c-v6-meetups__rail">
          <figure className="d2c-v6-meetups__shot d2c-v6-meetups__shot--a">
            <Image
              src="/images/landing/v6/encontro-1.jpg"
              alt="Criadores reunidos presencialmente no Dreamers"
              width={647}
              height={420}
              sizes="(max-width: 860px) 256px, 420px"
            />
          </figure>
          <figure className="d2c-v6-meetups__shot d2c-v6-meetups__shot--b">
            <Image
              src="/images/landing/v6/encontro-2.jpg"
              alt="Encontro presencial da comunidade D2C"
              width={647}
              height={574}
              sizes="(max-width: 860px) 256px, 360px"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}
