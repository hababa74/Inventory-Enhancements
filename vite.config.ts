// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

if (!process.env.LOVABLE_PREVIEW_HOST) {
  process.env.LOVABLE_PREVIEW_HOST = "id-preview--429cebc2-e935-411c-a32a-c1f89a24e32a.lovable.app";
}

export default defineConfig({
	// The sandbox preview is reached through a generated public hostname.
	vite: {
		server: { allowedHosts: true },
	},
	tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
