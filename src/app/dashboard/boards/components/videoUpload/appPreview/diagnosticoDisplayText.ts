import {
  buildData2ContentNarrativeContract,
  compactD2CNarrativeLabel,
  compactD2CNextExperiment,
  compactD2CTension,
  data2ContentTextKey,
} from "@/app/dashboard/boards/videoUpload/data2contentNarrativeContract";

export type DiagnosticoDisplayRole =
  | "narrative"
  | "pattern"
  | "hypothesis"
  | "strength"
  | "tension"
  | "experiment"
  | "execution"
  | "commercial"
  | "generic";

export type DiagnosticoDisplaySignal = {
  label: string;
  summary: string;
  evidenceCount?: number;
};

const BAD_PREFIXES = [
  /^video\s+sobre\s+uma\s+dire[cç][aã]o\s+de\s+conte[uú]do\s+ligada\s+a\s+/i,
  /^v[ií]deo\s+sobre\s+uma\s+dire[cç][aã]o\s+de\s+conte[uú]do\s+ligada\s+a\s+/i,
  /^narrativa\s+em\s+observa[cç][aã]o\s*:\s*/i,
  /^esse\s+v[ií]deo\s+comunica\s+(?:uma\s+dire[cç][aã]o\s+de\s+conte[uú]do\s+ligada\s+a\s+)?/i,
  /^este\s+v[ií]deo\s+(?:comunica|mostra|revela)\s+/i,
  /^pelo\s+v[ií]deo,\s*a\s+leitura\s+principal\s+aponta\s+para\s+/i,
  /^o\s+criador\s+(?:analisa|refor[cç]a|mostra|apresenta|comenta|explica|discute)\s+/i,
  /^a\s+creator\s+(?:analisa|refor[cç]a|mostra|apresenta|comenta|explica|discute)\s+/i,
  /^o\s+creator\s+(?:analisa|refor[cç]a|mostra|apresenta|comenta|explica|discute)\s+/i,
  /^o\s+melhor\s+caminho\s+[eé]\s+/i,
  /^territ[oó]rio\s+de\s+marca\s+poss[ií]vel\s*:\s*/i,
  /^territ[oó]rio\s+poss[ií]vel\s*:\s*/i,
];

const RAW_PATTERNS = [
  /o\s+criador\s+analisa/i,
  /esse\s+v[ií]deo\s+comunica\s+uma\s+dire[cç][aã]o/i,
  /pelo\s+v[ií]deo,\s*a\s+leitura/i,
  /cria\s+uma\s+primeira\s+pista/i,
  /entra\s+como\s+sinal\s+em\s+observa[cç][aã]o/i,
  /o\s+melhor\s+caminho\s+[eé]/i,
  /^refinar\s+a\s+abertura/i,
  /^testar\s+uma\s+abertura/i,
  /^a\s+narrativa\s+n[aã]o\s+(?:deixa|explicita|explora)/i,
];

function clean(value: string | null | undefined): string {
  let text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return "";
  for (let i = 0; i < 3; i += 1) {
    const before = text;
    for (const pattern of BAD_PREFIXES) {
      text = text.replace(pattern, "").trim();
    }
    if (before === text) break;
  }
  return text.replace(/\.{2,}$/g, ".").trim();
}

