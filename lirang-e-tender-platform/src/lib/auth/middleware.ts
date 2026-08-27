import { createMiddleware } from "@tanstack/react-start";
import { assertSameSiteRequest } from "./isolation.server";
import { requireUserId } from "./verify.server";

export const authMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    assertSameSiteRequest();
    const userId = await requireUserId();
    return next({ context: { userId } });
  },
);
