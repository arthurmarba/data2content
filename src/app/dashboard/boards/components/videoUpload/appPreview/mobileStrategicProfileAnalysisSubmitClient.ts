type AnalysisSubmitResult = { response: Response; data: any; attempts: number };
const ENDPOINT = '/api/dashboard/mobile-strategic-profile/analyze-real';
const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(new DOMException('Acompanhamento encerrado.', 'AbortError')); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
});
async function request(url: string, init: RequestInit, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export async function findPendingVideoAnalysis(signal?: AbortSignal) {
  const { response, data } = await request(ENDPOINT, { cache: 'no-store' }, signal);
  if (!response.ok) throw new Error('Não foi possível consultar suas análises. Feche e abra novamente.');
  return data.job ?? null;
}
export async function postMobileStrategicProfileAnalysisJson(params: {
  endpoint: string; body: Record<string, unknown>; maxAttempts?: number;
  signal?: AbortSignal; onProgress?: (stage: string) => void;
}): Promise<AnalysisSubmitResult> {
  const real = params.endpoint === ENDPOINT;
  let jobId = typeof params.body.recoveryJobId === 'string' ? params.body.recoveryJobId : null;
  if (!jobId) {
    try {
      const initial = await request(params.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params.body) }, params.signal);
      if (!real || initial.response.status !== 202) return { ...initial, attempts: 1 };
      jobId = initial.data.jobId;
    } catch (error) {
      if (params.signal?.aborted || !real || typeof params.body.uploadSessionId !== 'string') throw error;
      // Resposta perdida não autoriza outra chamada de geração. Consulta a sessão.
      jobId = params.body.uploadSessionId;
    }
  }
  if (!jobId) throw new Error('Não foi possível identificar a análise.');
  const deadline = Date.now() + 8 * 60000;
  let failures = 0;
  while (Date.now() < deadline) {
    try {
      const { response, data } = await request(`${ENDPOINT}?jobId=${encodeURIComponent(jobId)}`, { cache: 'no-store' }, params.signal);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return { response, data, attempts: 1 };
        throw new Error('Consulta indisponível.');
      }
      const job = data.job;
      if (!job || job.state === 'uploading' || job.state === 'cancelled') throw Object.assign(new Error('O pedido não foi confirmado. Feche e envie o vídeo novamente.'), { terminal: true });
      failures = 0;
      params.onProgress?.(job.stage);
      if (job.state === 'completed' || job.state === 'failed') {
        return { response: new Response(null, { status: job.httpStatus || (job.state === 'completed' ? 200 : 502) }), data: { ...job.result, requestId: jobId }, attempts: 1 };
      }
    } catch (error) {
      if (params.signal?.aborted || (error as any)?.terminal) throw error;
      failures++;
      params.onProgress?.('reconnecting');
      if (failures >= 5) throw Object.assign(new Error('A conexão foi interrompida. Sua análise continua salva no servidor; abra o botão + para acompanhar.'), { retryable: false });
    }
    await delay(2500, params.signal);
  }
  throw Object.assign(new Error('A análise continua em andamento. Você pode fechar e voltar pelo botão +.'), { retryable: false });
}
