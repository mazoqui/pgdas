/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const root = import.meta.dirname;

/**
 * The built page may talk to its own origin only: the PDF is read in the browser
 * and this makes it impossible for any code on the page to send it anywhere.
 * Build only - the dev server injects inline scripts the policy would block.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

const withCsp = (html: string, csp: string) =>
  html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);

const contentSecurityPolicy = (): Plugin => ({
  name: "content-security-policy",
  apply: "build",
  transformIndexHtml: (html) => withCsp(html, CSP),
});

/**
 * `npm run build:single`: everything in one HTML file that works opened from disk
 * (file://) or from any host. Its scripts are all inline, so instead of 'self' the
 * policy allows exactly those scripts, by hash, and no connection at all.
 */
const SINGLE_FILE_NAME = "pgdas.html";

const singleFileExtras = (): Plugin[] => [
  {
    // The files of public/ are not copied in this build: inline the two the page uses.
    name: "single-file-public",
    // "pre": before Vite rewrites the paths to "./theme.js" and the replaces below miss.
    transformIndexHtml: {
      order: "pre",
      handler: (html) => {
        const theme = readFileSync(path.join(root, "public/theme.js"), "utf8").trim();
        const icon = readFileSync(path.join(root, "public/favicon.svg")).toString("base64");
        const inlined = html
          .replace('<script src="/theme.js"></script>', `<script>\n${theme}\n</script>`)
          .replace('href="/favicon.svg"', `href="data:image/svg+xml;base64,${icon}"`);
        if (/(src|href)="\/(theme\.js|favicon\.svg)"/.test(inlined)) throw new Error("index.html: public file not inlined");
        return inlined;
      },
    },
  },
  {
    // After vite-plugin-singlefile has inlined the bundle, so the hashes are of the final scripts.
    name: "single-file-csp",
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const page = bundle["index.html"];
        if (!page || page.type !== "asset") return;
        let html = String(page.source);
        const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(
          ([, code]) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`,
        );
        const csp = [
          "default-src 'none'",
          `script-src ${hashes.join(" ")}`,
          "style-src 'unsafe-inline'",
          "img-src data: blob:",
          "font-src data:",
          "connect-src 'none'",
          "form-action 'none'",
          "base-uri 'none'",
          "object-src 'none'",
        ].join("; ");
        html = withCsp(html, csp);
        delete bundle["index.html"];
        this.emitFile({ type: "asset", fileName: SINGLE_FILE_NAME, source: html });
      },
    },
  },
];

export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(single ? [viteSingleFile({ removeViteModuleLoader: true }), ...singleFileExtras()] : [contentSecurityPolicy()]),
    ],
    resolve: { alias: { "@": path.resolve(root, "./src") } },
    build: single ? { outDir: "dist-single", copyPublicDir: false } : undefined,
    test: { environment: "node" },
  };
});
