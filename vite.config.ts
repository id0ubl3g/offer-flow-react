import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { linkPreview } from "./dev/linkPreview";

export default defineConfig({
  plugins: [react(), linkPreview()],
  server: {
    port: 5173,
    allowedHosts: [".ngrok-free.app"],
    proxy: {
      "/api": {
        target: "https://offerflow.duckdns.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
