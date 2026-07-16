import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import mongoose from "mongoose";

const DEFAULT_BASE_URL = "http://127.0.0.1:3215";
const INSTAGRAM_WEB_APP_ID = "936619743392459";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36";

type CommunityUser = {
  name?: string | null;
  mediaKitDisplayName?: string | null;
  username?: string | null;
  mediaKitSlug: string;
};

function fetchInstagramProfilePicture(username: string): string | null {
  const endpoint = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const response = execFileSync(
    "curl",
    [
      "-sS",
      "--compressed",
      "--fail",
      "-H",
      `x-ig-app-id: ${INSTAGRAM_WEB_APP_ID}`,
      "-H",
      `User-Agent: ${USER_AGENT}`,
      endpoint,
    ],
    { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 },
  );
  const payload = JSON.parse(response);
  const profile = payload?.data?.user;
  const candidate = profile?.profile_pic_url_hd || profile?.profile_pic_url;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

function downloadImage(url: string, destination: string) {
  execFileSync(
    "curl",
    [
      "-sS",
      "-L",
      "--compressed",
      "--fail",
      "-H",
      `User-Agent: ${USER_AGENT}`,
      "-H",
      "Referer: https://www.instagram.com/",
      "-o",
      destination,
      url,
    ],
    { stdio: "pipe", maxBuffer: 5 * 1024 * 1024 },
  );
}

async function fetchExistingMediaKitAvatar(baseUrl: string, slug: string) {
  const response = await fetch(`${baseUrl}/api/mediakit/${encodeURIComponent(slug)}/avatar?sync=1`, {
    headers: { "cache-control": "no-cache" },
  });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || contentType.includes("image/svg+xml")) return null;
  return new Uint8Array(await response.arrayBuffer());
}

async function main() {
  const baseUrl = process.env.LANDING_AVATAR_SOURCE_URL || DEFAULT_BASE_URL;
  const forceSync = process.env.LANDING_AVATAR_FORCE_SYNC === "1";
  const outputDirectory = path.join(process.cwd(), "public/images/community/avatars");
  const temporaryDirectory = path.join(process.cwd(), "tmp/landing-community-avatar-sync");
  await mkdir(outputDirectory, { recursive: true });
  await mkdir(temporaryDirectory, { recursive: true });

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("MONGODB_URI não está configurada");
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB_NAME || process.env.DB_NAME || "data2content",
  });
  const users = (await mongoose.connection.collection("users")
    .find(
      { planStatus: "active", mediaKitSlug: { $exists: true, $nin: [null, ""] } },
      { projection: { name: 1, mediaKitDisplayName: 1, username: 1, mediaKitSlug: 1 } },
    )
    .sort({ mediaKitSlug: 1 })
    .toArray()) as unknown as CommunityUser[];

  const completed: string[] = [];
  const failed: Array<{ slug: string; reason: string }> = [];

  for (const user of users) {
    const slug = user.mediaKitSlug.trim();
    const username = user.username?.trim().replace(/^@/, "") || "";
    const rawPath = path.join(temporaryDirectory, `${slug}.raw`);
    const outputPath = path.join(outputDirectory, `${slug}.jpg`);

    try {
      if (!forceSync && existsSync(outputPath)) {
        completed.push(slug);
        continue;
      }

      const existing = await fetchExistingMediaKitAvatar(baseUrl, slug);
      if (existing) {
        await writeFile(rawPath, existing);
      } else {
        if (!username) throw new Error("creator sem username para atualização pública");
        const currentProfilePicture = fetchInstagramProfilePicture(username);
        if (!currentProfilePicture) throw new Error("Instagram não retornou foto de perfil");
        downloadImage(currentProfilePicture, rawPath);
      }

      execFileSync(
        "/usr/bin/sips",
        ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", "512", rawPath, "--out", outputPath],
        { stdio: "pipe" },
      );
      completed.push(slug);
    } catch (error) {
      failed.push({ slug, reason: error instanceof Error ? error.message : String(error) });
    } finally {
      await rm(rawPath, { force: true });
    }
  }

  await rm(temporaryDirectory, { recursive: true, force: true });
  await mongoose.disconnect();
  console.log(JSON.stringify({ completed, failed }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
