export function instagramReconnectNotice(params: { name?: string | null; reason?: string }) {
  const { name, reason } = params;
  const firstName = name ? String(name).split(' ')[0] : 'Olá';

  const subject = 'Reconecte seu Instagram à Data2Content';
  const reasonLine = reason ? `Detectamos o seguinte motivo: ${reason}.` : 'Perdemos acesso às permissões do Instagram vinculadas ao seu perfil.';

  const text = `${firstName}, precisamos que você reconecte sua conta do Instagram para continuar sincronizando seus dados.
${reasonLine}

Clique no link abaixo para autorizar novamente:
https://app.data2content.ai/dashboard/instagram/connect

Se precisar de ajuda, fale conosco pelo e-mail suporte@data2content.ai.`;

  const html = `
    <p>${firstName},</p>
    <p>Precisamos que você reconecte sua conta do Instagram para que o assistente continue acompanhando seus dados.</p>
    <p>${reasonLine}</p>
    <p>
      <a href="https://app.data2content.ai/dashboard/instagram/connect" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
        Reconectar Instagram agora
      </a>
    </p>
    <p>Se precisar de ajuda, é só responder este e-mail ou falar com <a href="mailto:suporte@data2content.ai">suporte@data2content.ai</a>.</p>
    <p>— Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
