/* Seção 05 — a superfície extra. Só o Claude: conectar a D2C no ChatGPT via MCP
   exige plano caro e excluiria quase todo criador, então o ChatGPT volta quando
   o app estiver aprovado.
   Uma troca só, e sobre algo que as seções 03 e 04 não entregaram — repetir a
   pauta e a publi aqui era dizer a mesma coisa três vezes na mesma página. */

const MCP_URL = "https://data2content.ai/api/mcp";

const OTHER_PROMPTS = [
  "quais tendências do momento combinam com o que eu falo",
  "me dá o roteiro da pauta dessa semana no meu tom",
];

const STEPS = [
  {
    n: "01",
    title: "Tenha sua assinatura ativa.",
    detail: "Essa conexão está disponível para quem assina a D2C.",
  },
  {
    n: "02",
    title: "Adicione o conector no Claude.",
    detail:
      "No Claude, entre em Configurações, abra Conectores e escolha adicionar um conector personalizado. Cole este endereço:",
    code: MCP_URL,
  },
  {
    n: "03",
    title: "Autorize com sua conta Data2Content.",
    detail: "Pronto. A partir daí é só perguntar.",
  },
];

export function ClaudeConnection() {
  return (
    <section
      className="d2c-v6-section d2c-v6-section--cream d2c-v6-claude"
      id="no-claude"
      data-landing-section="claude"
    >
      <div className="d2c-v6-shell">
        <div className="d2c-v6-head d2c-v6-reveal">
          <span className="d2c-v6-label">a qualquer hora</span>
          <h2 className="d2c-v6-title">Pergunte à D2C dentro do Claude.</h2>
          <p className="d2c-v6-lead">
            Você conecta sua conta uma vez. Depois, pergunta o que quiser, quando quiser, e a
            resposta é baseada nos seus próprios posts.
          </p>
        </div>

        <div className="d2c-v6-claude__grid">
          <div className="d2c-v6-claude__chat d2c-v6-reveal">
            {/* Rótulo fora do balão e cauda no canto de quem fala: é o que faz
                a troca ler como conversa em vez de dois cartões empilhados. */}
            <div className="d2c-v6-turn d2c-v6-turn--you">
              <span className="d2c-v6-turn__who">você · planejamento</span>
              <p className="d2c-v6-bubble">monta meu plano de postagem do mês olhando meus horários</p>
            </div>

            <div className="d2c-v6-turn d2c-v6-turn--d2c">
              <span className="d2c-v6-turn__who">data2content</span>
              <p className="d2c-v6-bubble">
                Montei um calendário com [N] posts, nos dias e horários em que o seu público
                costuma responder melhor. Quer que eu ajuste para postar menos vezes por semana?
              </p>
            </div>

            <div className="d2c-v6-claude__more">
              <span className="d2c-v6-label">e também</span>
              <ul>
                {OTHER_PROMPTS.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="d2c-v6-claude__setup d2c-v6-reveal">
            <span className="d2c-v6-label">como conectar</span>
            <ol className="d2c-v6-claude__steps">
              {STEPS.map((step) => (
                <li className="d2c-v6-step" key={step.n}>
                  <span className="d2c-v6-step__n">{step.n}</span>
                  <span className="d2c-v6-step__t">{step.title}</span>
                  <span className="d2c-v6-step__d">{step.detail}</span>
                  {step.code && <code className="d2c-v6-step__code">{step.code}</code>}
                </li>
              ))}
            </ol>
            <p className="d2c-v6-claude__note">
              Você não precisa conectar o Instagram para usar a D2C no Claude.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
