import { metricThumbnailWriteFields } from './metricThumbnailWrite';
import Metric from '@/app/models/Metric';

describe('gravação de capa e miniatura de Metric', () => {
  const cover = 'https://cdn.example/capa?oe=novo';
  const different = 'https://cdn.example/miniatura?oe=novo';

  it.each([
    [cover, cover, { set: { coverUrl: cover }, unsetThumbnail: true }],
    [cover, different, { set: { coverUrl: cover, thumbnailUrl: different }, unsetThumbnail: false }],
    [cover, null, { set: { coverUrl: cover }, unsetThumbnail: false }],
    [null, different, { set: { thumbnailUrl: different }, unsetThumbnail: false }],
    [null, null, { set: {}, unsetThumbnail: false }],
  ])('preserva a informação entregue pela Meta sem apagar a URL distinta anterior', (newCover, newThumbnail, expected) => {
    expect(metricThumbnailWriteFields(newCover, newThumbnail)).toEqual(expected);
  });

  it('compara o valor que o schema gravará após remover espaços nas pontas', () => {
    expect(metricThumbnailWriteFields(` ${cover} `, cover)).toEqual({
      set: { coverUrl: cover }, unsetThumbnail: true,
    });
  });

  it('não recria miniatura vazia nos novos upserts', () => {
    expect(Metric.schema.path('thumbnailUrl').options.default).toBeUndefined();
  });
});
