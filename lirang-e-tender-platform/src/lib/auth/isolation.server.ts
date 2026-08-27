import { getRequest } from "@tanstack/react-start/server";

export class CrossSiteRequestError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden: cross-site request blocked");
    this.name = "CrossSiteRequestError";
  }
}

export function assertSameSiteRequest(): void {
  const request = getRequest();
  if (!request) return;
  const headers = request.headers;
  const site = headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return;

  const isTopLevelGet =
    headers.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET" &&
    headers.get("sec-fetch-dest") !== "object" &&
    headers.get("sec-fetch-dest") !== "embed";

  if (isTopLevelGet) return;
  throw new CrossSiteRequestError();
}
