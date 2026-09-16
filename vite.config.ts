import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  // posthog-js ships ESM only; bundle it into the server build so root.tsx can import the React hooks.
  ssr: { noExternal: ["posthog-js", "posthog-js/react"] },
});
