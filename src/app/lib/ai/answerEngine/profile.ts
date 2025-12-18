import type { ProfileSignals } from './types';

export function buildProfileSignals(profile?: any, preferences?: any): ProfileSignals {
  const signals: ProfileSignals = {
    pesquisa_bruta: profile || null,
  };

  if (Array.isArray(profile?.niches) && profile.niches.length) {
    signals.nicho = String(profile.niches[0] || '').trim() || undefined;
  }
  if (profile?.mainGoal3m) {
    signals.objetivo_primario = String(profile.mainGoal3m).trim() || undefined;
  }
  if (Array.isArray(preferences?.preferredFormats) && preferences.preferredFormats.length) {
    signals.formatos_preferidos = preferences.preferredFormats.map((f: any) => String(f)).filter(Boolean);
  } else if (Array.isArray(profile?.preferredFormats) && profile.preferredFormats.length) {
    signals.formatos_preferidos = profile.preferredFormats.map((f: any) => String(f)).filter(Boolean);
  }
  if (Array.isArray(profile?.mainPains) && profile.mainPains.length) {
    signals.dificuldades = profile.mainPains.map((p: any) => String(p)).filter(Boolean);
  }
  if (profile?.preferredAiTone || preferences?.preferredAiTone) {
    signals.tom = String(preferences?.preferredAiTone || profile?.preferredAiTone);
  }
  if (Array.isArray(profile?.stage) && profile.stage.length) {
    signals.maturidade = String(profile.stage[0]);
  }
  if (Array.isArray(profile?.constraints) && profile.constraints.length) {
    signals.restricoes = profile.constraints.map((c: any) => String(c)).filter(Boolean);
  }
  return signals;
}

export function formatMatchesPreference(formatList: string[] | undefined, preferred: string[] | undefined) {
  if (!formatList || !preferred || !preferred.length) return false;
  return formatList.some((fmt) => preferred.includes(fmt));
}
