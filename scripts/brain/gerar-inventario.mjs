#!/usr/bin/env node
/**
 * Gera as notas mecânicas do cérebro (docs/brain/90 Inventário/).
 * Tudo aqui é derivado do código: rodar de novo sempre que a estrutura mudar.
 *
 *   npm run brain
 *
 * Regra: nada nesta pasta é escrito à mão — o script sobrescreve.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(ROOT, "docs", "brain", "90 Inventário");
mkdirSync(OUT, { recursive: true });

const HOJE = new Date().toISOString().slice(0, 10);
const cabecalho = (titulo, resumo) =>
  `---
gerado: automaticamente
atualizado: ${HOJE}
---

> [!warning] Nota gerada por script — não edite à mão.
> Rode \`npm run brain\` para atualizar. Fonte: \`scripts/brain/gerar-inventario.mjs\`.

# ${titulo}

${resumo}
`;

function andar(dir, filtro, achados = []) {
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return achados;
  }
  for (const nome of entradas) {
    if (nome === "node_modules" || nome === ".next" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    const st = statSync(caminho);
    if (st.isDirectory()) andar(caminho, filtro, achados);
    else if (filtro(caminho)) achados.push(caminho);
  }
  return achados;
}

const rel = (p) => relative(ROOT, p).split("\\").join("/");

/* ---------------------------------------------------------------- rotas */
function rotasDeApi() {
  const arquivos = andar(join(ROOT, "src", "app", "api"), (p) => basename(p) === "route.ts");
  const grupos = new Map();
  for (const arquivo of arquivos) {
    const url =
      "/" +
      rel(arquivo).replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
    const grupo = url.split("/")[2] ?? "(raiz)";
    const metodos = (readFileSync(arquivo, "utf8").match(
      /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
    ) ?? [])
      .map((m) => m.split(/\s+/).pop())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo).push({ url, metodos, arquivo: rel(arquivo) });
  }

  let md = cabecalho(
    "Rotas de API",
    `O back-end vive dentro do próprio Next.js: cada pasta com um \`route.ts\` vira um endereço da API.\n\n**${arquivos.length} rotas** em **${grupos.size} grupos**.`,
  );
  md += "\n## Índice\n\n";
  for (const g of [...grupos.keys()].sort())
    md += `- [${g}](#${g.toLowerCase()}) — ${grupos.get(g).length} ${grupos.get(g).length === 1 ? "rota" : "rotas"}\n`;
  for (const g of [...grupos.keys()].sort()) {
    md += `\n## ${g}\n\n| Endereço | Métodos | Arquivo |\n| --- | --- | --- |\n`;
    for (const r of grupos.get(g).sort((a, b) => a.url.localeCompare(b.url)))
      md += `| \`${r.url}\` | ${r.metodos.join(", ") || "—"} | \`${r.arquivo}\` |\n`;
  }
  writeFileSync(join(OUT, "Rotas de API.md"), md);
  return arquivos.length;
}

