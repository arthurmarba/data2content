/** @jest-environment node */
import { getInstagramConnectionDetails } from "@/app/lib/instagram/db/userActions";
import { comparePublicInstagramCreators, getPublicInstagramCreator } from "./publicInstagramResearch";

jest.mock("@/app/lib/instagram/db/userActions", () => ({ getInstagramConnectionDetails: jest.fn() }));
const connection = jest.mocked(getInstagramConnectionDetails);
const request = jest.fn();
const originalFetch = global.fetch;
const payload = () => ({ id: "999", access_token: "nao-retornar", business_discovery: {
  id: "123", username: "concorrente", followers_count: 1000, media_count: 90, email: "nao-retornar",
  media: { data: [
    { id: "p1", like_count: 100, comments_count: 10, view_count: 2000 },
    { id: "p2", like_count: 50 },
    { id: "p3", like_count: 0, comments_count: 0 },
  ], paging: { next: "https://graph.facebook.com/?access_token=nao-retornar" } },
} });

beforeEach(() => {
  jest.clearAllMocks(); global.fetch = request;
  connection.mockResolvedValue({ accountId: "999", accessToken: "token-privado" });
  request.mockResolvedValue({ ok: true, status: 200, json: async () => payload() });
});
afterAll(() => { global.fetch = originalFetch; });

it("consulta somente com a conexão do solicitante e retorna uma lista explícita de campos públicos", async () => {
  const result = await getPublicInstagramCreator("admin-id", { username: "@Concorrente" });
  expect(connection).toHaveBeenCalledWith("admin-id");
  const [url, options] = request.mock.calls[0];
  expect(url).toContain("https://graph.facebook.com/v26.0/999?");
  expect(url).not.toContain("token-privado");
  expect(options).toMatchObject({ headers: { Authorization: "Bearer token-privado" }, cache: "no-store", redirect: "error" });
  expect(JSON.stringify(result)).not.toMatch(/nao-retornar|token-privado|"999"|paging|email/);
  expect(result.creator.id).toBe("instagram-public:123");
  expect(result.coverage).toMatchObject({ returnedPosts: 3, completeHistory: false });
});

it("não transforma ausência em zero nem usa posts incompletos na taxa de engajamento", async () => {
  const result = await getPublicInstagramCreator("admin-id", { username: "concorrente" });
  expect(result.posts[1]?.comments).toBeNull();
  expect(result.summary.publicInteractions).toEqual({ availablePosts: 2, total: 110, mean: 55 });
  expect(result.summary.meanPublicEngagementByFollowersPercent).toBe(5.5);
  expect(result.summary.views).toEqual({ availablePosts: 1, total: 2000, mean: 2000 });
});

it("declara mídia e taxa indisponíveis quando a Meta omite esses dados", async () => {
  request.mockResolvedValueOnce({ ok: true, json: async () => ({ business_discovery: { id: "123", username: "concorrente", followers_count: 0 } }) });
  const result = await getPublicInstagramCreator("admin-id", { username: "concorrente" });
  expect(result.coverage.mediaAvailable).toBe(false);
  expect(result.summary.meanPublicEngagementByFollowersPercent).toBeNull();
  expect(result.summary.publicInteractions.total).toBeNull();
});

it.each(["evil){email}", "https://instagram.com/alguem/", "a".repeat(31)])("recusa entrada inválida antes de acessar a conexão: %s", async username => {
  await expect(getPublicInstagramCreator("admin-id", { username })).rejects.toThrow();
  expect(connection).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
});

it("não consulta a Meta sem conexão do administrador", async () => {
  connection.mockResolvedValueOnce(null);
  await expect(getPublicInstagramCreator("admin-id", { username: "concorrente" })).rejects.toMatchObject({ code: "instagram_connection_required" });
  expect(request).not.toHaveBeenCalled();
});

it.each([[190, "instagram_reauthorization_required"], [10, "instagram_public_permission_required"], [4, "instagram_public_rate_limited"], [100, "instagram_public_query_rejected"]])("traduz erro %s sem revelar mensagem bruta da Meta", async (code, expected) => {
  request.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { code, message: "segredo-do-provedor" } }) });
  await expect(getPublicInstagramCreator("admin-id", { username: "concorrente" })).rejects.toMatchObject({ code: expected, message: expect.not.stringContaining("segredo-do-provedor") });
});

it("oculta erros de rede e recusa resposta de outro perfil", async () => {
  request.mockRejectedValueOnce(new Error("token-privado"));
  await expect(getPublicInstagramCreator("admin-id", { username: "concorrente" })).rejects.toMatchObject({ code: "instagram_public_api_unavailable" });
  await expect(getPublicInstagramCreator("admin-id", { username: "outro" })).rejects.toMatchObject({ code: "instagram_public_profile_unavailable" });
});

it("mostra a cobertura parcial da comparação sem omitir o perfil que falhou", async () => {
  const result = await comparePublicInstagramCreators("admin-id", { usernames: ["concorrente", "outro"] });
  expect(result.coverage).toEqual({ requestedCreators: 2, availableCreators: 1, commonTimeWindow: false });
  expect(result.creators[1]).toMatchObject({ username: "outro", error: { code: "instagram_public_profile_unavailable" } });
});

it("recusa duplicatas e excesso de perfis antes de consultar", async () => {
  await expect(comparePublicInstagramCreators("admin-id", { usernames: ["@Concorrente", "concorrente"] })).rejects.toThrow();
  await expect(comparePublicInstagramCreators("admin-id", { usernames: ["a", "b", "c", "d"] })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
