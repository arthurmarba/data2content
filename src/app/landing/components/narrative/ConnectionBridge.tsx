import { CalendarDays, HeartHandshake, MessageCircleMore, Sparkles } from "lucide-react";

const CONNECTION_STEPS = [
  {
    icon: Sparkles,
    number: "01",
    title: "A plataforma encontra",
    text: "Uma pauta faz sentido para duas narrativas.",
  },
  {
    icon: CalendarDays,
    number: "02",
    title: "A reunião aprofunda",
    text: "Histórias, repertórios e possibilidades entram na conversa.",
  },
  {
    icon: MessageCircleMore,
    number: "03",
    title: "O WhatsApp mantém vivo",
    text: "A troca continua durante a semana, até a ideia ganhar forma.",
  },
] as const;

export function ConnectionBridge() {
  return (
    <section className="d2c-connection-bridge" data-landing-section="connection-flow" aria-labelledby="connection-bridge-title">
      <div className="d2c-shell d2c-connection-bridge__inner">
        <div className="d2c-connection-bridge__statement">
          <HeartHandshake aria-hidden="true" />
          <p>O match abre a conversa.</p>
          <h2 id="connection-bridge-title">A comunidade faz a ideia acontecer.</h2>
        </div>
        <ol className="d2c-connection-bridge__steps">
          {CONNECTION_STEPS.map(({ icon: Icon, number, title, text }) => (
            <li key={number}>
              <span className="d2c-connection-bridge__number">{number}</span>
              <Icon aria-hidden="true" />
              <div><strong>{title}</strong><p>{text}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
