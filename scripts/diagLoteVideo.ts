/** Lote COM VÍDEO no 2.5-flash: o teste que faltava. Descartável. */
import { GoogleGenAI } from '@google/genai';
async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '' });
  const enviado = await ai.files.upload({ file: 'output/modelos-cena/video-0.mp4', config: { mimeType: 'video/mp4' } });
  let arquivo: any = enviado;
  const esperaInicio = Date.now();
  while (String(arquivo.state) !== 'ACTIVE' && Date.now() - esperaInicio < 5 * 60000) {
    await new Promise(r => setTimeout(r, 5000));
    arquivo = await ai.files.get({ name: arquivo.name! });
  }
  console.log('arquivo:', arquivo.name, arquivo.state);
  if (String(arquivo.state) !== 'ACTIVE') { console.log('arquivo não ficou ativo'); process.exit(1); }

  const job: any = await ai.batches.create({
    model: 'gemini-2.5-flash',
    src: [{
      contents: [{ role: 'user', parts: [
        { text: 'Responda SÓ com JSON: {"resumo":"uma frase sobre o vídeo","fala":"os primeiros 10 segundos de fala"}' },
        { fileData: { fileUri: arquivo.uri, mimeType: 'video/mp4' } },
      ] }],
      config: { thinkingConfig: { thinkingBudget: 0 }, responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 1024 },
    }] as any,
    config: { displayName: `sonda-lote-video-${Date.now()}` },
  });
  console.log('job:', job.name, job.state);

  const inicio = Date.now();
  while (Date.now() - inicio < 25 * 60000) {
    const atual: any = await ai.batches.get({ name: job.name });
    const estado = String(atual.state ?? '');
    if (/SUCCEEDED|FAILED|CANCELLED|EXPIRED/.test(estado)) {
      const r = (atual.dest?.inlinedResponses ?? [])[0];
      console.log(`${estado} após ${Math.round((Date.now() - inicio) / 60000)} min`);
      console.log('texto:', JSON.stringify(r?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? null).slice(0, 400));
      console.log('uso:', JSON.stringify(r?.response?.usageMetadata ?? null).slice(0, 260));
      console.log('erro:', JSON.stringify(r?.error ?? null).slice(0, 240));
      // Só apaga no fim: apagar cedo foi o que estragou a prova de 14/09.
      await ai.files.delete({ name: arquivo.name! }).catch(() => {});
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 30000));
  }
  console.log('ainda pendente após 25 min · job', job.name, '· arquivo', arquivo.name, '(mantido vivo)');
  process.exit(0);
}
main().catch(e => { console.error('ERRO', e?.status ?? '', String(e?.message ?? e).slice(0, 240)); process.exit(1); });
