// vite/config.dev.mjs
import { defineConfig } from "file:///C:/Users/SHASHANK/Sanyam/MinorProject/CaveVerse/client/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/SHASHANK/Sanyam/MinorProject/CaveVerse/client/node_modules/@vitejs/plugin-react/dist/index.mjs";
import tailwindcss from "file:///C:/Users/SHASHANK/Sanyam/MinorProject/CaveVerse/client/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/SHASHANK/Sanyam/MinorProject/CaveVerse/client/vite/config.dev.mjs";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var config_dev_default = defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src")
    }
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/colyseus": {
        target: "http://localhost:2567",
        ws: true,
        rewrite: (p) => p.replace(/^\/colyseus/, "")
      },
      "/livekit": {
        target: "http://localhost:7880",
        ws: true,
        rewrite: (p) => p.replace(/^\/livekit/, "")
      }
    }
  }
});
export {
  config_dev_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS9jb25maWcuZGV2Lm1qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXFNIQVNIQU5LXFxcXFNhbnlhbVxcXFxNaW5vclByb2plY3RcXFxcQ2F2ZVZlcnNlXFxcXGNsaWVudFxcXFx2aXRlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxTSEFTSEFOS1xcXFxTYW55YW1cXFxcTWlub3JQcm9qZWN0XFxcXENhdmVWZXJzZVxcXFxjbGllbnRcXFxcdml0ZVxcXFxjb25maWcuZGV2Lm1qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvU0hBU0hBTksvU2FueWFtL01pbm9yUHJvamVjdC9DYXZlVmVyc2UvY2xpZW50L3ZpdGUvY29uZmlnLmRldi5tanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XHJcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tIFwiQHRhaWx3aW5kY3NzL3ZpdGVcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCB9IGZyb20gXCJ1cmxcIjtcclxuXHJcbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICAgIGJhc2U6IFwiLi9cIixcclxuICAgIHBsdWdpbnM6IFtyZWFjdCgpLCB0YWlsd2luZGNzcygpXSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgICBhbGlhczoge1xyXG4gICAgICAgICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLi9zcmNcIiksXHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgICBob3N0OiB0cnVlLFxyXG4gICAgICAgIGFsbG93ZWRIb3N0czogdHJ1ZSxcclxuICAgICAgICBwcm94eToge1xyXG4gICAgICAgICAgICBcIi9jb2x5c2V1c1wiOiB7XHJcbiAgICAgICAgICAgICAgICB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDoyNTY3XCIsXHJcbiAgICAgICAgICAgICAgICB3czogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHJld3JpdGU6IChwKSA9PiBwLnJlcGxhY2UoL15cXC9jb2x5c2V1cy8sIFwiXCIpLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcIi9saXZla2l0XCI6IHtcclxuICAgICAgICAgICAgICAgIHRhcmdldDogXCJodHRwOi8vbG9jYWxob3N0Ojc4ODBcIixcclxuICAgICAgICAgICAgICAgIHdzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgcmV3cml0ZTogKHApID0+IHAucmVwbGFjZSgvXlxcL2xpdmVraXQvLCBcIlwiKSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVgsU0FBUyxvQkFBb0I7QUFDaFosT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTtBQUNqQixTQUFTLHFCQUFxQjtBQUorTSxJQUFNLDJDQUEyQztBQU05UixJQUFNLFlBQVksS0FBSyxRQUFRLGNBQWMsd0NBQWUsQ0FBQztBQUc3RCxJQUFPLHFCQUFRLGFBQWE7QUFBQSxFQUN4QixNQUFNO0FBQUEsRUFDTixTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLEVBQ2hDLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssS0FBSyxRQUFRLFdBQVcsUUFBUTtBQUFBLElBQ3pDO0FBQUEsRUFDSjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ0osTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsT0FBTztBQUFBLE1BQ0gsYUFBYTtBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsSUFBSTtBQUFBLFFBQ0osU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRLGVBQWUsRUFBRTtBQUFBLE1BQy9DO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDUixRQUFRO0FBQUEsUUFDUixJQUFJO0FBQUEsUUFDSixTQUFTLENBQUMsTUFBTSxFQUFFLFFBQVEsY0FBYyxFQUFFO0FBQUEsTUFDOUM7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
