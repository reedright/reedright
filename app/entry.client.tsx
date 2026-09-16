// Client entry. Same as React Router's default, plus PostHog when a project token is configured.
// VITE_POSTHOG_PROJECT_TOKEN and VITE_POSTHOG_HOST are baked in at build time; without a token nothing loads.
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
if (token) {
  posthog.init(token, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    defaults: "2025-05-24",
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <PostHogProvider client={posthog}>
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    </PostHogProvider>,
  );
});
