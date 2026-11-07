import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import betterTailwind from "eslint-plugin-better-tailwindcss";

// Dependency rules of docs/ARCHITECTURE.md §4.1: app → modules → platform → shared.
//
// Two rules on purpose:
// - import/no-restricted-paths resolves the import, so it sees `@/x` and `../x` alike. Its zones must be concrete paths: a glob (and any
//   path holding `[site]`, which counts as one) is matched with minimatch against backslashes on Windows and silently never applies.
// - no-restricted-imports only reads the import text, but its `files` globs work on any OS, so it covers what zones cannot target.

const root = import.meta.dirname;
const modulesDir = path.join(root, "modules");
const moduleNames = existsSync(modulesDir)
  ? readdirSync(modulesDir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  : [];

const legacyMessage = "El código nuevo no importa de app/, lib/ ni components/: pasa por platform/ (docs/CONVENTIONS.md §3).";
const legacy = ["./app", "./lib", "./components"];

const zonesOfModule = name => {
  const own = `./modules/${name}`;
  return [
    ...legacy.map(from => ({ target: own, from, message: legacyMessage })),
    { target: own, from: "./modules", except: [`./${name}`], message: "Un módulo no importa a otro módulo: lo común sube a platform/ o se compone en app/." },
    // domain/ stays pure: it is what the tests load without a bundler.
    ...["data", "api", "ui", "panel.tsx", "server.ts", "index.ts"].map(part => ({
      target: `${own}/domain`,
      from: `${own}/${part}`,
      message: "domain/ es puro: no importa data/, api/, ui/ ni las entradas del módulo.",
    })),
    { target: `${own}/domain`, from: "./platform", except: ["./money"], message: "domain/ solo importa platform/money de platform/." },
    { target: `${own}/domain`, from: "./shared", except: ["./lib"], message: "domain/ solo importa shared/lib de shared/." },
    // Routes reach a module only through its public entries: @/modules/<m>, /server, /panel and /ui.
    ...["domain", "data", "api"].map(part => ({
      target: "./app",
      from: `${own}/${part}`,
      message: "Fuera de un módulo se importa solo por sus entradas públicas: index, server, panel y ui.",
    })),
    // ui/public.ts is the entry of what a public site renders: it keeps the panel's code out of that bundle.
    { target: "./app", from: `${own}/ui`, except: ["./index.ts", "./public.ts"], message: "Fuera de un módulo se importa solo por sus entradas públicas: index, server, panel, ui y ui/public." },
  ];
};

const zones = [
  ...moduleNames.flatMap(zonesOfModule),
  { target: "./platform", from: "./modules", message: "platform/ no conoce a los módulos." },
  ...[...legacy, "./platform", "./modules"].map(from => ({ target: "./shared", from, message: "shared/ no importa nada de las capas de arriba." })),
];

// The existing code never imports a module. Listed by folder, not as all of app/: new routes under app/ do import modules. kinds.tsx and the
// summary page are the two existing files that exist to compose every kind of site, so they are the only ones allowed to.
const legacyFiles = [
  "lib/**",
  "components/**",
  "tests/**",
  "proxy.ts",
  "app/*.{ts,tsx}",
  "app/herboristeria/**",
  "app/recetas/**",
  "app/productos/**",
  "app/api/{catalog,images,session,usage}/**",
  "app/api/sites/*/{comments,metrics,products,recipes,settings}/**",
  "app/panel/*.{ts,tsx}",
  "app/panel/manifest.webmanifest/**",
  "app/panel/*/*.{ts,tsx}",
  "app/panel/*/{categorias,comentarios,hierbas,metricas,productos,recetas,sitio,tienda,tonicos}/**",
];

// Pure code runs in the tests under plain Node, which resolves neither `@/` nor packages left out of them, so it only uses relative imports.
const pureFiles = ["modules/*/domain/**", "platform/money/**", "shared/lib/**"];
const pureMessage = "El código puro no usa react, next ni otros paquetes, y los tests no resuelven @/: usá imports relativos con extensión .ts.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  { rules: { "import/no-restricted-paths": ["error", { basePath: root, zones }] } },
  {
    files: legacyFiles,
    ignores: ["app/panel/*/kinds.tsx", "app/panel/*/page.tsx"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ regex: "(^|/)modules(/|$)", message: "El código existente no importa de modules/ (docs/ARCHITECTURE.md §4.2)." }] }] },
  },
  // Tailwind silently ignores a misspelt class. Only for new code: in the legacy folders every class of their own CSS would count as unknown.
  {
    files: ["modules/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwind },
    settings: { "better-tailwindcss": { entryPoint: "app/globals.css" } },
    rules: { "better-tailwindcss/no-unknown-classes": "error" },
  },
  {
    files: pureFiles,
    rules: { "no-restricted-imports": ["error", { patterns: [{ regex: "^(?!\\.)", message: pureMessage }] }] },
  },
  {
    files: pureFiles.map(glob => `${glob}/*.test.ts`),
    rules: { "no-restricted-imports": ["error", { patterns: [{ regex: "^(?!\\.|node:test$|node:assert(/strict)?$)", message: pureMessage }] }] },
  },
]);

export default eslintConfig;
