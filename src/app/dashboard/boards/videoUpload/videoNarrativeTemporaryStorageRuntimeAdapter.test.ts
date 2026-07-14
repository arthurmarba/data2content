import { S3Client } from "@aws-sdk/client-s3";
import {
  resolveVideoNarrativeTemporaryStorageInput,
  deleteVideoNarrativeTemporaryStorageObject,
} from "./videoNarrativeTemporaryStorageRuntimeAdapter";
import { writeLocalVideoNarrativeTemporaryUpload } from "./videoNarrativeLocalTemporaryUploadStore";

describe("videoNarrativeTemporaryStorageRuntimeAdapter", () => {
  const baseEnv = {
    VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "cloudflare_r2",
    VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT: "https://test.r2.cloudflarestorage.com",
    VIDEO_NARRATIVE_TEMP_STORAGE_REGION: "auto",
    VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET: "d2c-temp",
    VIDEO_NARRATIVE_TEMP_STORAGE_ACCESS_KEY_ID: "key",
    VIDEO_NARRATIVE_TEMP_STORAGE_SECRET_ACCESS_KEY: "secret",
    VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB: "300",
  };

  const baseInput = {
    uploadSessionId: "session-123",
    objectKey: "test-video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1024,
  };

  describe("resolveVideoNarrativeTemporaryStorageInput", () => {
    it("retorna provider_not_configured quando provider falta", async () => {
      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: baseInput,
        env: { ...baseEnv, VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: undefined },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe("provider_not_configured");
        expect(res.issues[0].code).toBe("provider_disabled");
      }
    });

    it("retorna missing_storage_adapter quando provider nao e suportado", async () => {
      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: baseInput,
        env: { ...baseEnv, VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "google_cloud_storage" },
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe("missing_storage_adapter");
        expect(res.issues[0].code).toBe("unsupported_provider");
      }
    });

    it("rejeita objectKey vazio", async () => {
      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: { ...baseInput, objectKey: "" },
        env: baseEnv,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe("object_not_found");
        expect(res.issues[0].code).toBe("empty_object_key");
      }
    });

    it("rejeita mimeType nao suportado", async () => {
      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: { ...baseInput, mimeType: "image/jpeg" },
        env: baseEnv,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe("unsupported_mime_type");
        expect(res.issues[0].code).toBe("invalid_mime_type");
      }
    });

    it("rejeita sizeBytes acima do limite", async () => {
      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: { ...baseInput, sizeBytes: 350 * 1024 * 1024 }, // 350MB
        env: baseEnv,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe("object_too_large");
        expect(res.issues[0].code).toBe("exceeds_max_size");
      }
    });

    it("rejeita o ContentLength real acima de 300MB antes de baixar o body", async () => {
      const transformToByteArray = jest.fn();
      const fakeS3Client = {
        send: jest.fn().mockResolvedValue({
          ContentLength: 300 * 1024 * 1024 + 1,
          Body: { transformToByteArray },
        }),
      } as unknown as S3Client;

      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: { ...baseInput, sizeBytes: 1024 },
        env: baseEnv,
        s3Client: fakeS3Client,
      });

      expect(res).toEqual(expect.objectContaining({ ok: false, status: "object_too_large" }));
      expect(transformToByteArray).not.toHaveBeenCalled();
    });

    it("aceita e streama vídeo acima de 100MB quando o limite central permite 300MB", async () => {
      const { Readable } = await import("node:stream");
      const { readFile, unlink } = await import("node:fs/promises");
      const payload = Buffer.from("conteudo-simulado-de-video-145mb");
      const fakeS3Client = {
        send: jest.fn().mockResolvedValue({
          Body: Readable.from([payload]),
        }),
      } as unknown as S3Client;

      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: { ...baseInput, sizeBytes: 145 * 1024 * 1024 },
        env: baseEnv,
        s3Client: fakeS3Client,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.status).toBe("ready");
        expect(res.geminiInput.bytes).toBeUndefined();
        expect(res.geminiInput.filePath).toEqual(expect.stringContaining("d2c-r2-video-"));
        const written = await readFile(res.geminiInput.filePath!);
        expect(written.equals(payload)).toBe(true);
        await unlink(res.geminiInput.filePath!).catch(() => undefined);
      }
    });

    it("retorna bytes quando S3Client funciona corretamente", async () => {
      const fakeBytes = new Uint8Array([1, 2, 3]);
      const fakeS3Client = {
        send: jest.fn().mockResolvedValue({
          Body: {
            transformToByteArray: jest.fn().mockResolvedValue(fakeBytes),
          },
        }),
      } as unknown as S3Client;

      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: baseInput,
        env: baseEnv,
        s3Client: fakeS3Client,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.status).toBe("ready");
        expect(res.geminiInput.bytes).toEqual(fakeBytes);
        expect(res.geminiInput.mimeType).toBe("video/mp4");
        expect(res.safeDebugSummary.provider).toBe("cloudflare_r2");
      }
    });

    it("streama para um arquivo temporário quando o vídeo excede o limite inline", async () => {
      const { Readable } = await import("node:stream");
      const { readFile, unlink } = await import("node:fs/promises");
      const payload = Buffer.from("conteudo-de-video-grande");
      const fakeS3Client = {
        send: jest.fn().mockResolvedValue({
          Body: Readable.from([payload]),
        }),
      } as unknown as S3Client;

      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: { ...baseInput, sizeBytes: 30 * 1024 * 1024 }, // 30MB > 14MB inline limit
        env: baseEnv,
        s3Client: fakeS3Client,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.status).toBe("ready");
        expect(res.geminiInput.bytes).toBeUndefined();
        expect(res.geminiInput.filePath).toEqual(expect.stringContaining("d2c-r2-video-"));
        // O arquivo foi escrito com o conteúdo streamado do R2.
        const written = await readFile(res.geminiInput.filePath!);
        expect(written.equals(payload)).toBe(true);
        await unlink(res.geminiInput.filePath!).catch(() => undefined);
      }
    });

    it("retorna bytes do upload temporário local em desenvolvimento", async () => {
      const sessionId = "video-temp-upload-session-local-runtime-test";
      await writeLocalVideoNarrativeTemporaryUpload({
        sessionId,
        mimeType: "video/mp4",
        bytes: Buffer.from([7, 8, 9]),
      });

      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: {
          uploadSessionId: sessionId,
          objectKey: `temporary/video-narrative/hash/${sessionId}.mp4`,
          mimeType: "video/mp4",
          sizeBytes: 3,
        },
        env: {
          NODE_ENV: "development",
          VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED: "1",
          VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB: "100",
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(Array.from(res.geminiInput.bytes ?? [])).toEqual([7, 8, 9]);
        expect(res.safeDebugSummary.provider).toBe("local_temp");
      }

      await deleteVideoNarrativeTemporaryStorageObject({
        objectKey: `temporary/video-narrative/hash/${sessionId}.mp4`,
        env: {
          NODE_ENV: "development",
          VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED: "1",
        },
      });
    });

    it("retorna download_failed quando S3Client lanca erro", async () => {
      const fakeS3Client = {
        send: jest.fn().mockRejectedValue(new Error("Network Error")),
      } as unknown as S3Client;

      const res = await resolveVideoNarrativeTemporaryStorageInput({
        input: baseInput,
        env: baseEnv,
        s3Client: fakeS3Client,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.status).toBe("download_failed");
        expect(res.issues[0].code).toBe("s3_download_error");
        expect(res.safeMessage).not.toContain("Network Error");
      }
    });
  });

  describe("deleteVideoNarrativeTemporaryStorageObject", () => {
    it("deleta corretamente via S3Client", async () => {
      const fakeS3Client = {
        send: jest.fn().mockResolvedValue({}),
      } as unknown as S3Client;

      const res = await deleteVideoNarrativeTemporaryStorageObject({
        objectKey: "test.mp4",
        env: baseEnv,
        s3Client: fakeS3Client,
      });

      expect(res).toBe(true);
      expect(fakeS3Client.send).toHaveBeenCalled();
    });

    it("retorna false quando s3 lanca erro, silenciosamente", async () => {
      const fakeS3Client = {
        send: jest.fn().mockRejectedValue(new Error("Access Denied")),
      } as unknown as S3Client;

      const res = await deleteVideoNarrativeTemporaryStorageObject({
        objectKey: "test.mp4",
        env: baseEnv,
        s3Client: fakeS3Client,
      });

      expect(res).toBe(false);
    });

    it("retorna false se provider invalido", async () => {
      const res = await deleteVideoNarrativeTemporaryStorageObject({
        objectKey: "test.mp4",
        env: { ...baseEnv, VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "none" },
      });

      expect(res).toBe(false);
    });
  });
});
