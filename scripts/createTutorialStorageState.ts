import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { request } from "@playwright/test";

import { loginByRequestCredentials } from "../tests/e2e/auth/loginByRequest";

type ProfileName = "user" | "admin" | "livia" | "custom";

type CliOptions = {
  profile: ProfileName;
  outputPath: string | null;
  email: string | null;
  password: string | null;
  baseUrl: string;
  callbackPath: string;
  all: boolean;
};

type ProfilePreset = {
  profile: Exclude<ProfileName, "custom">;
  outputPath: string;
  emailEnv: string;
  passwordEnv: string;
  label: string;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const DEFAULT_CALLBACK_PATH = "/dashboard/chat";

const PROFILE_PRESETS: Record<Exclude<ProfileName, "custom">, ProfilePreset> = {
  user: {
    profile: "user",
    outputPath: "playwright/.auth/user.json",
    emailEnv: "E2E_EMAIL",
    passwordEnv: "E2E_PASSWORD",
    label: "sessao padrao",
  },
  admin: {
    profile: "admin",
    outputPath: "playwright/.auth/admin.json",
    emailEnv: "TUTORIAL_ADMIN_EMAIL",
    passwordEnv: "TUTORIAL_ADMIN_PASSWORD",
    label: "admin de campanhas",
  },
  livia: {
    profile: "livia",
    outputPath: "playwright/.auth/livia-linhares.json",
    emailEnv: "TUTORIAL_LIVIA_EMAIL",
    passwordEnv: "TUTORIAL_LIVIA_PASSWORD",
    label: "Livia Linhares",
  },
};

function parseCli(): CliOptions {
  const { values } = parseArgs({
    options: {
      profile: { type: "string", default: "custom" },
      output: { type: "string" },
      email: { type: "string" },
      password: { type: "string" },
      "base-url": { type: "string", default: DEFAULT_BASE_URL },
      "callback-path": { type: "string", default: DEFAULT_CALLBACK_PATH },
      all: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  const profile = String(values.profile || "custom").trim().toLowerCase();
  if (!["user", "admin", "livia", "custom"].includes(profile)) {
    throw new Error(`Perfil invalido: ${profile}. Use user, admin, livia ou custom.`);
  }

  return {
    profile: profile as ProfileName,
    outputPath: values.output ? path.resolve(process.cwd(), String(values.output).trim()) : null,
    email: values.email ? String(values.email).trim() : null,
    password: values.password ? String(values.password).trim() : null,
    baseUrl: String(values["base-url"] || DEFAULT_BASE_URL).trim().replace(/\/+$/, ""),
    callbackPath: String(values["callback-path"] || DEFAULT_CALLBACK_PATH).trim(),
    all: Boolean(values.all),
  };
}

function getCredentialsFromEnv(preset: ProfilePreset) {
  const email = process.env[preset.emailEnv]?.trim() || null;
  const password = process.env[preset.passwordEnv]?.trim() || null;
  return { email, password };
}

async function createStorageState(args: {
  label: string;
  email: string;
  password: string;
  outputPath: string;
  baseUrl: string;
  callbackPath: string;
}) {
  await mkdir(path.dirname(args.outputPath), { recursive: true });

  const context = await request.newContext({ baseURL: args.baseUrl });
  try {
    await loginByRequestCredentials(context, {
      baseURL: args.baseUrl,
      email: args.email,
      password: args.password,
      callbackPath: args.callbackPath,
    });
    await context.storageState({ path: args.outputPath });
  } finally {
    await context.dispose();
  }

  console.log(`- ${args.label}: ${args.outputPath}`);
}

async function runPreset(
  preset: ProfilePreset,
  options: Pick<CliOptions, "baseUrl" | "callbackPath">,
) {
  const { email, password } = getCredentialsFromEnv(preset);
  if (!email || !password) {
    throw new Error(
      `Credenciais ausentes para ${preset.profile}. Defina ${preset.emailEnv} e ${preset.passwordEnv} em .env.local.`,
    );
  }

  await createStorageState({
    label: preset.label,
    email,
    password,
    outputPath: path.resolve(process.cwd(), preset.outputPath),
    baseUrl: options.baseUrl,
    callbackPath: options.callbackPath,
  });
}

async function main() {
  const options = parseCli();

  if (options.all) {
    await runPreset(PROFILE_PRESETS.admin, options);
    await runPreset(PROFILE_PRESETS.livia, options);
    return;
  }

  if (options.profile === "custom") {
    if (!options.email || !options.password || !options.outputPath) {
      throw new Error(
        "Perfil custom exige --email, --password e --output para gerar o storage state.",
      );
    }

    await createStorageState({
      label: "sessao custom",
      email: options.email,
      password: options.password,
      outputPath: options.outputPath,
      baseUrl: options.baseUrl,
      callbackPath: options.callbackPath,
    });
    return;
  }

  const preset = PROFILE_PRESETS[options.profile];
  const email = options.email || getCredentialsFromEnv(preset).email;
  const password = options.password || getCredentialsFromEnv(preset).password;
  const outputPath = options.outputPath || path.resolve(process.cwd(), preset.outputPath);

  if (!email || !password) {
    throw new Error(
      `Credenciais ausentes para ${options.profile}. Use --email/--password ou defina ${preset.emailEnv} e ${preset.passwordEnv} em .env.local.`,
    );
  }

  await createStorageState({
    label: preset.label,
    email,
    password,
    outputPath,
    baseUrl: options.baseUrl,
    callbackPath: options.callbackPath,
  });
}

main().catch((error) => {
  console.error(
    `[tutorial-auth] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
