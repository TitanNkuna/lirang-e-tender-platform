import { betterAuth } from "better-auth";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getRequest } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { pgliteDialect } from "./pglite-dialect";

const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value || undefined;
};

const databaseUrl = env("DATABASE_URL");

const globalRef = globalThis as typeof globalThis & {
  __authSecret__?: string;
};

function localSecret(): string {
  globalRef.__authSecret__ ??= randomBytes(32).toString("hex");
  return globalRef.__authSecret__;
}

const explicitBaseURL = env("BETTER_AUTH_URL");
const baseURL = explicitBaseURL ?? "http://localhost:8080";

const trustedOrigins = [
  baseURL,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];

const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl, max: 5 })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

void ensureDbReady();

export const auth = betterAuth({
  baseURL,
  secret: env("BETTER_AUTH_SECRET") ?? localSecret(),
  database,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 300,
    },
  },
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

export const authConfigured = true;

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
