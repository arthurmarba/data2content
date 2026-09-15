import MapaSeed from '@/app/models/MapaSeed';
/** Apenas a apresentação do criador; evidências, assets e diagnósticos ficam privados. */
export async function loadMediaKitPresentation(userId: string) {
  // Falha ao ler o mapa não derruba o mídia kit: ele segue com a bio do criador.
  const map = await MapaSeed.findOne({userId}).select('mapa.narrativa_central mapa.territorios -_id').lean().catch(() => null);
  return { narrative: map?.mapa?.narrativa_central || '', territories: map?.mapa?.territorios || [] };
}

// O mídia kit é público: quem tem o link recebe o objeto do usuário inteiro.
// Contato comercial passa pelo formulário de proposta, nunca pelo e-mail da conta.
const PRIVATE_USER_FIELD = /token|password|email|stripe|checkout|whatsapp|phone|taxid|cpf|cnpj|birth|pix|bank|payout/i;

export function stripSensitiveUserFields<T extends Record<string, unknown>>(user: T): Partial<T> {
  return Object.fromEntries(Object.entries(user).filter(([key]) => key !== '__v' && !PRIVATE_USER_FIELD.test(key))) as Partial<T>;
}