function limit(value: string, maxLength: number): string {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function hasRawPattern(value: string | null | undefined): boolean {
  const text = clean(value);
  if (!text) return true;
  return RAW_PATTERNS.some((pattern) => pattern.test(text));
}

function sameMeaning(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftKey = data2ContentTextKey(left);
  const rightKey = data2ContentTextKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function fallbackSummary(role: DiagnosticoDisplayRole, label: string): string {
  switch (role) {
    case "tension":
      return "Observe se esse ponto se repete antes de transformar em ajuste fixo.";
    case "experiment":
      return "Teste esse eixo em outro formato para entender se ele pertence ao mapa.";
    case "commercial":
      return "Território em observação; só deve avançar se fizer sentido com a narrativa.";
    case "execution":
      return "Sinal de formato, fala ou produção observado pela D2C.";
    case "hypothesis":
      return `Ainda é uma hipótese: ${label.toLowerCase()}.`;
    case "strength":
      return `Esse eixo aparece como força quando sustenta ${label.toLowerCase()}.`;
    default:
      return `O vídeo aponta para ${label.toLowerCase()} como sinal do mapa narrativo.`;
  }
}

function narrativeLabel(signal: DiagnosticoDisplaySignal): string {
  return compactD2CNarrativeLabel([signal.label, signal.summary]);
}

function displayLabel(signal: DiagnosticoDisplaySignal, role: DiagnosticoDisplayRole): string {
  if (role === "tension") return compactD2CTension([signal.label, signal.summary]);
  if (role === "experiment") return compactD2CNextExperiment([signal.label, signal.summary]);
  if (role === "commercial") return limit(clean(signal.label) || clean(signal.summary) || "Território em observação", 70);
  if (role === "execution") return limit(clean(signal.label) || "Execução em observação", 70);
  if (role === "generic") return limit(clean(signal.label) || clean(signal.summary) || "Sinal em observação", 90);
  return narrativeLabel(signal);
}

function displaySummary(
  signal: DiagnosticoDisplaySignal,
  role: DiagnosticoDisplayRole,
  label: string,
): string {
  const rawSummary = clean(signal.summary);
  const contract = buildData2ContentNarrativeContract({
    mainNarrative: label,
    whatVideoCommunicates: signal.summary,
    strategicReading: signal.summary,
  });

  const candidates = [
    rawSummary,
    contract.creatorPointOfView,
    contract.strategicThesis,
    fallbackSummary(role, label),
  ];

  for (const candidate of candidates) {
    const text = clean(candidate);
    if (!text || hasRawPattern(text) || sameMeaning(text, label)) continue;
    // Skip rawSummary when it's a dangling fragment left after prefix stripping
    // (starts with lowercase = article/preposition remainder, not a proper sentence)
    if (candidate === rawSummary && /^[a-z]/.test(text)) continue;
    return limit(text, role === "execution" ? 130 : 150);
  }

  return limit(fallbackSummary(role, label), 150);
}

export function refineDiagnosticoSignal<T extends DiagnosticoDisplaySignal>(
  signal: T,
  role: DiagnosticoDisplayRole,
): T {
  const label = displayLabel(signal, role);
  const summary = displaySummary(signal, role, label);
  return {
    ...signal,
    label,
    summary,
  };
}

export function refineDiagnosticoSignals<T extends DiagnosticoDisplaySignal>(
  signals: T[],
  role: DiagnosticoDisplayRole,
  maxItems = signals.length,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const signal of signals) {
    const refined = refineDiagnosticoSignal(signal, role);
    const key = data2ContentTextKey(refined.label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(refined);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function refineDiagnosticoNextMove(
  move: { label: string; description: string; reason?: string | null },
) {
  const label = hasRawPattern(move.label)
    ? compactD2CTension([move.label, move.description])
    : limit(move.label, 72);
  const description = hasRawPattern(move.description) || sameMeaning(move.description, label)
    ? fallbackSummary("experiment", label)
    : limit(move.description, 170);
  const reason = move.reason && !hasRawPattern(move.reason) && !sameMeaning(move.reason, description)
    ? limit(move.reason, 170)
    : null;

  return { label, description, reason };
}

export function refineDiagnosticoCardText(
  value: string | null | undefined,
  role: DiagnosticoDisplayRole = "generic",
  fallback = "Sinal em observação",
): string {
  const text = clean(value);
  if (!text || hasRawPattern(text)) {
    if (role === "tension") return compactD2CTension([text, fallback]);
    if (role === "experiment") return compactD2CNextExperiment([text, fallback]);
    if (role === "narrative" || role === "pattern" || role === "hypothesis" || role === "strength") {
      return compactD2CNarrativeLabel([text, fallback]);
    }
    return fallback;
  }
  return limit(text, role === "generic" ? 140 : 90);
}

export function refineDiagnosticoRememberedAs(
  rememberedAs: string | null | undefined,
  mainNarrativeLabel?: string | null,
): string {
  const raw = clean(rememberedAs);
  if (/bad\s+bunny|super\s+bowl/i.test(raw)) return "Vídeo sobre Bad Bunny no Super Bowl";
  if (!raw || hasRawPattern(raw) || /dire[cç][aã]o\s+de\s+conte[uú]do\s+ligada/i.test(raw)) {
    const label = compactD2CNarrativeLabel([mainNarrativeLabel, raw]);
    return `Vídeo ligado a ${label}`;
  }
  return limit(raw, 90);
}
