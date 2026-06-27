import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/jjobtub/",
  plugins: [
    react(),
    {
      name: "jjobtub-base-redirect",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const requestUrl = (req as { url?: string }).url;
          if (requestUrl === "/jjobtub") {
            res.statusCode = 302;
            res.setHeader("Location", "/jjobtub/");
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:4000",
    },
  },
});
