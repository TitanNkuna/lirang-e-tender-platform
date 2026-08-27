import { createServerFn } from "@tanstack/react-start";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { AppProviders } from "@/components/providers";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import appCss from "../styles.css?url";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getSessionUserSafe } = await import("@/lib/auth/verify.server");
    const u = await getSessionUserSafe();
    return u ? { id: u.id, email: u.email } : null;
  } catch (err) {
    console.error("[fetchSessionUser] failed:", err);
    if (err instanceof Error) {
      console.error("[fetchSessionUser] message:", err.message);
      console.error("[fetchSessionUser] stack:", err.stack);
    }
    return null;
  }
});

export const Route = createRootRoute({
  beforeLoad: async () => ({ sessionUser: await fetchSessionUser() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: BRAND_NAME },
      {
        name: "description",
        content: BRAND_TAGLINE,
      },
      { name: "theme-color", content: "#0E0F12" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg">
        <AuthProvider>
          <AppProviders>
            <Outlet />
          </AppProviders>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
