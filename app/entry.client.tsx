// Client entry. Same as React Router's default, plus the PostHog provider. PostHog itself is initialized after
// hydration (root.tsx), so nothing it injects into the document can race React's hydration of <html>.
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

startTransition(() => {
  hydrateRoot(
    document,
    <PostHogProvider client={posthog}>
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    </PostHogProvider>,
    {
      // Hydration mismatches and other errors React recovers from on its own. Keep them visible with the
      // component stack, and send them on once PostHog is up, so a report from the wild says where it happened.
      onRecoverableError(error, info) {
        console.error("React recovered from an error", error, info.componentStack);
        if (posthog.__loaded) posthog.captureException(error instanceof Error ? error : new Error(String(error)), { recoverable: true, component_stack: info.componentStack ?? "" });
      },
    },
  );
});
