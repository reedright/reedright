import { useEffect, useRef } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { usePostHog } from "posthog-js/react";
import type { Route } from "./+types/root";
import "@fontsource-variable/source-sans-3";
import "./app.css";
import { Shell } from "./components/shell";
import { getUser } from "./lib/session.server";

export function meta() {
  return [{ title: "reedright" }];
}

/** Who is logged in, for analytics identity. Runs on every document request; no cookie means no database call. */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  return { user: user ? { id: user.id, email: user.email, name: user.name } : null };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("theme");var d=s==="dark"||(s!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`,
          }}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  const posthog = usePostHog();
  const user = loaderData.user;
  const identified = useRef<string | null>(null);
  // Initialize after hydration, never before: PostHog injects script tags into the document, and React 19
  // hydrates the whole document, so anything added early can turn into a hydration mismatch.
  useEffect(() => {
    const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
    if (!token || !posthog || posthog.__loaded) return;
    posthog.init(token, { api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com", defaults: "2026-05-30" });
  }, [posthog]);
  useEffect(() => {
    if (!posthog?.__loaded) return;
    if (user && identified.current !== user.id) {
      posthog.identify(user.id, { email: user.email, name: user.name });
      identified.current = user.id;
    } else if (!user && identified.current) {
      posthog.reset();
      identified.current = null;
    }
  }, [posthog, user]);
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const posthog = usePostHog();
  useEffect(() => {
    if (posthog?.__loaded && error instanceof Error) posthog.captureException(error);
  }, [posthog, error]);
  let message = "Something went wrong";
  let details = "";
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
    details = typeof error.data === "string" ? error.data : "";
  } else if (error instanceof Error) {
    message = error.message;
    details = import.meta.env.DEV ? (error.stack ?? "") : "";
  }
  return (
    <Shell footer={false}>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{message}</h1>
        {details && <pre className="mt-4 overflow-x-auto text-xs text-stone-500">{details}</pre>}
      </main>
    </Shell>
  );
}
