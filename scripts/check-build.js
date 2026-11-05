/**
 * Verificación post-build: cada .ts de src/ debe tener su .js en app/.
 * Falla con la lista de ausentes (caza builds parciales).
 * Post-build check: every src/ .ts must have its .js in app/.
 * Fails listing the missing ones (catches partial builds).
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const APP = path.join(__dirname, "..", "app");

/**
 * Recoge rutas relativas con cierta extensión bajo un directorio.
 * Collects relative paths with an extension under a directory.
 */
function collect(dir, ext, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, ext, base, out);
    else if (entry.name.endsWith(ext)) out.push(path.relative(base, full));
  }
  return out;
}

const missing = [];
for (const rel of collect(SRC, ".ts")) {
  const js = rel.replace(/\.ts$/, ".js");
  if (!fs.existsSync(path.join(APP, js))) missing.push(js);
}
if (missing.length > 0) {
  console.error(`Faltan salidas en app/ / Missing outputs in app/: ${missing.join(", ")}`);
  process.exit(1);
}

/**
 * Comprueba el paquete estático de web/: portada, fallback SPA,
 * entrada JS y recursos.
 * Checks the web/ static bundle: cover, SPA fallback, JS entry, assets.
 */
const WEB = path.join(__dirname, "..", "web");
const bundle = ["index.html", "404.html", path.join("app", "index.js")];
for (const rel of bundle) {
  if (!fs.existsSync(path.join(WEB, rel))) missing.push(`web/${rel}`);
}
if (fs.existsSync(path.join(__dirname, "..", "assets")) && !fs.existsSync(path.join(WEB, "assets"))) {
  missing.push("web/assets");
}

const prohibidos = ["assets/datos/perfil.cifrado.json", "web/assets/datos/perfil.cifrado.json"];
const presentes = prohibidos.filter((rel) => fs.existsSync(path.join(__dirname, "..", rel)));
if (presentes.length > 0) {
  console.error(
    `Sobre estático prohibido / Static envelope must not be published: ${presentes.join(", ")}`,
  );
  process.exit(1);
}

if (missing.length > 0) {
  console.error(`Paquete web incompleto / Incomplete web bundle: ${missing.join(", ")}`);
  process.exit(1);
}
console.log("build ok: salidas completas / outputs complete");
