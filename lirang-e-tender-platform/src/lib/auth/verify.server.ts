import { getSessionUser } from "./server";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export async function getSessionUserSafe(): Promise<VerifiedUser | null> {
  return getSessionUser();
}

export async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user.id;
}
