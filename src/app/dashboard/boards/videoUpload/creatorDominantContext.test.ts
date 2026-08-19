import { resolveCreatorDominantContext } from "./creatorDominantContext";

const aggregate = jest.fn();
/** ObjectId válido: com id inválido o próprio construtor lança e o teste passaria por engano. */
const USER_ID = "67eeade94db910a2c674f505";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/app/models/Metric", () => ({ __esModule: true, default: { aggregate: (...args: unknown[]) => aggregate(...args) } }));

describe("resolveCreatorDominantContext", () => {
  beforeEach(() => jest.clearAllMocks());

  it("devolve a gaveta mais frequente entre os posts do criador", async () => {
    aggregate.mockReturnValue({ exec: async () => [{ _id: "career_work", posts: 12 }] });
    await expect(resolveCreatorDominantContext(USER_ID)).resolves.toBe("career_work");
  });

  it("não responde com base em um ou dois posts", async () => {
    aggregate.mockReturnValue({ exec: async () => [{ _id: "pets", posts: 2 }] });
    await expect(resolveCreatorDominantContext(USER_ID)).resolves.toBeNull();
  });

  it("devolve null quando ainda não há post classificado", async () => {
    aggregate.mockReturnValue({ exec: async () => [] });
    await expect(resolveCreatorDominantContext(USER_ID)).resolves.toBeNull();
  });

  it("engole falha do banco — a seção some, o Perfil segue", async () => {
    aggregate.mockReturnValue({ exec: async () => { throw new Error("db down"); } });
    await expect(resolveCreatorDominantContext(USER_ID)).resolves.toBeNull();
  });
});
