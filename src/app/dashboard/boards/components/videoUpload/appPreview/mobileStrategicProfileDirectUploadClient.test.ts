import fs from "fs";
import path from "path";
import { uploadVideoToTemporarySignedUrl } from "./mobileStrategicProfileDirectUploadClient";

const SOURCE_PATH = path.join(__dirname, "mobileStrategicProfileDirectUploadClient.ts");

describe("mobileStrategicProfileDirectUploadClient", () => {
  const futureIso = "2099-01-01T00:00:00.000Z";

  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  function validInput(overrides: Partial<Parameters<typeof uploadVideoToTemporarySignedUrl>[0]> = {}) {
    return {
      file: new File(["video"], "vlog.mp4", { type: "video/mp4" }),
      uploadUrl: "https://signed.example.test/upload?signature=secret",
      method: "PUT" as const,
      headers: { "Content-Type": "video/mp4", "x-amz-acl": "private" },
      expiresAt: futureIso,
      ...overrides,
    };
  }

  it("rejeita uploadUrl ausente", async () => {
    const res = await uploadVideoToTemporarySignedUrl(validInput({ uploadUrl: "" }));
    expect(res.status).toBe("invalid_signed_session");
  });

  it("rejeita URL não HTTPS", async () => {
    const res = await uploadVideoToTemporarySignedUrl(validInput({ uploadUrl: "http://signed.example.test/upload" }));
    expect(res.status).toBe("invalid_signed_session");
  });

  it("permite URL HTTP localhost somente para upload local de descarte em desenvolvimento", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED = "1";
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === "x-d2c-local-temp-upload" ? "stored" : null) },
    });

    const res = await uploadVideoToTemporarySignedUrl(validInput({
      uploadUrl: "http://localhost:3000/api/dev/mobile-strategic-profile/discard-upload?signature=test",
    }));

    expect(res.status).toBe("uploaded");
    expect(global.fetch).toHaveBeenCalled();
    delete process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalNodeEnv,
      configurable: true,
    });
  });

  it("usa URL relativa para upload local e evita CORS entre localhost e 127.0.0.1", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalWindow = global.window;
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED = "1";
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
    Object.defineProperty(global, "window", {
      value: { location: { href: "http://127.0.0.1:3000/dashboard" } },
      configurable: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === "x-d2c-local-temp-upload" ? "stored" : null) },
    });

    const res = await uploadVideoToTemporarySignedUrl(validInput({
      uploadUrl: "http://localhost:3000/api/dev/mobile-strategic-profile/discard-upload?sessionId=local&signature=test",
    }));

    expect(res.status).toBe("uploaded");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/dev/mobile-strategic-profile/discard-upload?sessionId=local&signature=test",
      expect.objectContaining({ method: "PUT" }),
    );
    delete process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalNodeEnv,
      configurable: true,
    });
    Object.defineProperty(global, "window", {
      value: originalWindow,
      configurable: true,
    });
  });

  it("rejeita upload local antigo que retorna 2xx sem confirmação de arquivo gravado", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED = "1";
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "development",
      configurable: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204, headers: { get: () => null } });

    const res = await uploadVideoToTemporarySignedUrl(validInput({
      uploadUrl: "http://localhost:3000/api/dev/mobile-strategic-profile/discard-upload?signature=test",
    }));

    expect(res.ok).toBe(false);
    expect(res.status).toBe("failed");
    delete process.env.NEXT_PUBLIC_VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED;
    Object.defineProperty(process.env, "NODE_ENV", {
      value: originalNodeEnv,
      configurable: true,
    });
  });

  it("rejeita sessão expirada", async () => {
    const res = await uploadVideoToTemporarySignedUrl(validInput({ expiresAt: "2020-01-01T00:00:00.000Z" }));
    expect(res.status).toBe("expired");
  });

  it("rejeita método diferente de PUT", async () => {
    const res = await uploadVideoToTemporarySignedUrl(validInput({ method: "POST" as "PUT" }));
    expect(res.status).toBe("invalid_signed_session");
  });

  it("rejeita headers perigosos", async () => {
    const res = await uploadVideoToTemporarySignedUrl(validInput({ headers: { Authorization: "secret" } }));
    expect(res.status).toBe("invalid_signed_session");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("faz fetch PUT com body=file, headers recebidos e credentials omit quando input é válido", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
    const input = validInput();

    const res = await uploadVideoToTemporarySignedUrl(input);

    expect(global.fetch).toHaveBeenCalledWith(
      input.uploadUrl,
      expect.objectContaining({
        method: "PUT",
        headers: input.headers,
        body: input.file,
        credentials: "omit",
      }),
    );
    expect(res.status).toBe("uploaded");
    expect(res.bytesSent).toBe(input.file.size);
  });

  it("retorna uploaded em resposta 2xx", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 });
    const res = await uploadVideoToTemporarySignedUrl(validInput());
    expect(res.ok).toBe(true);
    expect(res.status).toBe("uploaded");
    expect(res.uploadedAt).toBeTruthy();
  });

  it("retorna failed em resposta 4xx/5xx sem body bruto", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: jest.fn().mockResolvedValue("secret signed failure"),
    });

    const res = await uploadVideoToTemporarySignedUrl(validInput());

    expect(res.status).toBe("failed");
    expect(res.errorMessage).toBe("Não foi possível enviar o vídeo agora.");
    expect(JSON.stringify(res)).not.toContain("secret signed failure");
  });

  it("retorna erro humano em network error sem expor uploadUrl", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("https://signed.example.test/upload?signature=secret"));

    const res = await uploadVideoToTemporarySignedUrl(validInput());

    expect(res.status).toBe("failed");
    expect(res.errorMessage).toBe("Não foi possível enviar o vídeo agora.");
    expect(res.errorMessage).not.toContain("signed.example.test");
  });

  it("não usa FileReader, object URL ou storage local", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");

    for (const forbidden of ["FileReader", "URL.createObjectURL", "localStorage", "sessionStorage"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