/* -------------------------------------------------------------- modelos */
function modelosDoBanco() {
  const arquivos = andar(
    join(ROOT, "src"),
    (p) => /\/models\/[^/]+\.ts$/.test(rel(p)) && !/\.test\.ts$/.test(p),
  );
  const linhas = [];
  for (const arquivo of arquivos) {
    const src = readFileSync(arquivo, "utf8");
    const m = src.match(/\bmodel(?:<[^>]*>)?\(\s*["']([^"']+)["']/);
    const col = src.match(/collection:\s*["']([^"']+)["']/);
    const doc = src.match(/^\s*\/\*\*\s*\n\s*\*\s*(.+?)\s*$/m);
    linhas.push({
      nome: m ? m[1] : basename(arquivo, ".ts"),
      colecao: col ? col[1] : "—",
      arquivo: rel(arquivo),
      nota: doc ? doc[1].replace(/\|/g, "/") : "",
    });
  }
  linhas.sort((a, b) => a.nome.localeCompare(b.nome));
  let md = cabecalho(
    "Modelos do banco",
    `Todo dado persistido é um modelo Mongoose. **${linhas.length} modelos.**\n\nA coluna *Coleção* só aparece quando o arquivo fixa o nome à mão; nos demais o Mongoose pluraliza o nome do modelo.`,
  );
  md += "\n| Modelo | Coleção | Arquivo |\n| --- | --- | --- |\n";
  for (const l of linhas) md += `| **${l.nome}** | \`${l.colecao}\` | \`${l.arquivo}\` |\n`;
  writeFileSync(join(OUT, "Modelos do banco.md"), md);
  return linhas.length;
}

/* -------------------------------------------------------------- comandos */
function comandosNpm() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const scripts = pkg.scripts ?? {};
  const grupos = new Map();
  for (const [nome, cmd] of Object.entries(scripts)) {
    const g = nome.includes(":") ? nome.split(":")[0] : "básicos";
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g).push({ nome, cmd });
  }
  let md = cabecalho(
    "Comandos npm",
    `**${Object.keys(scripts).length} comandos.** Os que carregam \`--env-file=.env.local\` mexem no banco de verdade — leia antes de rodar.`,
  );
  const ordem = ["básicos", ...[...grupos.keys()].filter((g) => g !== "básicos").sort()];
  for (const g of ordem) {
    if (!grupos.has(g)) continue;
    md += `\n## ${g}\n\n| Comando | O que roda |\n| --- | --- |\n`;
    for (const s of grupos.get(g).sort((a, b) => a.nome.localeCompare(b.nome)))
      md += `| \`npm run ${s.nome}\` | \`${s.cmd.replace(/\|/g, "\\|")}\` |\n`;
  }
  writeFileSync(join(OUT, "Comandos npm.md"), md);
  return Object.keys(scripts).length;
}

/* ----------------------------------------------------------------- env */
function variaveisDeAmbiente() {
  const arquivos = andar(join(ROOT, "src"), (p) => /\.(ts|tsx)$/.test(p)).concat(
    andar(join(ROOT, "scripts"), (p) => /\.(ts|mjs)$/.test(p)),
  );
  const contagem = new Map();
  for (const arquivo of arquivos) {
    for (const achado of readFileSync(arquivo, "utf8").match(/process\.env\.[A-Z0-9_]+/g) ?? []) {
      const nome = achado.replace("process.env.", "");
      contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
    }
  }
  const familia = (n) => {
    for (const p of ["NEXT_PUBLIC", "STRIPE", "MCP", "VIDEO_NARRATIVE", "QSTASH", "OPENAI",
      "GEMINI", "GOOGLE", "INSTAGRAM", "FACEBOOK", "MONGODB", "NEXTAUTH", "WHATSAPP",
      "AFFILIATE", "AGENCY", "CRON", "R2", "REDIS", "SENTRY", "YOUTUBE"])
      if (n.startsWith(p)) return p;
    return "outras";
  };
  const grupos = new Map();
  for (const [nome, n] of contagem) {
    const f = familia(nome);
    if (!grupos.has(f)) grupos.set(f, []);
    grupos.get(f).push({ nome, n });
  }
  let md = cabecalho(
    "Variáveis de ambiente",
    `**${contagem.size} variáveis** lidas pelo código. \`NEXT_PUBLIC_*\` vaza pro navegador — nunca guarde segredo aí.\n\n> As que ligam e desligam funcionalidades (\`*_ENABLED\`) moram no \`.env.local\` e **precisam ser repetidas na Vercel**, senão a funcionalidade some em produção.`,
  );
  for (const f of [...grupos.keys()].sort()) {
    md += `\n## ${f}\n\n| Variável | Usos no código |\n| --- | --- |\n`;
    for (const v of grupos.get(f).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome)))
      md += `| \`${v.nome}\` | ${v.n} |\n`;
  }
  writeFileSync(join(OUT, "Variáveis de ambiente.md"), md);
  return contagem.size;
}

