/**
 * Empaqueta la web estática lista para servir en web/:
 * index.html en la raíz (+ copia como 404.html para que el SPA
 * arranque también en rutas profundas), app/ tal cual y assets/.
 * Packages the ready-to-serve static site into web/:
 * root index.html (+ a copy as 404.html so the SPA also boots
 * on deep routes), app/ as-is and assets/.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "web");

/**
 * Limpia y asegura un directorio. / Cleans and ensures a directory.
 */
function limpiar(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

limpiar(WEB);
fs.copyFileSync(path.join(ROOT, "index.html"), path.join(WEB, "index.html"));
fs.copyFileSync(path.join(ROOT, "index.html"), path.join(WEB, "404.html"));
fs.cpSync(path.join(ROOT, "app"), path.join(WEB, "app"), { recursive: true });
if (fs.existsSync(path.join(ROOT, "assets"))) {
  fs.cpSync(path.join(ROOT, "assets"), path.join(WEB, "assets"), { recursive: true });
}
console.log("web ok: paquete estático listo / static bundle ready");
