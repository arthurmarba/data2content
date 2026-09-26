import { resolveMetricThumbnailUrl } from './metricThumbnail';

describe('miniatura de Metric', () => {
  const cover = 'https://cdn.example/capa?oe=antigo';
  const other = 'https://cdn.example/miniatura?oe=novo';

  it.each([
    [{ thumbnailUrl: cover, coverUrl: cover }, cover],
    [{ thumbnailUrl: other, coverUrl: cover }, other],
    [{ thumbnailUrl: null, coverUrl: cover }, cover],
    [{ thumbnailUrl: other, coverUrl: null }, other],
    [{ thumbnailUrl: null, coverUrl: null }, null],
    [{ thumbnailUrl: null, coverUrl: '/api/proxy/thumbnail/capa' }, '/api/proxy/thumbnail/capa'],
  ])('mantém a imagem esperada sem acessar a Meta', (metric, expected) => {
    expect(resolveMetricThumbnailUrl(metric)).toBe(expected);
  });
});