/* ------------------------------------------------- cron / worker / fila */
function trabalhosEmFundo() {
  const lista = (sub) =>
    andar(join(ROOT, "src", "app", "api", sub), (p) => basename(p) === "route.ts").map((p) => ({
      nome: rel(p).replace(`src/app/api/${sub}/`, "").replace("/route.ts", ""),
      arquivo: rel(p),
    }));
  const crons = lista("cron");
  const workers = lista("worker");
  let md = cabecalho(
    "Trabalhos em fundo",
    `Duas famílias: **cron** (roda sozinho, no relógio) e **worker** (roda quando alguém enfileira um trabalho, via QStash).\n\nOs dois grupos são protegidos: cron por \`CRON_SECRET\`, worker pela assinatura do QStash.`,
  );
  md += `\n## Cron — ${crons.length} tarefas no relógio\n\n| Tarefa | Arquivo |\n| --- | --- |\n`;
  for (const c of crons.sort((a, b) => a.nome.localeCompare(b.nome)))
    md += `| \`${c.nome}\` | \`${c.arquivo}\` |\n`;
  md += `\n## Worker — ${workers.length} trabalhos enfileirados\n\n| Trabalho | Arquivo |\n| --- | --- |\n`;
  for (const w of workers.sort((a, b) => a.nome.localeCompare(b.nome)))
    md += `| \`${w.nome}\` | \`${w.arquivo}\` |\n`;
  md += `\n## Agendamento\n\nO cadastro dos horários vive em \`src/scripts/scheduleCrons.ts\` (\`npm run schedule:crons\`) e no \`vercel.json\`, quando houver.\n`;
  writeFileSync(join(OUT, "Trabalhos em fundo.md"), md);
  return crons.length + workers.length;
}

/* ------------------------------------------------------------- tamanho */
function retrato() {
  const conta = (dir, filtro) => andar(join(ROOT, dir), filtro).length;
  const ts = conta("src", (p) => /\.(ts|tsx)$/.test(p) && !/\.test\.(ts|tsx)$/.test(p));
  const testes = conta("src", (p) => /\.test\.(ts|tsx)$/.test(p));
  const comps = conta("src", (p) => /\.tsx$/.test(p) && !/\.test\.tsx$/.test(p));
  const md =
    cabecalho(
      "Retrato do projeto",
      "Os números crus, pra dar noção de escala antes de mexer em qualquer coisa.",
    ) +
    `\n| | |\n| --- | --- |\n| Arquivos de código | ${ts} |\n| Arquivos de teste | ${testes} |\n| Componentes de tela (.tsx) | ${comps} |\n| Rotas de API | ${conta("src/app/api", (p) => basename(p) === "route.ts")} |\n| Documentos em \`docs/\` | ${conta("docs", (p) => /\.md$/.test(p))} |\n\n` +
    `Um projeto deste tamanho não cabe na cabeça de ninguém — nem na da IA. Por isso o cérebro existe: [[00 Comece por aqui]].\n`;
  writeFileSync(join(OUT, "Retrato do projeto.md"), md);
  return ts;
}


/* --------------------------------------------------- links apontando pro nada */
function conferirLinks() {
  const raiz = join(ROOT, "docs", "brain");
  const notas = andar(raiz, (p) => p.endsWith(".md"));
  const nomes = new Set(notas.map((n) => basename(n, ".md")));
  const quebrados = [];
  for (const nota of notas) {
    const txt = readFileSync(nota, "utf8");
    for (const m of txt.matchAll(/\[\[([^\]|#]+)/g)) {
      const alvo = m[1].trim();
      if (!nomes.has(alvo)) quebrados.push(`${basename(nota)} → [[${alvo}]]`);
    }
  }
  return { total: notas.length, quebrados };
}

const r = {
  rotas: rotasDeApi(),
  modelos: modelosDoBanco(),
  comandos: comandosNpm(),
  variaveis: variaveisDeAmbiente(),
  trabalhos: trabalhosEmFundo(),
  arquivos: retrato(),
};
const links = conferirLinks();
console.log(
  `cérebro atualizado em docs/brain/90 Inventário/\n` +
    `  ${r.rotas} rotas · ${r.modelos} modelos · ${r.comandos} comandos · ` +
    `${r.variaveis} variáveis · ${r.trabalhos} trabalhos · ${r.arquivos} arquivos de código`,
);
if (links.quebrados.length) {
  console.log(`\naviso — ${links.quebrados.length} link(s) apontando pro nada:`);
  for (const q of links.quebrados) console.log(`  ${q}`);
} else {
  console.log(`  ${links.total} notas · todos os links resolvem`);
}
