export { fetchPublicText, withCollectionBudget } from "./guardedHttp";

export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, values.length)) }, worker));
  return results;
}
