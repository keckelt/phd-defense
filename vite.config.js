import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { defineConfig } from "vite";

const ROOT = import.meta.dirname;
const INCLUDE = /^[ \t]*<!--\s*@include\s+([^\s>]+)\s*-->[ \t]*$/gm;

// Vite config: HTML includes and trimmed reveal theme fonts

/** Replace `<!-- @include path -->` lines with that file at build time (nested includes work). */
function htmlPartials() {
  // Do not re-indent included lines, whitespace matters inside <pre>
  const expand = (html, seen = []) =>
    html.replace(INCLUDE, (_, rel) => {
      const file = resolve(ROOT, rel);
      if (seen.includes(file)) {
        throw new Error(`Circular @include: ${[...seen, file].join(" -> ")}`);
      }
      const body = readFileSync(file, "utf8").trimEnd();
      return expand(body, [...seen, file]);
    });

  return {
    name: "html-partials",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => expand(html),
    },
    configureServer(server) {
      const slides = resolve(ROOT, "slides");
      server.watcher.add(slides);
      server.watcher.on("change", (file) => {
        if (dirname(file) === slides) {
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}

/** Drop the unused inline web fonts from reveal's base theme. */
function stripUnusedThemeFonts() {
  return {
    name: "strip-unused-theme-fonts",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("reveal.js/dist/theme/")) return null;
      const stripped = code.replace(/@font-face\s*\{[^}]*\}/g, "");
      return stripped === code ? null : { code: stripped, map: null };
    },
  };
}

export default defineConfig({
  // Relative base so the build works from a subpath or the file system
  base: "./",
  plugins: [htmlPartials(), stripUnusedThemeFonts()],
  server: {
    open: true,
  },
  build: {
    outDir: "dist",
    // Bundle is large on purpose
    chunkSizeWarningLimit: 1500,
  },
});
