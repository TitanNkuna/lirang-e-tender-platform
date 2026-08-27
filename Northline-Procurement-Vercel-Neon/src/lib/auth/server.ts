import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getRequest } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { getPglite } from "../db";
import { pgliteDialect } from "./pglite-dialect";

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

const databaseUrl = env("DATABASE_URL");
const globalRef = globalThis as typeof globalThis & { __authSecret__?: string };
function localSecret(): string {
  globalRef.__authSecret__ ??= randomBytes(32).toString("hex");
  return globalRef.__authSecret__;
}

const explicitBaseURL = env("BETTER_AUTH_URL");
const baseURL = explicitBaseURL ?? "http://localhost:8080";

/** Production + every Vercel preview / branch deploy must be trusted. */
function collectTrustedOrigins(): string[] {
  const origins = new Set<string>([
    baseURL,
    "http://localhost:8080",
    "http://127.0.0.1:8080",
  ]);
  const vercelUrl = env("VERCEL_URL"); // e.g. my-app-git-main-user.vercel.app
  if (vercelUrl) {
    origins.add(`https://${vercelUrl}`);
  }
  const vercelBranch = env("VERCEL_BRANCH_URL");
  if (vercelBranch) {
    origins.add(`https://${vercelBranch}`);
  }
  const vercelProject = env("VERCEL_PROJECT_PRODUCTION_URL");
  if (vercelProject) {
    origins.add(
      vercelProject.startsWith("http") ? vercelProject : `https://${vercelProject}`,
    );
  }
  // Extra comma-separated hosts (optional env for custom domains / previews)
  const extra = env("BETTER_AUTH_TRUSTED_ORIGINS");
  if (extra) {
    for (const part of extra.split(",")) {
      const o = part.trim();
      if (o) origins.add(o);
    }
  }
  return [...origins];
}

const trustedOrigins = collectTrustedOrigins();

const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 1 })
  : process.env.VERCEL === "1"
    ? undefined
    : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

export const auth = betterAuth({
  baseURL,
  secret: env("BETTER_AUTH_SECRET") ?? localSecret(),
  ...(database ? { database } : {}),
  trustedOrigins,
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  session: { cookieCache: { enabled: true, maxAge: 300 } },
  advanced: {
    useSecureCookies: Boolean(explicitBaseURL?.startsWith("https://")),
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: Boolean(explicitBaseURL?.startsWith("https://")),
      path: "/",
    },
  },
  plugins: [tanstackStartCookies()],
});

export const authConfigured = Boolean(database);

export async function getSessionUser() {
  const request = getRequest();
  if (!request) return null;
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
  };
}
