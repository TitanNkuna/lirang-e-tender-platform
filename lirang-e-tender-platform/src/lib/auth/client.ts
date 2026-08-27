import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const authEnabled = true;

export async function signOut(redirectTo = "/login"): Promise<void> {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message ?? "Sign-out failed");
  window.location.href = redirectTo;
}
