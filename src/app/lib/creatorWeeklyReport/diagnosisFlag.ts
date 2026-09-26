/**
 * Liga o diagnóstico semanal no Perfil. Desligado, nada é escrito e o Perfil
 * mostra os cartões de padrão como antes. Sem dependência de servidor: a página
 * lê no servidor e repassa o valor para a tela.
 *
 * Lê a variável direto do ambiente, sem parâmetro, de propósito: é assim que o
 * inventário do cérebro (`npm run brain`) encontra a variável.
 */
export function isCreatorWeeklyDiagnosisEnabled(): boolean {
  return process.env.CREATOR_WEEKLY_DIAGNOSIS_ENABLED === "1";
}
