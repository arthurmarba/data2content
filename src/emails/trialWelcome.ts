export function trialWelcomeEmail({
  name,
  expiresAt,
}: {
  name?: string | null;
  expiresAt: Date;
}) {
  const formattedDate = expiresAt.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const greeting = name ? `Olá, ${name}!` : "Olá!";

  const subject = "Você desbloqueou o Plano Agência — aproveite agora";
  const ctaUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai"}/media-kit`;
  const whatsappUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.data2content.ai"}/planning/whatsapp`;

  const intro = `${greeting}\n\nVocê acabou de liberar o Modo Agência da Data2Content por tempo limitado. Durante esse período, além da comunidade aberta, você também tem acesso completo ao <Grupo VIP> — mentorias estratégicas semanais, salas reservadas e alertas premium no WhatsApp.`;

  const stepsText = [
    "- Veja o seu Mídia Kit automático com insights de desempenho.",
    "- Conecte o WhatsApp para receber alertas e ideias em tempo real.",
    "- Teste o planner com sugestões de conteúdos consistentes e criativos.",
    "- Reserve uma mentoria no Grupo VIP e veja como aplicamos estratégias avançadas ao vivo.",
  ].join("\n");

  const closing = `Esse acesso promocional expira em ${formattedDate}. Aproveite para sentir o valor do Grupo VIP: mentorias semanais, acompanhamento do Mobi e alertas que mantêm você constante.\n\nBons conteúdos!\nEquipe Data2Content`;

  const text = `${intro}\n\nComece por aqui:\n${stepsText}\n\n• Abrir o painel: ${ctaUrl}\n• Ativar o WhatsApp IA: ${whatsappUrl}\n\n${closing}`;

  const html = `
  <p>${greeting}</p>
  <p>Você acabou de liberar o <strong>Modo Agência</strong> da Data2Content por tempo limitado. Durante esse período, além da comunidade aberta, você também tem acesso completo ao <strong>Grupo VIP</strong>: mentorias estratégicas semanais, salas reservadas e alertas premium no WhatsApp.</p>
  <p>Comece por aqui:</p>
  <ul>
    <li><strong>Veja o seu Mídia Kit automático</strong> com insights frescos.</li>
    <li><strong>Conecte o WhatsApp</strong> para receber alertas e ideias em tempo real.</li>
    <li><strong>Teste o planner</strong> com sugestões de conteúdos consistentes e criativos.</li>
    <li><strong>Reserve sua mentoria VIP</strong> e traga um desafio para analisarmos ao vivo.</li>
  </ul>
  <p>
    <a href="${ctaUrl}" style="display:inline-block;padding:12px 18px;background:#6d28d9;color:#fff;border-radius:8px;font-weight:600;text-decoration:none;margin-right:8px;">
      Abrir o painel
    </a>
    <a href="${whatsappUrl}" style="display:inline-block;padding:12px 18px;border:1px solid #6d28d9;color:#6d28d9;border-radius:8px;font-weight:600;text-decoration:none;">
      Ativar WhatsApp IA
    </a>
  </p>
  <p style="font-size:13px;color:#555;">Esse acesso promocional expira em <strong>${formattedDate}</strong>. Aproveite para sentir o valor do Grupo VIP: mentorias semanais, acompanhamento do Mobi e alertas que mantêm você constante.</p>
  <p style="margin-top:16px;">Bons conteúdos!<br/>Equipe Data2Content</p>
  `;

  return { subject, text, html };
}
