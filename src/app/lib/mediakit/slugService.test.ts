import {
  buildMediaKitPublicUrl,
  buildMediaKitSlugBase,
  ensureUniqueMediaKitSlug,
  resolveMediaKitToken,
} from './slugService';
import UserModel from '@/app/models/User';
import MediaKitSlugAlias from '@/app/models/MediaKitSlugAlias';

jest.mock('@/app/models/User', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findById: jest.fn(),
  },
}));

jest.mock('@/app/models/MediaKitSlugAlias', () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mockUserFindOne = (UserModel as any).findOne as jest.Mock;
const mockUserFindById = (UserModel as any).findById as jest.Mock;
const mockAliasFindOne = (MediaKitSlugAlias as any).findOne as jest.Mock;

const queryResult = (value: any) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});

describe('slugService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindOne.mockImplementation(() => queryResult(null));
    mockUserFindById.mockImplementation(() => queryResult(null));
    mockAliasFindOne.mockImplementation(() => queryResult(null));
  });

  it('buildMediaKitSlugBase normaliza acentos e espaços', () => {
    expect(buildMediaKitSlugBase('João da Silva', 'fallback')).toBe('joao-da-silva');
  });

  it('buildMediaKitSlugBase usa fallback quando nome não gera slug', () => {
    expect(buildMediaKitSlugBase('!!!', 'usuario-1234')).toBe('usuario-1234');
  });

  it('buildMediaKitPublicUrl monta URL canônica sem barra final duplicada', () => {
    expect(buildMediaKitPublicUrl('https://data2content.ai/', 'ana-kit')).toBe(
      'https://data2content.ai/mediakit/ana-kit'
    );
  });

  it('ensureUniqueMediaKitSlug retorna base quando livre', async () => {
    mockUserFindOne.mockImplementationOnce(() => queryResult(null));
    mockAliasFindOne.mockImplementationOnce(() => queryResult(null));

    const slug = await ensureUniqueMediaKitSlug('ana-kit', '507f1f77bcf86cd799439011');
    expect(slug).toBe('ana-kit');
  });

  it('ensureUniqueMediaKitSlug evita colisão com alias e gera sufixo', async () => {
    mockUserFindOne
      .mockImplementationOnce(() => queryResult(null))
      .mockImplementationOnce(() => queryResult(null));
    mockAliasFindOne
      .mockImplementationOnce(() => queryResult({ _id: 'alias1' }))
      .mockImplementationOnce(() => queryResult(null));

    const slug = await ensureUniqueMediaKitSlug('ana-kit', '507f1f77bcf86cd799439011');
    expect(slug.startsWith('ana-kit-')).toBe(true);
  });

  it('resolveMediaKitToken resolve slug direto', async () => {
    mockUserFindOne.mockImplementationOnce(() => queryResult({ _id: 'u1', mediaKitSlug: 'ana-kit' }));

    const resolved = await resolveMediaKitToken('ana-kit');
    expect(resolved).toEqual({
      userId: 'u1',
      canonicalSlug: 'ana-kit',
      matchedByAlias: false,
    });
  });

  it('resolveMediaKitToken resolve alias para slug canônico atual', async () => {
    mockUserFindOne.mockImplementationOnce(() => queryResult(null));
    mockAliasFindOne.mockImplementationOnce(() => queryResult({ user: 'u1', canonicalSlug: 'ana-antigo' }));
    mockUserFindById.mockImplementationOnce(() => queryResult({ _id: 'u1', mediaKitSlug: 'ana-novo' }));

    const resolved = await resolveMediaKitToken('ana-antigo');
    expect(resolved).toEqual({
      userId: 'u1',
      canonicalSlug: 'ana-novo',
      matchedByAlias: true,
    });
  });
});
