import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
    base: "./",
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "../src"),
        },
    },
    server: {
        host: true,
        allowedHosts: true,
        proxy: {
            "/colyseus": {
                target: "http://localhost:2567",
                ws: true,
                rewrite: (p) => p.replace(/^\/colyseus/, ""),
            },
            "/livekit": {
                target: "http://localhost:7880",
                ws: true,
                rewrite: (p) => p.replace(/^\/livekit/, ""),
            },
        },
    },
});
