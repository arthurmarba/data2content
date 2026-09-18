/** Acompanha os jobs de lote da sonda até o fim. Descartável. */
import { GoogleGenAI } from '@google/genai';
const nomes = process.argv.slice(2).filter(a => a.startsWith('batches/'));
async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '' });
  const inicio = Date.now();
  const pendentes = new Set(nomes);
  while (pendentes.size && Date.now() - inicio < 20 * 60000) {
    for (const nome of [...pendentes]) {
      const job: any = await ai.batches.get({ name: nome });
      const estado = String(job.state ?? '');
      if (/SUCCEEDED|FAILED|CANCELLED|EXPIRED/.test(estado)) {
        pendentes.delete(nome);
        const respostas = job.dest?.inlinedResponses ?? [];
        console.log(`${nome}: ${estado} após ${Math.round((Date.now() - inicio) / 1000)}s · itens=${respostas.length}`);
        for (const r of respostas.slice(0, 2)) {
          const texto = r?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
          console.log(`   resposta="${String(texto ?? '').slice(0, 60)}" erro=${JSON.stringify(r?.error ?? null).slice(0, 160)}`);
        }
      }
    }
    if (pendentes.size) await new Promise(r => setTimeout(r, 15000));
  }
  for (const nome of pendentes) console.log(`${nome}: ainda pendente após 20 min`);
  process.exit(0);
}
main();
