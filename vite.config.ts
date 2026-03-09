import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
    },
  },
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    historyApiFallback: true,
    proxy: {
      "/vision": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/chat": {
        target: "ws://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
      // Character + tone system prompt for Video agent
      "/set-character": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/api/audio": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/api/voice-cloning": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/api/generate-title": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/audio": {
        target: "ws://127.0.0.1:8080",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Expose LLMRTC backend URL to the client
  envPrefix: ["VITE_", "VITE_LLMRTC_"],
}));
