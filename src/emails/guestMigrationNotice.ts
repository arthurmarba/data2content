export function guestMigrationNotice(expiresAt: Date) {
  const date = expiresAt.toLocaleDateString('pt-BR');
  return {
    subject: 'Aviso de migração de conta',
    text: `Seu acesso como convidado terminará em ${date}. Após essa data sua conta será migrada para usuário e o valor do plano será ajustado.`,
    html: `<p>Seu acesso como convidado terminará em <strong>${date}</strong>. Após essa data sua conta será migrada para usuário e o valor do plano será ajustado.</p>`,
  };
}
